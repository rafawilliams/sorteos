"""ML model configuration."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ml_model import LotteryPredictor


def test_early_stopping_always_on():
    # 'auto' only enables it above 10 000 samples; the 4-digit training set is ~9 750.
    clf = LotteryPredictor._new_classifier(LotteryPredictor.__new__(LotteryPredictor))
    assert clf.early_stopping is True


def _picos(a, b):
    """Two equally likely digits per position: 16 equally likely numbers."""
    import numpy as np
    probs = []
    for pos in range(4):
        p = np.full(10, 1e-9)
        p[int(a[pos])] = p[int(b[pos])] = 0.5
        probs.append(p / p.sum())
    return probs


def test_predict_from_probs_all_prizes_counts_third_prize():
    sorteos = [{"cat": "dominical", "primero": "1111", "segundo": "9999", "tercero": "5678"}]
    pred = LotteryPredictor.__new__(LotteryPredictor)
    top = pred.predict_from_probs(_picos("1234", "5678"), sorteos, prize=None, top=1)
    assert top[0]["number"] == "5678"                  # bonus from the 3rd prize


def test_predict_from_probs_primero_ignores_other_prizes():
    sorteos = [{"cat": "dominical", "primero": "1234", "segundo": "9999", "tercero": "5678"}]
    pred = LotteryPredictor.__new__(LotteryPredictor)
    top = pred.predict_from_probs(_picos("1234", "5678"), sorteos, prize="primero", top=1)
    assert top[0]["number"] == "1234"                  # only the 1st prize gives the bonus
