from __future__ import annotations

import io


def extract_text_from_document(
    file_bytes: bytes,
    *,
    filename: str,
    content_type: str | None = None,
) -> tuple[str, list[str]]:
    warnings: list[str] = []
    lower_name = filename.lower()
    mime = (content_type or "").lower()

    if lower_name.endswith(".txt") or mime == "text/plain":
        return file_bytes.decode("utf-8", errors="ignore"), warnings

    if lower_name.endswith(".pdf") or mime == "application/pdf":
        try:
            import pdfplumber  # type: ignore
        except Exception:
            warnings.append("pdfplumber not installed; cannot extract PDF text.")
            return "", warnings

        text_parts: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts), warnings

    image_mime = mime.startswith("image/")
    image_ext = lower_name.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff"))
    if image_mime or image_ext:
        try:
            from PIL import Image  # type: ignore
            import pytesseract  # type: ignore
        except Exception as exc:
            warnings.append(f"pytesseract/Pillow import failed: {exc}")
            return "", warnings

        image = Image.open(io.BytesIO(file_bytes))
        try:
            text = pytesseract.image_to_string(image)
        except Exception as exc:
            warnings.append(f"Image OCR failed: {exc}")
            return "", warnings
        return text, warnings

    warnings.append(f"Unsupported upload type: {filename}")
    return "", warnings
