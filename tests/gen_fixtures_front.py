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
from datetime import date, timedelta
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

SORTEOS_ESPERADOS = 600
MAX_ELEMENTOS = 25
POCOS_SORTEOS = 150          # menos de 230 desde 1995: los backtests de estadísticas salen None
ULTIMOS_SIN_COMPARAR = 12    # sorteos que se «esconden» para que Seguimiento tenga registros por comparar
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
        json.dump(recortar(cuerpo), f, ensure_ascii=False, indent=1, sort_keys=True)
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
    así que se llevan las fechas al presente. Se calcula una primera vez sin los sorteos más nuevos (se
    congelan las recomendaciones) y otra con todos (esos sorteos ya existen y se comparan).
    """
    reciente = date.fromisoformat(sorteos[0]["fecha"])
    presentes = desplazar_fechas(sorteos, (date.today() - reciente).days - 3)
    with _seguimiento_en_memoria(app_module):
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

    with app_module.app.test_client() as client:
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
