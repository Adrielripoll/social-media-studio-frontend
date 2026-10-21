import { useEffect, useId, useState } from "react";
import { BadgeCheck, Mail } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../auth/api";
import { authErrorMessage } from "../auth/errors";
export async function checkEmailVerification(): Promise<boolean> {
  const result = await apiRequest<{ verified: boolean }>(
    "/account/email-verification",
  );
  return result.verified === true;
}
export default function EmailVerification({
  forceUnverified = false,
  inline = false,
}: {
  forceUnverified?: boolean;
  inline?: boolean;
}) {
  const auth = useAuth();
  const tooltipId = useId();
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(
    forceUnverified ? false : null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setVerified(await checkEmailVerification());
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (forceUnverified) return;
    let active = true;
    void checkEmailVerification()
      .then((value) => {
        if (active) setVerified(value);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível consultar a confirmação do email.");
      });
    return () => {
      active = false;
    };
  }, [forceUnverified]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function resend() {
    if (busy || cooldown || !auth.identity?.email) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/auth/resend", {
        method: "POST",
        body: { email: auth.identity.email },
      });
      setNotice(
        "Enviamos as instruções. Confira sua caixa de entrada e a pasta de spam.",
      );
      setCooldown(60);
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={
        "privacy-email" +
        (inline ? " privacy-email-inline" : "") +
        (verified === true ? " is-verified" : "")
      }
    >
      {verified === true ? (
        <span
          className={
            inline ? "privacy-email-badge" : "account-feedback success"
          }
          role="status"
          aria-label="Email verificado"
          aria-describedby={inline ? tooltipId : undefined}
          tabIndex={inline ? 0 : undefined}
          data-tooltip-dismissed={tooltipDismissed || undefined}
          onMouseEnter={inline ? () => setTooltipDismissed(false) : undefined}
          onFocus={inline ? () => setTooltipDismissed(false) : undefined}
          onKeyDown={
            inline
              ? (event) => {
                  if (event.key === "Escape") setTooltipDismissed(true);
                }
              : undefined
          }
        >
          <BadgeCheck size={inline ? 22 : 18} aria-hidden="true" />
          {inline ? (
            <span
              id={tooltipId}
              className="privacy-email-tooltip"
              role="tooltip"
            >
              Email verificado
            </span>
          ) : (
            <span>Email verificado</span>
          )}
        </span>
      ) : (
        <>
          <p role="status">
            {verified === null
              ? "Consultando confirmação do email…"
              : "Email não verificado. Confirme seu email para contratar ou retomar uma assinatura."}
          </p>
          <div className="billing-actions">
            {verified === false && (
              <button
                type="button"
                className="button secondary"
                disabled={busy || cooldown > 0}
                onClick={() => void resend()}
              >
                <Mail size={16} aria-hidden="true" />
                {cooldown ? "Reenviar em " + cooldown + "s" : "Verificar email"}
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void refresh()}
            >
              {busy ? "Consultando…" : "Já confirmei, atualizar"}
            </button>
          </div>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="account-feedback error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
