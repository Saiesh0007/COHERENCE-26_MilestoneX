import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Target, Activity } from "lucide-react";
import { getRecentMatches, getStats, type Stats } from "@/lib/api";

const COLORS = ["hsl(187, 55%, 42%)", "hsl(152, 56%, 40%)", "hsl(38, 92%, 50%)", "hsl(215, 25%, 65%)", "hsl(340, 65%, 55%)", "hsl(187, 30%, 60%)"];

const ranges = [
  { label: "0-20%", min: 0, max: 20 },
  { label: "21-40%", min: 21, max: 40 },
  { label: "41-60%", min: 41, max: 60 },
  { label: "61-80%", min: 61, max: 80 },
  { label: "81-100%", min: 81, max: 100 },
];

const InsightsPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScores, setRecentScores] = useState<number[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getStats(), getRecentMatches(25)])
      .then(([statsData, recent]) => {
        setStats(statsData);
        setRecentScores(recent.results.map((item) => Math.round(item.score * 100)));
      })
      .catch(() => setError("Failed to load insights from backend."));
  }, []);

  const diseaseData = useMemo(
    () =>
      stats
        ? Object.entries(stats.conditions).map(([name, count]) => ({
            name,
            count,
          }))
        : [],
    [stats],
  );

  const scoreDistribution = useMemo(() => {
    return ranges.map((range) => ({
      range: range.label,
      count: recentScores.filter((score) => score >= range.min && score <= range.max).length,
    }));
  }, [recentScores]);

  const mostCommonDisease =
    diseaseData.length > 0 ? diseaseData.reduce((a, b) => (a.count > b.count ? a : b)).name : "-";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Analytics and distributions across patients and trials.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-slide-up-delay-1">
          <Card className="glass-card-elevated">
            <CardContent className="pt-6 pb-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent mx-auto mb-3 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.total_trials || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">Total Clinical Trials</p>
            </CardContent>
          </Card>

          <Card className="glass-card-elevated">
            <CardContent className="pt-6 pb-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent mx-auto mb-3 flex items-center justify-center">
                <Activity className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">{mostCommonDisease}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">Most Common Trial Condition</p>
            </CardContent>
          </Card>

          <Card className="glass-card-elevated">
            <CardContent className="pt-6 pb-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent mx-auto mb-3 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.total_patients || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">Total Patients</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-slide-up-delay-2">
          <Card className="glass-card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Disease Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diseaseData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="count" nameKey="name" label>
                      {diseaseData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Match Score Distribution</CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Based on recent matches
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(187, 55%, 42%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InsightsPage;

