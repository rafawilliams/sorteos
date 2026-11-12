"""Prize data quality: zero-padding, and empty prizes never counted as "0000"."""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module
from actualizar_db import fila_a_loteria
from loteria import Loteria, normalizar_premio


class TestNormalizarPremio:
    @pytest.mark.parametrize("valor,esperado", [
        ("74", "0074"), (" 7 ", "0007"), ("1234", "1234"), ("0042", "0042"),
        ("", ""), (None, ""), ("   ", ""),
    ])
    def test_values(self, valor, esperado):
        assert normalizar_premio(valor) == esperado

    def test_int_input(self):
        assert normalizar_premio(74) == "0074"


def _loteria(primero="74", segundo="", tercero="5"):
    r = Loteria("dominical", date(1992, 3, 6), primero, "", "", "", segundo, tercero)
    r.id = 1
    return r


class TestDataLayer:
    def test_row_to_dict_pads_and_keeps_empty(self):
        d = app_module._row_to_dict(_loteria())
        assert (d["primero"], d["segundo"], d["tercero"]) == ("0074", "", "0005")

    def test_single_digit_prize_counts_as_ending(self):
        sorteos = [app_module._row_to_dict(_loteria(primero="7", segundo="1234", tercero="9999"))]
        endings = [e["ending"] for e in app_module._extract_endings(sorteos)]
        assert "07" in endings


class TestActualizarDb:
    def test_fila_a_loteria_pads(self):
        r = fila_a_loteria({"cat": "dominical", "fecha": "2026-10-25", "primero": "74",
                            "segundo": "3", "tercero": "", "letra": "ABCD", "folio": "1", "serie": "2"})
        assert (r.primero, r.segundo, r.tercero) == ("0074", "0003", "")
        assert (r.tipo, r.letras, r.folio, r.serie) == ("dominical", "ABCD", "1", "2")


SORTEOS_CON_VACIOS = [
    {"id": "1", "fecha": "1992-03-06", "cat": "gordito", "primero": "1234", "segundo": "", "tercero": ""},
    {"id": "2", "fecha": "1992-02-28", "cat": "gordito", "primero": "5678", "segundo": "", "tercero": ""},
]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(app_module, "get_sorteos", lambda: SORTEOS_CON_VACIOS)
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


class TestEmptyPrizesAreNotZero:
    def test_simulador_0000(self, client):
        data = client.get("/api/simulador?numero=0000").get_json()
        assert data["exact"]["total"] == 0
        assert data["ending"]["total"] == 0
        assert data["exact"]["gap_draws"] is None

    def test_comparar_0000(self, client):
        n = client.get("/api/comparar?numeros=0000").get_json()["numbers"][0]
        assert n["total_exact"] == 0
        assert n["ending_matches"] == 0

