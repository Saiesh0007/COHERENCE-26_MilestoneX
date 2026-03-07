from __future__ import annotations

from typing import Any

import pandas as pd

from backend.geo import distance_km, location_score
from backend.ml_ranker import EligibilityRanker


def build_trials_by_condition(trials: pd.DataFrame) -> dict[str, pd.DataFrame]:
    return {
        condition: trials[trials["condition"] == condition]
        for condition in trials["condition"].dropna().unique()
    }


def _feature_scores(patient: pd.Series, trial: pd.Series) -> dict[str, float]:
    age_score = 0.0
    if trial["age_min"] <= patient["age"] <= trial["age_max"]:
        age_range = max(1, trial["age_max"] - trial["age_min"])
        middle_age = (trial["age_min"] + trial["age_max"]) / 2
        distance = abs(patient["age"] - middle_age)
        age_score = max(0.5, 1 - (distance / age_range))

    hba1c_score = 0.0
    if patient["hba1c"] >= trial["hba1c_min"]:
        diff = patient["hba1c"] - trial["hba1c_min"]
        hba1c_score = min(1.0, 0.6 + diff * 0.1)

    bp_score = 0.0
    if patient["blood_pressure"] >= trial["bp_min"]:
        diff = patient["blood_pressure"] - trial["bp_min"]
        bp_score = min(1.0, 0.6 + diff * 0.05)

    exclusion_score = 1.0 if trial["exclusion"] == "None" or patient["heart_disease"] == "No" else 0.0
    geo_score = location_score(str(patient["location"]), str(trial["location"]))
    return {
        "age_score": age_score,
        "hba1c_score": hba1c_score,
        "bp_score": bp_score,
        "exclusion_score": exclusion_score,
        "geo_score": geo_score,
    }


def _build_explanation(patient: pd.Series, trial: pd.Series, feature_map: dict[str, float]) -> list[str]:
    explanation: list[str] = []
    if feature_map["age_score"] > 0:
        explanation.append("Age criteria satisfied")
    if feature_map["hba1c_score"] > 0:
        explanation.append("HbA1c requirement satisfied")
    if feature_map["bp_score"] > 0:
        explanation.append("Blood pressure requirement satisfied")
    if feature_map["exclusion_score"] > 0:
        explanation.append("No exclusion condition triggered")

    dist = distance_km(str(patient["location"]), str(trial["location"]))
    if dist is None:
        explanation.append("Location compatibility estimated without precise distance")
    elif dist < 100:
        explanation.append(f"Trial is nearby (~{round(dist)} km)")
    else:
        explanation.append(f"Trial is at moderate distance (~{round(dist)} km)")

    return explanation


def _build_training_rows(patients: pd.DataFrame, trials: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    grouped = build_trials_by_condition(trials)
    sampled_patients = patients.head(250)
    for _, patient in sampled_patients.iterrows():
        condition = patient["disease"]
        if condition not in grouped:
            continue
        for _, trial in grouped[condition].head(8).iterrows():
            features = _feature_scores(patient, trial)
            label = int(
                features["age_score"] > 0
                and features["hba1c_score"] > 0
                and features["bp_score"] > 0
                and features["exclusion_score"] > 0
            )
            rows.append({"features": features, "label": label})
    return rows


def match_patient(
    patient_id: str,
    patients: pd.DataFrame,
    trials: pd.DataFrame,
    *,
    min_score: float = 0.5,
    limit: int = 5,
) -> list[dict[str, Any]]:
    patient_rows = patients[patients["patient_id"] == patient_id]
    if patient_rows.empty:
        raise ValueError(f"Patient ID not found: {patient_id}")

    patient = patient_rows.iloc[0]
    condition = patient["disease"]

    trials_by_condition = build_trials_by_condition(trials)
    if condition not in trials_by_condition:
        return []

    ranker = EligibilityRanker.train(_build_training_rows(patients, trials))
    relevant_trials = trials_by_condition[condition]
    results: list[dict[str, Any]] = []

    for _, trial in relevant_trials.iterrows():
        features = _feature_scores(patient, trial)
        rule_score = sum(features.values()) / len(features)
        ml_probability = ranker.predict_proba(features)
        final_score = (rule_score * 0.7) + (ml_probability * 0.3)

        if final_score < min_score:
            continue

        results.append(
            {
                "trial_id": trial["trial_id"],
                "condition": trial["condition"],
                "location": trial["location"],
                "score": round(float(final_score), 4),
                "rule_score": round(float(rule_score), 4),
                "ml_probability": round(float(ml_probability), 4),
                "explanation": _build_explanation(patient, trial, features),
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:limit]

