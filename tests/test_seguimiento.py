"""Seguimiento: frozen recommendations compared with real draws (spec seguimiento-recomendaciones)."""
import os
import sys
from datetime import date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import seguimiento as sg
from seguimiento import Prediccion


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def S(id_, fecha, cat, p1, p2="", p3=""):
    return {"id": str(id_), "fecha": fecha, "cat": cat, "primero": p1, "segundo": p2, "tercero": p3}


def reco(ml_nums=None, est_nums=None, ml_ends=None, est_ends=None):
    est = {"numeros": est_nums or ["1111", "2222", "3333", "4444", "5555"],
           "terminaciones": est_ends or [f"{i:02d}" for i in range(10)]}
    ml = None if ml_nums is False else {
        "numeros": ml_nums or ["6666", "7777", "8888", "9999", "0000"],
        "terminaciones": ml_ends or [f"{i:02d}" for i in range(10, 20)]}
    return {"ml": ml, "estadistico": est}


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Prediccion.__table__.create(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


HOY = date(2026, 10, 31)
AHORA = datetime(2026, 10, 31, 12, 0)
BASE = [S(10, "2026-10-25", "dominical", "4491", "3810", "6580"),
        S(11, "2026-10-28", "miercolito", "7533", "2673", "2458"),
        S(12, "2026-10-30", "gordito", "5312", "62", "88")]


# ---------------------------------------------------------------------------
# T1 — pure functions
# ---------------------------------------------------------------------------

class TestMetricas:
    def test_digitos_en_posicion(self):
        assert sg.digitos_en_posicion("1234", "1294") == 3
        assert sg.digitos_en_posicion("1234", "62") == 0

    def test_comparar_third_prize_is_exact_hit(self):
        c = sg.comparar(["1111", "2458", "3333", "4444", "5555"], ["58", "99"],
                        S(1, "2026-10-28", "miercolito", "7533", "2673", "2458"))
        assert c["exactos"] == 1 and c["numeros_acertados"] == ["2458"]
        assert c["terminaciones_aciertos"] == 1 and c["alguna_terminacion"] is True

    def test_gordito_two_digit_prizes_only_count_for_endings(self):
        g = S(1, "2026-10-30", "gordito", "5312", "62", "88")
        c = sg.comparar(["0062", "5312", "1188", "4444", "5555"], ["62", "88", "12", "00"], g)
        assert c["exactos"] == 1                      # only 5312 (1st prize); 0062 ≠ "62"
        assert c["terminacion_numeros"] == 3          # 0062, 5312, 1188
        assert c["terminaciones_aciertos"] == 3       # 62, 88, 12
        # digits only against the 4-digit 1st prize: 5 numbers × 1 prize
        assert c["digitos_media"] == pytest.approx((1 + 4 + 0 + 0 + 1) / 5)

    def test_azar(self):
        a = sg.azar(S(1, "x", "miercolito", "7533", "2673", "2458"))
        assert a["exactos"] == pytest.approx(5 * 3 / 10000)
        assert a["digitos_media"] == 0.4
        assert a["terminaciones_aciertos"] == pytest.approx(10 * 3 / 100)
        assert a["alguna_terminacion"] == pytest.approx(1 - 0.9 ** 3, abs=0.01)

    def test_azar_without_four_digit_prizes(self):
        a = sg.azar(S(1, "x", "extraordinario", "05309", "98327", "61748"))
        assert a["exactos"] == 0 and a["digitos_media"] is None


class TestPesoMl:
    def test_fewer_than_10_is_half(self):
        assert sg.peso_ml([{"ml": 0.9, "estadistico": 0.1}] * 9) == 0.5

    def test_proportional(self):
        assert sg.peso_ml([{"ml": 0.45, "estadistico": 0.40}] * 20) == pytest.approx(0.45 / 0.85)

    def test_only_last_20_count(self):
        hist = [{"ml": 0.45, "estadistico": 0.40}] * 20 + [{"ml": 0.0, "estadistico": 1.0}] * 30
        assert sg.peso_ml(hist) == pytest.approx(0.45 / 0.85)

    def test_rows_without_digits_are_skipped(self):
        hist = [{"ml": None, "estadistico": None}] * 5 + [{"ml": 0.5, "estadistico": 0.5}] * 10
        assert sg.peso_ml(hist) == 0.5


class TestCombinar:
    def test_weight_zero_is_statistical(self):
        assert sg.combinar(["a", "b"], ["c", "d"], 0.0, 2) == ["c", "d"]

    def test_weighted_rank_merge(self):
        # ml 0.7: a=0.7*1, c=0.3*1, b=0.7*0.5, d=0.3*0.5
        assert sg.combinar(["a", "b"], ["c", "d"], 0.7, 4) == ["a", "b", "c", "d"]

    def test_shared_candidate_rises(self):
        assert sg.combinar(["a", "x"], ["x", "b"], 0.5, 1) == ["x"]


# ---------------------------------------------------------------------------
# T2 — register / freeze
# ---------------------------------------------------------------------------

class TestRegistrar:
    def test_registers_three_methods_per_category(self, session):
        hechos = sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        assert hechos == ["dominical"]
        rows = session.query(Prediccion).all()
        assert sorted(r.metodo for r in rows) == ["combinada", "estadistico", "ml"]
        r = rows[0]
        assert r.ultima_fecha == date(2026, 10, 25) and r.ultimo_id == 12
        assert len(r.lista_numeros()) == 5 and len(r.lista_terminaciones()) == 10

    def test_frozen_until_target_draw_arrives(self, session):
        sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        again = sg.registrar(session, BASE, {"dominical": reco(est_nums=["9" * 4] * 5)}, hoy=HOY, ahora=AHORA)
        assert again == []
        est = session.query(Prediccion).filter_by(metodo="estadistico").one()
        assert est.lista_numeros()[0] == "1111"

    def test_new_record_after_target_arrives(self, session):
        sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        nuevos = BASE + [S(13, "2026-11-01", "dominical", "1111", "2222", "3333")]
        assert sg.registrar(session, nuevos, {"dominical": reco()}, hoy=date(2026, 11, 2), ahora=AHORA) == ["dominical"]
        assert session.query(Prediccion).filter_by(metodo="ml").count() == 2

    def test_without_ml_combined_equals_statistical(self, session):
        sg.registrar(session, BASE, {"dominical": reco(ml_nums=False)}, hoy=HOY, ahora=AHORA)
        rows = {r.metodo: r for r in session.query(Prediccion).all()}
        assert set(rows) == {"estadistico", "combinada"}
        assert rows["combinada"].lista_numeros() == rows["estadistico"].lista_numeros()
        assert rows["combinada"].peso_ml == 0.0

    def test_skips_categories_without_recent_draws(self, session):
        old = BASE + [S(5, "2020-01-01", "extraordinaria", "1234")]
        assert sg.registrar(session, old, {"extraordinaria": reco()}, hoy=HOY, ahora=AHORA) == []


class TestObjetivo:
    def test_second_same_day_draw_is_the_target(self, session):
        sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        r = session.query(Prediccion).filter_by(metodo="ml").one()
        cat = [s for s in BASE if s["cat"] == "dominical"] + [S(14, "2026-10-25", "dominical", "9999")]
        assert sg.objetivo(r, cat)["id"] == "14"

    def test_old_ids_are_never_targets(self, session):
        sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        r = session.query(Prediccion).filter_by(metodo="ml").one()
        assert sg.objetivo(r, [s for s in BASE if s["cat"] == "dominical"]) is None


# ---------------------------------------------------------------------------
# T3 — summary
# ---------------------------------------------------------------------------

class TestResumen:
    def test_pending_then_compared(self, session):
        sg.registrar(session, BASE, {"dominical": reco(), "gordito": reco()}, hoy=HOY, ahora=AHORA)
        r = sg.resumen(session, BASE)
        assert {p["categoria"] for p in r["pendientes"]} == {"dominical", "gordito"}
        assert r["comparados"] == [] and r["peso_ml"] == 0.5

        nuevos = BASE + [S(13, "2026-11-01", "dominical", "1111", "8888", "4502")]
        r = sg.resumen(session, nuevos)
        assert [p["categoria"] for p in r["pendientes"]] == ["gordito"]
        c = r["comparados"][0]
        assert c["sorteo"]["fecha"] == "2026-11-01"
        assert c["metodos"]["estadistico"]["exactos"] == 1      # 1111
        assert c["metodos"]["ml"]["exactos"] == 1               # 8888
        assert c["azar"]["exactos"] == pytest.approx(15 / 10000)
        m = r["marcador"]["estadistico"]
        assert m["sorteos"] == 1 and m["exactos"] == 1
        assert m["exactos_azar"] == pytest.approx(15 / 10000)
        assert m["digitos_media_azar"] == 0.4

    def test_draw_without_record(self, session):
        sg.registrar(session, BASE, {"dominical": reco()}, hoy=HOY, ahora=AHORA)
        nuevos = BASE + [S(13, "2026-11-01", "dominical", "1111"), S(14, "2026-11-08", "dominical", "2222")]
        r = sg.resumen(session, nuevos)
        assert [c["sorteo"]["id"] for c in r["comparados"]] == ["13"]
        assert [s["id"] for s in r["sin_registro"]] == ["14"]
        assert r["marcador"]["ml"]["sorteos"] == 1

    def test_empty(self, session):
        r = sg.resumen(session, BASE)
        assert r["comparados"] == [] and r["pendientes"] == [] and r["sin_registro"] == []
        assert r["peso_ml"] == 0.5
