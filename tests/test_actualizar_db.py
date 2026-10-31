"""Unit tests for the pure helpers of actualizar_db.py (no network, no DB writes)."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from actualizar_db import filtrar_nuevos, meses_a_consultar


class TestMesesAConsultar:
    def test_same_month(self):
        assert meses_a_consultar(date(2026, 10, 3), date(2026, 10, 31)) == [(2026, 10)]

    def test_several_months(self):
        assert meses_a_consultar(date(2026, 8, 20), date(2026, 10, 1)) == [(2026, 8), (2026, 9), (2026, 10)]

    def test_crosses_year(self):
        assert meses_a_consultar(date(2025, 11, 30), date(2026, 2, 1)) == [(2025, 11), (2025, 12), (2026, 1), (2026, 2)]

    def test_desde_after_hasta_is_empty(self):
        assert meses_a_consultar(date(2026, 11, 1), date(2026, 10, 31)) == []


class TestFiltrarNuevos:
    HOY = date(2026, 10, 31)

    def test_skips_existing_case_insensitive(self):
        data = [{"fecha": "2026-10-26", "cat": "Dominical "}, {"fecha": "2026-10-28", "cat": "miercolito"}]
        existentes = {("2026-10-26", "dominical")}
        assert [f["fecha"] for f in filtrar_nuevos(data, existentes, self.HOY)] == ["2026-10-28"]

    def test_skips_future_and_missing_dates(self):
        data = [{"fecha": "2026-11-02", "cat": "dominical"}, {"fecha": "", "cat": "gordito"}, {"cat": "gordito"},
                {"fecha": "2026-10-31", "cat": "gordito"}]
        assert [f["fecha"] for f in filtrar_nuevos(data, set(), self.HOY)] == ["2026-10-31"]

    def test_dedupes_within_response(self):
        data = [{"fecha": "2026-10-30", "cat": "gordito"}, {"fecha": "2026-10-30", "cat": "GORDITO"}]
        assert len(filtrar_nuevos(data, set(), self.HOY)) == 1

    def test_same_date_different_category_both_kept(self):
        data = [{"fecha": "2026-10-30", "cat": "gordito"}, {"fecha": "2026-10-30", "cat": "extraordinario"}]
        assert len(filtrar_nuevos(data, set(), self.HOY)) == 2

    def test_no_hardcoded_months(self):
        import actualizar_db
        src = open(actualizar_db.__file__, encoding="utf-8").read()
        assert "(2026," not in src and '"2026-' not in src
