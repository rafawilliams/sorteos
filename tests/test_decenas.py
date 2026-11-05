"""Decenas: honest confidence, minimum sample, backtest and coherent data (fix/decenas-honestas)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import estadisticas as E


def S(id_, fecha, cat, p1, p2="", p3=""):
    return {"id": str(id_), "fecha": fecha, "cat": cat, "primero": p1, "segundo": p2, "tercero": p3}


def serie(decenas_1o, cat="dominical", p2="0050", p3="0060", anio=2000):
    """Draws newest first, built from the chronological list of 1st-prize tens digits."""
    n = len(decenas_1o)
    chrono = [S(i + 1, f"{anio + i // 300}-{1 + (i // 25) % 12:02d}-{1 + i % 25:02d}", cat,
                f"00{d}0", p2, p3) for i, d in enumerate(decenas_1o)]
    assert n == len(chrono)
    return list(reversed(chrono))


class TestPatronYMuestra:
    def test_followers_count_the_three_prizes(self):
        # Pattern 1-2-3 is followed 25 times by a draw whose prizes have tens 4 / 5 / 6.
        seq = [1, 2, 3, 4] * 25 + [1, 2, 3]
        r = E.decena_recommendation(serie(seq, p2="0050", p3="0060"), "dominical")
        assert r["method"] == "triple" and r["match_count"] == 25
        assert r["muestras"] == 75                         # 25 matches × 3 prizes
        assert r["follower_distribution"]["5"] == 25 and r["follower_distribution"]["6"] == 25

    def test_below_minimum_falls_back_to_pair(self):
        seq = [1, 2, 3, 4] * 5 + [9, 2, 3] * 30 + [1, 2, 3]   # triple 1-2-3 only 5 times
        r = E.decena_recommendation(serie(seq), "dominical")
        assert r["method"] == "pair" and r["match_count"] >= 20

    def test_below_minimum_twice_uses_frequency(self):
        seq = [d for d in range(10)] * 3                     # every pair appears ≤ 3 times
        r = E.decena_recommendation(serie(seq), "dominical")
        assert r["method"] == "frecuencia"
        assert r["match_count"] == 30                         # all draws

    def test_only_draws_since_1995(self):
        # Pre-1995 draws full of the current pattern 7-8-9 → 1: they must not count.
        viejos = serie([7, 8, 9, 1] * 50, anio=1950)
        nuevos = serie([d for d in range(10)] * 3, anio=2000)      # ends in 7-8-9
        r_con = E.decena_recommendation(nuevos + viejos, "dominical")
        r_sin = E.decena_recommendation(nuevos, "dominical")
        assert r_con == r_sin


class TestConfianza:
    def test_uniform_is_chance(self):
        seq = [d for d in range(10)] * 3
        r = E.decena_recommendation(serie(seq, p2="", p3=""), "dominical")
        assert r["lift"] == pytest.approx(1.0) and r["confidence"] == pytest.approx(1.0)

    def test_ties_are_deterministic_smallest_digit(self):
        seq = [d for d in range(10)] * 3
        assert E.decena_recommendation(serie(seq, p2="", p3=""), "dominical")["recommended"] == "0"

    def test_always_same_follower_is_x10(self):
        seq = [1, 2, 3, 4] * 25 + [1, 2, 3]
        r = E.decena_recommendation(serie(seq, p2="0040", p3="0040"), "dominical")
        assert r["recommended"] == "4" and r["lift"] == pytest.approx(10.0)   # 100 % / 10 %
        assert r["confidence"] == 10.0


class TestBacktest:
    def test_chance_uses_distinct_decenas(self):
        draws = serie([4] * 260, p2="0050", p3="0060")      # decenas 4 / 5 / 6 → 3 distinct
        assert E.decena_backtest(draws, "dominical", last_n=50)["acierto_pct_azar"] == pytest.approx(30.0)

    def test_always_same_tens_always_hits(self):
        draws = serie([4] * 260, p2="0040", p3="0040")
        bt = E.decena_backtest(draws, "dominical", last_n=50)
        assert bt["sorteos"] == 50 and bt["aciertos"] == 50 and bt["acierto_pct"] == 100.0
        assert bt["acierto_pct_azar"] == pytest.approx(10.0)    # one distinct decena per draw → 1/10

    def test_target_draw_not_used(self):
        draws = serie([4] * 260, p2="0040", p3="0040")
        draws[0] = S(999, "2009-12-31", "dominical", "0090", "0090", "0090")
        assert E.decena_backtest(draws, "dominical", last_n=1)["aciertos"] == 0

    def test_too_few(self):
        assert E.decena_backtest(serie([4] * 40), "dominical", last_n=200) is None


def test_construir_stats_uses_recent_and_adds_backtest():
    draws = serie([d % 10 for d in range(260)])
    recent = E._filter_recent(draws)
    res = E.construir_stats(draws, recent, {}, {"trained": False}, "2026-10-30")
    d = res["decena_recomendada"]["dominical"]
    assert {"lift", "muestras", "backtest", "method"} <= set(d)
    assert d["backtest"]["sorteos"] == 200
