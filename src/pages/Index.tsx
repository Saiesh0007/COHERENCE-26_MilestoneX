import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, FlaskConical, CheckCircle2, TrendingUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { getRecentMatches, getStats, type RecentMatch, type Stats } from "@/lib/api";

const scoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 80) return "text-primary";
  if (score >= 70) return "text-warning";
  return "text-destructive";
};

const scoreBg = (score: number) => {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-primary";
  if (score >= 70) return "bg-warning";
  return "bg-destructive";
};

const DashboardPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getStats(), getRecentMatches(5)])
      .then(([statsData, recentData]) => {
        setStats(statsData);
        setRecentMatches(recentData.results);
      })
      .catch(() => setError("Failed to load dashboard metrics from backend."));
  }, []);

  const avgConfidence = useMemo(() => {
    if (!recentMatches.length) return 0;
    const avg = recentMatches.reduce((sum, match) => sum + match.score, 0) / recentMatches.length;
    return Math.round(avg * 1000) / 10;
  }, [recentMatches]);

  return (
    <DashboardLayout>
      <div className="page-shell">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
            AI system that analyzes anonymized patient records and matches them with suitable clinical trials.
          </p>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up-delay-1">
          <StatCard
            title="Patients Loaded"
            value={String(stats?.total_patients ?? 0)}
            icon={<Users className="h-4 w-4" />}
            subtitle="Sourced from backend dataset"
            accent
          />
          <StatCard
            title="Clinical Trials"
            value={String(stats?.total_trials ?? 0)}
            icon={<FlaskConical className="h-4 w-4" />}
            subtitle="Active trials in database"
          />
          <StatCard
            title="Recent Matches"
            value={String(recentMatches.length)}
            icon={<CheckCircle2 className="h-4 w-4" />}
            subtitle="Most recent computed results"
          />
          <StatCard
            title="Avg Confidence"
            value={`${avgConfidence}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            subtitle="Across recent matches"
          />
        </div>

        <div className="flex animate-slide-up-delay-2">
          <Button asChild className="gap-2 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 px-6 h-11 text-sm font-semibold">
            <Link to="/patient-matching">
              <Play className="h-4 w-4" />
              Start Matching
            </Link>
          </Button>
        </div>

        <Card className="surface-panel animate-slide-up-delay-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Matches</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-medium">
                {recentMatches.length} results
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentMatches.map((match, i) => {
                const score = Math.round(match.score * 100);
                return (
                  <div
                    key={`${match.patient_id}-${i}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-3 rounded-lg hover:bg-accent/40 transition-colors duration-200 group cursor-default"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                        <span className="text-[10px] font-bold text-accent-foreground">
                          {match.patient_id.replace("P", "")}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-foreground truncate">{match.patient_id}</span>
                          <span className="text-xs text-muted-foreground">-&gt;</span>
                          <span className="text-sm font-mono text-muted-foreground truncate">{match.trial_id}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {match.disease}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[170px]">
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBg(score)} transition-all duration-500`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-11 text-right shrink-0 ${scoreColor(score)}`}>{score}%</span>
                    </div>
                  </div>
                );
              })}

              {recentMatches.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-foreground">No recent matches yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Run a match from Upload Data or Patient Matching to populate this list.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
