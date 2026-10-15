import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Eye,
  Heart,
  Camera,
  MousePointer2,
  ScanEye,
  Sparkles,
  UserRound,
  Users,
  BarChart3,
  Check,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Dialog from "../components/Dialog";
import type { Client } from "../workspace/api";
import {
  deleteDashboard,
  errorMessage,
  getDashboard,
  updateDashboard,
} from "./api";
import type { Dashboard, Period } from "./api";
import {
  engagementRate,
  formatCount,
  formatRate,
  interactions,
  periodLabel,
  variation,
} from "./metrics";
const DashboardCharts = lazy(() => import("./DashboardCharts"));
import DashboardImport from "./DashboardImport";
import MetricSparkline from "./MetricSparkline";
import type { LucideIcon } from "lucide-react";
import "./dashboards.css";
type Metadata = Pick<Dashboard, "name" | "accountName" | "clientId" | "notes">;
const metadataOf = (value: Dashboard): Metadata => ({
  name: value.name,
  accountName: value.accountName,
  clientId: value.clientId,
  notes: value.notes,
});
const keyOf = (period: Period) => period.startDate + "/" + period.endDate;
export default function DashboardDetail({
  id,
  clients,
  onBack,
  onDirtyChange,
}: {
  id: string;
  clients: Client[];
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [draft, setDraft] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0),
    [importing, setImporting] = useState(false),
    [removing, setRemoving] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [currentKey, setCurrentKey] = useState(""),
    [previousKey, setPreviousKey] = useState("");
  const presentationButton = useRef<HTMLButtonElement>(null);
  const dirty =
    !!dashboard &&
    !!draft &&
    JSON.stringify(metadataOf(dashboard)) !== JSON.stringify(draft);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    document.body.classList.toggle("dashboard-presenting", presenting);
    if (!presenting) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPresenting(false);
        window.requestAnimationFrame(() => presentationButton.current?.focus());
      }
    }
    window.addEventListener("keydown", escape);
    return () => {
      document.body.classList.remove("dashboard-presenting");
      window.removeEventListener("keydown", escape);
    };
  }, [presenting]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSuccess("");
    void getDashboard(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setDashboard(value);
          setDraft(metadataOf(value));
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, reload]);
  function accept(value: Dashboard) {
    setDashboard(value);
    setDraft(metadataOf(value));
    setError("");
  }
  async function save() {
    if (!dashboard || !draft || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      accept(
        await updateDashboard(id, { ...draft, revision: dashboard.revision }),
      );
      setSuccess("Informações salvas.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteDashboard(id);
      onDirtyChange(false);
      onBack();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  function retry() {
    if (
      dirty &&
      !window.confirm(
        "Descartar as alterações não salvas e recarregar o dashboard?",
      )
    )
      return;
    setReload((value) => value + 1);
  }
  if (loading)
    return (
      <div className="dashboard-status" role="status">
        <LoaderCircle className="spin" size={24} />
        Carregando seu dashboard…
      </div>
    );
  if (!dashboard || !draft)
    return (
      <section className="dashboard-page">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar aos dashboards
        </button>
        <div className="workspace-error" role="alert">
          <span>{error || "Dashboard indisponível."}</span>
          <button className="button secondary" onClick={retry}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </section>
    );
  const periods = [...dashboard.periods].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const current =
    periods.find((period) => keyOf(period) === currentKey) ?? periods[0];
  const index = current ? periods.indexOf(current) : -1;
  const previous =
    previousKey === "none"
      ? undefined
      : (periods.find(
          (period) => keyOf(period) === previousKey && period !== current,
        ) ?? periods[index + 1]);
  const client = clients.find((value) => value.id === dashboard.clientId);
  const cards: {
    label: string;
    tone: string;
    icon: LucideIcon;
    value: (period: Period) => number | null;
  }[] = [
    { label: "Alcance", tone: "violet", icon: ScanEye, value: (p) => p.reach },
    { label: "Visualizações", tone: "blue", icon: Eye, value: (p) => p.views },
    { label: "Interações", tone: "rose", icon: Heart, value: interactions },
    {
      label: "Novos seguidores",
      tone: "mint",
      icon: Users,
      value: (p) => p.newFollowers,
    },
    {
      label: "Visitas ao perfil",
      tone: "amber",
      icon: UserRound,
      value: (p) => p.profileVisits,
    },
    {
      label: "Cliques no link",
      tone: "sky",
      icon: MousePointer2,
      value: (p) => p.linkClicks,
    },
  ];
  return (
    <section
      className={"dashboard-page" + (presenting ? " is-presenting" : "")}
      aria-label={"Dashboard " + dashboard.name}
    >
      {!presenting && (
        <button
          className="text-button dashboard-back"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          Voltar ao espaço de trabalho
        </button>
      )}
      <header className="dashboard-heading dashboard-hero">
        <div>
          <span className="dashboard-hero-eyebrow">
            <Camera size={14} aria-hidden="true" /> RELATÓRIO DE RESULTADOS ·
            INSTAGRAM
          </span>
          <h1>{dashboard.name}</h1>
          <p className="dashboard-hero-profile">
            {dashboard.accountName || "Perfil não informado"}
            {client ? " · " + client.name : " · Sem cliente associado"}
          </p>
        </div>
        <div className="dashboard-actions">
          {presenting ? (
            <button
              className="button secondary"
              onClick={() => setPresenting(false)}
            >
              <X size={16} />
              Sair da apresentação
            </button>
          ) : (
            <>
              <button
                ref={presentationButton}
                className="button secondary"
                disabled={busy || dirty || !current}
                onClick={() => setPresenting(true)}
              >
                <Play size={16} />
                Apresentar
              </button>
              <button
                className="button primary"
                disabled={busy || dirty}
                onClick={() => {
                  setError("");
                  setImporting(true);
                }}
              >
                <FileSpreadsheet size={16} />
                Importar dados
              </button>
            </>
          )}
        </div>
        <div className="dashboard-hero-footer">
          <span>
            <span className="dashboard-status-dot" aria-hidden="true" /> Seus
            dados. Sua próxima grande história.
          </span>
          <span>
            <CalendarDays size={14} aria-hidden="true" />
            {current
              ? periodLabel(current)
              : "Pronto para receber seus resultados"}
          </span>
        </div>
      </header>
      {dirty && (
        <p className="dashboard-notice" role="status">
          Há alterações não salvas. Salve as informações antes de importar ou
          apresentar.
        </p>
      )}
      {error && !removing && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button className="button secondary" disabled={busy} onClick={retry}>
            <RefreshCw size={16} />
            Recarregar dashboard
          </button>
        </div>
      )}
      {!presenting && success && (
        <p className="dashboard-success" role="status">
          <Check size={16} />
          {success}
        </p>
      )}
      {!presenting && (
        <details className="dashboard-settings">
          <summary>Editar informações do dashboard</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="workspace-form"
          >
            <fieldset disabled={busy}>
              <div className="dashboard-metadata-grid">
                <label>
                  Nome do dashboard
                  <input
                    required
                    maxLength={80}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Perfil analisado
                  <input
                    maxLength={120}
                    value={draft.accountName}
                    onChange={(event) =>
                      setDraft({ ...draft, accountName: event.target.value })
                    }
                    placeholder="Ex.: @cafeaurora"
                  />
                </label>
                <label>
                  Cliente associado
                  <select
                    aria-label="Cliente associado"
                    value={draft.clientId ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        clientId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem cliente</option>
                    {clients.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Análise do profissional
                <textarea
                  aria-label="Análise do profissional"
                  rows={5}
                  maxLength={6000}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                  placeholder="Explique os resultados e os próximos passos para seu cliente."
                />
              </label>
            </fieldset>
            <div className="dashboard-settings-actions">
              <button
                className="button primary"
                disabled={busy || !dirty || !draft.name.trim()}
              >
                <Save size={16} />
                {busy ? "Salvando…" : "Salvar informações"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy || !dirty}
                onClick={() => setDraft(metadataOf(dashboard))}
              >
                Descartar alterações
              </button>
              <button
                type="button"
                className="button danger-button"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setRemoving(true);
                }}
              >
                <Trash2 size={16} />
                Excluir dashboard
              </button>
            </div>
          </form>
        </details>
      )}
      {current ? (
        <>
          <div className="dashboard-periods">
            <div className="dashboard-period-context">
              <CalendarDays size={20} aria-hidden="true" />
              <div>
                <h2>Visão geral</h2>
                <p>Escolha os períodos de análise</p>
              </div>
            </div>
            <label>
              Período
              <select
                aria-label="Período do relatório"
                value={keyOf(current)}
                onChange={(event) => {
                  setCurrentKey(event.target.value);
                  setPreviousKey("");
                }}
              >
                {periods.map((period) => (
                  <option key={keyOf(period)} value={keyOf(period)}>
                    {periodLabel(period)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comparar com
              <select
                aria-label="Período de comparação"
                value={previous ? keyOf(previous) : "none"}
                onChange={(event) => setPreviousKey(event.target.value)}
              >
                <option value="none">Sem comparação</option>
                {periods
                  .filter((period) => period !== current)
                  .map((period) => (
                    <option key={keyOf(period)} value={keyOf(period)}>
                      {periodLabel(period)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="dashboard-kpis">
            {cards.map((card) => {
              const value = card.value(current),
                delta = previous
                  ? variation(value, card.value(previous))
                  : null;
              return (
                <article
                  className={"dashboard-kpi tone-" + card.tone}
                  aria-label={card.label}
                  key={card.label}
                >
                  <div className="dashboard-kpi-top">
                    <h2>{card.label}</h2>
                    <span className="dashboard-kpi-icon">
                      <card.icon size={17} aria-hidden="true" />
                    </span>
                  </div>
                  <strong>{formatCount(value)}</strong>
                  {delta && (
                    <span className={"dashboard-change " + delta.direction}>
                      {delta.direction === "up" && (
                        <ArrowUpRight size={13} aria-hidden="true" />
                      )}
                      {delta.direction === "down" && (
                        <ArrowDownRight size={13} aria-hidden="true" />
                      )}
                      {delta.label}
                    </span>
                  )}
                  <MetricSparkline
                    periods={dashboard.periods}
                    value={card.value}
                  />
                </article>
              );
            })}
          </div>
          <Suspense
            fallback={
              <div className="dashboard-status" role="status">
                Carregando gráficos…
              </div>
            }
          >
            <DashboardCharts
              current={current}
              previous={previous}
              periods={dashboard.periods}
            />
          </Suspense>
          <details className="dashboard-methodology" open>
            <summary>Como os resultados são apresentados</summary>
            <p>
              Interações = curtidas + comentários + compartilhamentos +
              salvamentos. Taxa de engajamento por alcance:{" "}
              <strong>{formatRate(engagementRate(current))}</strong>.
            </p>
            <p>
              A taxa usa interações ÷ alcance × 100. Se faltar um componente, o
              total e a taxa ficam indisponíveis. “—” indica um dado não
              informado; zero representa um resultado medido. O alcance é o
              total informado para o período, sem somar pessoas entre
              intervalos.
            </p>
          </details>
          {dashboard.notes && (
            <section
              className="dashboard-analysis"
              aria-label="Análise do profissional"
            >
              <div className="dashboard-analysis-heading">
                <span className="dashboard-analysis-symbol">
                  <Sparkles size={20} aria-hidden="true" />
                </span>
                <div>
                  <span className="dashboard-eyebrow">OLHAR ESTRATÉGICO</span>
                  <h2>Análise do profissional</h2>
                </div>
              </div>
              <p>{dashboard.notes}</p>
            </section>
          )}
          <footer className="dashboard-report-footer">
            <span>Instagram · {periodLabel(current)}</span>
            <span>Dados importados pelo profissional</span>
          </footer>
        </>
      ) : (
        <div className="dashboard-empty">
          <BarChart3 size={36} aria-hidden="true" />
          <h2>Dê contexto aos seus resultados.</h2>
          <p>
            Importe uma planilha XLSX ou CSV com os totais de cada período para
            montar sua apresentação. O arquivo será descartado após a leitura.
          </p>
        </div>
      )}
      {importing && (
        <DashboardImport
          dashboard={dashboard}
          onClose={() => setImporting(false)}
          onImported={(value) => {
            accept(value);
            setCurrentKey("");
            setPreviousKey("");
            setImporting(false);
            setSuccess("Resultados importados. O arquivo não foi armazenado.");
          }}
        />
      )}
      {removing && (
        <Dialog
          title="Excluir dashboard?"
          busy={busy}
          onClose={() => setRemoving(false)}
          className="workspace-dialog"
        >
          <div className="workspace-form">
            <p>
              Excluir <strong>{dashboard.name}</strong> e todos os seus
              períodos? Esta ação não pode ser desfeita.
            </p>
            {error && (
              <p className="workspace-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setRemoving(false)}
              >
                Cancelar
              </button>
              <button
                className="button danger-button"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
