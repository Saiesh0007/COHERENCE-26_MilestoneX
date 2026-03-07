from __future__ import annotations

from typing import Any


def parse_patient_note(note_text: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for raw_line in note_text.splitlines():
        if ":" not in raw_line:
            continue
        key, value = raw_line.split(":", 1)
        normalized_key = key.strip().lower().replace(" ", "_")
        result[normalized_key] = value.strip()

    aliases = {
        "bloodpressure": "blood_pressure",
        "heartdisease": "heart_disease",
    }
    for old_key, new_key in aliases.items():
        if old_key in result and new_key not in result:
            result[new_key] = result.pop(old_key)

    return result

