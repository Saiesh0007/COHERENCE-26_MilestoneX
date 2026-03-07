from __future__ import annotations

from typing import Any

from backend.matching.geography import distance_km, normalize_city


def _score_age(age: float, age_min: float, age_max: float) -> float:
    if age < age_min or age > age_max:
        return 0.0
    mid = (age_min + age_max) / 2
    half_window = max(1.0, (age_max - age_min) / 2)
    return max(0.4, 1.0 - abs(age - mid) / half_window)


def _score_threshold(patient_value: float, threshold: float, *, slack: float) -> float:
    if patient_value >= threshold:
        margin = patient_value - threshold
        return min(1.0, 0.7 + margin / max(slack, 1e-6))
    deficit = threshold - patient_value
    return max(0.0, 0.5 - deficit / max(slack, 1e-6))


def _score_geo(distance: float | None) -> float:
    if distance is None:
        return 0.5
    if distance <= 20:
        return 1.0
    if distance <= 80:
        return 0.9
    if distance <= 200:
        return 0.75
    if distance <= 400:
        return 0.55
    return 0.35


def _ml_confidence(feature_scores: dict[str, float]) -> float:
    # Lightweight confidence engine for hackathon prototype.
    weighted = (
        0.24 * feature_scores["age"]
        + 0.25 * feature_scores["disease"]
        + 0.21 * feature_scores["hba1c"]
        + 0.15 * feature_scores["blood_pressure"]
        + 0.15 * feature_scores["geo"]
    )
    return min(1.0, max(0.0, weighted))


def _resolve_organization(trial: dict[str, Any], trial_city: str | None) -> str:
    raw = trial.get("organization")
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    if trial_city:
        return f"{trial_city} Clinical Research Site"
    return f"Trial Site {trial.get('trial_id', '')}".strip()


def _build_explanation(
    patient: dict[str, Any],
    trial: dict[str, Any],
    feature_scores: dict[str, float],
    dist: float | None,
) -> list[str]:
    reasons: list[str] = []
    if feature_scores["age"] > 0:
        reasons.append(f"Age eligible ({patient['age']} in {trial['age_min']}-{trial['age_max']})")
    else:
        reasons.append(f"Age not in range ({trial['age_min']}-{trial['age_max']})")

    if feature_scores["disease"] > 0:
        reasons.append(f"Disease match ({patient['disease']})")
    else:
        reasons.append(f"Disease mismatch ({patient['disease']} vs {trial['condition']})")

    if feature_scores["hba1c"] >= 0.5:
        reasons.append(f"HbA1c satisfies threshold ({patient['hba1c']} >= {trial['hba1c_min']})")
    else:
        reasons.append(f"HbA1c below preferred threshold ({trial['hba1c_min']})")

    if feature_scores["blood_pressure"] >= 0.5:
        reasons.append(f"Blood pressure satisfies threshold ({patient['blood_pressure']} >= {trial['bp_min']})")
    else:
        reasons.append(f"Blood pressure below preferred threshold ({trial['bp_min']})")

    heart = bool(patient.get("heart_disease"))
    exclusion = str(trial.get("exclusion", "None"))
    if exclusion == "None" or not heart:
        reasons.append("No exclusion criteria triggered")
    else:
        reasons.append("Potential exclusion: heart disease history")

    if dist is None:
        reasons.append("Distance unavailable; location compatibility estimated")
    else:
        reasons.append(f"Trial distance: {round(dist, 1)} km")

    return reasons


def match_patient_to_trials(
    patient: dict[str, Any],
    trials: list[dict[str, Any]],
    *,
    radius_km: float = 200.0,
    limit: int = 5,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for trial in trials:
        patient_location = str(patient["location"])
        trial_location = str(trial["location"])
        patient_city = normalize_city(patient_location)
        trial_city = normalize_city(trial_location)
        organization = _resolve_organization(trial, trial_city)
        dist = distance_km(patient_location, trial_location)
        if dist is not None and dist > radius_km:
            continue

        feature_scores = {
            "age": _score_age(float(patient["age"]), float(trial["age_min"]), float(trial["age_max"])),
            "disease": 1.0 if str(patient["disease"]).lower() == str(trial["condition"]).lower() else 0.0,
            "hba1c": _score_threshold(float(patient["hba1c"]), float(trial["hba1c_min"]), slack=4.0),
            "blood_pressure": _score_threshold(float(patient["blood_pressure"]), float(trial["bp_min"]), slack=35.0),
            "geo": _score_geo(dist),
        }

        exclusion = str(trial.get("exclusion", "None")).lower()
        heart_disease = bool(patient.get("heart_disease"))
        exclusion_score = 1.0 if exclusion == "none" or not heart_disease else 0.0

        rule_score = (
            feature_scores["age"]
            + feature_scores["disease"]
            + feature_scores["hba1c"]
            + feature_scores["blood_pressure"]
            + exclusion_score
        ) / 5.0
        ml_score = _ml_confidence(feature_scores)
        match_score = (0.65 * rule_score) + (0.35 * ml_score)

        if match_score < 0.45:
            continue

        results.append(
            {
                "trial_id": trial["trial_id"],
                "condition": trial["condition"],
                "location": trial_location,
                "patient_location": patient_location,
                "patient_city": patient_city,
                "trial_city": trial_city,
                "organization": organization,
                "distance_km": round(dist, 2) if dist is not None else None,
                "match_score": round(match_score, 4),
                "rule_score": round(rule_score, 4),
                "ml_score": round(ml_score, 4),
                "explanation": _build_explanation(patient, trial, feature_scores, dist),
            }
        )

    results.sort(key=lambda item: item["match_score"], reverse=True)
    return results[:limit]
