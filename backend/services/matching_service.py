from __future__ import annotations

from typing import Any

from backend.database.repository import ClinicalTrialRepository
from backend.matching.engine import match_patient_to_trials


def find_matches_for_patient(
    repository: ClinicalTrialRepository,
    patient_id: str,
    *,
    radius_km: float = 200.0,
    limit: int = 5,
) -> list[dict[str, Any]]:
    patient = repository.get_patient(patient_id)
    if not patient:
        raise ValueError(f"Patient ID not found: {patient_id}")

    patient["heart_disease"] = bool(patient["heart_disease"])
    trials = repository.get_trials()
    matches = match_patient_to_trials(
        patient,
        trials,
        radius_km=radius_km,
        limit=limit,
    )
    repository.save_matches(patient_id, matches)
    return matches

