from __future__ import annotations

import json
import os
import time
from secrets import token_urlsafe
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest
from urllib.request import urlopen
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.anonymization import anonymize_patients
from backend.database.repository import ClinicalTrialRepository
from backend.ethical import ethical_report
from backend.nlp.patient_entities import extract_patient_entities
from backend.nlp.trial_criteria_parser import parse_trial_criteria
from backend.services.matching_service import find_matches_for_patient
from backend.services.patient_upload_service import process_patient_upload, process_upload_and_match
from backend.services.trial_service import parse_and_store_trial_criteria


def _load_local_env() -> None:
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                raw = line.strip()
                if not raw or raw.startswith("#") or "=" not in raw:
                    continue
                key, value = raw.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        # Do not block API startup if env file parsing fails.
        pass


_load_local_env()

app = FastAPI(title="AI Clinical Trial Matching Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repository = ClinicalTrialRepository()
bearer_scheme = HTTPBearer(auto_error=False)
oauth_state_store: dict[str, float] = {}

try:
    import multipart  # type: ignore # noqa: F401

    MULTIPART_AVAILABLE = True
except Exception:
    MULTIPART_AVAILABLE = False


class CriteriaPayload(BaseModel):
    inclusion_text: str
    exclusion_text: str = ""
    trial_id: str | None = None
    location: str | None = None
    save_trial: bool = False


class MatchRequest(BaseModel):
    patient_id: str
    radius_km: float = Field(default=200.0, ge=1.0, le=5000.0)
    limit: int = Field(default=5, ge=1, le=20)


class PatientNotePayload(BaseModel):
    notes_text: str


class RegisterPayload(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=128)


class LoginPayload(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=128)


class UserTextMatchPayload(BaseModel):
    notes_text: str = Field(min_length=10)
    radius_km: float = Field(default=200.0, ge=1.0, le=5000.0)
    limit: int = Field(default=5, ge=1, le=20)


class ForgotPasswordPayload(BaseModel):
    email: str = Field(min_length=5, max_length=120)


class ResetPasswordPayload(BaseModel):
    token: str = Field(min_length=8, max_length=300)
    new_password: str = Field(min_length=6, max_length=128)


class UserRolePayload(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


def _patient_rows_for_ui() -> list[dict[str, Any]]:
    patients = repository.get_patients()
    for row in patients:
        row["heart_disease"] = "Yes" if bool(row["heart_disease"]) else "No"
    return patients


def _frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:8080").strip().rstrip("/")


def _google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _google_client_secret() -> str:
    return os.getenv("GOOGLE_CLIENT_SECRET", "").strip()


def _google_redirect_uri() -> str:
    return os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/auth/google/callback").strip()


def _extract_current_user(credentials: HTTPAuthorizationCredentials | None) -> dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token.")
    token = credentials.credentials.strip()
    user = repository.get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please login again.")
    return user


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict[str, Any]:
    return _extract_current_user(credentials)


def get_admin_user(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")
    return user


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "AI Clinical Trial Matching Platform API running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register")
def register(payload: RegisterPayload) -> dict[str, Any]:
    existing = repository.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered.")
    try:
        user = repository.create_user(payload.name, payload.email, payload.password, role="user")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to create user account.") from exc
    token_data = repository.create_auth_token(user["id"])
    return {"user": user, "token": token_data["token"], "expires_at": token_data["expires_at"]}


@app.post("/auth/login")
def login(payload: LoginPayload) -> dict[str, Any]:
    user = repository.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token_data = repository.create_auth_token(user["id"])
    return {"user": user, "token": token_data["token"], "expires_at": token_data["expires_at"]}


@app.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": user}


@app.post("/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict[str, str]:
    if credentials and credentials.scheme.lower() == "bearer":
        repository.revoke_token(credentials.credentials.strip())
    return {"message": "Logged out."}


@app.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload) -> dict[str, Any]:
    token_data = repository.create_password_reset_token(payload.email)
    if not token_data:
        return {"message": "If the email exists, a reset token was generated."}
    # Demo mode: return token directly so flow works without email service.
    return {
        "message": "Password reset token generated.",
        "reset_token": token_data["token"],
        "expires_at": token_data["expires_at"],
    }


@app.get("/auth/google/login")
def auth_google_login() -> RedirectResponse:
    client_id = _google_client_id()
    if not client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID.")

    state = token_urlsafe(24)
    oauth_state_store[state] = time.time() + 600
    params = {
        "client_id": client_id,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url=url, status_code=302)


@app.get("/auth/google/callback")
def auth_google_callback(code: str | None = None, state: str | None = None) -> RedirectResponse:
    frontend_url = _frontend_base_url()
    fail_redirect = f"{frontend_url}/login?oauth_error=google_auth_failed"

    if not code or not state:
        return RedirectResponse(url=fail_redirect, status_code=302)

    expiry = oauth_state_store.get(state)
    if not expiry or expiry < time.time():
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=invalid_state", status_code=302)
    oauth_state_store.pop(state, None)

    client_id = _google_client_id()
    client_secret = _google_client_secret()
    if not client_id or not client_secret:
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=oauth_not_configured", status_code=302)

    try:
        token_payload = urlencode(
            {
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _google_redirect_uri(),
                "grant_type": "authorization_code",
            }
        ).encode("utf-8")
        token_req = UrlRequest(
            "https://oauth2.googleapis.com/token",
            data=token_payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urlopen(token_req, timeout=15) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
        access_token = str(token_data.get("access_token", "")).strip()
        if not access_token:
            return RedirectResponse(url=fail_redirect, status_code=302)

        userinfo_req = UrlRequest(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            method="GET",
        )
        with urlopen(userinfo_req, timeout=15) as resp:
            profile = json.loads(resp.read().decode("utf-8"))

        email = str(profile.get("email", "")).strip().lower()
        name = str(profile.get("name", "")).strip() or "Google User"
        if not email:
            return RedirectResponse(url=fail_redirect, status_code=302)

        user = repository.get_or_create_oauth_user(name=name, email=email, role="user")
        token_data = repository.create_auth_token(int(user["id"]))
        success_redirect = f"{frontend_url}/auth/google/callback?token={token_data['token']}"
        return RedirectResponse(url=success_redirect, status_code=302)
    except Exception:
        return RedirectResponse(url=fail_redirect, status_code=302)


@app.post("/auth/reset-password")
def reset_password(payload: ResetPasswordPayload) -> dict[str, str]:
    ok = repository.reset_password_with_token(payload.token, payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    return {"message": "Password updated. Please login with your new password."}


@app.post("/user/upload-and-match-text")
def user_upload_and_match_text(
    payload: UserTextMatchPayload,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        result = process_upload_and_match(
            repository,
            notes_text=payload.notes_text,
            file_bytes=None,
            filename=None,
            content_type=None,
            radius_km=payload.radius_km,
            limit=payload.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    recommended = result.get("recommended_trials", [])
    top_trial_id = recommended[0]["trial_id"] if recommended else None
    top_score = float(recommended[0]["match_score"]) if recommended else None
    repository.log_submission(
        user_id=int(user["id"]),
        patient_id=result.get("patient_profile", {}).get("patient_id"),
        notes_text=payload.notes_text,
        radius_km=payload.radius_km,
        result_limit=payload.limit,
        recommended_count=len(recommended),
        top_trial_id=top_trial_id,
        top_score=top_score,
        result_payload=result,
    )
    return result


@app.get("/user/submissions")
def user_submissions(limit: int = 50, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"results": repository.get_user_submissions(int(user["id"]), limit=limit)}


@app.get("/admin/users")
def admin_users(_: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
    return {"results": repository.list_users()}


@app.post("/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: int,
    payload: UserRolePayload,
    admin: dict[str, Any] = Depends(get_admin_user),
) -> dict[str, Any]:
    target = repository.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if int(target["id"]) == int(admin["id"]):
        raise HTTPException(status_code=400, detail="You cannot change your own role.")
    try:
        updated = repository.update_user_role(user_id, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"user": updated}


@app.get("/admin/submissions")
def admin_submissions(limit: int = 200, _: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
    return {"results": repository.get_all_submissions(limit=limit)}


@app.get("/patients")
def get_patients() -> list[dict[str, Any]]:
    return _patient_rows_for_ui()


@app.get("/trials")
def get_trials() -> list[dict[str, Any]]:
    return repository.get_trials()


@app.get("/stats")
def get_stats() -> dict[str, Any]:
    return repository.get_stats()


@app.post("/admin/reset-demo")
def reset_demo_data(_: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
    stats = repository.reset_demo_data()
    return {
        "message": "Demo data reset completed.",
        "total_patients": stats["total_patients"],
        "total_trials": stats["total_trials"],
    }


@app.get("/ethical/report")
def get_ethical_report() -> dict[str, Any]:
    patients_df = pd.DataFrame(repository.get_patients())
    trials_df = pd.DataFrame(repository.get_trials())
    if not patients_df.empty:
        patients_df["heart_disease"] = patients_df["heart_disease"].map(lambda v: "Yes" if bool(v) else "No")
    return ethical_report(patients_df, trials_df)


@app.post("/patients/parse-note")
def parse_patient_note(payload: PatientNotePayload) -> dict[str, Any]:
    return extract_patient_entities(payload.notes_text)


if MULTIPART_AVAILABLE:

    @app.post("/upload/patient")
    async def upload_patient(
        file: UploadFile | None = File(default=None),
        notes_text: str | None = Form(default=None),
    ) -> dict[str, Any]:
        try:
            file_bytes = await file.read() if file else None
            result = process_patient_upload(
                repository,
                notes_text=notes_text,
                file_bytes=file_bytes,
                filename=file.filename if file else None,
                content_type=file.content_type if file else None,
            )
            return result
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/upload/patient/match")
    async def upload_patient_and_match(
        file: UploadFile | None = File(default=None),
        notes_text: str | None = Form(default=None),
        radius_km: float = Form(default=200.0),
        limit: int = Form(default=5),
    ) -> dict[str, Any]:
        try:
            file_bytes = await file.read() if file else None
            return process_upload_and_match(
                repository,
                notes_text=notes_text,
                file_bytes=file_bytes,
                filename=file.filename if file else None,
                content_type=file.content_type if file else None,
                radius_km=radius_km,
                limit=limit,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

else:

    @app.post("/upload/patient")
    def upload_patient_no_multipart(_: Request) -> dict[str, Any]:
        raise HTTPException(
            status_code=501,
            detail=(
                "File upload requires python-multipart. "
                "Install with: pip install python-multipart"
            ),
        )

    @app.post("/upload/patient/match")
    def upload_patient_and_match_no_multipart(_: Request) -> dict[str, Any]:
        raise HTTPException(
            status_code=501,
            detail=(
                "File upload matching requires python-multipart. "
                "Install with: pip install python-multipart"
            ),
        )


@app.post("/upload/patient/note")
def upload_patient_note(payload: PatientNotePayload) -> dict[str, Any]:
    try:
        return process_patient_upload(repository, notes_text=payload.notes_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/trials/parse-criteria")
def parse_criteria(payload: CriteriaPayload) -> dict[str, Any]:
    parsed = parse_trial_criteria(payload.inclusion_text, payload.exclusion_text)
    if payload.save_trial:
        if not payload.trial_id or not payload.location:
            raise HTTPException(status_code=400, detail="trial_id and location are required when save_trial=true")
        try:
            trial = parse_and_store_trial_criteria(
                repository,
                trial_id=payload.trial_id,
                location=payload.location,
                inclusion_text=payload.inclusion_text,
                exclusion_text=payload.exclusion_text,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"parsed": parsed, "stored_trial": trial}
    return parsed


@app.get("/match/{patient_id}")
def get_trial_matches(
    patient_id: str,
    radius_km: float = 200.0,
    limit: int = 5,
) -> dict[str, Any]:
    try:
        matches = find_matches_for_patient(repository, patient_id, radius_km=radius_km, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"patient_id": patient_id, "recommended_trials": matches}


@app.post("/match/patient")
def match_patient(payload: MatchRequest) -> dict[str, Any]:
    return get_trial_matches(payload.patient_id, payload.radius_km, payload.limit)


@app.get("/matches/recent")
def get_recent_matches(limit: int = 5) -> dict[str, Any]:
    return {"results": repository.get_recent_matches(limit=limit)}


if MULTIPART_AVAILABLE:

    @app.post("/datasets/upload")
    async def upload_datasets(
        patients_file: UploadFile | None = File(default=None),
        trials_file: UploadFile | None = File(default=None),
        _: dict[str, Any] = Depends(get_admin_user),
    ) -> dict[str, Any]:
        if not patients_file and not trials_file:
            raise HTTPException(status_code=400, detail="At least one CSV must be uploaded.")

        updated: list[str] = []
        removed_pii_columns: list[str] = []

        if patients_file:
            if not patients_file.filename.lower().endswith(".csv"):
                raise HTTPException(status_code=400, detail="patients_file must be a CSV.")
            patient_df = pd.read_csv(patients_file.file)
            patient_df, removed = anonymize_patients(patient_df)
            repository.upsert_patients(patient_df, source="csv_upload")
            removed_pii_columns = removed
            updated.append("patients")

        if trials_file:
            if not trials_file.filename.lower().endswith(".csv"):
                raise HTTPException(status_code=400, detail="trials_file must be a CSV.")
            trials_df = pd.read_csv(trials_file.file)
            repository.upsert_trials(trials_df)
            updated.append("trials")

        stats = repository.get_stats()
        return {
            "updated": updated,
            "removed_pii_columns": removed_pii_columns,
            "total_patients": stats["total_patients"],
            "total_trials": stats["total_trials"],
        }

else:

    @app.post("/datasets/upload")
    def upload_datasets_unavailable(_: dict[str, Any] = Depends(get_admin_user)) -> dict[str, Any]:
        raise HTTPException(
            status_code=501,
            detail="CSV upload requires python-multipart. Install with: pip install python-multipart",
        )
