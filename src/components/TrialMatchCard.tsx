import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import type { TrialMatch } from "@/lib/api";

type TrialMatchCardProps = {
  match: TrialMatch;
  rank: number;
  topScore: number;
  fallbackPatientLocation?: string;
};

export function TrialMatchCard({ match, rank, topScore, fallbackPatientLocation }: TrialMatchCardProps) {
  const score = Math.round(match.match_score * 100);
  const ruleScore = Math.round((match.rule_score || 0) * 100);
  const mlScore = Math.round((match.ml_score || 0) * 100);
  const gap = Math.max(0, topScore - score);

  const scoreTone =
    score >= 90
      ? "text-emerald-600"
      : score >= 80
        ? "text-primary"
        : score >= 70
          ? "text-amber-600"
          : "text-rose-600";
  const scoreBarTone =
    score >= 90
      ? "bg-emerald-500"
      : score >= 80
        ? "bg-primary"
        : score >= 70
          ? "bg-amber-500"
          : "bg-rose-500";
  const gapTone = gap <= 2 ? "text-emerald-600" : gap <= 6 ? "text-amber-600" : "text-rose-600";

  const patientLocation = match.patient_location || fallbackPatientLocation || "Unknown";
  const trialDisplayLocation = match.location || match.trial_city || "Unknown";
  const kmLabel = match.distance_km !== null ? `${match.distance_km} km` : "distance unavailable";

  return (
    <Card
      className={`surface-panel animate-card-in ${rank === 0 ? "ring-1 ring-primary/20" : ""}`}
      style={{ animationDelay: `${Math.min(rank * 70, 420)}ms` }}
    >
      <CardContent className="py-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-2xl tracking-tight font-mono">{match.trial_id}</p>
              {rank === 0 && <Badge className="bg-yellow-500 text-white">Top Match</Badge>}
              <Badge variant="outline" className={`${gapTone} border-current`}>Gap {gap}%</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {match.condition}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Patient: {patientLocation} {"->"} Trial: {trialDisplayLocation} | {kmLabel}
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Rule: {ruleScore}% | ML: {mlScore}% | Gap from top: {gap}%
            </p>
          </div>

          <div className="min-w-[120px] sm:text-right">
            <p className={`text-3xl font-bold ${scoreTone}`}>{score}%</p>
            <p className="text-xs text-muted-foreground">Match Score</p>
            <div className="w-full sm:w-24 h-2 rounded bg-secondary mt-2 sm:ml-auto overflow-hidden">
              <div className={`h-full ${scoreBarTone}`} style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(match.explanation || []).map((reason, index) => (
            <div key={index} className="text-xs rounded-md bg-accent/40 px-2 py-1 border border-border/40">
              {reason}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
