"""Unit tests for the pure helpers of actualizar_db.py (no network, no DB writes)."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from actualizar_db import clave_sorteo, filtrar_nuevos, meses_a_consultar


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
        data = [{"fecha": "2026-10-26", "cat": "Dominical ", "primero": "4491"},
                {"fecha": "2026-10-28", "cat": "miercolito", "primero": "7533"}]
        existentes = {clave_sorteo("2026-10-26", "dominical", "4491")}
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
        with open(actualizar_db.__file__, encoding="utf-8") as f:
            src = f.read()
        assert "(2026," not in src and '"2026-' not in src

    def test_same_date_and_category_different_first_prize_both_kept(self):
        # Two real draws on one day: 2002-12-29 dominical (API ids 4276 and 4277).
        data = [{"fecha": "2002-12-29", "cat": "dominical", "primero": "4359"},
                {"fecha": "2002-12-29", "cat": "dominical", "primero": "1394"}]
        assert len(filtrar_nuevos(data, set(), self.HOY)) == 2

    def test_second_draw_of_the_day_not_blocked_by_first(self):
        data = [{"fecha": "2002-12-29", "cat": "dominical", "primero": "1394"}]
        existentes = {clave_sorteo("2002-12-29", "dominical", "4359")}
        assert len(filtrar_nuevos(data, existentes, self.HOY)) == 1

    def test_db_short_prize_matches_api_padded(self):
        # DB keeps "74" as published; the API may send "0074": same draw.
        data = [{"fecha": "2020-03-08", "cat": "dominical", "primero": "0074"}]
        existentes = {clave_sorteo("2020-03-08", "Dominical", "74")}
        assert filtrar_nuevos(data, existentes, self.HOY) == []


class TestClaveSorteo:
    def test_accepts_date_objects(self):
        assert clave_sorteo(date(2026, 10, 30), " Gordito", "5312") == ("2026-10-30", "gordito", "5312")

    def test_zodiaco_is_gordito(self):
        # DB stores the Dec-2023 draws as "zodiaco"; the API now returns them as "gordito".
        assert clave_sorteo("2023-12-01", "zodiaco", "4231") == clave_sorteo("2023-12-01", "gordito", "4231")
