import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  LayoutGrid,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import Dialog from "../components/Dialog";
import { ApiError } from "../auth/api";
import { listClients, saveClient, deleteClient } from "./api";
import type { Client } from "./api";
import "./workspace.css";
import FeedLibrary from "../feeds/FeedLibrary";
type View =
  { kind: "home" | "clients" | "feeds" } | { kind: "client"; id: string };
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
  const [view, setView] = useState<View>({ kind: "home" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{ client?: Client } | null>(null);
  const [removal, setRemoval] = useState<Client | null>(null);
  const writing = useRef(false);
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
    if (!writing.current) setView(next);
  }
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
      if (view.kind === "client" && view.id === removal.id)
        setView({ kind: "clients" });
      setRemoval(null);
    });
  }
  const selectedClient =
    view.kind === "client"
      ? clients.find((client) => client.id === view.id)
      : null;
  const visibleClients =
    view.kind === "client"
      ? clients.filter((client) => client.id === view.id)
      : clients;
  const disabled = busy || loading;
  return (
    <div className="platform-layout">
      <aside className="workspace-sidebar">
        <nav aria-label="Navegação do espaço de trabalho">
          <button
            className={
              "workspace-nav-button" +
              (view.kind === "home" ? " is-active" : "")
            }
            disabled={busy}
            onClick={() => navigate({ kind: "home" })}
            aria-current={view.kind === "home" ? "page" : undefined}
          >
            <CalendarDays size={17} />
            Início
          </button>
          <button
            className={
              "workspace-nav-button" +
              (view.kind === "clients" ? " is-active" : "")
            }
            disabled={busy}
            onClick={() => navigate({ kind: "clients" })}
            aria-current={view.kind === "clients" ? "page" : undefined}
          >
            <Users size={17} />
            Clientes
          </button>
          <button
            className={
              "workspace-nav-button" +
              (view.kind === "feeds" ? " is-active" : "")
            }
            disabled={busy}
            onClick={() => navigate({ kind: "feeds" })}
            aria-current={view.kind === "feeds" ? "page" : undefined}
          >
            <LayoutGrid size={17} />
            Feeds
          </button>
          <div className="workspace-sidebar-heading">
            <span>SEUS CLIENTES</span>
            <button
              className="task-icon-button"
              aria-label="Novo cliente"
              disabled={disabled}
              onClick={() => openEditor()}
            >
              <Plus size={16} />
            </button>
          </div>
          {loading ? (
            <p className="workspace-muted" role="status">
              Carregando seu espaço…
            </p>
          ) : (
            clients.length === 0 && (
              <p className="workspace-muted">Seus clientes aparecerão aqui.</p>
            )
          )}
          {clients.map((client) => (
            <div className="workspace-client-group" key={client.id}>
              <button
                className={
                  "workspace-client-link" +
                  (view.kind === "client" && view.id === client.id
                    ? " is-active"
                    : "")
                }
                disabled={busy}
                onClick={() => navigate({ kind: "client", id: client.id })}
                aria-current={
                  view.kind === "client" && view.id === client.id
                    ? "page"
                    : undefined
                }
              >
                <Users size={14} />
                <span>{client.name}</span>
              </button>
            </div>
          ))}
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
        {view.kind === "home" ? (
          children
        ) : view.kind === "feeds" ? (
          <FeedLibrary />
        ) : (
          <section aria-label="Gerenciar clientes" className="workspace-page">
            <header className="workspace-page-heading">
              <div>
                <span className="task-eyebrow">SEU ESPAÇO DE TRABALHO</span>
                <h1>{selectedClient?.name ?? "Clientes"}</h1>
              </div>
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
            {loading && (
              <p className="workspace-muted" role="status">
                <LoaderCircle className="spin" size={16} />
                Carregando…
              </p>
            )}
            <div className="workspace-cards">
              {!loading && !visibleClients.length && (
                <p className="workspace-empty">
                  Nenhum cliente cadastrado. Adicione o primeiro para começar.
                </p>
              )}
              {visibleClients.map((client) => (
                <article
                  key={client.id}
                  className="workspace-card"
                  aria-label={"Cliente " + client.name}
                >
                  <div>
                    <span className="workspace-card-label">CLIENTE</span>
                    <h2>{client.name}</h2>
                  </div>
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
                      className="task-icon-button"
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
                </article>
              ))}
            </div>
            {selectedClient && (
              <FeedLibrary
                key={selectedClient.id}
                clientId={selectedClient.id}
              />
            )}
          </section>
        )}
      </main>
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
                className="button danger"
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
    </div>
  );
}
