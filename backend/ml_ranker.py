from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

try:
    from sklearn.linear_model import LogisticRegression  # type: ignore

    SKLEARN_AVAILABLE = True
except Exception:  # pragma: no cover
    LogisticRegression = None
    SKLEARN_AVAILABLE = False


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def feature_vector(feature_map: dict[str, float]) -> list[float]:
    return [
        feature_map["age_score"],
        feature_map["hba1c_score"],
        feature_map["bp_score"],
        feature_map["exclusion_score"],
        feature_map["geo_score"],
    ]


@dataclass
class EligibilityRanker:
    model: Any | None

    @classmethod
    def train(cls, rows: list[dict[str, Any]]) -> "EligibilityRanker":
        if not SKLEARN_AVAILABLE or not rows:
            return cls(model=None)

        x = [feature_vector(row["features"]) for row in rows]
        y = [row["label"] for row in rows]
        if len(set(y)) < 2:
            return cls(model=None)

        model = LogisticRegression(max_iter=200)
        model.fit(x, y)
        return cls(model=model)

    def predict_proba(self, feature_map: dict[str, float]) -> float:
        if self.model is not None:
            return float(self.model.predict_proba([feature_vector(feature_map)])[0][1])

        weighted = (
            feature_map["age_score"] * 0.2
            + feature_map["hba1c_score"] * 0.25
            + feature_map["bp_score"] * 0.2
            + feature_map["exclusion_score"] * 0.2
            + feature_map["geo_score"] * 0.15
        )
        return _sigmoid((weighted - 0.5) * 4)

