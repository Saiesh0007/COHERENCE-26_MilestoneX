import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Brain, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPatientMatches, getPatients, parseTrialCriteria, type ParsedCriteria, type Patient, type TrialMatch } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ExplainableAIPage = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [match, setMatch] = useState<TrialMatch | null>(null);
  const [error, setError] = useState("");
  const [inclusionText, setInclusionText] = useState("Age between 18-65\nDiagnosed with Type 2 Diabetes\nHbA1c greater than 7%");
  const [exclusionText, setExclusionText] = useState("History of heart disease");
  const [parsedCriteria, setParsedCriteria] = useState<ParsedCriteria | null>(null);

  useEffect(() => {
    getPatients()
      .then((data) => {
        setPatients(data);
        if (data.length > 0) setSelectedPatient(data[0].patient_id);
      })
      .catch(() => setError("Failed to load patients from backend."));
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    getPatientMatches(selectedPatient)
      .then((data) => setMatch(data.recommended_trials[0] ?? null))
      .catch(() => {
        setMatch(null);
        setError("Failed to compute explainable match details.");
      });
  }, [selectedPatient]);

  const ruleEvaluation = useMemo(
    () =>
      (match?.explanation || []).map((item) => ({
        condition: item,
        patientValue: "Matched",
        requirement: "Satisfied",
        result: true,
      })),
    [match],
  );

  const confidence = Math.round((match?.match_score ?? 0) * 100);
  const ruleConfidence = Math.round((match?.rule_score ?? 0) * 100);
  const mlConfidence = Math.round((match?.ml_score ?? 0) * 100);

  const handleParseCriteria = async () => {
    try {
      const parsed = await parseTrialCriteria(inclusionText, exclusionText);
      if ("parsed" in parsed) {
        setParsedCriteria(parsed.parsed);
      } else {
        setParsedCriteria(parsed);
      }
      setError("");
    } catch {
      setError("Failed to parse criteria text.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider border-primary/30 text-primary bg-primary/5 px-2.5 py-0.5">
              <Brain className="w-3 h-3 mr-1" /> Transparent AI
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Explainable AI</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Understand how the AI evaluates eligibility criteria for each match.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Patient Selector</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.patient_id} value={patient.patient_id}>
                    {patient.patient_id} - {patient.disease}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Criteria NLP Parser</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={inclusionText}
              onChange={(e) => setInclusionText(e.target.value)}
            />
            <textarea
              className="w-full min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={exclusionText}
              onChange={(e) => setExclusionText(e.target.value)}
            />
            <Button variant="outline" onClick={handleParseCriteria}>Parse Criteria Text</Button>
            {parsedCriteria && (
              <pre className="text-xs bg-accent/40 p-3 rounded-md overflow-auto">{JSON.stringify(parsedCriteria, null, 2)}</pre>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/50 border border-border/50 animate-slide-up-delay-1">
          <span className="text-sm text-muted-foreground">Patient:</span>
          <Badge variant="secondary" className="font-mono font-bold text-xs">
            {selectedPatient || "-"}
          </Badge>
          <span className="text-muted-foreground">-&gt;</span>
          <span className="text-sm text-muted-foreground">Trial:</span>
          <Badge variant="secondary" className="font-mono font-bold text-xs">
            {match?.trial_id || "No Match"}
          </Badge>
        </div>

        <Card className="glass-card-elevated animate-slide-up-delay-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Rule Evaluation</CardTitle>
              <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-semibold" variant="outline">
                {ruleEvaluation.length}/{ruleEvaluation.length} Passed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-accent/50">
                    <th className="text-left py-2.5 px-4 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Condition</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Patient Value</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Trial Requirement</th>
                    <th className="text-center py-2.5 px-4 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleEvaluation.map((rule, i) => (
                    <tr key={i} className="border-t border-border/40 hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">{rule.condition}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">{rule.patientValue}</td>
                      <td className="py-3 px-4 text-muted-foreground">{rule.requirement}</td>
                      <td className="py-3 px-4 text-center">
                        {rule.result ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold">Pass</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-semibold">Fail</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-elevated animate-slide-up-delay-3 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Match Confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-5">
              <div className="flex-1 h-4 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-success" style={{ width: `${confidence}%` }} />
              </div>
              <span className="text-4xl font-bold text-success">{confidence}%</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded bg-accent/30">Rule Score: <span className="font-semibold">{ruleConfidence}%</span></div>
              <div className="p-2 rounded bg-accent/30">ML Probability: <span className="font-semibold">{mlConfidence}%</span></div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Final confidence combines rule engine score and ML probability estimate.
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Decision Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">
              {match
                ? `Patient ${selectedPatient} has a top recommendation of trial ${match.trial_id} in ${match.location}. The recommendation is backed by ${match.explanation.length} satisfied criteria and a confidence score of ${confidence}%.`
                : `No recommended trial is currently available for patient ${selectedPatient || "-"}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExplainableAIPage;
