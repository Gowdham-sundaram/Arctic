import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { AuthSession } from "@arctic/contracts";
import { clearAuthSession, readAuthSession, writeAuthSession } from "./auth-storage.ts";

interface AuthContextValue {
  session: AuthSession | null;
  saveSession: (session: AuthSession) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readAuthSession());
  const saveSession = useCallback((nextSession: AuthSession) => {
    writeAuthSession(nextSession);
    setSession(nextSession);
  }, []);
  const clearSession = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, saveSession, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
