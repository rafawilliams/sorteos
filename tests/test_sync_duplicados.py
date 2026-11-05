"""Sync must not insert re-dated draws nor copies of another category (fix/sync-duplicados)."""
import os
import sys
from datetime import date
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import actualizar_db
from actualizar_db import descartar_sospechosos


def F(fecha, cat, p1, p2, p3):
    return {"fecha": fecha, "cat": cat, "primero": p1, "segundo": p2, "tercero": p3}


# Real cases seen in the API on 2026-11-05.
MIER_0930 = F("2026-09-30", "miercolito", "8674", "6643", "3271")
MIER_1001 = F("2026-10-01", "miercolito", "8674", "6643", "3271")      # same draw, re-dated
DOM_1011 = F("2026-10-11", "dominical", "1548", "7612", "5841")
MIER_1015 = F("2026-10-15", "miercolito", "1548", "7612", "5841")      # copy of the dominical


def fechas(filas):
    return [f["fecha"] for f in filas]


class TestFechaCorregida:
    def test_redated_against_stored_is_dropped(self):
        validos, descartados = descartar_sospechosos([MIER_1001], [MIER_0930])
        assert validos == []
        assert descartados[0][0] is MIER_1001 and descartados[0][1] == "fecha corregida"
        assert descartados[0][2] is MIER_0930

    def test_redated_inside_the_same_batch_keeps_the_oldest(self):
        validos, descartados = descartar_sospechosos([MIER_1001, MIER_0930], [])
        assert fechas(validos) == ["2026-09-30"]
        assert fechas(d[0] for d in descartados) == ["2026-10-01"]

    def test_category_alias_and_case(self):
        guardado = F("2026-10-02", "zodiaco", "0020", "76", "10")
        nuevo = F("2026-10-03", "Gordito ", "0020", "76", "10")
        assert descartar_sospechosos([nuevo], [guardado])[0] == []

    def test_unpadded_prizes_match(self):
        guardado = F("2026-10-04", "dominical", "0163", "0617", "9796")
        nuevo = F("2026-10-05", "dominical", "163", "617", "9796")
        assert descartar_sospechosos([nuevo], [guardado])[0] == []


class TestCopiaOtraCategoria:
    def test_copy_of_stored_draw_is_dropped(self):
        validos, descartados = descartar_sospechosos([MIER_1015], [DOM_1011])
        assert validos == [] and descartados[0][1] == "copia de otra categoría"

    def test_original_kept_even_if_listed_after_the_copy(self):
        validos, descartados = descartar_sospechosos([MIER_1015, DOM_1011], [])
        assert validos == [DOM_1011]
        assert [d[0] for d in descartados] == [MIER_1015]


class TestSinFalsosPositivos:
    def test_outside_the_window_is_kept(self):
        lejos = F("2026-10-08", "miercolito", "8674", "6643", "3271")     # 8 days after 09-30
        assert descartar_sospechosos([lejos], [MIER_0930])[0] == [lejos]

    def test_seven_days_is_inside_the_window(self):
        cerca = F("2026-10-07", "miercolito", "8674", "6643", "3271")
        assert descartar_sospechosos([cerca], [MIER_0930])[0] == []

    def test_empty_prizes_are_not_compared(self):
        guardado = F("1993-05-07", "gordito", "1234", "", "")
        nuevo = F("1993-05-08", "gordito", "1234", "", "")
        assert descartar_sospechosos([nuevo], [guardado])[0] == [nuevo]

    def test_same_first_prize_other_prizes_differ(self):
        nuevo = F("2026-10-01", "miercolito", "8674", "1111", "2222")
        assert descartar_sospechosos([nuevo], [MIER_0930])[0] == [nuevo]

    def test_two_real_draws_same_day(self):
        a = F("2002-12-29", "dominical", "4359", "1111", "2222")
        b = F("2002-12-29", "dominical", "7777", "3333", "4444")
        assert descartar_sospechosos([a, b], [])[0] == [a, b]

    def test_normal_week_untouched(self):
        semana = [F("2026-10-28", "miercolito", "7533", "2673", "2458"),
                  F("2026-10-30", "gordito", "5312", "62", "88"),
                  F("2026-11-01", "dominical", "0682", "4272", "5360")]
        validos, descartados = descartar_sospechosos(semana, [MIER_0930, DOM_1011])
        assert validos == semana and descartados == []

    def test_rows_without_date_pass_through(self):
        # filtrar_nuevos already drops them; this function must not crash on them.
        sin = F("", "dominical", "1", "2", "3")
        assert descartar_sospechosos([sin], [])[0] == [sin]


class FakeSession:
    def __init__(self, rows):
        self.rows, self.added = rows, []

    def query(self, *cols):
        return SimpleNamespace(all=lambda: self.rows)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


class TestActualizar:
    def test_sync_skips_suspicious_rows_and_warns(self, monkeypatch, capsys):
        guardados = [SimpleNamespace(fecha=date(2026, 9, 30), tipo="miercolito", primero="8674",
                                     segundo="6643", tercero="3271"),
                     SimpleNamespace(fecha=date(2026, 10, 11), tipo="dominical", primero="1548",
                                     segundo="7612", tercero="5841")]
        sesion = FakeSession(guardados)
        api = [MIER_1001, MIER_1015, F("2026-10-28", "miercolito", "7533", "2673", "2458")]
        monkeypatch.setattr(actualizar_db, "Session", lambda: sesion)
        monkeypatch.setattr(actualizar_db.Base.metadata, "create_all", lambda *a, **k: None)
        monkeypatch.setattr(actualizar_db, "get_token", lambda: {"token": "t"})
        monkeypatch.setattr(actualizar_db, "buscar_por_mes", lambda t, y, m: api if (y, m) == (2026, 10) else [])
        assert actualizar_db.actualizar(desde=date(2026, 10, 1)) == 1
        assert [s.primero for s in sesion.added] == ["7533"]
        out = capsys.readouterr().out
        assert "fecha corregida" in out and "copia de otra categoría" in out
