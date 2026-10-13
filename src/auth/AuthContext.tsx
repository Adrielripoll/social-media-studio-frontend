import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest, registerCurrentUser, resetCsrf } from "./api";
import type { PlatformUser } from "./api";

interface AuthState {
  authenticated: boolean;
  sessionLoading: boolean;
  identity: PlatformUser | null;
  verifying: boolean;
  error: string;
  retry: () => void;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [identity, setIdentity] = useState<PlatformUser | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<AbortController | null>(null);

  async function refreshSession() {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setVerifying(true);
    setError("");
    try {
      const result = await apiRequest<{ authenticated: boolean }>(
        "/auth/session",
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (!result || typeof result.authenticated !== "boolean")
        throw new ApiError(502);
      setAuthenticated(result.authenticated);
      if (!result.authenticated) {
        setIdentity(null);
        return;
      }
      if (window.location.pathname === "/redefinir-senha") return;
      const user = await registerCurrentUser(controller.signal);
      if (!controller.signal.aborted) setIdentity(user);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setIdentity(null);
      if (reason instanceof ApiError && reason.status === 401) {
        setAuthenticated(false);
        setError("Sua sessão expirou. Faça login novamente.");
      } else {
        setError(
          reason instanceof ApiError && [400, 409].includes(reason.status)
            ? reason.message
            : "Não foi possível conectar ao seu espaço. Tente novamente.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setVerifying(false);
        setSessionLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshSession();
    const onFocus = () => void refreshSession();
    window.addEventListener("focus", onFocus);
    return () => {
      current.current?.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  function clearState() {
    current.current?.abort();
    setAuthenticated(false);
    setIdentity(null);
    setError("");
    resetCsrf();
  }

  async function signIn(email: string, password: string) {
    await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setAuthenticated(true);
    await refreshSession();
  }

  async function signOut() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      clearState();
    }
  }

  async function updatePassword(password: string) {
    await apiRequest("/auth/password", { method: "POST", body: { password } });
    clearState();
  }

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        sessionLoading,
        identity,
        verifying,
        error,
        retry: () => void refreshSession(),
        refreshSession,
        signIn,
        signOut,
        updatePassword,
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
