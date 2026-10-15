import { feedEditorUrl } from "../workspace/navigation";
import FeedCardPreview from "./FeedCardPreview";
import { useEffect, useState } from "react";
import { LayoutGrid, Plus, RefreshCw } from "lucide-react";
import { ApiError } from "../auth/api";
import { createFeed, listFeeds, deleteFeed } from "./api";
import type { FeedSummary } from "./api";
export default function FeedLibrary({ clientId }: { clientId?: string }) {
  const [feeds, setFeeds] = useState<FeedSummary[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void listFeeds(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setFeeds(value.filter((feed) => !clientId || feed.clientId === clientId));
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Não foi possível carregar os feeds.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [clientId, reload]);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const feed = await createFeed("Novo feed", clientId ?? null);
      window.location.assign(
        feedEditorUrl(
          feed.id,
          clientId ? { kind: "client", id: clientId } : { kind: "feeds" },
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "Não foi possível criar o feed.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="workspace-page" aria-label="Seus feeds">
      <header className="workspace-page-heading">
        <div>
          <h2>{clientId ? "Feeds deste cliente" : "Seus feeds"}</h2>
          <p>Crie e apresente seus perfis fictícios do Instagram.</p>
        </div>
      </header>
      <div className="feed-create-actions">
        <button className="button primary" disabled={busy} onClick={() => void create()}>
          <Plus size={16} />
          {busy ? "Criando…" : "Criar feed"}
        </button>
      </div>
      {loading && <p role="status">Carregando feeds…</p>}
      {error && (
        <div className="workspace-error" role="alert">
          {error}
          <button
            className="button secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && !feeds.length && (
        <p className="workspace-empty">Nenhum feed criado ainda.</p>
      )}
      <div className={"workspace-cards" + (clientId ? " feed-preview-cards" : "")}>
        {feeds.map((feed) => (
          <article
            className={"workspace-card" + (clientId ? " workspace-feed-card" : "")}
            key={feed.id}
            aria-label={"Feed " + feed.name}
          >
            <div className="feed-card-header">
              <div>
                <span className="workspace-card-label">INSTAGRAM</span>
                <h3>{feed.name}</h3>
                {!feed.clientId && <p>Sem cliente</p>}
              </div>
              {feed.pendingDeletion ? (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    void deleteFeed(feed.id)
                      .then(() => setReload((value) => value + 1))
                      .catch((reason) =>
                        setError(
                          reason instanceof ApiError
                            ? reason.message
                            : "Não foi possível concluir a exclusão.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Concluir exclusão
                </button>
              ) : (
                <a
                  className="button secondary"
                  href={feedEditorUrl(
                    feed.id,
                    clientId ? { kind: "client", id: clientId } : { kind: "feeds" },
                  )}
                >
                  <LayoutGrid size={16} />
                  Abrir feed
                </a>
              )}
            </div>
            {clientId && !feed.pendingDeletion && (
              <FeedCardPreview feedId={feed.id} feedName={feed.name} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
