import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Database, FileSearch, Cpu, BarChart3, ShieldCheck, Layers } from "lucide-react";
import { getEthicalReport, type EthicalReport } from "@/lib/api";

const steps = [
  { title: "Patient Dataset", description: "Anonymized patient health records are loaded into the system.", icon: Database, color: "text-primary bg-primary/10" },
  { title: "Eligibility Criteria Parser", description: "Trial inclusion/exclusion criteria are parsed into structured rules.", icon: FileSearch, color: "text-warning bg-warning/10" },
  { title: "Rule-Based Matching Engine", description: "Patient data is evaluated against each trial's eligibility rules.", icon: Cpu, color: "text-success bg-success/10" },
  { title: "Trial Ranking System", description: "Eligible trials are scored using rule + ML confidence ranking.", icon: BarChart3, color: "text-primary bg-primary/10" },
  { title: "Explainable Recommendations", description: "Results are presented with full transparency on how decisions were made.", icon: ShieldCheck, color: "text-success bg-success/10" },
];

const SystemOverviewPage = () => {
  const [report, setReport] = useState<EthicalReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getEthicalReport()
      .then(setReport)
      .catch(() => setError("Failed to load ethical report from backend."));
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider border-primary/30 text-primary bg-primary/5 px-2.5 py-0.5">
              <Layers className="w-3 h-3 mr-1" /> Architecture
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">System Overview</h1>
          <p className="text-sm text-muted-foreground mt-1.5">How the AI matching engine processes data and generates recommendations.</p>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        <Card className="glass-card-elevated animate-slide-up-delay-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Processing Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors duration-200 group">
                    <div className={`w-10 h-10 rounded-xl ${step.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] font-bold shrink-0 mt-0.5">
                      Step {i + 1}
                    </Badge>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex justify-start pl-9 py-1.5">
                      <div className="flex flex-col items-center">
                        <div className="w-px h-3 bg-border" />
                        <ArrowDown className="h-3.5 w-3.5 text-primary/50" />
                        <div className="w-px h-3 bg-border" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-elevated animate-slide-up-delay-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ethical Safeguards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-accent/40 border border-border/40">
                <p className="text-xs text-muted-foreground">Anonymized</p>
                <p className="font-semibold">{report?.privacy.is_anonymized ? "Yes" : "No"}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent/40 border border-border/40">
                <p className="text-xs text-muted-foreground">PII Columns Detected</p>
                <p className="font-semibold">{report?.privacy.pii_columns_detected.length ?? 0}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Patient missing rate: {Math.round((report?.quality.patient_missing_rate ?? 0) * 100)}% | Trial missing rate: {Math.round((report?.quality.trial_missing_rate ?? 0) * 100)}%
            </div>
            <div className="space-y-2">
              {(report?.fairness_alerts || []).length === 0 && (
                <p className="text-sm text-success">No fairness alerts detected.</p>
              )}
              {(report?.fairness_alerts || []).map((alert, i) => (
                <p key={i} className="text-sm text-warning">{alert}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SystemOverviewPage;

