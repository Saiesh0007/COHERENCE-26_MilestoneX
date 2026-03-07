from __future__ import annotations

import re
from typing import Any

from backend.patient_parser import parse_patient_note


def _find_float(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text, flags=re.I)
    if not match:
        return None
    return float(match.group(1))


def _find_int(text: str, pattern: str) -> int | None:
    value = _find_float(text, pattern)
    return int(value) if value is not None else None


def _extract_disease(text: str) -> str | None:
    options = ["Type 2 Diabetes", "Diabetes", "Hypertension", "Asthma", "Cancer", "COPD"]
    lowered = text.lower()
    for item in options:
        if item.lower() in lowered:
            return "Diabetes" if "diabetes" in item.lower() else item
    return None


def _extract_location(text: str) -> str | None:
    cities = ["Delhi", "Mumbai", "Hyderabad", "Bangalore", "Pune", "Chennai", "Kolkata", "Ahmedabad"]
    lowered = text.lower()
    for city in cities:
        if city.lower() in lowered:
            return city
    return None


def extract_patient_entities(raw_text: str) -> dict[str, Any]:
    note_dict = parse_patient_note(raw_text)
    merged = {k.lower(): str(v) for k, v in note_dict.items()}
    raw_lower = raw_text.lower()

    age = merged.get("age")
    disease = merged.get("disease")
    hba1c = merged.get("hba1c")
    blood_pressure = merged.get("blood_pressure")
    heart_disease = merged.get("heart_disease")
    location = merged.get("location")

    age_val = int(age) if age and age.isdigit() else _find_int(raw_text, r"\bage[^0-9]{0,10}(\d{1,3})")
    disease_val = disease or _extract_disease(raw_text)
    hba1c_val = float(hba1c) if hba1c and re.match(r"^\d+(\.\d+)?$", hba1c) else _find_float(raw_text, r"hba1c[^0-9]{0,10}(\d+(?:\.\d+)?)")
    bp_val = None
    if blood_pressure:
        bp_match = re.search(r"\d{2,3}", blood_pressure)
        if bp_match:
            bp_val = int(bp_match.group(0))
    if bp_val is None:
        bp_val = _find_int(raw_text, r"(?:blood pressure|bp)[^0-9]{0,10}(\d{2,3})")

    if heart_disease:
        hd_val = heart_disease.strip().lower() in {"yes", "true", "1", "present"}
    elif "no heart disease" in raw_lower or "without heart disease" in raw_lower:
        hd_val = False
    elif "heart disease" in raw_lower:
        hd_val = True
    else:
        hd_val = False

    location_val = location or _extract_location(raw_text)

    return {
        "age": age_val,
        "disease": disease_val,
        "hba1c": hba1c_val,
        "blood_pressure": bp_val,
        "heart_disease": hd_val,
        "location": location_val,
    }

