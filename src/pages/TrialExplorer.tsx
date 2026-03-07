import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, MapPin, FlaskConical, BookOpenCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTrials, type Trial } from "@/lib/api";

const TrialExplorerPage = () => {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);

  useEffect(() => {
    getTrials()
      .then((data) => setTrials(data))
      .catch(() => setError("Failed to load trials from backend."))
      .finally(() => setLoading(false));
  }, []);

  const filteredTrials = useMemo(
    () =>
      trials.filter(
        (trial) =>
          trial.trial_id?.toLowerCase().includes(search.toLowerCase()) ||
          trial.condition?.toLowerCase().includes(search.toLowerCase()) ||
          trial.location?.toLowerCase().includes(search.toLowerCase()),
      ),
    [trials, search],
  );

  return (
    <DashboardLayout>
      <div className="page-shell max-w-5xl">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <BookOpenCheck className="h-3.5 w-3.5" />
            Trial Catalog
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Trial Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Browse and search available clinical trials.
          </p>
        </div>

        <div className="relative w-full max-w-xl animate-slide-up-delay-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trials by ID, condition, or location..."
            className="pl-9 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading && (
          <div className="grid gap-3 animate-slide-up-delay-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={`trial-skeleton-${i}`} className="surface-panel">
                <CardContent className="py-4 px-5">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-24 rounded bg-accent" />
                    <div className="h-3 w-36 rounded bg-accent" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-3 animate-slide-up-delay-2">
          {filteredTrials.map((trial, index) => (
            <Card
              key={`${trial.trial_id}-${index}`}
              className="surface-panel hover:shadow-md transition-all duration-300 group cursor-pointer"
              onClick={() => {
                setDetailLoading(true);
                setSelectedTrial(trial);
                setTimeout(() => setDetailLoading(false), 150);
              }}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <FlaskConical className="h-4 w-4 text-accent-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-foreground">{trial.trial_id}</span>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {trial.condition}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {trial.location}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-semibold shrink-0">
                    Clinical Trial
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && filteredTrials.length === 0 && (
            <Card className="surface-panel">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium text-foreground">No trials match your search.</p>
                <p className="text-xs text-muted-foreground mt-1">Try searching by trial ID (e.g., T0001) or city.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={Boolean(selectedTrial)} onOpenChange={(open) => !open && setSelectedTrial(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTrial?.trial_id} - Trial Details
              </DialogTitle>
              <DialogDescription>
                Full dataset fields for the selected clinical trial.
              </DialogDescription>
            </DialogHeader>
            {detailLoading ? (
              <div className="space-y-3">
                <div className="h-12 rounded bg-accent animate-pulse" />
                <div className="h-12 rounded bg-accent animate-pulse" />
                <div className="h-12 rounded bg-accent animate-pulse" />
              </div>
            ) : selectedTrial && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <p className="font-medium">{selectedTrial.condition}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedTrial.location}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Age Range</p>
                  <p className="font-medium">{selectedTrial.age_min} - {selectedTrial.age_max}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">HbA1c Minimum</p>
                  <p className="font-medium">{selectedTrial.hba1c_min}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Blood Pressure Minimum</p>
                  <p className="font-medium">{selectedTrial.bp_min}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Exclusion</p>
                  <p className="font-medium">{selectedTrial.exclusion || "None"}</p>
                </div>
                <div className="rounded-md border p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Inclusion Text</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedTrial.inclusion_text || "Not provided in dataset"}</p>
                </div>
                <div className="rounded-md border p-3 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Exclusion Text</p>
                  <p className="font-medium whitespace-pre-wrap">{selectedTrial.exclusion_text || "Not provided in dataset"}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TrialExplorerPage;
