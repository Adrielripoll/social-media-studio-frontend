import { useState } from "react";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { StudioBrand } from "../auth/AuthShell";
import { authErrorMessage } from "../auth/errors";

export default function PlatformHeader({
  children,
  onSignOut,
  disabled = false,
  className = "",
}: {
  children?: ReactNode;
  onSignOut?: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy || disabled || !onSignOut) return;
    setBusy(true);
    setError("");
    try {
      await onSignOut();
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <header
      className={"platform-header " + className + (error ? " has-error" : "")}
    >
      <StudioBrand />
      {children}
      {onSignOut && (
        <button
          className="button secondary"
          disabled={busy || disabled}
          onClick={() => void logout()}
        >
          <LogOut size={15} />
          {busy ? "Saindo…" : "Sair"}
        </button>
      )}
      {error && (
        <p className="auth-message error platform-header-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
