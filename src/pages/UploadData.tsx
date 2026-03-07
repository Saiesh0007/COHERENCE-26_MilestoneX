import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrialMatchCard } from "@/components/TrialMatchCard";
import { Sparkles, RotateCcw } from "lucide-react";
import { resetDemoData, uploadPatientAndMatch, type TrialMatch, type UploadedPatientResult } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type TextMatchResult = UploadedPatientResult & {
  recommended_trials: TrialMatch[];
};

const UploadDataPage = () => {
  const { user } = useAuth();
  const presets: Array<{ label: string; value: string }> = [
    {
      label: "Diabetes",
      value: "Age: 45\nDisease: Type 2 Diabetes\nHbA1c: 8.1\nBlood Pressure: 130\nHeart Disease: No\nLocation: Mumbai",
    },
    {
      label: "Hypertension",
      value: "Age: 58\nDisease: Hypertension\nHbA1c: 6.4\nBlood Pressure: 148\nHeart Disease: Yes\nLocation: Delhi",
    },
    {
      label: "Asthma",
      value: "Age: 34\nDisease: Asthma\nHbA1c: 6.0\nBlood Pressure: 118\nHeart Disease: No\nLocation: Bangalore",
    },
  ];

  const [notesText, setNotesText] = useState(
    "Age: 45\nDisease: Type 2 Diabetes\nHbA1c: 8.1\nBlood Pressure: 130\nHeart Disease: No\nLocation: Mumbai",
  );
  const [radiusKm, setRadiusKm] = useState(500);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<TextMatchResult | null>(null);

  const handleProcess = async () => {
    if (!notesText.trim()) {
      setError("Enter patient details in text format.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await uploadPatientAndMatch({ notesText, radiusKm, limit });
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to process patient text.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    setError("");
    setStatus("");
    try {
      const data = await resetDemoData();
      setResult(null);
      setStatus(`${data.message} Patients: ${data.total_patients}, Trials: ${data.total_trials}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset demo data.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-shell max-w-5xl">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Text To Match
          </div>
          <h1 className="text-3xl font-bold text-foreground mt-2">Upload Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter patient text details, convert to structured profile, and get satisfied clinical trial matches.
          </p>
        </div>

        {status && <p className="text-sm text-success">{status}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="surface-panel animate-slide-up-delay-1">
          <CardHeader>
            <CardTitle>Patient Text Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline" onClick={() => setNotesText(preset.value)}>
                  {preset.label} Preset
                </Button>
              ))}
            </div>
            <textarea
              className="w-full min-h-40 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="field-label mb-1">Radius (km)</p>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value || 500))}
                />
              </div>
              <div>
                <p className="field-label mb-1">Top Matches</p>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value || 5))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
            <Button onClick={handleProcess} disabled={busy} className="shadow-md shadow-primary/20">
              {busy ? "Processing..." : "Structure And Match Trials"}
            </Button>
            {user?.role === "admin" && (
              <Button variant="outline" onClick={handleResetDemo} disabled={resetting} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {resetting ? "Resetting..." : "Reset Demo Data"}
              </Button>
            )}
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card className="surface-panel animate-slide-up-delay-2">
              <CardHeader>
                <CardTitle>Structured Patient Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="text-xs bg-accent/40 p-3 rounded-md overflow-auto">
                  {JSON.stringify(result.patient_profile, null, 2)}
                </pre>
                {result.warnings.length > 0 && (
                  <p className="text-xs text-warning">{result.warnings.join(" | ")}</p>
                )}
              </CardContent>
            </Card>

            <div className="result-stack animate-slide-up-delay-3">
              <div className="section-head">
                <h2 className="text-lg font-semibold">Satisfied Trial Results</h2>
                <Badge>{result.recommended_trials.length} found</Badge>
              </div>

              {result.recommended_trials.length === 0 && (
                <Card className="surface-panel">
                  <CardContent className="py-5 text-sm text-muted-foreground">
                    No eligible trials found for this patient profile. Try increasing radius or using another preset.
                  </CardContent>
                </Card>
              )}

              {result.recommended_trials.map((match, index) => (
                <TrialMatchCard
                  key={`${match.trial_id}-${index}`}
                  match={match}
                  rank={index}
                  topScore={Math.round((result.recommended_trials[0]?.match_score || 0) * 100)}
                  fallbackPatientLocation={result.patient_profile.location}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UploadDataPage;
