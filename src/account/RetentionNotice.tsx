import { ShieldCheck, Clock3 } from "lucide-react";
import { useId, useState } from "react";
import { useAccount } from "./AccountContext";
import { apiRequest, ApiError } from "../auth/api";
export default function RetentionNotice({
  onAccepted,
  onBusyChange,
}: { onAccepted?: () => void; onBusyChange?: (busy: boolean) => void } = {}) {
  const titleId = useId();
  const account = useAccount(),
    retention = account?.account?.retention;
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [acceptedVersion, setAcceptedVersion] = useState("");
  const accepted =
    !!retention?.acceptedAt ||
    (!!retention?.policy && acceptedVersion === retention.policy.version);
  const end = retention?.projectedPurgeAt
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(retention.projectedPurgeAt))
    : null;
  async function accept() {
    if (!checked || busy || !retention?.policy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await apiRequest("/account/retention/accept", {
        method: "POST",
        body: { version: retention.policy.version, accepted: true },
      });
      setAcceptedVersion(retention.policy.version);
      account?.refresh();
      onAccepted?.();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível registrar o aceite. Tente novamente.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section
      className="account-card account-retention"
      aria-labelledby={titleId}
    >
      <div className="account-card-heading">
        <span className="account-card-icon blue">
          {retention?.status === "retained" ? (
            <Clock3 size={22} />
          ) : (
            <ShieldCheck size={22} />
          )}
        </span>
        <div>
          <h2 id={titleId}>Seus arquivos, com clareza</h2>
          <p>Política de retenção do armazenamento.</p>
        </div>
      </div>
      {retention?.status === "retained" && end && (
        <p className="account-feedback warning" role="status">
          Prazo previsto pela política de retenção: <strong>{end}</strong>. Sua
          conta segue o prazo de {retention.months}{" "}
          {retention.months === 1 ? "mês" : "meses"} após o fim do acesso.
        </p>
      )}
      <p>
        Contas com assinatura em dia têm seus arquivos preservados. Após o teste
        sem contratação, a retenção prevista é de 1 mês. Para quem já teve uma
        assinatura paga, são 6 meses após o término do acesso pago.
      </p>
      <p>
        A exclusão dos arquivos é definitiva. Seu cadastro e os textos e dados
        das ferramentas serão preservados. Entrar na conta não reinicia o prazo.
      </p>
      {retention?.purgedAt && (
        <p className="account-feedback warning" role="status">
          Os arquivos desta conta foram excluídos pela política de retenção.
        </p>
      )}
      <p className="account-field-help">
        {retention?.automaticPurgeEnabled
          ? "A exclusão automática está ativa para contas elegíveis que aceitaram a política e receberam os avisos. Regularize antes do início da exclusão para preservar seus arquivos restantes."
          : "A exclusão automática ainda não está ativa. A ativação depende da configuração dos avisos e da publicação dos termos de uso."}
      </p>
      {retention?.policy && (
        <>
          <details open={onAccepted ? true : undefined}>
            <summary>
              Ler política de retenção · versão {retention.policy.version}
            </summary>
            {retention.policy.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </details>
          {accepted ? (
            <p className="account-field-help" role="status">
              Política de retenção aceita
              {retention.acceptedAt
                ? " em " +
                  new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(retention.acceptedAt))
                : ""}
              .
            </p>
          ) : (
            <div className="retention-acceptance">
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                  disabled={busy}
                />
                Li e aceito a política de retenção e a exclusão definitiva dos
                arquivos nos prazos informados.
              </label>
              <button
                className="button secondary"
                disabled={!checked || busy}
                onClick={() => void accept()}
              >
                {busy
                  ? "Registrando…"
                  : onAccepted
                    ? "Aceitar e continuar"
                    : "Aceitar política de retenção"}
              </button>
              <p className="account-field-help">
                O aceite é necessário para contratar uma assinatura.
              </p>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="account-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
