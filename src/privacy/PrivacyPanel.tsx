import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useAccount } from "../account/AccountContext";
import { apiRequest } from "../auth/api";
import { authErrorMessage } from "../auth/errors";
import Dialog from "../components/Dialog";
import MotionPresence from "../components/MotionPresence";
import ExitFeedback from "./ExitFeedback";
import type { ExitFeedbackValue } from "./ExitFeedback";
import "./privacy.css";
export default function PrivacyPanel() {
  const account = useAccount();
  const canCancelRenewal = ["active", "overdue"].includes(
    account?.account?.access.status ?? "",
  );
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<ExitFeedbackValue>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retention, setRetention] = useState<{
    months: number;
    purgeAt: string | null;
    status: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ workRetention: typeof retention }>("/account/privacy", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setRetention(result.workRetention);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  function close() {
    if (!busy) {
      setOpen(false);
      setPassword("");
      setError("");
    }
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Informe sua senha atual para confirmar a exclusão.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ accepted: boolean; protocol: string }>(
        "/account/deletion",
        {
          method: "POST",
          body: { currentPassword: password, ...feedback },
          timeoutMs: 30_000,
        },
      );
      setPassword("");
      if (!result.accepted || !result.protocol) throw new Error();
      window.location.assign(
        "/conta-excluida?protocolo=" + encodeURIComponent(result.protocol),
      );
    } catch (reason) {
      setError(authErrorMessage(reason));
      setBusy(false);
    }
  }
  return (
    <section
      className="account-card privacy-panel"
      aria-labelledby="privacy-title"
    >
      <div className="account-card-heading">
        <span className="account-card-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h2 id="privacy-title">Privacidade e seus dados</h2>
          <p>Você tem controle sobre sua conta.</p>
        </div>
      </div>
      <p>
        Para solicitar acesso, cópia ou correção dos seus dados, fale com{" "}
        <a href="mailto:sergastudio@outlook.com">sergastudio@outlook.com</a>.
        Confirmaremos sua identidade antes do atendimento. Não envie senhas ou
        documentos sem orientação.
      </p>
      <p>
        <a href="/privacidade" target="_blank" rel="noopener noreferrer">
          Ler a política de privacidade
        </a>
      </p>
      {retention?.status === "retained" && retention.purgeAt && (
        <p role="status">
          Seu cadastro e dados de trabalho seguem a retenção de{" "}
          {retention.months} meses e poderão ser removidos a partir de{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }).format(new Date(retention.purgeAt))}
          . Os avisos podem estender esse prazo. Entrar na plataforma não
          reinicia a contagem.
        </p>
      )}
      <p>
        Excluir a conta é diferente de cancelar a assinatura. A exclusão encerra
        o acesso, interrompe renovações e remove seus dados de trabalho e
        arquivos.
      </p>
      <button
        className="button secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        Excluir minha conta
      </button>
      <MotionPresence>
        {open && (
          <Dialog
            title="Excluir sua conta definitivamente?"
            onClose={close}
            busy={busy}
          >
            <form
              onSubmit={(event) => void remove(event)}
              className="account-form"
            >
              <p>
                Seus clientes, tarefas, feeds, dashboards e arquivos serão
                removidos. Essa ação é definitiva. Seu acesso será encerrado
                após a confirmação, mesmo que ainda exista um período pago
                disponível.
              </p>
              <p>
                Registros necessários de cobrança, aceite e comprovação do
                pedido serão conservados por seus prazos próprios.{" "}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Entenda a conservação de dados.
                </a>
              </p>
              {canCancelRenewal && (
                <p>
                  Se você deseja apenas interromper renovações, pode{" "}
                  <a href="/minha-conta?secao=assinatura">
                    gerenciar sua assinatura
                  </a>{" "}
                  e manter o cadastro.
                </p>
              )}
              <ExitFeedback
                context="account_deletion"
                value={feedback}
                onChange={setFeedback}
                disabled={busy}
              />
              <label className="field">
                <span>Senha atual</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error && (
                <p className="account-feedback error" role="alert">
                  {error}
                </p>
              )}
              <div className="billing-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={close}
                >
                  Manter minha conta
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy}
                >
                  {busy ? "Confirmando…" : "Excluir minha conta"}
                </button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>
    </section>
  );
}
