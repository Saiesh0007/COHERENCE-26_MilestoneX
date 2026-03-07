import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import UploadData from "./pages/UploadData";
import UploadAndMatch from "./pages/UploadAndMatch";
import PatientMatching from "./pages/PatientMatching";
import TrialExplorer from "./pages/TrialExplorer";
import ExplainableAI from "./pages/ExplainableAI";
import Insights from "./pages/Insights";
import SystemOverview from "./pages/SystemOverview";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import GoogleAuthCallback from "./pages/GoogleAuthCallback";
import MySubmissions from "./pages/MySubmissions";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
            <Route
              path="/"
              element={(
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/my-submissions"
              element={(
                <ProtectedRoute>
                  <MySubmissions />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/upload"
              element={(
                <ProtectedRoute>
                  <UploadData />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/upload-and-match"
              element={(
                <ProtectedRoute>
                  <UploadAndMatch />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/patient-matching"
              element={(
                <ProtectedRoute>
                  <PatientMatching />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/trial-explorer"
              element={(
                <ProtectedRoute>
                  <TrialExplorer />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/explainable-ai"
              element={(
                <ProtectedRoute>
                  <ExplainableAI />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/insights"
              element={(
                <ProtectedRoute>
                  <Insights />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/system-overview"
              element={(
                <ProtectedRoute>
                  <SystemOverview />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/admin"
              element={(
                <ProtectedRoute role="admin">
                  <AdminPanel />
                </ProtectedRoute>
              )}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
