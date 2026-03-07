export type Patient = {
  patient_id: string;
  age: number;
  disease: string;
  hba1c: number;
  blood_pressure: number;
  heart_disease: string;
  location: string;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at?: string;
};

export type Trial = {
  trial_id: string;
  condition: string;
  age_min: number;
  age_max: number;
  hba1c_min: number;
  bp_min: number;
  exclusion: string;
  location: string;
  organization?: string | null;
  inclusion_text?: string | null;
  exclusion_text?: string | null;
  created_at?: string;
};

export type TrialMatch = {
  trial_id: string;
  condition: string;
  location: string;
  patient_location?: string;
  patient_city?: string | null;
  trial_city?: string | null;
  organization?: string | null;
  distance_km: number | null;
  match_score: number;
  rule_score?: number;
  ml_score?: number;
  explanation: string[];
};

export type Stats = {
  total_patients: number;
  total_trials: number;
  conditions: Record<string, number>;
};

export type RecentMatch = {
  patient_id: string;
  disease: string;
  trial_id: string;
  score: number;
};

export type ParsedCriteria = {
  condition: string | null;
  age_min: number | null;
  age_max: number | null;
  hba1c_min: number | null;
  bp_min: number | null;
  exclusion: string;
  inclusion_text?: string;
  exclusion_text?: string;
};

export type EthicalReport = {
  privacy: {
    pii_columns_detected: string[];
    is_anonymized: boolean;
  };
  quality: {
    patient_missing_rate: number;
    trial_missing_rate: number;
  };
  distribution: {
    patient_disease_mix: Record<string, number>;
    trial_condition_mix: Record<string, number>;
  };
  fairness_alerts: string[];
};

export type UploadedPatientResult = {
  patient_profile: {
    patient_id: string;
    age: number;
    disease: string;
    hba1c: number;
    blood_pressure: number;
    heart_disease: boolean;
    location: string;
  };
  warnings: string[];
  removed_pii_columns: string[];
  raw_text_preview: string;
};

export type UploadedPatientMatchResult = UploadedPatientResult & {
  recommended_trials: TrialMatch[];
};

export type SubmissionRecord = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  patient_id: string | null;
  notes_text: string | null;
  radius_km: number;
  result_limit: number;
  recommended_count: number;
  top_trial_id: string | null;
  top_score: number | null;
  result_json: UploadedPatientMatchResult | null;
  created_at: string;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const AUTH_TOKEN_KEY = "trialmatch_auth_token";

export function getStoredAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Authorization")) {
    const token = getStoredAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Network error calling ${API_BASE_URL}${path}. Ensure backend is running and reachable. Original error: ${raw}`,
    );
  }
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    const contentType = response.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        if (typeof payload?.detail === "string") {
          message = payload.detail;
        } else if (typeof payload?.message === "string") {
          message = payload.message;
        }
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      // Keep fallback status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function registerUser(payload: { name: string; email: string; password: string }) {
  return request<{ user: AuthUser; token: string; expires_at: string }>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: { email: string; password: string }) {
  return request<{ user: AuthUser; token: string; expires_at: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(email: string) {
  return request<{ message: string; reset_token?: string; expires_at?: string }>("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function getMe() {
  return request<{ user: AuthUser }>("/auth/me");
}

export function logoutUser() {
  return request<{ message: string }>("/auth/logout", { method: "POST" });
}

export function getStats() {
  return request<Stats>("/stats");
}

export function getPatients() {
  return request<Patient[]>("/patients");
}

export function getTrials() {
  return request<Trial[]>("/trials");
}

export function getPatientMatches(patientId: string, radiusKm = 200, limit = 5) {
  return request<{ patient_id: string; recommended_trials: TrialMatch[] }>(
    `/match/${patientId}?radius_km=${radiusKm}&limit=${limit}`,
  );
}

export function getRecentMatches(limit = 5) {
  return request<{ results: RecentMatch[] }>(`/matches/recent?limit=${limit}`);
}

export async function uploadDatasets(data: {
  patientsFile?: File;
  trialsFile?: File;
}) {
  const body = new FormData();
  if (data.patientsFile) body.append("patients_file", data.patientsFile);
  if (data.trialsFile) body.append("trials_file", data.trialsFile);

  return request<{ updated: string[]; removed_pii_columns?: string[]; total_patients: number; total_trials: number }>(
    "/datasets/upload",
    { method: "POST", body },
  );
}

export function getEthicalReport() {
  return request<EthicalReport>("/ethical/report");
}

export function parseTrialCriteria(
  inclusionText: string,
  exclusionText: string,
  options?: { saveTrial?: boolean; trialId?: string; location?: string },
) {
  return request<ParsedCriteria | { parsed: ParsedCriteria; stored_trial: Trial }>("/trials/parse-criteria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inclusion_text: inclusionText,
      exclusion_text: exclusionText,
      save_trial: options?.saveTrial ?? false,
      trial_id: options?.trialId,
      location: options?.location,
    }),
  });
}

export function parsePatientNote(noteText: string) {
  return request<UploadedPatientResult>("/upload/patient/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes_text: noteText }),
  });
}

export function uploadPatientDocument(file: File, notesText?: string) {
  const body = new FormData();
  body.append("file", file);
  if (notesText) body.append("notes_text", notesText);
  return request<UploadedPatientResult>("/upload/patient", {
    method: "POST",
    body,
  });
}

export function uploadPatientAndMatch(
  options?: { file?: File; notesText?: string; radiusKm?: number; limit?: number },
) {
  const body = new FormData();
  if (options?.file) body.append("file", options.file);
  if (options?.notesText) body.append("notes_text", options.notesText);
  body.append("radius_km", String(options?.radiusKm ?? 200));
  body.append("limit", String(options?.limit ?? 5));
  return request<UploadedPatientMatchResult>("/upload/patient/match", {
    method: "POST",
    body,
  });
}

export function userUploadAndMatchText(payload: { notesText: string; radiusKm?: number; limit?: number }) {
  return request<UploadedPatientMatchResult>("/user/upload-and-match-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notes_text: payload.notesText,
      radius_km: payload.radiusKm ?? 200,
      limit: payload.limit ?? 5,
    }),
  });
}

export function getMySubmissions(limit = 50) {
  return request<{ results: SubmissionRecord[] }>(`/user/submissions?limit=${limit}`);
}

export function getAdminUsers() {
  return request<{ results: AuthUser[] }>("/admin/users");
}

export function updateAdminUserRole(userId: number, role: "user" | "admin") {
  return request<{ user: AuthUser }>(`/admin/users/${userId}/role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function getAdminSubmissions(limit = 200) {
  return request<{ results: SubmissionRecord[] }>(`/admin/submissions?limit=${limit}`);
}

export function resetDemoData() {
  return request<{ message: string; total_patients: number; total_trials: number }>("/admin/reset-demo", {
    method: "POST",
  });
}
