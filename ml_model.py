"""
Machine Learning model for lottery number prediction.
Uses Gradient Boosted Trees with per-position digit classifiers
and rich feature engineering from historical draw sequences.
"""

import os
import time
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder

MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "predictor.joblib"

# Category encoding
CAT_MAP = {
    "dominical": 0, "miercolito": 1, "gordito": 2,
    "extraordinario": 3, "extraordinaria": 4,
    "zodiaco": 5, "extraordonario": 6,
}


class LotteryPredictor:
    """Ensemble of 4 Gradient Boosted classifiers, one per digit position."""

    def __init__(self):
        self.models = [None] * 4  # One per digit position
        self.trained = False
        self.train_date = None
        self.train_samples = 0
        self.feature_names = []
        self._load()

    def _new_classifier(self):
        return HistGradientBoostingClassifier(
            max_iter=300,
            max_depth=5,
            learning_rate=0.05,
            min_samples_leaf=15,
            max_bins=64,
            random_state=42,
            class_weight="balanced",
            # Always on: the default "auto" only enables it above 10 000 samples,
            # and the 4-digit training set is ~9 750 rows (300 overfit iterations otherwise).
            early_stopping=True,
        )

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------

    def _build_df(self, sorteos: list[dict]) -> pd.DataFrame:
        """Convert sorteos list into a DataFrame sorted chronologically."""
        rows = []
        for s in sorteos:
            for prize_idx, prize in enumerate(("primero", "segundo", "tercero")):
                num = s.get(prize, "")
                if len(num) != 4:  # only real 4-digit prizes (skip empty, 2- and 5-digit formats)
                    continue
                rows.append({
                    "fecha": s.get("fecha", ""),
                    "cat": s.get("cat", ""),
                    "prize": prize_idx,
                    "d0": int(num[0]), "d1": int(num[1]),
                    "d2": int(num[2]), "d3": int(num[3]),
                    "number": int(num),
                })
        df = pd.DataFrame(rows)
        if df.empty:
            return df
        df = df.sort_values("fecha").reset_index(drop=True)
        return df

    def _compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Build feature matrix from the chronological draw DataFrame."""
        parts = {}

        # Temporal features
        dates = pd.to_datetime(df["fecha"], errors="coerce")
        parts["day_of_week"] = dates.dt.dayofweek.fillna(0).astype(int)
        parts["month"] = dates.dt.month.fillna(1).astype(int)
        parts["day_of_month"] = dates.dt.day.fillna(15).astype(int)
        parts["week_of_year"] = dates.dt.isocalendar().week.fillna(26).astype(int)
        parts["year_norm"] = (dates.dt.year.fillna(2010) - 1995) / 31

        # Category & Prize
        parts["cat_code"] = df["cat"].map(CAT_MAP).fillna(7).astype(int)
        parts["prize"] = df["prize"]

        # Rolling digit frequencies per position (windows: 10, 25, 50)
        for pos in range(4):
            col = f"d{pos}"
            for window in (10, 25, 50):
                for digit in range(10):
                    mask = (df[col] == digit).astype(float)
                    parts[f"p{pos}_d{digit}_w{window}"] = (
                        mask.rolling(window, min_periods=1).mean().shift(1).fillna(0.1)
                    )

            # Gap: draws since digit last appeared in this position
            for digit in range(10):
                mask = (df[col] == digit)
                gaps = []
                last_seen = -50
                for i, hit in enumerate(mask):
                    gaps.append(i - last_seen)  # record gap BEFORE updating
                    if hit:
                        last_seen = i
                parts[f"p{pos}_gap_{digit}"] = gaps

            # Previous draw digits
            parts[f"prev_d{pos}"] = df[col].shift(1).fillna(5).astype(int)
            parts[f"prev2_d{pos}"] = df[col].shift(2).fillna(5).astype(int)

        # Last 2-digit ending features
        for window in (10, 25):
            for ending_digit in range(10):
                mask = (df["d3"] == ending_digit).astype(float)
                parts[f"last_d_w{window}_{ending_digit}"] = (
                    mask.rolling(window, min_periods=1).mean().shift(1).fillna(0.1)
                )

        # Sum of digits from previous draw
        digit_sum = df["d0"] + df["d1"] + df["d2"] + df["d3"]
        parts["prev_sum"] = digit_sum.shift(1).fillna(18)
        parts["prev_number"] = df["number"].shift(1).fillna(5000) / 9999

        # Build DataFrame in one shot to avoid fragmentation
        feat = pd.DataFrame(parts, index=df.index)
        self.feature_names = list(feat.columns)
        return feat

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, sorteos: list[dict]):
        """Train all 4 position classifiers from scratch."""
        df = self._build_df(sorteos)
        if len(df) < 100:
            return

        features = self._compute_features(df)

        # Drop first 50 rows (incomplete rolling features)
        start = 50
        X = features.iloc[start:].values
        targets = [df[f"d{pos}"].iloc[start:].values for pos in range(4)]

        self.models = []
        for pos in range(4):
            clf = self._new_classifier()
            clf.fit(X, targets[pos])
            self.models.append(clf)

        self.trained = True
        self.train_date = time.strftime("%Y-%m-%d %H:%M")
        self.train_samples = len(X)
        self._save()

    def update(self, sorteos: list[dict]):
        """Full retrain with all data."""
        self.train(sorteos)

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    @staticmethod
    def _smooth_proba(raw: np.ndarray, temperature: float = 1.5) -> np.ndarray:
        """Apply temperature smoothing to avoid over-concentrated distributions."""
        log_p = np.log(np.clip(raw, 1e-8, None)) / temperature
        log_p -= log_p.max()
        p = np.exp(log_p)
        return p / p.sum()

    def _avg_pos_probs(self, features: pd.DataFrame,
                       n_context: int = 20, temperature: float = 1.5) -> list[np.ndarray]:
        """Average predictions over the last n_context rows with smoothing."""
        n = min(n_context, len(features))
        X_ctx = features.iloc[-n:].values

        pos_probs = []
        for pos in range(4):
            avg = np.zeros(10)
            classes = self.models[pos].classes_
            probas = self.models[pos].predict_proba(X_ctx)
            for row_proba in probas:
                full = np.full(10, 1e-6)
                for cls, prob in zip(classes, row_proba):
                    full[int(cls)] = prob
                avg += full
            avg /= n
            pos_probs.append(self._smooth_proba(avg, temperature))
        return pos_probs

    def predict_from_probs(self, pos_probs: list[np.ndarray],
                           sorteos: list[dict], prize: str = "primero",
                           top: int = 5) -> list[dict]:
        """Generate top number recommendations from pre-computed probabilities.
        Uses vectorized Monte Carlo for speed."""
        if not pos_probs:
            return []

        # Vectorized Monte Carlo — ~100x faster than Python loop
        rng = np.random.default_rng(42)
        n_samples = 50_000
        samples = np.column_stack([
            rng.choice(10, size=n_samples, p=pos_probs[pos])
            for pos in range(4)
        ])
        # Convert to 4-digit numbers
        nums = samples[:, 0] * 1000 + samples[:, 1] * 100 + samples[:, 2] * 10 + samples[:, 3]
        unique, counts = np.unique(nums, return_counts=True)
        candidates = dict(zip(unique, counts))

        # Score top candidates
        hist = Counter(
            s[prize] for s in sorteos if len(s.get(prize) or "") == 4
        )
        # Pre-sort by MC count descending, take top 200
        top_idx = np.argsort(counts)[-200:][::-1]

        scored = []
        for idx in top_idx:
            num_int = int(unique[idx])
            num = f"{num_int:04d}"
            gen_count = int(counts[idx])
            hist_score = hist.get(num, 0)
            joint_prob = 1.0
            for pos in range(4):
                joint_prob *= pos_probs[pos][int(num[pos])]
            score = gen_count * 0.4 + hist_score * 500 * 0.3 + joint_prob * 1e6 * 0.3
            confidence = min(round(joint_prob * 1e4, 1), 15.0)
            scored.append({
                "number": num,
                "score": round(score, 1),
                "confidence": confidence,
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top]

    def predict(self, sorteos: list[dict], category: str | None = None,
                prize: str = "primero", top: int = 5) -> list[dict]:
        """Generate top number recommendations using the ML model."""
        if not self.trained or len(self.models) != 4:
            return []

        if category:
            sorteos = [s for s in sorteos if s.get("cat") == category]

        df = self._build_df(sorteos)
        if len(df) < 50:
            return []

        features = self._compute_features(df)
        pos_probs = self._avg_pos_probs(features)
        return self.predict_from_probs(pos_probs, sorteos, prize, top)

    def predict_endings_from_probs(self, pos_probs: list[np.ndarray],
                                    top: int = 10) -> list[dict]:
        """Predict endings from pre-computed probabilities (no recomputation)."""
        if not pos_probs or len(pos_probs) < 4:
            return []

        proba_tens = pos_probs[2]
        proba_units = pos_probs[3]

        # Vectorized outer product — all 100 endings at once
        probs = np.outer(proba_tens, proba_units).ravel()
        indices = np.argsort(probs)[-top:][::-1]

        return [
            {
                "ending": f"{i // 10}{i % 10}",
                "score": round(float(probs[i]) * 10000, 1),
                "confidence": min(round(float(probs[i]) * 1000, 1), 15.0),
            }
            for i in indices
        ]

    def predict_endings(self, sorteos: list[dict], top: int = 10) -> list[dict]:
        """Predict most likely 2-digit endings using the ML model."""
        if not self.trained or len(self.models) != 4:
            return []

        df = self._build_df(sorteos)
        if len(df) < 50:
            return []

        features = self._compute_features(df)
        pos_probs = self._avg_pos_probs(features)
        return self.predict_endings_from_probs(pos_probs, top)

    def batch_predict(self, sorteos: list[dict],
                      categories: list[str] | None = None) -> dict:
        """Compute all predictions in a single batch — avoids redundant
        _build_df / _compute_features calls.

        Returns dict with keys:
          general_probs, general_reco, prize_reco, endings, cat_reco
        """
        if not self.trained or len(self.models) != 4:
            return {}

        # --- General predictions (all data) ---
        df_all = self._build_df(sorteos)
        if len(df_all) < 50:
            return {}
        feat_all = self._compute_features(df_all)
        general_probs = self._avg_pos_probs(feat_all)

        general_reco = self.predict_from_probs(general_probs, sorteos, "primero")

        # Per-prize predictions reuse same probabilities (same features)
        prize_reco = {}
        for prize in ("primero", "segundo", "tercero"):
            prize_reco[prize] = self.predict_from_probs(
                general_probs, sorteos, prize
            )

        endings = self.predict_endings_from_probs(general_probs)

        # --- Per-category predictions ---
        cat_reco = {}
        if categories:
            for cat_key in categories:
                cat_sorteos = [s for s in sorteos if s.get("cat") == cat_key]
                df_cat = self._build_df(cat_sorteos)
                if len(df_cat) < 50:
                    cat_reco[cat_key] = []
                    continue
                feat_cat = self._compute_features(df_cat)
                cat_probs = self._avg_pos_probs(feat_cat)
                cat_reco[cat_key] = self.predict_from_probs(
                    cat_probs, cat_sorteos, "primero"
                )

        return {
            "general_reco": general_reco,
            "prize_reco": prize_reco,
            "endings": endings,
            "cat_reco": cat_reco,
        }

    # ------------------------------------------------------------------
    # Backtesting
    # ------------------------------------------------------------------

    def _full_proba(self, pos: int, X: np.ndarray, model=None) -> np.ndarray:
        """Get full 10-class probability matrix for a position classifier."""
        mdl = model if model is not None else self.models[pos]
        classes = mdl.classes_
        raw = mdl.predict_proba(X)
        n = X.shape[0]
        full = np.full((n, 10), 1e-6)
        for ci, cls in enumerate(classes):
            full[:, int(cls)] = raw[:, ci]
        full /= full.sum(axis=1, keepdims=True)
        return full

    def backtest(self, sorteos: list[dict], last_n: int = 500) -> dict:
        """Evaluate model accuracy on recent historical draws (true hold-out).

        Trains temporary classifiers on data BEFORE the eval window so that
        no evaluated row was ever seen during training.
        """
        if not self.trained or len(self.models) != 4:
            return {}

        df = self._build_df(sorteos)
        if len(df) < 100:
            return {}

        features = self._compute_features(df)
        eval_start = max(50, len(df) - last_n)

        # Need at least 50 training rows before the eval window
        train_start = 50
        if eval_start - train_start < 50:
            return {}

        n_eval = len(df) - eval_start
        X_eval = features.iloc[eval_start:].values

        # Train temporary models only on pre-eval data (true out-of-sample)
        X_train = features.iloc[train_start:eval_start].values
        temp_models = []
        for pos in range(4):
            clf = self._new_classifier()
            clf.fit(X_train, df[f"d{pos}"].iloc[train_start:eval_start].values)
            temp_models.append(clf)

        # --- Per-position metrics (single batch predict per position) ---
        all_proba = []          # list of (n_eval, 10) arrays
        all_actuals = []        # list of (n_eval,) arrays
        pos_results = []
        row_top1 = np.zeros(n_eval)
        row_top3 = np.zeros(n_eval)

        for pos in range(4):
            proba = self._full_proba(pos, X_eval, model=temp_models[pos])
            actuals = df[f"d{pos}"].iloc[eval_start:].values
            all_proba.append(proba)
            all_actuals.append(actuals)

            preds = proba.argmax(axis=1)
            top3 = np.argsort(proba, axis=1)[:, -3:]

            t1 = (preds == actuals).astype(float)
            t3 = np.array([actuals[i] in top3[i] for i in range(n_eval)],
                          dtype=float)
            avg_p = np.mean([proba[i, actuals[i]] for i in range(n_eval)])

            row_top1 += t1
            row_top3 += t3

            top1_acc = t1.mean() * 100
            top3_acc = t3.mean() * 100
            pos_results.append({
                "position": pos,
                "top1_accuracy": round(top1_acc, 1),
                "top3_accuracy": round(top3_acc, 1),
                "avg_prob_actual": round(avg_p * 100, 1),
                "random_baseline_top1": 10.0,
                "random_baseline_top3": 30.0,
                "lift_top1": round(top1_acc / 10.0, 2),
            })

        row_top1 /= 4
        row_top3 /= 4

        # --- Ending accuracy (positions 2+3) ---
        p2, p3 = all_proba[2], all_proba[3]
        actual_endings = all_actuals[2] * 10 + all_actuals[3]

        end_hit10 = end_hit5 = 0
        for i in range(n_eval):
            ep = np.outer(p2[i], p3[i]).ravel()
            t10 = np.argsort(ep)[-10:]
            t5 = np.argsort(ep)[-5:]
            if actual_endings[i] in t10:
                end_hit10 += 1
            if actual_endings[i] in t5:
                end_hit5 += 1

        # --- Rolling monthly accuracy ---
        dates = pd.to_datetime(
            df["fecha"].iloc[eval_start:].reset_index(drop=True),
            errors="coerce",
        )
        months = dates.dt.to_period("M")
        rmap: dict[str, list] = {}
        for i in range(n_eval):
            m = str(months.iloc[i]) if pd.notna(months.iloc[i]) else None
            if not m:
                continue
            rmap.setdefault(m, []).append((row_top1[i], row_top3[i]))

        rolling = [
            {
                "month": m,
                "top1_avg": round(np.mean([v[0] for v in vals]) * 100, 1),
                "top3_avg": round(np.mean([v[1] for v in vals]) * 100, 1),
                "count": len(vals),
            }
            for m, vals in sorted(rmap.items())
        ]

        avg_t1 = round(np.mean([p["top1_accuracy"] for p in pos_results]), 1)
        avg_t3 = round(np.mean([p["top3_accuracy"] for p in pos_results]), 1)

        return {
            "total_evaluated": n_eval,
            "per_position": pos_results,
            "avg_top1_accuracy": avg_t1,
            "avg_top3_accuracy": avg_t3,
            "avg_lift_top1": round(avg_t1 / 10.0, 2),
            "ending_top10_hit_rate": round(end_hit10 / n_eval * 100, 1),
            "ending_top5_hit_rate": round(end_hit5 / n_eval * 100, 1),
            "ending_random_top10": 10.0,
            "ending_random_top5": 5.0,
            "rolling_accuracy": rolling,
        }

    def get_info(self) -> dict:
        """Return model metadata."""
        info = {
            "trained": self.trained,
            "train_date": self.train_date,
            "train_samples": self.train_samples,
            "model_type": "HistGradientBoosting (4 classifiers)",
        }
        if self.trained and self.models[0]:
            try:
                importances = {}
                for pos in range(4):
                    names = self.feature_names
                    imp = getattr(self.models[pos], "feature_importances_", None)
                    if imp is None:
                        continue
                    top_idx = np.argsort(imp)[-5:][::-1]
                    importances[f"pos_{pos}"] = [
                        {"feature": names[i] if i < len(names) else str(i),
                         "importance": round(float(imp[i]), 4)}
                        for i in top_idx
                    ]
                if importances:
                    info["feature_importances"] = importances
            except Exception:
                pass
        return info

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _save(self):
        MODEL_DIR.mkdir(exist_ok=True)
        joblib.dump({
            "models": self.models,
            "trained": self.trained,
            "train_date": self.train_date,
            "train_samples": self.train_samples,
            "feature_names": self.feature_names,
        }, MODEL_PATH)

    def _load(self):
        if MODEL_PATH.exists():
            try:
                data = joblib.load(MODEL_PATH)
                models = data["models"]
                if not isinstance(models, list) or len(models) != 4 or any(m is None for m in models):
                    self.trained = False
                    return
                self.models = models
                self.trained = data["trained"]
                self.train_date = data["train_date"]
                self.train_samples = data["train_samples"]
                self.feature_names = data.get("feature_names", [])
            except Exception:
                self.trained = False


# Singleton
predictor = LotteryPredictor()
