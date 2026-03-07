from backend.database.repository import ClinicalTrialRepository


def test_repository_bootstrap_has_expected_columns():
    repo = ClinicalTrialRepository()
    patients = repo.get_patients()
    trials = repo.get_trials()

    assert len(patients) > 0
    assert len(trials) > 0
    assert {"patient_id", "disease", "location"}.issubset(set(patients[0].keys()))
    assert {"trial_id", "condition", "location"}.issubset(set(trials[0].keys()))

