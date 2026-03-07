import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthToken,
  getMe,
  getStoredAuthToken,
  loginUser,
  logoutUser,
  registerUser,
  setStoredAuthToken,
  type AuthUser,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  completeOAuthLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearStoredAuthToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(email: string, password: string) {
        const data = await loginUser({ email, password });
        setStoredAuthToken(data.token);
        setUser(data.user);
      },
      async register(name: string, email: string, password: string) {
        const data = await registerUser({ name, email, password });
        setStoredAuthToken(data.token);
        setUser(data.user);
      },
      async completeOAuthLogin(token: string) {
        setStoredAuthToken(token);
        const me = await getMe();
        setUser(me.user);
      },
      async logout() {
        try {
          await logoutUser();
        } finally {
          clearStoredAuthToken();
          setUser(null);
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
