"""Genera los fixtures de `frontend/fixtures/` con respuestas reales de la API.

Spec frontend-react (T008). Cada fixture es lo que devuelve el servidor de verdad, recortado a pocos
elementos por lista para que pesen poco. Las variantes con nulos (sin backtest, formatos reales de
premios, sin seguimiento, sin aciertos) se obtienen llamando al mismo código con otros datos, no
escribiendo JSON a mano.

Uso, contra la base sembrada (600 sorteos) y NUNCA contra la real:

    DATABASE_URL=<url de la base sorteos_capturas> python tests/gen_fixtures_front.py

Se niega a correr si la base no tiene exactamente 600 sorteos (los de `tests/seed_db.py`): la
generación llama a `/api/stats`, que escribe recomendaciones en la tabla `predicciones`.
"""
import copy
import json
import os
import sys
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

SORTEOS_ESPERADOS = 600
MAX_ELEMENTOS = 25
POCOS_SORTEOS = 150          # menos de 230 desde 1995: los backtests de estadísticas salen None
ULTIMOS_SIN_COMPARAR = 12    # sorteos que se «esconden» para que Seguimiento tenga registros por comparar
HOY_FIJO = date(2026, 1, 15)             # reloj de referencia: los fixtures no deben cambiar según el día
AHORA_FIJO = datetime(2026, 1, 15, 12, 0)
DESTINO = os.path.join(os.path.dirname(__file__), "..", "frontend", "fixtures")


# ---------------------------------------------------------------------------
# Funciones puras (probadas en tests/test_gen_fixtures_front.py)
# ---------------------------------------------------------------------------

def recortar(valor, n=MAX_ELEMENTOS):
    """Copia de `valor` con cada lista, a cualquier profundidad, limitada a `n` elementos."""
    if isinstance(valor, dict):
        return {k: recortar(v, n) for k, v in valor.items()}
    if isinstance(valor, list):
        return [recortar(v, n) for v in valor[:n]]
    return valor


def exigir_base_sembrada(contar):
    """Aborta si la base no es la sembrada: contar() devuelve el número de sorteos que tiene."""
    total = contar()
    if total != SORTEOS_ESPERADOS:
        raise SystemExit(
            f"La base tiene {total} sorteos y se esperaban {SORTEOS_ESPERADOS} (la base sembrada con "
            "tests/seed_db.py). Parece que no es la base de capturas: no se genera nada."
        )


def ultimos(sorteos, n):
    """Los `n` sorteos más recientes (`get_sorteos()` los devuelve del más nuevo al más viejo)."""
    return list(sorteos[:n])


def duplicar_hacia_atras(sorteos, anios=7):
    """Los mismos sorteos seguidos de una copia `anios` años más vieja (ids nuevos, mismos premios).

    Sirve para que el código real calcule con más de 230 sorteos por categoría y devuelva los
    backtests con valores, algo que la base sembrada (600 sorteos) no alcanza.
    """
    desplazamiento = 100_000
    copias = []
    for s in sorteos:
        copia = dict(s)
        copia["id"] = str(int(s["id"]) + desplazamiento)
        fecha = date.fromisoformat(s["fecha"])
        try:
            copia["fecha"] = fecha.replace(year=fecha.year - anios).isoformat()
        except ValueError:                          # 29 de febrero
            copia["fecha"] = fecha.replace(year=fecha.year - anios, day=28).isoformat()
        copias.append(copia)
    return list(sorteos) + copias


def desplazar_fechas(sorteos, dias):
    """Copia con todas las fechas movidas `dias` días (negativos hacia atrás)."""
    resultado = copy.deepcopy(sorteos)
    for s in resultado:
        s["fecha"] = (date.fromisoformat(s["fecha"]) + timedelta(days=dias)).isoformat()
    return resultado


def llevar_al_presente(sorteos):
    """Copia con las fechas movidas para que el sorteo más nuevo caiga 3 días antes de `HOY_FIJO`.

    Seguimiento solo congela categorías con un sorteo del último año; la base sembrada llega a 2019.
    Se usa un «hoy» constante, no el del sistema, para que regenerar otro día dé los mismos fixtures.
    """
    reciente = max(date.fromisoformat(s["fecha"]) for s in sorteos)     # no se asume el orden de la lista
    return desplazar_fechas(sorteos, (HOY_FIJO - reciente).days - 3)


class _FechaFija(date):
    """`date` cuyo `today()` devuelve siempre `HOY_FIJO`; el resto se comporta como `date`."""

    @classmethod
    def today(cls):
        return HOY_FIJO


@contextmanager
def _reloj_fijo():
    """Congela el reloj de la aplicación: `HOY_FIJO` y `AHORA_FIJO` en lugar de la fecha del sistema.

    Dos sitios dependen del día: `seguimiento.registrar` (fecha y hora del registro; el endpoint no se las
    pasa) y `estadisticas.monthly_recommendation` (mes objetivo, vía `_dt.date.today()`). Se restauran siempre.
    """
    import datetime as modulo_datetime

    import estadisticas
    import seguimiento

    registrar_original, dt_original = seguimiento.registrar, estadisticas._dt

    def con_reloj(session, sorteos, recos, hoy=None, ahora=None):
        return registrar_original(session, sorteos, recos, hoy=HOY_FIJO, ahora=AHORA_FIJO)

    seguimiento.registrar = con_reloj
    estadisticas._dt = _modulo_con_fecha_fija(modulo_datetime)
    try:
        yield
    finally:
        seguimiento.registrar = registrar_original
        estadisticas._dt = dt_original


def _modulo_con_fecha_fija(modulo_datetime):
    publicos = {k: v for k, v in vars(modulo_datetime).items() if not k.startswith("__")}
    publicos["date"] = _FechaFija
    return SimpleNamespace(**publicos)


def fijar_valores_volatiles(cuerpo):
    """Copia con los valores que cambian con la ejecución (no con la forma) fijados al reloj de referencia."""
    resultado = copy.deepcopy(cuerpo)
    ml_info = resultado.get("ml_info") if isinstance(resultado, dict) else None
    # Solo si es un texto: si el backend cambiara el tipo del campo, el fixture debe seguir mostrándolo.
    if isinstance(ml_info, dict) and isinstance(ml_info.get("train_date"), str):
        ml_info["train_date"] = AHORA_FIJO.strftime("%Y-%m-%d %H:%M")
    return resultado


def con_numeros_repetidos(sorteos):
    """Copia donde un número sale 10 veces entre los sorteos recientes y otro 10 veces entre los antiguos.

    La base sembrada casi no repite números de 4 cifras, así que `/api/gaps` devuelve `overdue_numbers` y
    `ontime_numbers` vacíos. Con esto salen con elementos: el reciente (`1111`) «a tiempo» y el lejano
    (`2222`, último en el sorteo 300) «vencido».
    """
    resultado = copy.deepcopy(sorteos)
    for i in range(0, 40, 4):
        resultado[i]["primero"] = "1111"
    for i in range(300, 340, 4):
        resultado[i]["primero"] = "2222"
    return resultado


def a_formatos_reales(sorteos):
    """Copia con los formatos de premio de los datos reales.

    Extraordinario: premios de 5 cifras. Gordito: segundo y tercero de 2 cifras.
    """
    resultado = copy.deepcopy(sorteos)
    for s in resultado:
        if s["cat"] == "extraordinario":
            for clave in ("primero", "segundo", "tercero"):
                s[clave] = "0" + s[clave]
        elif s["cat"] == "gordito":
            for clave in ("segundo", "tercero"):
                s[clave] = s[clave][-2:]
    return resultado


# ---------------------------------------------------------------------------
# Generación (necesita la aplicación y la base sembrada)
# ---------------------------------------------------------------------------

def _guardar(destino, nombre, cuerpo):
    os.makedirs(destino, exist_ok=True)
    ruta = os.path.join(destino, nombre + ".json")
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        json.dump(recortar(fijar_valores_volatiles(cuerpo)), f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"  {nombre}.json")
    return ruta


@contextmanager
def _con_sorteos(app_module, sorteos):
    """Sustituye `get_sorteos()` y vacía la caché para calcular con otros datos."""
    original = app_module.get_sorteos
    app_module.get_sorteos = lambda: sorteos
    app_module._cache.clear()
    try:
        yield
    finally:
        app_module.get_sorteos = original
        app_module._cache.clear()


def _pedir(client, ruta):
    respuesta = client.get(ruta)
    if respuesta.status_code != 200:
        raise SystemExit(f"{ruta} devolvió {respuesta.status_code}: {respuesta.get_data(as_text=True)[:200]}")
    return respuesta.get_json()


def _numero_no_sorteado(sorteos):
    usados = {s[k] for s in sorteos for k in ("primero", "segundo", "tercero")}
    return next(f"{i:04d}" for i in range(10000) if f"{i:04d}" not in usados)


def _base_en_memoria():
    """Base SQLite vacía con la tabla `predicciones`, como en tests/test_seguimiento_api.py."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from seguimiento import Prediccion

    motor = create_engine("sqlite://")
    Prediccion.__table__.create(motor)
    return motor, sessionmaker(bind=motor)


@contextmanager
def _seguimiento_en_memoria(app_module):
    motor, fabrica = _base_en_memoria()
    original = app_module.SeguimientoSession
    app_module.SeguimientoSession = fabrica
    try:
        yield
    finally:
        app_module.SeguimientoSession = original
        motor.dispose()


def _seguimiento_con_datos(app_module, client, sorteos):
    """/api/seguimiento con registros pendientes y ya comparados.

    La base sembrada llega hasta 2019 y Seguimiento solo congela categorías con un sorteo en el último año,
    así que se llevan las fechas a un «hoy» fijo (`llevar_al_presente`). Se calcula una primera vez sin los sorteos más nuevos (se
    congelan las recomendaciones) y otra con todos (esos sorteos ya existen y se comparan).
    """
    presentes = llevar_al_presente(sorteos)
    with _reloj_fijo(), _seguimiento_en_memoria(app_module):
        with _con_sorteos(app_module, presentes[ULTIMOS_SIN_COMPARAR:]):
            _pedir(client, "/api/stats")
        with _con_sorteos(app_module, presentes):
            _pedir(client, "/api/stats")
            return _pedir(client, "/api/seguimiento")


def generar(destino=DESTINO, contar=None):
    if contar is None:
        from base import Session
        from loteria import Loteria

        def contar():
            sesion = Session()
            try:
                return sesion.query(Loteria).count()
            finally:
                sesion.close()

    exigir_base_sembrada(contar)             # antes de importar la aplicación o escribir nada

    import app as app_module

    app_module.app.config["TESTING"] = True
    sorteos = app_module.get_sorteos()
    escritos = []

    # Todo con el reloj congelado y Seguimiento en memoria: nada depende del día ni toca la tabla real.
    with app_module.app.test_client() as client, _reloj_fijo(), _seguimiento_en_memoria(app_module):
        print("Generando fixtures en", os.path.abspath(destino))
        escritos.append(_guardar(destino, "sorteos", _pedir(client, "/api/sorteos?all=true")))

        # /api/stats entrena el modelo la primera vez (50-100 s) y congela recomendaciones de Seguimiento.
        escritos.append(_guardar(destino, "stats", _pedir(client, "/api/stats")))
        escritos.append(_guardar(destino, "gaps", _pedir(client, "/api/gaps")))
        escritos.append(_guardar(destino, "backtesting", _pedir(client, "/api/backtesting?last_n=500")))

        # Sin modelo entrenado la API devuelve `ml: {}`: otra forma de la misma respuesta.
        entrenado = app_module.predictor
        app_module.predictor = SimpleNamespace(trained=False)
        app_module._cache.clear()
        try:
            escritos.append(_guardar(destino, "backtesting_sin_modelo", _pedir(client, "/api/backtesting?last_n=500")))
        finally:
            app_module.predictor = entrenado
            app_module._cache.clear()

        con_dato = [sorteos[0]["primero"], sorteos[1]["primero"]]
        escritos.append(_guardar(destino, "comparar", _pedir(client, "/api/comparar?numeros=" + ",".join(con_dato))))
        escritos.append(_guardar(destino, "simulador", _pedir(client, f"/api/simulador?numero={con_dato[0]}")))

        nunca = _numero_no_sorteado(sorteos)
        escritos.append(_guardar(destino, "comparar_sin_apariciones", _pedir(client, f"/api/comparar?numeros={nunca}")))
        escritos.append(_guardar(destino, "simulador_sin_aciertos", _pedir(client, f"/api/simulador?numero={nunca}")))

        with _con_sorteos(app_module, con_numeros_repetidos(sorteos)):
            escritos.append(_guardar(destino, "gaps_con_numeros", _pedir(client, "/api/gaps")))

        with _con_sorteos(app_module, ultimos(sorteos, POCOS_SORTEOS)):
            escritos.append(_guardar(destino, "stats_pocos_sorteos", _pedir(client, "/api/stats")))

        with _con_sorteos(app_module, duplicar_hacia_atras(sorteos)):
            escritos.append(_guardar(destino, "stats_con_backtests", _pedir(client, "/api/stats")))

        with _con_sorteos(app_module, a_formatos_reales(sorteos)):
            escritos.append(_guardar(destino, "stats_formatos_reales", _pedir(client, "/api/stats")))

        escritos.append(_guardar(destino, "seguimiento", _seguimiento_con_datos(app_module, client, sorteos)))
        with _seguimiento_en_memoria(app_module):
            escritos.append(_guardar(destino, "seguimiento_vacio", _pedir(client, "/api/seguimiento")))

    app_module._cache.clear()
    return escritos


if __name__ == "__main__":
    archivos = generar()
    print(f"{len(archivos)} fixtures generados")
