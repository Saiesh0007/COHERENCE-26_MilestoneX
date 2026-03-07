from __future__ import annotations

from typing import Any

import pandas as pd

from backend.database.repository import ClinicalTrialRepository
from backend.nlp.trial_criteria_parser import parse_trial_criteria


def parse_and_store_trial_criteria(
    repository: ClinicalTrialRepository,
    *,
    trial_id: str,
    location: str,
    inclusion_text: str,
    exclusion_text: str = "",
) -> dict[str, Any]:
    parsed = parse_trial_criteria(inclusion_text, exclusion_text)
    if not parsed.get("condition") or parsed.get("age_min") is None or parsed.get("age_max") is None:
        raise ValueError("Could not parse minimum required trial fields from provided text.")

    row = {
        "trial_id": trial_id,
        "condition": parsed["condition"],
        "age_min": parsed["age_min"],
        "age_max": parsed["age_max"],
        "hba1c_min": parsed.get("hba1c_min") or 0.0,
        "bp_min": parsed.get("bp_min") or 0.0,
        "exclusion": parsed.get("exclusion") or "None",
        "location": location,
        "inclusion_text": inclusion_text,
        "exclusion_text": exclusion_text,
    }
    repository.upsert_trials(pd.DataFrame([row]))
    return row
