from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
PATIENT_DATA_PATH = REPO_ROOT / "data" / "patients_dataset.csv"
TRIAL_DATA_PATH = REPO_ROOT / "data" / "clinical_trials_dataset.csv"


def load_datasets(
    patient_data_path: Path | str | None = None,
    trial_data_path: Path | str | None = None,
):
    patient_path = Path(patient_data_path) if patient_data_path else PATIENT_DATA_PATH
    trial_path = Path(trial_data_path) if trial_data_path else TRIAL_DATA_PATH

    patients = pd.read_csv(patient_path)
    trials = pd.read_csv(trial_path)

    return patients, trials
