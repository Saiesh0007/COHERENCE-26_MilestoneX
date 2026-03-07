from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
from pathlib import Path
from secrets import token_urlsafe
from typing import Any
from uuid import uuid4

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = REPO_ROOT / "backend" / "database" / "clinical_trial.db"
PATIENT_CSV = REPO_ROOT / "data" / "patients_dataset.csv"
TRIAL_CSV = REPO_ROOT / "data" / "clinical_trials_dataset.csv"
TRIAL_SITES_JSON = REPO_ROOT / "data" / "trial_sites.json"


def _to_bool_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    text = str(value).strip().lower()
    return 1 if text in {"1", "true", "yes", "y"} else 0


def _load_trial_site_map() -> dict[str, str]:
    if not TRIAL_SITES_JSON.exists():
        return {}
    try:
        data = json.loads(TRIAL_SITES_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}

    mapped: dict[str, str] = {}
    for key, value in data.items():
        if isinstance(key, str) and isinstance(value, str) and value.strip():
            mapped[key.strip()] = value.strip()
    return mapped


def _build_inclusion_text(trial: dict[str, Any]) -> str:
    return (
        f"Condition: {trial.get('condition')}\n"
        f"Age: {trial.get('age_min')} - {trial.get('age_max')}\n"
        f"HbA1c >= {trial.get('hba1c_min')}\n"
        f"Blood Pressure >= {trial.get('bp_min')}"
    )


def _build_exclusion_text(trial: dict[str, Any]) -> str:
    exclusion = str(trial.get("exclusion", "")).strip()
    if not exclusion or exclusion.lower() in {"none", "nan"}:
        return "No explicit exclusion criteria provided."
    return f"Exclude patients with: {exclusion}"


class ClinicalTrialRepository:
    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.bootstrap_from_csv_if_empty()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS patients (
                    patient_id TEXT PRIMARY KEY,
                    age INTEGER NOT NULL,
                    disease TEXT NOT NULL,
                    hba1c REAL NOT NULL,
                    blood_pressure REAL NOT NULL,
                    heart_disease INTEGER NOT NULL,
                    location TEXT NOT NULL,
                    source TEXT DEFAULT 'csv',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS clinical_trials (
                    trial_id TEXT PRIMARY KEY,
                    condition TEXT NOT NULL,
                    age_min INTEGER NOT NULL,
                    age_max INTEGER NOT NULL,
                    hba1c_min REAL NOT NULL,
                    bp_min REAL NOT NULL,
                    exclusion TEXT NOT NULL,
                    location TEXT NOT NULL,
                    inclusion_text TEXT,
                    exclusion_text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS trial_matches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL,
                    trial_id TEXT NOT NULL,
                    score REAL NOT NULL,
                    distance_km REAL,
                    explanation TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    expires_at TEXT NOT NULL,
                    consumed_at TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS submission_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    patient_id TEXT,
                    notes_text TEXT,
                    radius_km REAL,
                    result_limit INTEGER,
                    recommended_count INTEGER,
                    top_trial_id TEXT,
                    top_score REAL,
                    result_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
        self._ensure_default_admin()

    def _ensure_default_admin(self) -> None:
        default_email = os.getenv("APP_ADMIN_EMAIL", "admin@trialmatch.local").strip().lower()
        default_password = os.getenv("APP_ADMIN_PASSWORD", "admin123").strip()
        existing = self.get_user_by_email(default_email)
        if existing:
            return
        self.create_user(name="Administrator", email=default_email, password=default_password, role="admin")

    @staticmethod
    def _hash_password(password: str, salt_hex: str) -> str:
        salt = bytes.fromhex(salt_hex)
        digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        return digest.hex()

    @staticmethod
    def _sanitize_user(user: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": int(user["id"]),
            "name": str(user["name"]),
            "email": str(user["email"]),
            "role": str(user["role"]),
            "created_at": user.get("created_at"),
        }

    def bootstrap_from_csv_if_empty(self) -> None:
        with self._connect() as conn:
            patient_count = conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
            trial_count = conn.execute("SELECT COUNT(*) as c FROM clinical_trials").fetchone()["c"]

        if patient_count == 0 and PATIENT_CSV.exists():
            self.upsert_patients(pd.read_csv(PATIENT_CSV), source="csv")
        if trial_count == 0 and TRIAL_CSV.exists():
            self.upsert_trials(pd.read_csv(TRIAL_CSV))

    def reset_demo_data(self) -> dict[str, Any]:
        with self._connect() as conn:
            conn.execute("DELETE FROM trial_matches")
            conn.execute("DELETE FROM patients")
            conn.execute("DELETE FROM clinical_trials")
        self.bootstrap_from_csv_if_empty()
        return self.get_stats()

    def create_user(self, name: str, email: str, password: str, role: str = "user") -> dict[str, Any]:
        email_norm = email.strip().lower()
        if role not in {"user", "admin"}:
            role = "user"
        salt_hex = os.urandom(16).hex()
        password_hash = self._hash_password(password, salt_hex)
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_salt, password_hash, role)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name.strip(), email_norm, salt_hex, password_hash, role),
            )
            user_id = int(cursor.lastrowid)
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return self._sanitize_user(dict(row))

    def get_or_create_oauth_user(self, *, name: str, email: str, role: str = "user") -> dict[str, Any]:
        existing = self.get_user_by_email(email)
        if existing:
            return self._sanitize_user(existing)

        # Create a strong random placeholder password hash for OAuth accounts.
        salt_hex = os.urandom(16).hex()
        random_password = token_urlsafe(32)
        password_hash = self._hash_password(random_password, salt_hex)
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_salt, password_hash, role)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name.strip() or "Google User", email.strip().lower(), salt_hex, password_hash, role),
            )
            user_id = int(cursor.lastrowid)
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return self._sanitize_user(dict(row))

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        return dict(row) if row else None

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def update_user_role(self, user_id: int, role: str) -> dict[str, Any]:
        if role not in {"user", "admin"}:
            raise ValueError("Invalid role.")
        with self._connect() as conn:
            conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise ValueError("User not found.")
        return self._sanitize_user(dict(row))

    def authenticate_user(self, email: str, password: str) -> dict[str, Any] | None:
        user = self.get_user_by_email(email)
        if not user:
            return None
        expected_hash = self._hash_password(password, str(user["password_salt"]))
        if expected_hash != str(user["password_hash"]):
            return None
        return self._sanitize_user(user)

    def create_auth_token(self, user_id: int, *, ttl_hours: int = 24) -> dict[str, Any]:
        token = token_urlsafe(36)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO auth_tokens (token, user_id, expires_at)
                VALUES (?, ?, ?)
                """,
                (token, user_id, expires_at.isoformat()),
            )
        return {"token": token, "expires_at": expires_at.isoformat()}

    def create_password_reset_token(self, email: str, *, ttl_minutes: int = 30) -> dict[str, Any] | None:
        user = self.get_user_by_email(email)
        if not user:
            return None
        token = token_urlsafe(36)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO password_reset_tokens (token, user_id, expires_at)
                VALUES (?, ?, ?)
                """,
                (token, int(user["id"]), expires_at.isoformat()),
            )
        return {"token": token, "expires_at": expires_at.isoformat(), "user_id": int(user["id"])}

    def reset_password_with_token(self, token: str, new_password: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT token, user_id, expires_at, consumed_at
                FROM password_reset_tokens
                WHERE token = ?
                """,
                (token,),
            ).fetchone()
            if not row:
                return False

            if row["consumed_at"]:
                return False

            try:
                expires = datetime.fromisoformat(str(row["expires_at"]))
            except Exception:
                return False
            if expires <= datetime.now(timezone.utc):
                return False

            salt_hex = os.urandom(16).hex()
            password_hash = self._hash_password(new_password, salt_hex)
            conn.execute(
                "UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?",
                (salt_hex, password_hash, int(row["user_id"])),
            )
            conn.execute(
                "UPDATE password_reset_tokens SET consumed_at = ? WHERE token = ?",
                (datetime.now(timezone.utc).isoformat(), token),
            )
            conn.execute("DELETE FROM auth_tokens WHERE user_id = ?", (int(row["user_id"]),))
        return True

    def get_user_from_token(self, token: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT u.*
                FROM auth_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token = ?
                """,
                (token,),
            ).fetchone()
            token_row = conn.execute("SELECT expires_at FROM auth_tokens WHERE token = ?", (token,)).fetchone()
            if not row or not token_row:
                return None
            try:
                expires = datetime.fromisoformat(str(token_row["expires_at"]))
            except Exception:
                conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
                return None
            if expires <= datetime.now(timezone.utc):
                conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
                return None
        return self._sanitize_user(dict(row))

    def revoke_token(self, token: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))

    def list_users(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def log_submission(
        self,
        *,
        user_id: int,
        patient_id: str | None,
        notes_text: str | None,
        radius_km: float,
        result_limit: int,
        recommended_count: int,
        top_trial_id: str | None,
        top_score: float | None,
        result_payload: dict[str, Any],
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO submission_logs (
                    user_id, patient_id, notes_text, radius_km, result_limit, recommended_count,
                    top_trial_id, top_score, result_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    patient_id,
                    notes_text,
                    radius_km,
                    result_limit,
                    recommended_count,
                    top_trial_id,
                    top_score,
                    json.dumps(result_payload),
                ),
            )

    def _decode_submission_rows(self, rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            raw_payload = item.get("result_json")
            if isinstance(raw_payload, str) and raw_payload.strip():
                try:
                    item["result_json"] = json.loads(raw_payload)
                except Exception:
                    item["result_json"] = None
            else:
                item["result_json"] = None
            results.append(item)
        return results

    def get_user_submissions(self, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT s.*, u.name as user_name, u.email as user_email
                FROM submission_logs s
                JOIN users u ON u.id = s.user_id
                WHERE s.user_id = ?
                ORDER BY s.created_at DESC, s.id DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        return self._decode_submission_rows(rows)

    def get_all_submissions(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT s.*, u.name as user_name, u.email as user_email
                FROM submission_logs s
                JOIN users u ON u.id = s.user_id
                ORDER BY s.created_at DESC, s.id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return self._decode_submission_rows(rows)

    def upsert_patients(self, patients_df: pd.DataFrame, *, source: str = "upload") -> int:
        rows = 0
        with self._connect() as conn:
            for _, row in patients_df.iterrows():
                patient_id = str(row.get("patient_id") or f"P{uuid4().hex[:8].upper()}")
                conn.execute(
                    """
                    INSERT INTO patients (patient_id, age, disease, hba1c, blood_pressure, heart_disease, location, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(patient_id) DO UPDATE SET
                        age=excluded.age,
                        disease=excluded.disease,
                        hba1c=excluded.hba1c,
                        blood_pressure=excluded.blood_pressure,
                        heart_disease=excluded.heart_disease,
                        location=excluded.location,
                        source=excluded.source
                    """,
                    (
                        patient_id,
                        int(row["age"]),
                        str(row["disease"]),
                        float(row["hba1c"]),
                        float(row["blood_pressure"]),
                        _to_bool_int(row["heart_disease"]),
                        str(row["location"]),
                        source,
                    ),
                )
                rows += 1
        return rows

    def upsert_trials(self, trials_df: pd.DataFrame) -> int:
        rows = 0
        with self._connect() as conn:
            for _, row in trials_df.iterrows():
                trial_id = str(row.get("trial_id") or f"T{uuid4().hex[:8].upper()}")
                conn.execute(
                    """
                    INSERT INTO clinical_trials (
                        trial_id, condition, age_min, age_max, hba1c_min, bp_min, exclusion, location, inclusion_text, exclusion_text
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(trial_id) DO UPDATE SET
                        condition=excluded.condition,
                        age_min=excluded.age_min,
                        age_max=excluded.age_max,
                        hba1c_min=excluded.hba1c_min,
                        bp_min=excluded.bp_min,
                        exclusion=excluded.exclusion,
                        location=excluded.location,
                        inclusion_text=excluded.inclusion_text,
                        exclusion_text=excluded.exclusion_text
                    """,
                    (
                        trial_id,
                        str(row["condition"]),
                        int(row["age_min"]),
                        int(row["age_max"]),
                        float(row["hba1c_min"]),
                        float(row["bp_min"]),
                        str(row["exclusion"]),
                        str(row["location"]),
                        row.get("inclusion_text"),
                        row.get("exclusion_text"),
                    ),
                )
                rows += 1
        return rows

    def insert_patient(self, patient: dict[str, Any], *, source: str = "document") -> dict[str, Any]:
        patient_id = str(patient.get("patient_id") or f"P{uuid4().hex[:8].upper()}")
        row = {
            "patient_id": patient_id,
            "age": int(float(patient["age"])),
            "disease": str(patient["disease"]),
            "hba1c": float(patient["hba1c"]),
            "blood_pressure": float(patient["blood_pressure"]),
            "heart_disease": _to_bool_int(patient.get("heart_disease", 0)),
            "location": str(patient["location"]),
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO patients (patient_id, age, disease, hba1c, blood_pressure, heart_disease, location, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(patient_id) DO UPDATE SET
                    age=excluded.age,
                    disease=excluded.disease,
                    hba1c=excluded.hba1c,
                    blood_pressure=excluded.blood_pressure,
                    heart_disease=excluded.heart_disease,
                    location=excluded.location,
                    source=excluded.source
                """,
                (
                    row["patient_id"],
                    row["age"],
                    row["disease"],
                    row["hba1c"],
                    row["blood_pressure"],
                    row["heart_disease"],
                    row["location"],
                    source,
                ),
            )
        return row

    def get_patients(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def get_patient(self, patient_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,)).fetchone()
        return dict(row) if row else None

    def get_trials(self) -> list[dict[str, Any]]:
        site_map = _load_trial_site_map()
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM clinical_trials").fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["organization"] = site_map.get(str(item.get("trial_id", "")).strip())
            if not item.get("inclusion_text"):
                item["inclusion_text"] = _build_inclusion_text(item)
            if not item.get("exclusion_text"):
                item["exclusion_text"] = _build_exclusion_text(item)
            results.append(item)
        return results

    def get_stats(self) -> dict[str, Any]:
        with self._connect() as conn:
            patients = conn.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]
            trials = conn.execute("SELECT COUNT(*) AS c FROM clinical_trials").fetchone()["c"]
            conditions = {
                row["condition"]: row["count"]
                for row in conn.execute(
                    "SELECT condition, COUNT(*) as count FROM clinical_trials GROUP BY condition"
                ).fetchall()
            }
        return {
            "total_patients": int(patients),
            "total_trials": int(trials),
            "conditions": conditions,
        }

    def save_matches(self, patient_id: str, matches: list[dict[str, Any]]) -> None:
        with self._connect() as conn:
            for match in matches:
                conn.execute(
                    """
                    INSERT INTO trial_matches (patient_id, trial_id, score, distance_km, explanation)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        patient_id,
                        match["trial_id"],
                        float(match["match_score"]),
                        match.get("distance_km"),
                        json.dumps(match.get("explanation", [])),
                    ),
                )

    def get_recent_matches(self, limit: int = 5) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT tm.patient_id, p.disease, tm.trial_id, tm.score
                FROM trial_matches tm
                JOIN patients p ON p.patient_id = tm.patient_id
                ORDER BY tm.created_at DESC, tm.id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
