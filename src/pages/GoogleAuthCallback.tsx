import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const GoogleAuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing OAuth token from callback.");
      return;
    }

    completeOAuthLogin(token)
      .then(() => navigate("/", { replace: true }))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Google login failed.");
      });
  }, [params, completeOAuthLogin, navigate]);

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-background pattern-dots">
      <div className="text-center">
        <p className="text-base font-semibold">Completing Google sign-in...</p>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>
    </main>
  );
};

export default GoogleAuthCallbackPage;

