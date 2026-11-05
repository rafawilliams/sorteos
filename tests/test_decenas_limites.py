"""Decenas: boundaries the PR #27 reviewer flagged (minimum of 20, exact counts, ties, categories, formats)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import estadisticas as E


def desde(claves, siguientes=None, minimo=E.DECENA_MIN_COINCIDENCIAS):
    """Run the core over chronological 1st-prize tens digits; by default each draw's prizes = its own tens."""
    claves = [str(c) for c in claves]
    siguientes = siguientes or [[c] for c in claves]
    return E._decena_desde(claves, siguientes, [""] * len(claves), minimo)


class TestMinimoEnSuLimite:
    # Triple 1-2-3 appears `k` times; pair 2-3 appears k + 5 times (the extra 9-2-3-5 blocks).
    @staticmethod
    def _serie(k):
        return [1, 2, 3, 4] * k + [9, 2, 3, 5] * 5 + [1, 2, 3]

    def test_exactly_20_matches_keeps_the_triple(self):
        r = desde(self._serie(20))
        assert r["method"] == "triple" and r["match_count"] == 20
        assert r["minimo"] == 20

    def test_19_matches_drops_to_the_pair_with_its_exact_count(self):
        r = desde(self._serie(19))
        assert r["method"] == "pair"
        assert r["match_count"] == 24                  # 19 (…1-2-3-4) + 5 (…9-2-3-5)

    def test_pair_below_the_minimum_drops_to_frequency(self):
        r = desde([1, 2, 3, 4] * 19 + [1, 2, 3])       # triple 19, pair 2-3 also 19
        assert r["method"] == "frecuencia"
        assert r["match_count"] == 79                  # every draw


    def test_pattern_length_is_two_not_one(self):
        # 2-3 is followed by 6 (22 times); a lone 3 after a 4 is followed by 9 (30 times).
        # With a 1-digit pattern the 9 would win; with the real pair, the 6 does.
        r = desde([1, 2, 3, 6] * 22 + [4, 3, 9] * 30 + [0, 2, 3])
        assert r["method"] == "pair" and r["match_count"] == 22
        assert r["recommended"] == "6"

    def test_overlapping_windows_count_up_to_the_last_draw(self):
        # 5-5-5 overlaps itself: in 24 fives the triple matches 21 times (every window but the target).
        r = desde([5] * 24)
        assert r["method"] == "triple" and r["match_count"] == 21
        assert r["recommended"] == "5" and r["lift"] == 10.0

    def test_custom_minimum_is_honoured(self):
        seq = [1, 2, 3, 4] * 5 + [1, 2, 3]               # triple 5 times, pair 5 times
        assert desde(seq, minimo=5)["method"] == "triple"
        assert desde(seq)["method"] == "frecuencia"       # default minimum (20)

class TestEmpates:
    def test_triple_tie_goes_to_the_smallest_digit(self):
        # 1-2-3 is followed 10 times by a 7 and 10 times by a 3.
        claves = []
        for i in range(20):
            claves += [1, 2, 3, 7 if i % 2 else 3]
        r = desde(claves + [1, 2, 3])
        assert r["method"] == "triple"
        assert r["follower_distribution"]["3"] == r["follower_distribution"]["7"] == 10
        assert r["recommended"] == "3" and r["lift"] == 5.0          # 50 % ÷ 10 %

    def test_pair_tie_goes_to_the_smallest_digit(self):
        # Triple 0-2-3 never repeats, so the pair 2-3 decides: followed 11 times by 8 and 11 times by 6.
        claves = []
        for i in range(22):
            claves += [i % 10 if i % 10 not in (0, 2, 3) else 1, 2, 3, 8 if i % 2 else 6]
        r = desde(claves + [0, 2, 3])
        assert r["method"] == "pair"
        assert r["follower_distribution"]["6"] == r["follower_distribution"]["8"] == 11
        assert r["recommended"] == "6"


def S(id_, fecha, cat, p1, p2="", p3=""):
    return {"id": str(id_), "fecha": fecha, "cat": cat, "primero": p1, "segundo": p2, "tercero": p3}


def serie(decenas, cat, p2, p3):
    """Draws newest first (input order of get_sorteos), one per day since 2000."""
    chrono = [S(i + 1, f"{2000 + i // 300}-{1 + (i // 25) % 12:02d}-{1 + i % 25:02d}", cat,
                f"100{d}0" if cat == "extraordinario" else f"10{d}0",     # tens digit = d (5 or 4 digits)
                p2, p3)
              for i, d in enumerate(decenas)]
    return list(reversed(chrono))


class TestCategoriasYFormatos:
    def test_other_categories_do_not_count(self):
        dom = serie([d for d in range(10)] * 3, "dominical", "0050", "0060")
        ruido = serie([1, 2, 3, 4] * 40 + [1, 2, 3], "miercolito", "0040", "0040")
        assert E.decena_recommendation(dom + ruido, "dominical") == E.decena_recommendation(dom, "dominical")

    def test_two_digit_prizes_count_as_followers(self):
        # Gordito: 2nd and 3rd prizes are 2-digit ("47" → tens digit 4).
        r = E.decena_recommendation(serie([d for d in range(10)] * 3, "gordito", "47", "48"), "gordito")
        assert r["method"] == "frecuencia"
        assert r["follower_distribution"]["4"] == 30 * 2 + 3        # 2nd + 3rd of every draw + the 1st prizes with tens 4
        assert r["recommended"] == "4" and r["muestras"] == 90

    def test_five_digit_prizes_use_their_tens_digit(self):
        # Extraordinario: "05309" → tens digit 0 (second to last), not 3.
        r = E.decena_recommendation(serie([d for d in range(10)] * 3, "extraordinario", "05309", "98327"),
                                    "extraordinario")
        assert r["follower_distribution"]["0"] == 30 + 3             # every 2nd prize + the 1st prizes with tens 0
        assert r["follower_distribution"]["2"] == 30 + 3             # every 3rd prize (98327 → 2) + 1st prizes
        assert r["follower_distribution"]["3"] == 3                  # 05309's "3" is not its tens digit
