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
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

SORTEOS_ESPERADOS = 600
MAX_ELEMENTOS = 25
POCOS_SORTEOS = 150          # menos de 230 desde 1995: los backtests de estadísticas salen None
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


def generar(destino=DESTINO):
    import app as app_module
    from loteria import Loteria
    from base import Session

    def contar():
        sesion = Session()
        try:
            return sesion.query(Loteria).count()
        finally:
            sesion.close()

    exigir_base_sembrada(contar)
    app_module.app.config["TESTING"] = True
    sorteos = app_module.get_sorteos()
    escritos = []

    with app_module.app.test_client() as client:
        print("Generando fixtures en", os.path.abspath(destino))
        escritos.append(_guardar(destino, "sorteos", _pedir(client, "/api/sorteos?all=true")))

        # /api/stats entrena el modelo la primera vez (50-100 s) y congela recomendaciones de Seguimiento.
        escritos.append(_guardar(destino, "stats", _pedir(client, "/api/stats")))
        escritos.append(_guardar(destino, "seguimiento", _pedir(client, "/api/seguimiento")))
        escritos.append(_guardar(destino, "gaps", _pedir(client, "/api/gaps")))
        escritos.append(_guardar(destino, "backtesting", _pedir(client, "/api/backtesting?last_n=500")))

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

        # Seguimiento sin ningún registro: base en memoria, como en tests/test_seguimiento_api.py.
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from seguimiento import Prediccion

        motor = create_engine("sqlite://")
        Prediccion.__table__.create(motor)
        original = app_module.SeguimientoSession
        app_module.SeguimientoSession = sessionmaker(bind=motor)
        try:
            escritos.append(_guardar(destino, "seguimiento_vacio", _pedir(client, "/api/seguimiento")))
        finally:
            app_module.SeguimientoSession = original
            motor.dispose()

    app_module._cache.clear()
    return escritos


if __name__ == "__main__":
    archivos = generar()
    print(f"{len(archivos)} fixtures generados")
