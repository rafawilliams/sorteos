"""Contrato API ↔ front: la forma de cada endpoint coincide con su fixture (spec frontend-react, T009).

Cadena backend → fixture → tipo: si el servidor cambia la forma de una respuesta, esta prueba falla;
si un tipo de TypeScript cambia sin su fixture, falla `tsc` (T010).

Solo corre contra la base sembrada (600 sorteos, `tests/seed_db.py`, la del CI): llama a `/api/stats`,
que escribe recomendaciones en la tabla `predicciones`, y los fixtures salen de esa misma base. En local,
con otra base o sin base, se salta con el motivo; en CI no puede saltarse (ver test_contrato_front_ci.py).
Todo se pide con el mismo reloj congelado con el que se generaron los fixtures.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

import app as app_module
import gen_fixtures_front as gen
from contrato_front import diferencias, estado_base

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "frontend", "fixtures")

_ESTADO, _DATO = estado_base()           # nunca lanza: sin base, el módulo se salta en vez de romper la recolección

pytestmark = pytest.mark.skipif(
    _ESTADO != "sembrada",
    reason=f"El contrato con el front solo se comprueba contra la base sembrada (600 sorteos, tests/seed_db.py): "
           f"estado de la base = {_ESTADO} ({_DATO}). /api/stats escribe en `predicciones`.",
)


def _fixture(nombre):
    with open(os.path.join(FIXTURES, nombre + ".json"), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def client():
    app_module.app.config["TESTING"] = True
    limitador = app_module.limiter.enabled
    app_module.limiter.enabled = False           # las pruebas piden /api/stats y /api/backtesting varias veces
    app_module._cache.clear()
    with gen._reloj_fijo(), app_module.app.test_client() as c:
        yield c
    app_module.limiter.enabled = limitador
    app_module._cache.clear()


def _pedir(client, ruta):
    respuesta = client.get(ruta)
    assert respuesta.status_code == 200, f"{ruta} -> {respuesta.status_code}: {respuesta.get_data(as_text=True)[:200]}"
    return gen.recortar(respuesta.get_json())


@pytest.fixture(scope="module")
def stats_en_vivo(client):
    """Pide /api/stats primero: entrena el modelo y congela recomendaciones, de lo que dependen otros endpoints."""
    return _pedir(client, "/api/stats")


def _numeros():
    sorteos = app_module.get_sorteos()
    return [sorteos[0]["primero"], sorteos[1]["primero"]], gen._numero_no_sorteado(sorteos)


class TestEstructuraDeLaApi:
    def test_stats(self, stats_en_vivo):
        assert diferencias(_fixture("stats"), stats_en_vivo) == []

    def test_sorteos(self, client):
        assert diferencias(_fixture("sorteos"), _pedir(client, "/api/sorteos?all=true")) == []

    def test_gaps(self, client):
        assert diferencias(_fixture("gaps"), _pedir(client, "/api/gaps")) == []

    def test_backtesting(self, client, stats_en_vivo):
        # con el modelo ya entrenado por `stats_en_vivo`, `ml` viene con su forma completa
        assert diferencias(_fixture("backtesting"), _pedir(client, "/api/backtesting?last_n=500")) == []

    def test_seguimiento_con_registros_en_estricto(self, client, stats_en_vivo):
        """Seguimiento con pendientes y comparados, calculado como el generador: sin tolerar nada."""
        with gen._seguimiento_en_memoria(app_module):
            cuerpo = gen.recortar(gen._seguimiento_con_datos(app_module, client, app_module.get_sorteos()))
        assert diferencias(_fixture("seguimiento"), cuerpo) == []

    def test_seguimiento_leido_de_la_base(self, client, stats_en_vivo):
        # la base sembrada llega a 2019 y no registra nada: aquí solo se comprueba el cableado con la tabla
        # real y el nivel superior; la forma de los registros la cubre la prueba anterior, en estricto
        assert diferencias(_fixture("seguimiento"), _pedir(client, "/api/seguimiento"), tolerar_vacios=True) == []

    def test_comparar(self, client):
        con_dato, _ = _numeros()
        assert diferencias(_fixture("comparar"), _pedir(client, "/api/comparar?numeros=" + ",".join(con_dato))) == []

    def test_comparar_de_un_numero_que_nunca_salio(self, client):
        _, nunca = _numeros()
        assert diferencias(_fixture("comparar_sin_apariciones"), _pedir(client, f"/api/comparar?numeros={nunca}")) == []

    def test_simulador(self, client):
        con_dato, _ = _numeros()
        assert diferencias(_fixture("simulador"), _pedir(client, f"/api/simulador?numero={con_dato[0]}")) == []

    def test_simulador_de_un_numero_que_nunca_salio(self, client):
        _, nunca = _numeros()
        assert diferencias(_fixture("simulador_sin_aciertos"), _pedir(client, f"/api/simulador?numero={nunca}")) == []
