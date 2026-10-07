import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { setUnauthorizedHandler } from "@/services/api";
import { authService } from "@/services/auth";
import { tokenStore } from "@/services/tokenStore";
import type { User } from "@/types";

type AuthState = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  state: AuthState;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AuthState>(() => (tokenStore.get() ? "loading" : "anonymous"));

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setState("anonymous");
  }, []);

  // Restore an existing session on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    authService
      .me()
      .then((u) => {
        setUser(u);
        setState("authenticated");
      })
      .catch(clearSession);
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      toast.error("Your session has ended. Sign in again to continue.");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await authService.login(email, password, remember);
    tokenStore.set(res.access_token, remember);
    setUser(res.user);
    setState("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* the local session is cleared regardless */
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ user, state, login, logout }), [user, state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
