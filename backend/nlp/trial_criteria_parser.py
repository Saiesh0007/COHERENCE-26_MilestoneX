from __future__ import annotations

import re
from typing import Any


def _extract_age(text: str) -> tuple[int | None, int | None]:
    match = re.search(r"age[^0-9]*(\d{1,3})\s*(?:-|to|and)\s*(\d{1,3})", text, flags=re.I)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None


def _extract_disease(text: str) -> str | None:
    options = ["Type 2 Diabetes", "Diabetes", "Hypertension", "Asthma", "Cancer", "COPD"]
    lowered = text.lower()
    for item in options:
        if item.lower() in lowered:
            return "Diabetes" if "diabetes" in item.lower() else item
    return None


def _extract_hba1c(text: str) -> float | None:
    match = re.search(r"hba1c[^0-9]*(?:>|>=|greater than|at least)\s*(\d+(?:\.\d+)?)", text, flags=re.I)
    return float(match.group(1)) if match else None


def _extract_bp(text: str) -> float | None:
    match = re.search(r"(?:blood pressure|bp)[^0-9]*(?:>|>=|above|at least)\s*(\d{2,3})", text, flags=re.I)
    return float(match.group(1)) if match else None


def _extract_exclusion(text: str) -> str:
    lowered = text.lower()
    if "cardiac" in lowered or "heart disease" in lowered:
        return "HeartDisease"
    return "None"


def parse_trial_criteria(inclusion_text: str, exclusion_text: str = "") -> dict[str, Any]:
    age_min, age_max = _extract_age(inclusion_text)
    return {
        "condition": _extract_disease(inclusion_text),
        "age_min": age_min,
        "age_max": age_max,
        "hba1c_min": _extract_hba1c(inclusion_text),
        "bp_min": _extract_bp(inclusion_text),
        "exclusion": _extract_exclusion(exclusion_text or inclusion_text),
        "inclusion_text": inclusion_text,
        "exclusion_text": exclusion_text,
    }

