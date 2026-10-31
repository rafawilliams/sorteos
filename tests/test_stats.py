"""Unit tests for statistical functions in app.py."""
import sys
import os
import pytest

# Add parent dir so we can import app functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import (
    digit_frequency,
    position_frequency,
    last_digit_pairs,
    hot_cold,
    number_recommendation,
    decena_recommendation,
    monthly_recommendation,
    trend_data,
    _extract_decena,
    _json_safe,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_numbers():
    return ["0042", "1234", "5678", "9999", "0001", "4321", "8765", "0042"]


@pytest.fixture
def sample_sorteos():
    """Minimal sorteos list (desc by date, like real data)."""
    return [
        {"fecha": "2026-03-25", "cat": "miercolito", "tipo": "miercolito",
         "primero": "6915", "segundo": "1573", "tercero": "1871"},
        {"fecha": "2026-03-22", "cat": "dominical", "tipo": "dominical",
         "primero": "0042", "segundo": "1234", "tercero": "5678"},
        {"fecha": "2026-03-18", "cat": "miercolito", "tipo": "miercolito",
         "primero": "9999", "segundo": "0001", "tercero": "4321"},
        {"fecha": "2026-03-15", "cat": "dominical", "tipo": "dominical",
         "primero": "8765", "segundo": "3456", "tercero": "2109"},
        {"fecha": "2026-03-11", "cat": "miercolito", "tipo": "miercolito",
         "primero": "1111", "segundo": "2222", "tercero": "3333"},
        {"fecha": "2026-03-08", "cat": "dominical", "tipo": "dominical",
         "primero": "4444", "segundo": "5555", "tercero": "6666"},
        {"fecha": "2026-02-25", "cat": "miercolito", "tipo": "miercolito",
         "primero": "7777", "segundo": "8888", "tercero": "9900"},
        {"fecha": "2026-02-22", "cat": "dominical", "tipo": "dominical",
         "primero": "0042", "segundo": "1357", "tercero": "2468"},
    ]


# ---------------------------------------------------------------------------
# digit_frequency
# ---------------------------------------------------------------------------

class TestDigitFrequency:
    def test_basic(self, sample_numbers):
        freq = digit_frequency(sample_numbers)
        assert isinstance(freq, dict)
        # digit '0' appears in 0042 (x2), 0001 => many times
        assert "0" in freq
        assert freq["0"] > 0

    def test_empty(self):
        freq = digit_frequency([])
        # Returns dict with 0 counts for all digits
        assert all(freq.get(str(d), 0) == 0 for d in range(10))

    def test_all_same_digit(self):
        freq = digit_frequency(["1111", "1111"])
        assert freq["1"] == 8  # 4 digits * 2 numbers
        assert freq.get("0", 0) == 0


# ---------------------------------------------------------------------------
# position_frequency
# ---------------------------------------------------------------------------

class TestPositionFrequency:
    def test_returns_4_positions(self, sample_numbers):
        pf = position_frequency(sample_numbers)
        assert len(pf) == 4
        for pos in pf:
            assert isinstance(pos, dict)

    def test_position_0(self):
        pf = position_frequency(["0042", "0099", "1234"])
        assert pf[0]["0"] == 2
        assert pf[0]["1"] == 1

    def test_empty(self):
        pf = position_frequency([])
        assert len(pf) == 4


# ---------------------------------------------------------------------------
# last_digit_pairs
# ---------------------------------------------------------------------------

class TestLastDigitPairs:
    def test_basic(self, sample_numbers):
        pairs = last_digit_pairs(sample_numbers)
        # "0042" ends in "42"
        assert "42" in pairs
        assert pairs["42"] == 2  # appears twice in sample

    def test_empty(self):
        assert last_digit_pairs([]) == {}


# ---------------------------------------------------------------------------
# hot_cold
# ---------------------------------------------------------------------------

class TestHotCold:
    def test_structure(self, sample_numbers):
        result = hot_cold(sample_numbers)
        assert "hot" in result
        assert "cold" in result
        assert len(result["hot"]) <= 10
        assert len(result["cold"]) <= 10

    def test_hot_order(self, sample_numbers):
        result = hot_cold(sample_numbers)
        hot = result["hot"]
        for i in range(len(hot) - 1):
            assert hot[i]["count"] >= hot[i + 1]["count"]

    def test_0042_is_hot(self, sample_numbers):
        result = hot_cold(sample_numbers)
        hot_numbers = [h["number"] for h in result["hot"]]
        assert "0042" in hot_numbers  # appears twice


# ---------------------------------------------------------------------------
# number_recommendation
# ---------------------------------------------------------------------------

class TestNumberRecommendation:
    def test_returns_top_n(self, sample_numbers):
        recs = number_recommendation(sample_numbers, top=3)
        assert len(recs) == 3

    def test_structure(self, sample_numbers):
        recs = number_recommendation(sample_numbers, top=1)
        r = recs[0]
        assert "number" in r
        assert "score" in r
        assert "confidence" in r
        assert len(r["number"]) == 4
        assert r["confidence"] <= 99.9

    def test_empty(self):
        assert number_recommendation([]) == []

    def test_default_top_5(self, sample_numbers):
        recs = number_recommendation(sample_numbers)
        assert len(recs) == 5


# ---------------------------------------------------------------------------
# _extract_decena
# ---------------------------------------------------------------------------

class TestExtractDecena:
    def test_basic(self):
        # Returns string digit (tens position)
        assert _extract_decena("0042") == "4"
        assert _extract_decena("1234") == "3"
        assert _extract_decena("9999") == "9"
        assert _extract_decena("0001") == "0"

    def test_short_number(self):
        assert _extract_decena("42") == "4"

    def test_empty(self):
        assert _extract_decena("") is None


# ---------------------------------------------------------------------------
# trend_data
# ---------------------------------------------------------------------------

class TestTrendData:
    def test_returns_months(self, sample_sorteos):
        trends = trend_data(sample_sorteos, months=12)
        assert isinstance(trends, list)
        assert len(trends) > 0
        assert "month" in trends[0]
        assert "digits" in trends[0]
        assert "sorteos" in trends[0]

    def test_chronological_order(self, sample_sorteos):
        trends = trend_data(sample_sorteos, months=12)
        months = [t["month"] for t in trends]
        assert months == sorted(months)

    def test_digits_structure(self, sample_sorteos):
        trends = trend_data(sample_sorteos, months=12)
        for t in trends:
            for d in range(10):
                assert str(d) in t["digits"]


# ---------------------------------------------------------------------------
# monthly_recommendation
# ---------------------------------------------------------------------------

class TestMonthlyRecommendation:
    def test_structure(self, sample_sorteos):
        result = monthly_recommendation(sample_sorteos)
        assert "target_month" in result
        assert "target_month_name" in result
        assert "target_year" in result
        assert "recommendations" in result
        assert "digit_advantage" in result
        assert "monthly_profiles" in result
        assert len(result["monthly_profiles"]) == 12

    def test_profiles_have_names(self, sample_sorteos):
        result = monthly_recommendation(sample_sorteos)
        names = [p["name"] for p in result["monthly_profiles"]]
        assert "Enero" in names
        assert "Diciembre" in names


# ---------------------------------------------------------------------------
# _json_safe
# ---------------------------------------------------------------------------

class TestJsonSafe:
    def test_dict(self):
        import numpy as np
        result = _json_safe({"a": np.int64(42), "b": np.float64(3.14)})
        assert result == {"a": 42, "b": 3.14}
        assert type(result["a"]) is int
        assert type(result["b"]) is float

    def test_list(self):
        import numpy as np
        result = _json_safe([np.int64(1), np.int64(2)])
        assert result == [1, 2]

    def test_ndarray(self):
        import numpy as np
        result = _json_safe(np.array([1, 2, 3]))
        assert result == [1, 2, 3]

    def test_nested(self):
        import numpy as np
        result = _json_safe({"x": [np.int64(1)], "y": {"z": np.float64(2.0)}})
        assert result == {"x": [1], "y": {"z": 2.0}}

    def test_passthrough(self):
        assert _json_safe("hello") == "hello"
        assert _json_safe(42) == 42
