import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight, Zap, SlidersHorizontal } from "lucide-react";
import { TrialMatchCard } from "@/components/TrialMatchCard";
import { getPatientMatches, getPatients, type Patient, type TrialMatch } from "@/lib/api";

const PatientMatchingPage = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [matches, setMatches] = useState<TrialMatch[]>([]);
  const [error, setError] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(200);

  useEffect(() => {
    getPatients()
      .then((data) => {
        setPatients(data);
        if (data.length > 0) {
          setSelectedPatient(data[0].patient_id);
        }
      })
      .catch(() => {
        setError("Failed to load patients. Ensure backend is running.");
      });
  }, []);

  const patient = useMemo(
    () => patients.find((p) => p.patient_id === selectedPatient),
    [patients, selectedPatient],
  );

  const handleMatch = async () => {
    if (!selectedPatient) return;

    setProcessing(true);
    setShowResults(false);
    setError("");

    try {
      const data = await getPatientMatches(selectedPatient, radiusKm);
      setMatches(data.recommended_trials ?? []);
      setShowResults(true);
    } catch {
      setMatches([]);
      setShowResults(true);
      setError("Failed to fetch matches from backend.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-shell max-w-5xl">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Eligibility Ranking
          </div>
          <h1 className="text-3xl font-bold text-foreground">Patient Matching</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a patient and find eligible clinical trials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up-delay-1">
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle>Select Patient</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose patient ID" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.patient_id} value={p.patient_id}>
                      {p.patient_id} - {p.disease}, Age {p.age}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {patient && (
            <Card className="surface-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Patient Profile</CardTitle>
                  <Badge>{patient.patient_id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Age</p>
                    <p className="font-semibold">{patient.age}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disease</p>
                    <p className="font-semibold">{patient.disease}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">HbA1c</p>
                    <p className="font-semibold">{patient.hba1c}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Blood Pressure</p>
                    <p className="font-semibold">{patient.blood_pressure}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Heart Disease</p>
                    <p className="font-semibold">{patient.heart_disease}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-semibold">{patient.location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 animate-slide-up-delay-2">
          <div className="w-full sm:w-44">
            <p className="field-label mb-1">Radius (km)</p>
            <Input
              type="number"
              value={radiusKm}
              min={10}
              max={3000}
              onChange={(e) => setRadiusKm(Number(e.target.value || 200))}
            />
          </div>
          <Button onClick={handleMatch} disabled={processing || !selectedPatient} className="shadow-md shadow-primary/20">
          <Search className="h-4 w-4 mr-2" />
          {processing ? "Processing..." : "Find Eligible Clinical Trials"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {processing && (
          <Card className="surface-panel">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-4 text-sm">
                {["Patient Data", "Eligibility Evaluation", "Matching Engine", "Ranking"].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-muted-foreground">{step}</span>
                    {i < 3 && <ArrowRight className="h-3 w-3" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {showResults && (
          <div className="result-stack animate-slide-up-delay-3">
            <div className="section-head">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-bold">Recommended Trials</h2>
              <Badge>{matches.length} found</Badge>
            </div>

            {matches.length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No eligible clinical trials found for this patient.
                </CardContent>
              </Card>
            )}

            {matches.map((trial, idx) => (
              <TrialMatchCard
                key={`${trial.trial_id}-${idx}`}
                match={trial}
                rank={idx}
                topScore={Math.round((matches[0]?.match_score || 0) * 100)}
                fallbackPatientLocation={patient?.location}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientMatchingPage;
