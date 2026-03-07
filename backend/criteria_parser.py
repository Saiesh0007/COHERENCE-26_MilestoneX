from __future__ import annotations

import re
from typing import Any


_DISEASE_ALIASES = {
    "type 2 diabetes": "Diabetes",
    "diabetes": "Diabetes",
    "hypertension": "Hypertension",
    "asthma": "Asthma",
    "cancer": "Cancer",
    "copd": "COPD",
}


def _extract_age(text: str) -> tuple[int | None, int | None]:
    match = re.search(r"age[^0-9]*(\d{1,3})\s*(?:-|to|and)\s*(\d{1,3})", text, flags=re.I)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None


def _extract_hba1c_min(text: str) -> float | None:
    match = re.search(r"hba1c[^0-9]*(?:>|>=|greater than|at least)\s*(\d+(?:\.\d+)?)", text, flags=re.I)
    if match:
        return float(match.group(1))
    return None


def _extract_bp_min(text: str) -> int | None:
    match = re.search(r"(?:bp|blood pressure)[^0-9]*(?:>|>=|greater than|at least)\s*(\d{2,3})", text, flags=re.I)
    if match:
        return int(match.group(1))
    return None


def _extract_disease(text: str) -> str | None:
    lowered = text.lower()
    for alias, normalized in _DISEASE_ALIASES.items():
        if alias in lowered:
            return normalized
    return None


def _extract_exclusion(exclusion_text: str) -> str:
    lowered = exclusion_text.lower()
    if "heart disease" in lowered:
        return "HeartDisease"
    return "None"


def parse_trial_criteria(inclusion_text: str, exclusion_text: str) -> dict[str, Any]:
    age_min, age_max = _extract_age(inclusion_text)
    return {
        "condition": _extract_disease(inclusion_text),
        "age_min": age_min,
        "age_max": age_max,
        "hba1c_min": _extract_hba1c_min(inclusion_text),
        "bp_min": _extract_bp_min(inclusion_text),
        "exclusion": _extract_exclusion(exclusion_text),
    }

