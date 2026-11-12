"""Tests for the pure statistical domain module `estadisticas.py` and its integration with `app.py`."""

import ast
from pathlib import Path

import estadisticas
import app as app_module

ROOT = Path(__file__).resolve().parent.parent

SAMPLE_DRAWS = [
    {"id": "6", "fecha": "2026-10-30", "cat": "gordito", "primero": "4215", "segundo": "15", "tercero": "88", "letra": "ABCD", "serie": "1", "folio": "2"},
    {"id": "5", "fecha": "2026-10-25", "cat": "dominical", "primero": "4215", "segundo": "1234", "tercero": "9915", "letra": "BCDA", "serie": "1", "folio": "3"},
    {"id": "4", "fecha": "2026-10-18", "cat": "dominical", "primero": "7788", "segundo": "4215", "tercero": "0015", "letra": "ABCD", "serie": "2", "folio": "2"},
    {"id": "3", "fecha": "2026-09-20", "cat": "miercolito", "primero": "4215", "segundo": "5678", "tercero": "9012", "letra": "DCBA", "serie": "3", "folio": "4"},
    {"id": "2", "fecha": "2026-09-13", "cat": "dominical", "primero": "1111", "segundo": "2222", "tercero": "4215", "letra": "ABCD", "serie": "1", "folio": "2"},
    {"id": "1", "fecha": "2026-09-06", "cat": "dominical", "primero": "4215", "segundo": "3333", "tercero": "4444", "letra": "ABCD", "serie": "1", "folio": "2"},
]


class TestAislamientoModulo:
    def test_no_flask_or_sqlalchemy_imports(self):
        src = (ROOT / "estadisticas.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        assert "flask" not in imported
        assert "flask_limiter" not in imported
        assert "sqlalchemy" not in imported
        assert "base" not in imported

    def test_app_py_is_slim_and_reexports_domain_functions(self):
        lines = (ROOT / "app.py").read_text(encoding="utf-8").splitlines()
        assert len(lines) < 450
        for name in (
            "RECO_DATE_FROM",
            "CAT_LABELS",
            "_filter_recent",
            "_extract_decena",
            "_es_4_cifras",
            "_extract_numbers",
            "_extract_endings",
            "digit_frequency",
            "position_frequency",
            "last_digit_pairs",
            "hot_cold",
            "number_recommendation",
            "decena_recommendation",
            "endings_frequency",
            "endings_by_prize",
            "endings_hot_cold",
            "endings_recommendation",
            "endings_trend",
            "endings_stats",
            "series_folio_stats",
            "letra_stats",
            "_prize_stats",
            "formatos_stats",
            "monthly_recommendation",
            "trend_data",
            "calcular_gaps",
            "comparar_numeros",
            "simular_numero",
            "statistical_backtest",
        ):
            assert getattr(app_module, name) is getattr(estadisticas, name), f"{name} not re-exported"


class TestFuncionesDominio:
    def test_calcular_gaps(self):
        res = estadisticas.calcular_gaps(SAMPLE_DRAWS)
        assert res["total_sorteos"] == len(SAMPLE_DRAWS)
        assert "overdue_numbers" in res and "ontime_numbers" in res
        assert "overdue_endings" in res and "ontime_endings" in res
        # "4215" appeared 6 times (count >= 5), most recently at index 0 -> ontime (gap 0, ratio 0)
        ontime_nums = [g["number"] for g in res["ontime_numbers"]]
        assert "4215" in ontime_nums

    def test_comparar_numeros(self):
        res = estadisticas.comparar_numeros(SAMPLE_DRAWS, ["4215", "7788"])
        assert res["total_sorteos"] == len(SAMPLE_DRAWS)
        by_num = {r["number"]: r for r in res["numbers"]}
        assert by_num["4215"]["total_exact"] == 6
        assert by_num["4215"]["exact"] == {"primero": 4, "segundo": 1, "tercero": 1}
        assert by_num["4215"]["gap"] == 0
        assert by_num["7788"]["total_exact"] == 1
        assert by_num["7788"]["gap"] == 2

    def test_simular_numero_and_filters(self):
        res = estadisticas.simular_numero(SAMPLE_DRAWS, "4215")
        assert res["numero"] == "4215"
        assert res["terminacion"] == "15"
        assert res["exact"]["total"] == 6
        assert res["exact"]["primero"] == 4
        assert res["exact"]["segundo"] == 1
        assert res["exact"]["tercero"] == 1
        assert res["exact"]["gap_draws"] == 0

        res_dom = estadisticas.simular_numero(SAMPLE_DRAWS, "4215", cat="dominical")
        assert res_dom["total_sorteos"] == 4
        assert res_dom["exact"]["total"] == 4

    def test_construir_stats(self):
        recent = estadisticas._filter_recent(SAMPLE_DRAWS)
        res = estadisticas.construir_stats(SAMPLE_DRAWS, recent, {}, {"trained": False}, "2026-10-30")
        assert res["total_sorteos"] == len(SAMPLE_DRAWS)
        assert res["last_update"] == "2026-10-30"
        assert "dominical" in res["by_category"]
        assert "2" in res["formatos"] and "5" in res["formatos"]


class TestRecosTresPremios:
    """Per-category recommendations use the 1st, 2nd and 3rd 4-digit prizes (feat/recos-tres-premios)."""

    def test_extract_numbers_all_prizes_newest_first(self):
        nums = estadisticas._extract_numbers(SAMPLE_DRAWS, "dominical", prize=None)
        assert nums[:3] == ["4215", "1234", "9915"]        # newest draw first, prizes in order
        assert len(nums) == 12                              # 4 dominical draws × 3 prizes

    def test_two_digit_prizes_are_skipped(self):
        assert estadisticas._extract_numbers(SAMPLE_DRAWS, "gordito", prize=None) == ["4215"]

    def test_construir_stats_by_category_uses_three_prizes(self, monkeypatch):
        vistos = []
        real = estadisticas.number_recommendation
        monkeypatch.setattr(estadisticas, "number_recommendation",
                            lambda nums, top=5: vistos.append(list(nums)) or real(nums, top))
        recent = estadisticas._filter_recent(SAMPLE_DRAWS)
        estadisticas.construir_stats(SAMPLE_DRAWS, recent, {}, {"trained": False}, "2026-10-30")
        assert estadisticas._extract_numbers(recent, "dominical", prize=None) in vistos
        assert estadisticas._extract_numbers(recent, "miercolito", prize=None) in vistos
