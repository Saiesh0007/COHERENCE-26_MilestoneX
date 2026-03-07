from __future__ import annotations

import hashlib

import pandas as pd

PII_COLUMNS = {
    "name",
    "full_name",
    "address",
    "phone",
    "mobile",
    "aadhaar",
    "aadhar",
    "email",
}


def anonymize_patients(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    clean = df.copy()
    removed = [col for col in clean.columns if col.lower() in PII_COLUMNS]
    if removed:
        clean = clean.drop(columns=removed)

    if "patient_id" not in clean.columns:
        clean["patient_id"] = [f"P{idx+1:04d}" for idx in range(len(clean))]
    else:
        clean["patient_id"] = clean["patient_id"].astype(str).map(
            lambda raw: "P" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8].upper()
        )

    return clean, removed

