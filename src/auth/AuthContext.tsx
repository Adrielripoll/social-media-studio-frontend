import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ApiError, registerCurrentUser } from "./api";
import type { PlatformUser } from "./api";

interface AuthState {
  session: Session | null;
  sessionLoading: boolean;
  identity: PlatformUser | null;
  verifying: boolean;
  error: string;
  retry: () => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [identity, setIdentity] = useState<PlatformUser | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    let active = true;
    let observed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      observed = true;
      setSession(next);
      setSessionLoading(false);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || observed) return;
        setSession(data.session);
        if (error)
          setError(
            "Não foi possível recuperar sua sessão. Faça login novamente.",
          );
        setSessionLoading(false);
      })
      .catch(() => {
        if (active && !observed) {
          setError(
            "Não foi possível recuperar sua sessão. Faça login novamente.",
          );
          setSessionLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const token = session?.access_token;
  useEffect(() => {
    if (!token) {
      setIdentity(null);
      setVerifying(false);
      return;
    }
    const controller = new AbortController();
    setIdentity(null);
    setError("");
    setVerifying(true);
    void registerCurrentUser(token, controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) setIdentity(user);
      })
      .catch(async (reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setError("Sua sessão não foi aceita. Faça login novamente.");
          await supabase?.auth.signOut({ scope: "local" });
        } else if (reason instanceof ApiError && reason.status === 400) {
          setError(reason.message);
        } else {
          setError("Não foi possível conectar ao seu espaço. Tente novamente.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setVerifying(false);
      });
    return () => controller.abort();
  }, [token, attempt]);

  async function signOut() {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
    setSession(null);
    setIdentity(null);
    setError("");
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        sessionLoading,
        identity,
        verifying,
        error,
        retry: () => setAttempt((current) => current + 1),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return state;
}
