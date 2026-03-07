from __future__ import annotations

from typing import Any

import pandas as pd

from backend.anonymization import PII_COLUMNS


def ethical_report(patients: pd.DataFrame, trials: pd.DataFrame) -> dict[str, Any]:
    pii_present = [c for c in patients.columns if c.lower() in PII_COLUMNS]
    patient_missing_rate = float(patients.isna().mean().mean()) if len(patients) else 0.0
    trial_missing_rate = float(trials.isna().mean().mean()) if len(trials) else 0.0
    disease_mix = patients["disease"].value_counts(normalize=True).to_dict() if "disease" in patients.columns else {}

    fairness_alerts = []
    for disease, ratio in disease_mix.items():
        if ratio > 0.65:
            fairness_alerts.append(
                f"Dataset skew detected: '{disease}' represents {round(ratio * 100, 1)}% of patients."
            )

    if patient_missing_rate > 0.2:
        fairness_alerts.append("High patient-data missingness may cause unfair exclusions.")
    if trial_missing_rate > 0.2:
        fairness_alerts.append("High trial-data missingness may reduce recommendation quality.")

    return {
        "privacy": {
            "pii_columns_detected": pii_present,
            "is_anonymized": len(pii_present) == 0,
        },
        "quality": {
            "patient_missing_rate": round(patient_missing_rate, 4),
            "trial_missing_rate": round(trial_missing_rate, 4),
        },
        "distribution": {
            "patient_disease_mix": {k: round(v, 4) for k, v in disease_mix.items()},
            "trial_condition_mix": trials["condition"].value_counts(normalize=True).round(4).to_dict()
            if "condition" in trials.columns
            else {},
        },
        "fairness_alerts": fairness_alerts,
    }

