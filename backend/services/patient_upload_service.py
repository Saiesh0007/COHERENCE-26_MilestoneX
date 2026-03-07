from __future__ import annotations

from typing import Any

import pandas as pd

from backend.anonymization import anonymize_patients
from backend.database.repository import ClinicalTrialRepository
from backend.nlp.ocr_processor import extract_text_from_document
from backend.nlp.patient_entities import extract_patient_entities
from backend.services.matching_service import find_matches_for_patient


REQUIRED_FIELDS = {"disease", "hba1c", "location"}
FALLBACK_DEFAULTS: dict[str, Any] = {
    "age": 45,
    "blood_pressure": 120,
    "heart_disease": False,
}


def process_patient_upload(
    repository: ClinicalTrialRepository,
    *,
    notes_text: str | None = None,
    file_bytes: bytes | None = None,
    filename: str | None = None,
    content_type: str | None = None,
) -> dict[str, Any]:
    source_texts: list[str] = []
    warnings: list[str] = []
    file_extraction_attempted = False

    if notes_text:
        source_texts.append(notes_text)

    if file_bytes and filename:
        file_extraction_attempted = True
        extracted, ocr_warnings = extract_text_from_document(
            file_bytes,
            filename=filename,
            content_type=content_type,
        )
        warnings.extend(ocr_warnings)
        if extracted.strip():
            source_texts.append(extracted)

    if not source_texts:
        if file_extraction_attempted:
            warning_text = f" Warnings: {' | '.join(warnings)}" if warnings else ""
            raise ValueError(
                "Could not extract readable text from uploaded document."
                " Install OCR/PDF dependencies or provide notes_text with key fields "
                "(age, disease, hba1c, blood_pressure, location)." + warning_text
            )
        raise ValueError("Provide at least one source: notes_text or uploaded document.")

    merged_text = "\n".join(source_texts)
    patient = extract_patient_entities(merged_text)

    for field, fallback in FALLBACK_DEFAULTS.items():
        if patient.get(field) in (None, ""):
            patient[field] = fallback
            warnings.append(f"Used fallback value for {field}: {fallback}")

    missing = [field for field in REQUIRED_FIELDS if patient.get(field) in (None, "")]
    if missing:
        raise ValueError(
            "Unable to extract required medical fields: "
            f"{missing}. Include them in notes_text or upload a clearer document."
        )

    temp_df, removed = anonymize_patients(
        pd.DataFrame([patient | {"patient_id": patient.get("patient_id", "TEMP")}])
    )
    anon_patient = temp_df.iloc[0].to_dict()

    saved = repository.insert_patient(anon_patient, source="document")
    saved["heart_disease"] = bool(saved["heart_disease"])

    return {
        "patient_profile": saved,
        "warnings": warnings,
        "removed_pii_columns": removed,
        "raw_text_preview": merged_text[:800],
    }


def process_upload_and_match(
    repository: ClinicalTrialRepository,
    *,
    notes_text: str | None = None,
    file_bytes: bytes | None = None,
    filename: str | None = None,
    content_type: str | None = None,
    radius_km: float = 200.0,
    limit: int = 5,
) -> dict[str, Any]:
    upload_result = process_patient_upload(
        repository,
        notes_text=notes_text,
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
    )
    patient_id = str(upload_result["patient_profile"]["patient_id"])
    matches = find_matches_for_patient(repository, patient_id, radius_km=radius_km, limit=limit)
    return upload_result | {"recommended_trials": matches}
