import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrialMatchCard } from "@/components/TrialMatchCard";
import { uploadPatientAndMatch, type UploadedPatientMatchResult } from "@/lib/api";
import { ScanText } from "lucide-react";

const UploadAndMatchPage = () => {
  const presets: Array<{ label: string; value: string }> = [
    {
      label: "Mumbai Diabetes",
      value: "Age: 45\nDisease: Type 2 Diabetes\nHbA1c: 8.1\nBlood Pressure: 130\nHeart Disease: No\nLocation: Mumbai",
    },
    {
      label: "Delhi Hypertension",
      value: "Age: 57\nDisease: Hypertension\nHbA1c: 6.6\nBlood Pressure: 150\nHeart Disease: Yes\nLocation: Delhi",
    },
  ];

  const [file, setFile] = useState<File | undefined>();
  const [notesText, setNotesText] = useState(
    "Age: 45\nDisease: Type 2 Diabetes\nHbA1c: 8.1\nBlood Pressure: 130\nHeart Disease: No\nLocation: Mumbai",
  );
  const [radiusKm, setRadiusKm] = useState(500);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadedPatientMatchResult | null>(null);

  const handleRun = async () => {
    if (!file) {
      setError("Select a PDF/image/text medical record file.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const data = await uploadPatientAndMatch({ file, notesText, radiusKm, limit });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Upload and matching failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-shell max-w-5xl">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <ScanText className="h-3.5 w-3.5" />
            OCR + NLP
          </div>
          <h1 className="text-3xl font-bold text-foreground">Upload And Match</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload PDF/image records, convert to structured patient data, and get explainable trial matches.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="surface-panel animate-slide-up-delay-1">
          <CardHeader>
            <CardTitle>Medical Record Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.bmp,.tiff,.txt"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline" onClick={() => setNotesText(preset.value)}>
                  {preset.label}
                </Button>
              ))}
            </div>
            <textarea
              className="w-full min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Optional extra notes to improve extraction..."
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
            <Button onClick={handleRun} disabled={busy} className="shadow-md shadow-primary/20">
              {busy ? "Processing..." : "Upload, Parse, And Match"}
            </Button>
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
                <h2 className="text-lg font-semibold">Eligibility Matches</h2>
                <Badge>{result.recommended_trials.length} found</Badge>
              </div>

              {result.recommended_trials.length === 0 && (
                <Card className="surface-panel">
                  <CardContent className="py-5 text-sm text-muted-foreground">
                    No eligible trials found for this extracted patient profile. Try another document or increase radius.
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

export default UploadAndMatchPage;
