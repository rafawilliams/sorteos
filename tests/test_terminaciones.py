"""Endings: honest confidence, per category and with a visible backtest (feat/terminaciones-honestas)."""
import os
import sys
from math import comb

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import estadisticas as E
from ml_model import LotteryPredictor


def S(id_, fecha, cat, p1, p2="", p3=""):
    return {"id": str(id_), "fecha": fecha, "cat": cat, "primero": p1, "segundo": p2, "tercero": p3}


def ends(lista):
    return [{"ending": e, "prize": "primero", "fecha": ""} for e in lista]


class TestConfianzaEstadistica:
    def test_uniform_endings_are_chance(self):
        mitad = [f"{i:02d}" for i in range(100)]
        r = E.endings_recommendation(ends(mitad + mitad[::-1]))      # mirrored: equal weights
        assert r[0]["lift"] == pytest.approx(1.0)
        assert r[0]["confidence"] == pytest.approx(1.0)              # not 99.9

    def test_lift_is_share_of_weight_times_100(self):
        r = E.endings_recommendation(ends(["07", "07", "08", "09"]))
        # weights 2, 1.75 (07) · 1.5 (08) · 1.25 (09) → 07 has 3.75 / 6.5 of the weight
        assert r[0]["ending"] == "07"
        assert r[0]["lift"] == pytest.approx(3.75 / 6.5 * 100, abs=0.01)
        assert r[0]["confidence"] == 15.0                             # capped like numbers

    def test_ranking_unchanged(self):
        r = E.endings_recommendation(ends(["11", "22", "22", "33", "33", "33"]))
        assert [x["ending"] for x in r] == ["33", "22", "11"]


class TestConfianzaML:
    def test_ml_endings_confidence_is_prob_times_100(self):
        uniforme = [np.full(10, 0.1) for _ in range(4)]
        pred = LotteryPredictor.__new__(LotteryPredictor)
        r = pred.predict_endings_from_probs(uniforme, top=3)
        assert r[0]["confidence"] == pytest.approx(1.0)              # was 10.0 ("10 %")
        assert r[0]["lift"] == pytest.approx(1.0)


class TestBacktest:
    def _draws(self, n, cat="dominical"):
        # newest first; every draw ends in 12 / 34 / 56
        return [S(n - i, f"2026-{1 + i % 12:02d}-01", cat, f"10{12}", f"20{34}", f"30{56}") for i in range(n)]

    def test_repeating_endings_always_hit(self):
        bt = E.endings_backtest(self._draws(80), "dominical", last_n=20)
        assert bt["sorteos"] == 20
        assert bt["aciertos"] == 60                      # 3 endings × 20 draws, all in the top-10
        assert bt["alguna_pct"] == 100.0
        assert bt["aciertos_azar"] == pytest.approx(20 * 10 * 3 / 100)
        assert bt["alguna_pct_azar"] == pytest.approx(100 * (1 - comb(97, 10) / comb(100, 10)), abs=0.05)

    def test_target_draw_is_not_used_to_recommend(self):
        draws = self._draws(80)
        draws[0] = S(999, "2026-12-31", "dominical", "1099", "2098", "3097")   # brand-new endings
        bt = E.endings_backtest(draws, "dominical", last_n=1)
        assert bt["aciertos"] == 0                       # 99/98/97 never seen before → no hit

    def test_too_few_draws(self):
        assert E.endings_backtest(self._draws(20), "dominical", last_n=200) is None

    def test_other_categories_ignored(self):
        draws = self._draws(80) + self._draws(80, cat="gordito")
        assert E.endings_backtest(draws, "dominical", last_n=20)["sorteos"] == 20


class TestPorCategoria:
    def test_construir_stats_endings_by_category(self):
        draws = [S(100 - i, f"2025-{1 + i % 12:02d}-{1 + i % 28:02d}", "dominical",
                   f"{(i * 37) % 10000:04d}", f"{(i * 91) % 10000:04d}", f"{(i * 53) % 10000:04d}")
                 for i in range(260)]                       # backtest needs ≥ 230
        recent = E._filter_recent(draws)
        ml = {"cat_endings": {"dominical": [{"ending": "00", "score": 1, "confidence": 1.0, "lift": 1.0}]}}
        res = E.construir_stats(draws, recent, ml, {"trained": False}, "2026-10-30")
        d = res["endings_by_category"]["dominical"]
        assert len(d["recommendations"]) == 10 and "lift" in d["recommendations"][0]
        assert d["ml_recommendations"][0]["ending"] == "00"
        assert d["backtest"]["sorteos"] > 0
