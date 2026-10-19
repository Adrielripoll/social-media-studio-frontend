import RetentionNotice from "../account/RetentionNotice";
import { useEffect, useState } from "react";
import { CreditCard, LockKeyhole, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "../auth/api";
import { useAccount } from "../account/AccountContext";
import StorageSummary, { formatBytes } from "../account/StorageSummary";
import Dialog from "../components/Dialog";
import "./billing.css";
interface ResumptionOffer {
  mode: "renewal" | "checkout";
  nextChargeDate: string;
  priceCents: number | null;
}

interface Billing {
  available: boolean;
  priceCents: number | null;
  subscription: null | {
    status: string;
    anchorDate: string;
    priceCents: number;
    canceledAt: string | null;
    checkoutUrl: string | null;
    nextRenewalDate?: string | null;
    paymentMethod?: string;
  };
  resumption?: ResumptionOffer | null;
  currentPeriod?: { start: string; end: string } | null;
  payments: {
    status: string;
    dueDate: string;
    valueCents: number;
    invoiceUrl: string | null;
  }[];
}
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(value.length === 10 ? value + "T12:00:00Z" : value),
  );
function checkoutUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["sandbox.asaas.com", "www.asaas.com", "asaas.com"].includes(url.hostname)
  )
    throw new Error();
  return url.href;
}
const statusLabels: Record<string, string> = {
  creating: "Contratação em verificação",
  pending: "Aguardando pagamento",
  active: "Assinatura contratada",
  cancel_requested: "Cancelamento em processamento",
  resume_requested: "Retomada em processamento",
  canceled: "Assinatura cancelada",
};
export default function BillingPanel({
  blocked = false,
}: {
  blocked?: boolean;
}) {
  const state = useAccount();
  const [billing, setBilling] = useState<Billing | null>(null),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [revision, setRevision] = useState(0);
  const [resumeConfirmation, setResumeConfirmation] =
    useState<ResumptionOffer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Billing>("/billing", { signal: controller.signal })
      .then((value) => {
        if (
          !value ||
          typeof value.available !== "boolean" ||
          !Array.isArray(value.payments)
        )
          throw new Error();
        if (controller.signal.aborted) return;
        setBilling(value);
        setLoadError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError("Não foi possível consultar sua assinatura.");
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const timer = setInterval(() => {
      setRevision((v) => v + 1);
      state?.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  async function action(
    kind: "checkout" | "cancel" | "reconcile" | "resume",
    offer?: ResumptionOffer,
  ) {
    if (busy || (kind === "resume" && !offer)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{
        url?: string;
        kind?: "resumed" | "checkout";
        nextChargeDate?: string | null;
      }>("/billing/" + kind, {
        method: "POST",
        body:
          kind === "checkout"
            ? { plan: "basic" }
            : offer
              ? { mode: offer.mode }
              : undefined,
        timeoutMs: 60_000,
      });
      if (
        kind === "checkout" ||
        (kind === "resume" && result.kind === "checkout")
      ) {
        if (!result.url) throw new Error();
        window.location.assign(checkoutUrl(result.url));
        return;
      }
      setConfirm(false);
      setResumeConfirmation(null);
      setRevision((v) => v + 1);
      state?.refresh();
      if (kind === "resume") {
        setNotice(
          "Assinatura retomada. Nenhuma cobrança foi feita agora." +
            (result.nextChargeDate
              ? " A próxima cobrança será em " +
                date(result.nextChargeDate) +
                "."
              : ""),
        );
        return;
      }
      setNotice(
        kind === "cancel"
          ? "Cancelamento confirmado. Seu acesso continua até o término do ciclo pago."
          : "Verificação solicitada. A confirmação pode levar alguns minutos; esta página será atualizada automaticamente.",
      );
    } catch (reason) {
      setRevision((value) => value + 1);
      state?.refresh();
      if (
        reason instanceof ApiError &&
        ["paid_cycle_ended", "subscription_not_resumable"].includes(reason.code)
      ) {
        setResumeConfirmation(null);
      }
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  const access = state?.account?.access,
    subscription = billing?.subscription;
  const priceCents =
    subscription &&
    (subscription.status !== "canceled" ||
      (access?.allowed && access.status === "canceled"))
      ? subscription.priceCents
      : billing?.priceCents;
  return (
    <div className="billing-content">
      <div className="billing-heading">
        <span className="auth-eyebrow">SUA ASSINATURA</span>
        <h2>
          {blocked
            ? "Vamos regularizar seu acesso."
            : "Seu plano, sem complicação."}
        </h2>
        {blocked && (
          <p className="billing-blocked" role="status">
            <LockKeyhole size={20} aria-hidden="true" />
            {access?.status === "trial_expired"
              ? "Seu período gratuito terminou. Contrate o plano para continuar usando suas ferramentas."
              : "Seu acesso está suspenso. Regularize o pagamento para voltar às suas ferramentas."}
          </p>
        )}
        {!blocked && access?.status === "trialing" && (
          <p>
            Teste gratuito até {date(access.trialEndsAt)}. A contratação é
            opcional e não ocorre automaticamente.
          </p>
        )}
        {access?.paidUntil && (
          <p>
            Acesso pago até{" "}
            {date(new Date(Date.parse(access.paidUntil) - 1).toISOString())}
            {access.status === "canceled"
              ? ". Sua assinatura não será renovada."
              : "."}
          </p>
        )}
      </div>
      <StorageSummary />
      <RetentionNotice />
      <section className="billing-card" aria-label="Assinatura do Plano Básico">
        <CreditCard size={26} aria-hidden="true" />
        <h2>{state?.account?.plan.name ?? "Plano Básico"}</h2>
        <p>
          Fotos, carrosséis e suas ferramentas de organização. Armazenamento
          {state?.account
            ? " de " + formatBytes(state.account.storage.limitBytes)
            : ""}{" "}
          compartilhado entre as ferramentas.
        </p>
        <strong className="billing-price">
          {priceCents ? money(priceCents) + " / mês" : "Preço em definição"}
        </strong>
        <p>
          Pagamento mensal com cartão de crédito. Você informa os dados de
          pagamento diretamente no ambiente do Asaas.
        </p>
        {subscription && (
          <p role="status">
            {statusLabels[subscription.status] ?? "Verificando assinatura"}.
            Data-base: dia {Number(subscription.anchorDate.slice(-2))}.
          </p>
        )}
        {error && (
          <p className="auth-message error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="auth-message" role="status">
            {notice}
          </p>
        )}
        {loadError && (
          <div className="account-feedback error" role="alert">
            <p>{loadError}</p>
            <button
              className="button secondary"
              onClick={() => setRevision((v) => v + 1)}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!billing && !loadError && <p role="status">Consultando assinatura…</p>}
        {billing && !billing.available && (
          <p role="status">A contratação estará disponível em breve.</p>
        )}
        {subscription && (
          <dl className="account-facts">
            <div>
              <dt>Pagamento</dt>
              <dd>Cartão de crédito recorrente</dd>
            </div>
            <div>
              <dt>Próxima renovação</dt>
              <dd>
                {subscription.status === "canceled"
                  ? "Não será renovada"
                  : subscription.nextRenewalDate
                    ? date(subscription.nextRenewalDate)
                    : "Aguardando confirmação"}
              </dd>
            </div>
            {billing?.currentPeriod && (
              <div>
                <dt>Ciclo atual</dt>
                <dd>
                  {date(billing.currentPeriod.start)} a{" "}
                  {date(
                    new Date(
                      Date.parse(billing.currentPeriod.end) - 1,
                    ).toISOString(),
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
        {billing?.resumption && (
          <p className="auth-message" role="status">
            {billing.resumption.mode === "renewal"
              ? "Você pode retomar sua assinatura sem nenhuma cobrança agora. A próxima cobrança será no início do próximo ciclo, em " +
                date(billing.resumption.nextChargeDate) +
                "."
              : "Seu ciclo anterior terminou. Para retomar, será necessário um novo pagamento para iniciar um novo ciclo."}
          </p>
        )}
        <div className="billing-actions">
          {(!subscription || subscription.status === "pending") && (
            <button
              className="button primary"
              disabled={
                busy ||
                !billing?.available ||
                !state?.account?.retention?.acceptedAt ||
                !!loadError ||
                !priceCents ||
                (subscription?.status === "pending" &&
                  !subscription.checkoutUrl)
              }
              onClick={() => void action("checkout")}
            >
              {busy
                ? "Aguarde…"
                : subscription?.checkoutUrl
                  ? "Continuar pagamento"
                  : "Contratar Plano Básico"}
            </button>
          )}
          {subscription?.status === "canceled" && billing?.resumption && (
            <button
              className="button primary"
              disabled={
                busy ||
                !billing.available ||
                !state?.account?.retention?.acceptedAt ||
                !!loadError ||
                !billing.resumption.priceCents
              }
              onClick={() => {
                setError("");
                setResumeConfirmation(
                  billing.resumption ? { ...billing.resumption } : null,
                );
              }}
            >
              Retomar assinatura
            </button>
          )}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setRevision((v) => v + 1);
              state?.refresh();
              if (billing?.available) void action("reconcile");
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Verificar pagamento
          </button>
          {subscription &&
            ["active", "pending"].includes(subscription.status) && (
              <button
                className="button secondary"
                disabled={busy || !billing?.available}
                onClick={() => setConfirm(true)}
              >
                Cancelar assinatura
              </button>
            )}
        </div>
        <p className="billing-footnote">
          O retorno do checkout não confirma o pagamento. O acesso será liberado
          após a confirmação pelo Asaas. Em caso de atraso, o vencimento
          permanece na data-base contratada.
        </p>
      </section>
      {billing && !billing.payments.length && (
        <section className="billing-card account-empty" aria-label="Cobranças">
          <h2>Cobranças</h2>
          <p>Suas cobranças aparecerão aqui após a contratação.</p>
        </section>
      )}
      {!!billing?.payments.length && (
        <section className="billing-card" aria-label="Cobranças">
          <h2>Cobranças</h2>
          <ul className="billing-payments">
            {billing.payments.map((p, i) => (
              <li key={p.dueDate + "-" + i}>
                <div>
                  <strong>{money(p.valueCents)}</strong>
                  <span>Vencimento {date(p.dueDate)}</span>
                  <span>
                    {["CONFIRMED", "RECEIVED"].includes(p.status)
                      ? "Pagamento confirmado"
                      : p.status === "OVERDUE"
                        ? "Pagamento atrasado"
                        : p.status === "REFUNDED"
                          ? "Pagamento estornado"
                          : p.status.startsWith("CHARGEBACK")
                            ? "Pagamento em contestação"
                            : p.status === "DELETED"
                              ? "Cobrança cancelada"
                              : "Aguardando confirmação"}
                  </span>
                </div>
                {p.invoiceUrl && (
                  <a
                    className="button secondary"
                    href={checkoutUrl(p.invoiceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver cobrança
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {resumeConfirmation && (
        <Dialog
          title="Retomar assinatura?"
          onClose={() => setResumeConfirmation(null)}
          busy={busy}
        >
          {resumeConfirmation.mode === "renewal" ? (
            <p>
              <strong>Nenhuma cobrança será feita agora.</strong> Seu ciclo já
              está pago. A próxima cobrança será de{" "}
              {money(resumeConfirmation.priceCents ?? 0)} em{" "}
              {date(resumeConfirmation.nextChargeDate)}, no início do próximo
              ciclo. Depois disso, a renovação será mensal.
            </p>
          ) : (
            <p>
              Seu ciclo anterior terminou. Você será direcionado ao Asaas para
              pagar {money(resumeConfirmation.priceCents ?? 0)} agora e iniciar
              um novo ciclo mensal. O acesso será liberado após a confirmação do
              pagamento.
            </p>
          )}
          <div className="billing-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setResumeConfirmation(null)}
            >
              Voltar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void action("resume", resumeConfirmation)}
            >
              {busy
                ? "Aguarde…"
                : resumeConfirmation.mode === "renewal"
                  ? "Confirmar retomada"
                  : "Continuar para pagamento"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {confirm && (
        <Dialog
          title="Cancelar assinatura?"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p>
            As próximas renovações serão encerradas. O acesso ao período já pago
            será preservado
            {access?.paidUntil
              ? " até " +
                date(new Date(Date.parse(access.paidUntil) - 1).toISOString())
              : ""}
            .
          </p>
          <div className="billing-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Manter assinatura
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void action("cancel")}
            >
              {busy ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </div>
  );
}
