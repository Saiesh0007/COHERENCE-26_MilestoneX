import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMySubmissions, userUploadAndMatchText, type SubmissionRecord, type UploadedPatientMatchResult } from "@/lib/api";
import { TrialMatchCard } from "@/components/TrialMatchCard";

const MySubmissionsPage = () => {
  const [notesText, setNotesText] = useState(
    "Age: 45\nDisease: Type 2 Diabetes\nHbA1c: 8.1\nBlood Pressure: 130\nHeart Disease: No\nLocation: Mumbai",
  );
  const [radiusKm, setRadiusKm] = useState(500);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadedPatientMatchResult | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  const loadHistory = () => {
    getMySubmissions(20)
      .then((data) => setSubmissions(data.results))
      .catch(() => setSubmissions([]));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await userUploadAndMatchText({ notesText, radiusKm, limit });
      setResult(data);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-shell max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold">My Submissions</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit patient notes and track your previous outputs.</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Submit Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full min-h-36 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="field-label mb-1">Radius (km)</p>
                <Input type="number" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value || 500))} />
              </div>
              <div>
                <p className="field-label mb-1">Top Matches</p>
                <Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value || 5))} />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={busy} className="shadow-md shadow-primary/20">
              {busy ? "Submitting..." : "Submit And Match"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="result-stack">
            <div className="section-head">
              <h2 className="text-lg font-semibold">Latest Output</h2>
              <Badge>{result.recommended_trials.length} found</Badge>
            </div>
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
        )}

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Submission History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {submissions.map((row) => (
              <div key={row.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {row.patient_id || "Generated patient"} | {row.recommended_count} recommendations
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Top trial: {row.top_trial_id || "n/a"} | Top score:{" "}
                  {row.top_score !== null ? `${Math.round(row.top_score * 100)}%` : "n/a"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MySubmissionsPage;

