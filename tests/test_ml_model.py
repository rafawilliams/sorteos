"""ML model configuration."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ml_model import LotteryPredictor


def test_early_stopping_always_on():
    # 'auto' only enables it above 10 000 samples; the 4-digit training set is ~9 750.
    clf = LotteryPredictor._new_classifier(LotteryPredictor.__new__(LotteryPredictor))
    assert clf.early_stopping is True
