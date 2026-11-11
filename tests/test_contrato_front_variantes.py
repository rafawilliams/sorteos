"""Las variantes con nulos de los fixtures difieren del principal solo en nulos y listas vacías (spec frontend-react, T009).

No necesita base de datos ni servidor: solo lee `frontend/fixtures/`.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from contrato_front import aplanar, diferencias

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "frontend", "fixtures")

PRINCIPALES = {
    "stats": ["stats_pocos_sorteos", "stats_con_backtests", "stats_formatos_reales"],
    "seguimiento": ["seguimiento_vacio"],
    "comparar": ["comparar_sin_apariciones"],
    "simulador": ["simulador_sin_aciertos"],
    "backtesting": ["backtesting_sin_modelo"],
}


def _fixture(nombre):
    with open(os.path.join(FIXTURES, nombre + ".json"), encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize("principal,variante", [(p, v) for p, vs in PRINCIPALES.items() for v in vs])
def test_la_variante_solo_difiere_en_nulos_y_listas_vacias(principal, variante):
    assert diferencias(_fixture(principal), _fixture(variante), tolerar_vacios=True) == []


def test_estan_todos_los_fixtures_esperados():
    esperados = {"sorteos", "stats", "seguimiento", "gaps", "backtesting", "comparar", "simulador"}
    esperados |= {v for vs in PRINCIPALES.values() for v in vs}
    presentes = {f[:-5] for f in os.listdir(FIXTURES) if f.endswith(".json")}
    assert esperados <= presentes, f"faltan fixtures: {sorted(esperados - presentes)}"


@pytest.mark.parametrize("ruta", ["decena_recomendada.*.backtest", "endings_by_category.*.backtest"])
def test_los_backtests_estan_cubiertos_con_valor_y_sin_valor(ruta):
    """Si todos los fixtures tuvieran el backtest nulo, el contrato nunca vería su forma real."""
    con_valor = aplanar(_fixture("stats_con_backtests"))[ruta]
    sin_valor = aplanar(_fixture("stats_pocos_sorteos"))[ruta]
    assert con_valor == {"dict"}, f"{ruta}: el fixture con backtests no trae un objeto ({con_valor})"
    assert sin_valor == {"null"}, f"{ruta}: el fixture sin backtests no trae nulo ({sin_valor})"


def test_el_fixture_de_seguimiento_trae_comparados_y_pendientes_con_datos():
    """Si estuvieran vacíos, la forma de sus elementos y los valores del marcador quedarían fuera del contrato."""
    seguimiento = _fixture("seguimiento")
    assert len(seguimiento["comparados"]) >= 1, "seguimiento.json sin comparados: revisa ULTIMOS_SIN_COMPARAR en el generador"
    assert len(seguimiento["pendientes"]) >= 1, "seguimiento.json sin pendientes"
    assert _fixture("seguimiento_vacio")["comparados"] == []


def test_el_fixture_de_backtesting_sin_modelo_trae_ml_vacio_y_el_principal_no():
    assert _fixture("backtesting_sin_modelo")["ml"] == {}
    assert len(_fixture("backtesting")["ml"]) > 0
