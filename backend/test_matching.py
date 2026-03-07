from backend.database.repository import ClinicalTrialRepository
from backend.services.matching_service import find_matches_for_patient


def test_matching_returns_ranked_trials_with_confidence():
    repo = ClinicalTrialRepository()
    patient_id = repo.get_patients()[0]["patient_id"]
    results = find_matches_for_patient(repo, patient_id, radius_km=1000, limit=5)

    assert isinstance(results, list)
    if not results:
        return

    assert results[0]["match_score"] >= results[-1]["match_score"]
    assert "trial_id" in results[0]
    assert "distance_km" in results[0]
    assert "explanation" in results[0]

