import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminSubmissions, getAdminUsers, getStats, updateAdminUserRole, type AuthUser, type Stats, type SubmissionRecord } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const AdminPanelPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [error, setError] = useState("");
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getStats(), getAdminUsers(), getAdminSubmissions(200)])
      .then(([statsData, usersData, submissionsData]) => {
        setStats(statsData);
        setUsers(usersData.results);
        setSubmissions(submissionsData.results);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admin data."));
  }, []);

  const handleRoleUpdate = async (target: AuthUser, role: "user" | "admin") => {
    setBusyUserId(target.id);
    setError("");
    try {
      const data = await updateAdminUserRole(target.id, role);
      setUsers((prev) => prev.map((u) => (u.id === target.id ? data.user : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-shell">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all users, platform records, and submission details.
          </p>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="surface-panel">
            <CardContent className="py-5">
              <p className="field-label">Users</p>
              <p className="text-3xl font-bold mt-1">{users.length}</p>
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardContent className="py-5">
              <p className="field-label">Patients</p>
              <p className="text-3xl font-bold mt-1">{stats?.total_patients ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardContent className="py-5">
              <p className="field-label">Submissions</p>
              <p className="text-3xl font-bold mt-1">{submissions.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Registered Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="rounded-md border border-border/60 p-3 text-sm flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                  {u.id !== user?.id && (
                    <>
                      {u.role !== "admin" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRoleUpdate(u, "admin")}
                          disabled={busyUserId === u.id}
                        >
                          Make Admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRoleUpdate(u, "user")}
                          disabled={busyUserId === u.id}
                        >
                          Make User
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>All Submission Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions found.</p>}
            {submissions.map((row) => (
              <div key={row.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {row.user_name} ({row.user_email})
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Patient: {row.patient_id || "Generated"} | Radius: {row.radius_km} km | Limit: {row.result_limit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Top Trial: {row.top_trial_id || "n/a"} | Score:{" "}
                  {row.top_score !== null ? `${Math.round(row.top_score * 100)}%` : "n/a"} | Count: {row.recommended_count}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPanelPage;
