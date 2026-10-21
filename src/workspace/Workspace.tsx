import MotionPresence from "../components/MotionPresence";
import { useMediaQuery } from "../components/use-media-query";
import ClientLogo from "./ClientLogo";
import DashboardLibrary from "../dashboards/DashboardLibrary";
import DashboardDetail from "../dashboards/DashboardDetail";
import { workspaceView, workspaceUrl } from "./navigation";
import type { WorkspaceView as View } from "./navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Dialog from "../components/Dialog";
import { ApiError } from "../auth/api";
import { listClients, saveClient, deleteClient } from "./api";
import type { Client } from "./api";
import "./workspace.css";
import FeedLibrary from "../feeds/FeedLibrary";

function clientInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function sortClients(items: Client[]) {
  return [...items].sort(
    (a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
  );
}
function ClientForm({
  client,
  busy,
  error,
  onSave,
  onClose,
}: {
  client?: Client;
  busy: boolean;
  error: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  return (
    <Dialog
      title={client ? "Editar cliente" : "Novo cliente"}
      onClose={onClose}
      className="workspace-dialog"
      busy={busy}
    >
      <form
        className="workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(name);
        }}
      >
        <label>
          Nome do cliente
          <input
            required
            maxLength={200}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            placeholder="Ex.: Café da Praça"
          />
        </label>
        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}
        <div className="workspace-form-actions">
          <button className="button primary" disabled={busy}>
            {busy
              ? "Salvando…"
              : client
                ? "Salvar alterações"
                : "Criar cliente"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export default function Workspace({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView] = useState<View>(workspaceView);
  const dashboardExperience =
    view.kind === "dashboards" || view.kind === "dashboard";
  useEffect(() => {
    document.body.classList.toggle("dashboard-experience", dashboardExperience);
    return () => document.body.classList.remove("dashboard-experience");
  }, [dashboardExperience]);
  const [clientsExpanded, setClientsExpanded] = useState(false);
  const compactNavigation = useMediaQuery("(max-width: 600px)");
  const [expandedClients, setExpandedClients] = useState<
    Record<string, boolean>
  >({});
  const activeClientId =
    view.kind === "client"
      ? view.id
      : "clientId" in view
        ? view.clientId
        : undefined;
  const globalDashboardsActive =
    (view.kind === "dashboards" || view.kind === "dashboard") &&
    !activeClientId;
  useEffect(() => {
    if (activeClientId) {
      setExpandedClients((current) => ({ ...current, [activeClientId]: true }));
    }
  }, [activeClientId]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{ client?: Client } | null>(null);
  const [removal, setRemoval] = useState<Client | null>(null);
  const writing = useRef(false);
  const dashboardDirty = useRef(false);
  const currentView = useRef(view);
  currentView.current = view;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void listClients(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(response.clients)) throw new ApiError(502);
        setClients(sortClients(response.clients));
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Não foi possível carregar os clientes. Tente novamente.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);
  function navigate(next: View) {
    if (writing.current) return;
    if (
      dashboardDirty.current &&
      !window.confirm("Descartar as alterações não salvas do dashboard?")
    )
      return;
    dashboardDirty.current = false;
    setView(next);
    setClientsExpanded(false);
    window.history.pushState(null, "", workspaceUrl(next));
  }
  useEffect(() => {
    function restoreView() {
      if (
        dashboardDirty.current &&
        !window.confirm("Descartar as alterações não salvas do dashboard?")
      ) {
        window.history.pushState(null, "", workspaceUrl(currentView.current));
        return;
      }
      dashboardDirty.current = false;
      if (!writing.current) {
        setView(workspaceView());
        setClientsExpanded(false);
      }
    }
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);
  function openEditor(client?: Client) {
    setError("");
    setEditor({ client });
  }
  async function mutate(action: () => Promise<void>) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  async function save(name: string) {
    if (!editor) return;
    await mutate(async () => {
      const item = await saveClient(name, editor.client?.id);
      setClients((old) =>
        sortClients([...old.filter((client) => client.id !== item.id), item]),
      );
      setEditor(null);
    });
  }
  async function remove() {
    if (!removal) return;
    await mutate(async () => {
      await deleteClient(removal.id);
      setClients((old) => old.filter((client) => client.id !== removal.id));
      if (view.kind === "client" && view.id === removal.id) {
        setView({ kind: "clients" });
        window.history.replaceState(
          null,
          "",
          workspaceUrl({ kind: "clients" }),
        );
      }
      setRemoval(null);
    });
  }
  const selectedClient =
    clients.find((client) => client.id === activeClientId) ?? null;
  const visibleClients = view.kind === "client" ? [] : clients;
  const disabled = busy || loading;
  function clientActions(client: Client) {
    return (
      <div className="workspace-card-actions">
        <button
          className="task-icon-button"
          aria-label={"Editar cliente " + client.name}
          disabled={disabled}
          onClick={() => openEditor(client)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="task-icon-button danger"
          aria-label={"Excluir cliente " + client.name}
          disabled={disabled}
          onClick={() => {
            setError("");
            setRemoval(client);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }
  return (
    <div className="platform-layout">
      <aside className="workspace-sidebar">
        <nav aria-label="Navegação do espaço de trabalho">
          <div className="workspace-primary-nav">
            <span className="workspace-menu-label">PRINCIPAL</span>
            <button
              className={
                "workspace-nav-button" +
                (view.kind === "home" ? " is-active" : "")
              }
              disabled={busy}
              onClick={() => navigate({ kind: "home" })}
              aria-current={view.kind === "home" ? "page" : undefined}
            >
              <span className="workspace-nav-icon" aria-hidden="true">
                <CalendarDays size={17} />
              </span>
              <span className="workspace-nav-label">Início</span>
              <ChevronRight
                className="workspace-nav-indicator"
                size={14}
                aria-hidden="true"
              />
            </button>
            <button
              className={
                "workspace-nav-button" +
                (view.kind === "feeds" && !view.clientId ? " is-active" : "")
              }
              disabled={busy}
              onClick={() => navigate({ kind: "feeds" })}
              aria-current={
                view.kind === "feeds" && !view.clientId ? "page" : undefined
              }
            >
              <span className="workspace-nav-icon" aria-hidden="true">
                <LayoutGrid size={17} />
              </span>
              <span className="workspace-nav-label">Feeds</span>
              <ChevronRight
                className="workspace-nav-indicator"
                size={14}
                aria-hidden="true"
              />
            </button>
            <button
              className={
                "workspace-nav-button" +
                (globalDashboardsActive ? " is-active" : "")
              }
              disabled={busy}
              onClick={() => navigate({ kind: "dashboards" })}
              aria-current={globalDashboardsActive ? "page" : undefined}
            >
              <span className="workspace-nav-icon" aria-hidden="true">
                <BarChart3 size={17} />
              </span>
              <span className="workspace-nav-label">Dashboards</span>
              <ChevronRight
                className="workspace-nav-indicator"
                size={14}
                aria-hidden="true"
              />
            </button>
          </div>
          <section
            className="workspace-sidebar-clients"
            aria-label="Seus clientes"
          >
            <div className="workspace-sidebar-heading">
              <div className="workspace-clients-label-group">
                <span className="workspace-clients-label">SEUS CLIENTES</span>
                {!loading && (
                  <span
                    className="workspace-client-count"
                    aria-label={`${clients.length} clientes cadastrados`}
                  >
                    {clients.length}
                  </span>
                )}
              </div>
              <button
                className="workspace-clients-toggle"
                aria-expanded={clientsExpanded}
                aria-controls="workspace-clients-list"
                onClick={() => setClientsExpanded((value) => !value)}
              >
                {selectedClient?.name ?? "Seus clientes"}
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              <button
                className="task-icon-button"
                aria-label="Novo cliente"
                disabled={disabled}
                onClick={() => openEditor()}
              >
                <Plus size={16} />
              </button>
            </div>
            <div
              id="workspace-clients-list"
              aria-hidden={
                compactNavigation && !clientsExpanded ? true : undefined
              }
              inert={compactNavigation && !clientsExpanded}
              className={
                "workspace-clients-list" +
                (clientsExpanded ? " is-expanded" : "")
              }
            >
              <div className="workspace-clients-list-inner">
                {loading ? (
                  <p className="workspace-muted" role="status">
                    Carregando seu espaço…
                  </p>
                ) : (
                  clients.length === 0 && (
                    <p className="workspace-muted">
                      Seus clientes aparecerão aqui.
                    </p>
                  )
                )}
                {clients.map((client) => {
                  const expanded = Boolean(expandedClients[client.id]);
                  const submenuId = "workspace-client-tools-" + client.id;
                  return (
                    <div className="workspace-client-group" key={client.id}>
                      <div className="workspace-client-row">
                        <button
                          className={
                            "workspace-client-link" +
                            (activeClientId === client.id ? " is-active" : "")
                          }
                          disabled={busy}
                          onClick={() =>
                            navigate({ kind: "client", id: client.id })
                          }
                          aria-current={
                            view.kind === "client" && view.id === client.id
                              ? "page"
                              : undefined
                          }
                        >
                          <span
                            className="workspace-client-initials"
                            aria-hidden="true"
                          >
                            {clientInitials(client.name)}
                          </span>
                          <span className="workspace-client-name">
                            {client.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="workspace-client-toggle"
                          aria-label={"Ferramentas de " + client.name}
                          aria-expanded={expanded}
                          aria-controls={submenuId}
                          disabled={busy}
                          onClick={() =>
                            setExpandedClients((current) => ({
                              ...current,
                              [client.id]: !current[client.id],
                            }))
                          }
                        >
                          <ChevronRight
                            className="workspace-client-arrow"
                            size={16}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      <div
                        id={submenuId}
                        className={
                          "workspace-client-tools" +
                          (expanded ? " is-expanded" : "")
                        }
                        aria-hidden={!expanded}
                        inert={!expanded}
                      >
                        <div className="workspace-client-tools-inner">
                          <button
                            type="button"
                            disabled={busy}
                            className="workspace-client-tool"
                            aria-current={
                              view.kind === "feeds" &&
                              view.clientId === client.id
                                ? "page"
                                : undefined
                            }
                            onClick={() =>
                              navigate({ kind: "feeds", clientId: client.id })
                            }
                          >
                            <LayoutGrid size={15} aria-hidden="true" />
                            Feeds
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="workspace-client-tool"
                            aria-current={
                              (view.kind === "dashboards" ||
                                view.kind === "dashboard") &&
                              view.clientId === client.id
                                ? "page"
                                : undefined
                            }
                            onClick={() =>
                              navigate({
                                kind: "dashboards",
                                clientId: client.id,
                              })
                            }
                          >
                            <BarChart3 size={15} aria-hidden="true" />
                            Dashboards
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </nav>
      </aside>
      <main className="platform-content workspace-content">
        {error && !editor && !removal && (
          <div className="workspace-error" role="alert">
            <span>{error}</span>
            <button
              className="button secondary"
              disabled={disabled}
              onClick={() => setReload((old) => old + 1)}
            >
              <RefreshCw size={14} />
              Recarregar espaço
            </button>
          </div>
        )}
        <div className="workspace-view" key={workspaceUrl(view)}>
          {selectedClient &&
            (view.kind === "feeds" || view.kind === "dashboards") && (
              <div className="workspace-client-context">
                <button
                  className="text-button"
                  onClick={() =>
                    navigate({ kind: "client", id: selectedClient.id })
                  }
                >
                  {selectedClient.name}
                </button>
                <ChevronRight size={14} aria-hidden="true" />
                <span>{view.kind === "feeds" ? "Feeds" : "Dashboards"}</span>
              </div>
            )}
          {view.kind === "home" ? (
            children
          ) : view.kind === "dashboards" ? (
            <DashboardLibrary
              key={view.clientId ?? "all-dashboards"}
              clientId={view.clientId}
              onOpen={(id) =>
                navigate({
                  kind: "dashboard",
                  id,
                  ...(view.clientId ? { clientId: view.clientId } : {}),
                })
              }
            />
          ) : view.kind === "dashboard" ? (
            <DashboardDetail
              key={view.id}
              id={view.id}
              clients={clients}
              onDirtyChange={(value) => {
                dashboardDirty.current = value;
              }}
              onBack={() =>
                navigate(
                  view.clientId
                    ? { kind: "client", id: view.clientId }
                    : { kind: "dashboards" },
                )
              }
            />
          ) : view.kind === "feeds" ? (
            <FeedLibrary
              key={view.clientId ?? "all-feeds"}
              clientId={view.clientId}
              returnView={view}
            />
          ) : (
            <section aria-label="Gerenciar clientes" className="workspace-page">
              <header
                className="workspace-page-heading studio-page-heading studio-hero"
                role={selectedClient ? "article" : undefined}
                aria-label={
                  selectedClient ? "Cliente " + selectedClient.name : undefined
                }
              >
                <div>
                  <span className="task-eyebrow">SEU ESPAÇO DE TRABALHO</span>
                  <h1>{selectedClient?.name ?? "Clientes"}</h1>
                  <p>
                    {selectedClient
                      ? "Seus feeds e resultados, reunidos em um só lugar."
                      : "Organize suas marcas e mantenha cada trabalho por perto."}
                  </p>
                </div>
                {selectedClient && clientActions(selectedClient)}
                {view.kind === "clients" && (
                  <button
                    className="button primary"
                    disabled={disabled}
                    onClick={() => openEditor()}
                  >
                    <Plus size={16} />
                    Cadastrar cliente
                  </button>
                )}
              </header>
              {selectedClient && (
                <ClientLogo
                  key={selectedClient.id}
                  id={selectedClient.id}
                  name={selectedClient.name}
                />
              )}
              {loading && (
                <p className="workspace-muted" role="status">
                  <LoaderCircle className="spin" size={16} />
                  Carregando…
                </p>
              )}
              {!loading &&
                !error &&
                view.kind === "client" &&
                !selectedClient && (
                  <div className="workspace-empty">
                    <p>Este cliente não está disponível no seu espaço.</p>
                    <button
                      className="button secondary"
                      onClick={() => navigate({ kind: "clients" })}
                    >
                      Ver clientes
                    </button>
                  </div>
                )}
              <div className="workspace-cards workspace-client-cards">
                {!loading &&
                  !error &&
                  view.kind === "clients" &&
                  !visibleClients.length && (
                    <p className="workspace-empty">
                      Nenhum cliente cadastrado. Adicione o primeiro para
                      começar.
                    </p>
                  )}
                {visibleClients.map((client) => (
                  <article
                    key={client.id}
                    className="workspace-card workspace-client-card"
                    aria-label={"Cliente " + client.name}
                  >
                    <ClientLogo id={client.id} name={client.name} compact />
                    <div className="workspace-client-info">
                      <span className="workspace-card-label">CLIENTE</span>
                      <h2>{client.name}</h2>
                    </div>
                    {clientActions(client)}
                  </article>
                ))}
              </div>
              {selectedClient && (
                <>
                  <FeedLibrary
                    key={selectedClient.id}
                    clientId={selectedClient.id}
                  />
                  <DashboardLibrary
                    key={"dashboards-" + selectedClient.id}
                    clientId={selectedClient.id}
                    onOpen={(id) =>
                      navigate({
                        kind: "dashboard",
                        id,
                        clientId: selectedClient.id,
                      })
                    }
                  />
                </>
              )}
            </section>
          )}
        </div>
      </main>
      <MotionPresence>
        {editor && (
          <ClientForm
            client={editor.client}
            busy={busy}
            error={error}
            onSave={save}
            onClose={() => {
              if (!busy) {
                setEditor(null);
                setError("");
              }
            }}
          />
        )}
      </MotionPresence>
      <MotionPresence>
        {removal && (
          <Dialog
            title="Excluir cliente?"
            onClose={() => {
              if (!busy) {
                setRemoval(null);
                setError("");
              }
            }}
            className="workspace-dialog"
          >
            <div className="workspace-form">
              <p>
                Excluir <strong>{removal.name}</strong>?
              </p>
              <p className="workspace-muted">
                Esta ação remove o cliente da sua conta.
              </p>
              {error && (
                <p className="workspace-error" role="alert">
                  {error}
                </p>
              )}
              <div className="workspace-form-actions">
                <button
                  className="button danger-button"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {busy ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setRemoval(null);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
