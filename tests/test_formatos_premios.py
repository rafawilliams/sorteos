"""Prize formats: 2-digit (gordito/zodiaco 2º-3º, miercolito 1962-66), 4-digit, 5-digit (extraordinario)."""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module
from actualizar_db import fila_a_loteria
from loteria import Loteria, formato_premio, premio_en_formato
from ml_model import LotteryPredictor


class TestFormatoPremio:
    @pytest.mark.parametrize("cat,fecha,premio,valor,esperado", [
        ("gordito", "2019-05-31", "segundo", "98", 2),
        ("gordito", "2021-06-04", "tercero", "0", 2),
        ("Zodiaco ", "2023-12-01", "segundo", "01", 2),
        ("gordito", "2019-05-31", "primero", "7270", 4),
        ("miercolito", "1966-10-26", "primero", "10", 2),
        ("miercolito", date(1964, 1, 1), "tercero", "7", 2),
        ("miercolito", "2011-04-28", "segundo", "01", 4),   # lost zeros, 4-digit era
        ("dominical", "2020-03-08", "primero", "74", 4),
        ("extraordinario", "2019-08-18", "primero", "05309", 5),
        ("extraordinario", "2019-08-18", "primero", "5309", 4),
        ("gordito", "1992-03-06", "segundo", "", 0),
        ("gordito", "1992-03-06", "segundo", None, 0),
    ])
    def test_formato(self, cat, fecha, premio, valor, esperado):
        assert formato_premio(cat, fecha, premio, valor) == esperado

    @pytest.mark.parametrize("cat,fecha,premio,valor,esperado", [
        ("gordito", "2021-06-04", "tercero", "0", "00"),
        ("gordito", "2019-05-31", "segundo", " 98", "98"),
        ("dominical", "2020-03-08", "primero", "74", "0074"),
        ("extraordinario", "2019-08-18", "primero", "05309", "05309"),
        ("gordito", "1992-03-06", "segundo", None, ""),
    ])
    def test_en_formato(self, cat, fecha, premio, valor, esperado):
        assert premio_en_formato(cat, fecha, premio, valor) == esperado


def _row(cat, fecha, primero, segundo, tercero):
    r = Loteria(cat, fecha, primero, "", "", "", segundo, tercero)
    r.id = 1
    return r


GORDITO = {"id": "1", "fecha": "2019-05-31", "cat": "gordito", "primero": "7270", "segundo": "98", "tercero": "00"}
EXTRA = {"id": "2", "fecha": "2019-08-18", "cat": "extraordinario", "primero": "05309", "segundo": "98327", "tercero": "61748"}
DOMINICAL = {"id": "3", "fecha": "2019-08-11", "cat": "dominical", "primero": "0074", "segundo": "1234", "tercero": "5600"}
MIXTOS = [GORDITO, EXTRA, DOMINICAL]


class TestDataLayer:
    def test_row_to_dict_keeps_real_format(self):
        d = app_module._row_to_dict(_row("gordito", date(2019, 5, 31), "7270", "98", "0"))
        assert (d["primero"], d["segundo"], d["tercero"]) == ("7270", "98", "00")

    def test_fila_a_loteria_keeps_gordito_two_digits(self):
        r = fila_a_loteria({"cat": "gordito", "fecha": "2026-10-30", "primero": "123",
                            "segundo": "8", "tercero": "45"})
        assert (r.primero, r.segundo, r.tercero) == ("0123", "08", "45")


class TestFourDigitStatsOnlyUseFourDigits:
    def test_extract_numbers(self):
        assert app_module._extract_numbers(MIXTOS, prize="segundo") == ["1234"]
        assert app_module._extract_numbers(MIXTOS, prize="primero") == ["7270", "0074"]

    def test_trend_digits_ignore_other_formats(self):
        months = app_module.trend_data(MIXTOS)
        assert sum(sum(m["digits"].values()) for m in months) == 4 * 4  # 7270, 0074, 1234, 5600

    def test_gaps_numbers_are_four_digits(self, client):
        data = client.get("/api/gaps").get_json()
        assert data["total_sorteos"] == 3

    def test_ml_training_rows_are_four_digits(self):
        df = LotteryPredictor._build_df(LotteryPredictor.__new__(LotteryPredictor), MIXTOS)
        assert sorted(df["number"].tolist()) == [74, 1234, 5600, 7270]


class TestEndingsUseAllFormats:
    def test_endings(self):
        endings = sorted(e["ending"] for e in app_module._extract_endings(MIXTOS))
        assert endings == sorted(["70", "98", "00", "09", "27", "48", "74", "34", "00"])

    def test_decena_is_tens_digit(self):
        assert app_module._extract_decena("05309") == "0"
        assert app_module._extract_decena("7270") == "7"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(app_module, "get_sorteos", lambda: MIXTOS)
    monkeypatch.setattr(app_module, "_cache_get", lambda key: None)
    monkeypatch.setattr(app_module, "_cache_set", lambda key, data: None)
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


class TestEndpoints:
    def test_simulador_0098_does_not_match_gordito_98(self, client):
        data = client.get("/api/simulador?numero=0098").get_json()
        assert data["exact"]["total"] == 0
        assert data["ending"]["total"] == 1  # "98" ends in 98

    def test_simulador_0000_does_not_match_gordito_00(self, client):
        data = client.get("/api/simulador?numero=5600").get_json()
        assert data["exact"]["total"] == 1
        assert data["ending"]["total"] == 2  # 5600 and gordito "00"

    def test_comparar_5309_does_not_match_05309(self, client):
        n = client.get("/api/comparar?numeros=5309").get_json()["numbers"][0]
        assert n["total_exact"] == 0
        assert n["ending_matches"] == 1


class TestFormatosStats:
    def test_structure(self):
        f = app_module.formatos_stats(MIXTOS)
        assert f["2"]["total"] == 2 and f["5"]["total"] == 3
        assert f["2"]["by_category"] == {"gordito": 2}
        assert len(f["2"]["position_frequency"]) == 2
        assert len(f["5"]["position_frequency"]) == 5
        assert f["2"]["hot_cold"]["hot"][0]["count"] == 1
        assert {h["number"] for h in f["2"]["hot_cold"]["hot"]} == {"98", "00"}
