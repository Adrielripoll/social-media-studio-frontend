import { useEffect, useState } from "react";
import {
  BarChart3,
  Plus,
  RefreshCw,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import Dialog from "../components/Dialog";
import { createDashboard, errorMessage, listDashboards } from "./api";
import type { DashboardSummary } from "./api";
import "./dashboards.css";
export default function DashboardLibrary({
  clientId,
  onOpen,
}: {
  clientId?: string;
  onOpen: (id: string) => void;
}) {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [createError, setCreateError] = useState("");
  const [reload, setReload] = useState(0),
    [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void listDashboards(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setDashboards(
            value.filter((item) => !clientId || item.clientId === clientId),
          );
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [clientId, reload]);
  async function create() {
    if (busy) return;
    setBusy(true);
    setCreateError("");
    try {
      const item = await createDashboard(name.trim(), clientId ?? null);
      onOpen(item.id);
    } catch (reason) {
      setCreateError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="dashboard-library workspace-page"
      aria-label={clientId ? "Dashboards deste cliente" : "Seus dashboards"}
    >
      <header
        className={
          "workspace-page-heading " +
          (clientId
            ? "studio-section-heading"
            : "dashboard-library-heading dashboard-hero")
        }
      >
        <div>
          <span
            className={clientId ? "task-eyebrow" : "dashboard-hero-eyebrow"}
          >
            RESULTADOS QUE CONTAM UMA HISTÓRIA
          </span>
          {clientId ? (
            <h2>Dashboards deste cliente</h2>
          ) : (
            <h1>Seus dashboards</h1>
          )}
          <p>
            Transforme os dados do Instagram em uma apresentação para seus
            clientes.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setName("");
            setCreateError("");
            setCreating(true);
          }}
        >
          <Plus size={16} />
          Criar dashboard
        </button>
      </header>
      {loading && (
        <p className="workspace-muted" role="status">
          <LoaderCircle className="spin" size={16} />
          Carregando dashboards…
        </p>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button
            className="button secondary"
            onClick={() => setReload((v) => v + 1)}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && !dashboards.length && (
        <div className="dashboard-empty">
          <span className="dashboard-empty-symbol">
            <BarChart3 size={32} aria-hidden="true" />
          </span>
          <h3>Seus resultados começam aqui.</h3>
          <p>
            Crie um dashboard e importe uma planilha XLSX ou CSV. O arquivo é
            descartado após a leitura.
          </p>
          <ol className="dashboard-empty-steps">
            <li>
              <span>01</span>Crie seu dashboard
            </li>
            <li>
              <span>02</span>Importe seus dados
            </li>
            <li>
              <span>03</span>Conte sua história
            </li>
          </ol>
        </div>
      )}
      <div className="dashboard-library-grid">
        {dashboards.map((item, index) => (
          <article
            key={item.id}
            className={"dashboard-library-card cover-" + (index % 3)}
            aria-label={"Dashboard " + item.name}
          >
            <div className="dashboard-card-cover" aria-hidden="true">
              <span className="dashboard-cover-orbit" />
              <BarChart3 size={38} />
              <span className="dashboard-cover-word">insights.</span>
            </div>
            <div>
              <span className="workspace-card-label">INSTAGRAM</span>
              <h3>{item.name}</h3>
              <p>
                {item.accountName || "Perfil a definir"}
                {!item.clientId ? " · Sem cliente" : ""}
              </p>
              <small>
                Atualizado em{" "}
                {new Intl.DateTimeFormat("pt-BR").format(
                  new Date(item.updatedAt),
                )}
              </small>
            </div>
            <button
              className="button secondary"
              onClick={() => onOpen(item.id)}
            >
              Abrir dashboard
              <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {creating && (
        <Dialog
          title="Novo dashboard"
          busy={busy}
          onClose={() => setCreating(false)}
          className="workspace-dialog dashboard-theme-dialog"
        >
          <form
            className="workspace-form"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <label>
              Nome do dashboard
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
                placeholder="Ex.: Resultados do Instagram"
              />
            </label>
            <p className="workspace-muted">
              {clientId
                ? "Este dashboard será associado ao cliente selecionado."
                : "Você poderá associar um cliente depois."}
            </p>
            {createError && (
              <p className="workspace-error" role="alert">
                {createError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Criando…" : "Criar dashboard"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
