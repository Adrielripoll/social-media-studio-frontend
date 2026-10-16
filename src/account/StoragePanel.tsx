import { useEffect, useState } from "react";
import { FolderOpen, HardDrive, Trash2, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "../auth/api";
import { useAccount } from "./AccountContext";
import StorageSummary, { formatBytes } from "./StorageSummary";
import RetentionNotice from "./RetentionNotice";
import Dialog from "../components/Dialog";
import { deleteFeed } from "../feeds/api";
interface Resource {
  resourceType: string;
  resourceId: string;
  name: string;
  fileCount: number;
  usedBytes: number;
  reservedBytes: number;
  pendingDeletionBytes: number;
}
export default function StoragePanel() {
  const account = useAccount(),
    allowed = !!account?.account?.access.allowed;
  const [resources, setResources] = useState<Resource[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Resource | null>(null),
    [busy, setBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const used = account?.account?.storage.usedBytes,
    reserved = account?.account?.storage.reservedBytes;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void apiRequest<{ resources: Resource[] }>("/account/storage", {
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(value.resources)) throw new Error();
        setResources(value.resources);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Não foi possível consultar seus arquivos.");
      });
    return () => controller.abort();
  }, [revision, used, reserved]);
  function refresh() {
    setRevision((v) => v + 1);
    account?.refresh();
  }
  async function remove() {
    if (!selected || busy || !allowed) return;
    setBusy(true);
    setDeleteError("");
    setNotice("");
    try {
      await deleteFeed(selected.resourceId);
      setSelected(null);
      setNotice(
        "Feed excluído. A cota será atualizada após a confirmação da remoção dos arquivos.",
      );
    } catch (reason) {
      setDeleteError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível excluir o feed. Tente novamente.",
      );
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return (
    <div className="account-section-stack">
      <div>
        <div className="account-section-title">
          <span className="account-card-icon">
            <HardDrive size={22} />
          </span>
          <div>
            <h2>Armazenamento</h2>
            <p>Uma cota compartilhada para todas as suas ferramentas.</p>
          </div>
        </div>
        <StorageSummary />
      </div>
      <section className="account-card" aria-label="Arquivos por ferramenta">
        <div className="account-resources-heading">
          <div>
            <h2>Onde seu espaço está sendo usado</h2>
            <p>
              Abra um feed para remover imagens específicas ou exclua o feed
              inteiro.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={refresh}
            aria-label="Atualizar arquivos"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {!allowed && (
          <p className="account-feedback warning" role="status">
            Regularize sua assinatura para gerenciar ou excluir arquivos. Seu
            consumo continua disponível para consulta.
          </p>
        )}
        {error && (
          <div className="account-feedback error" role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={refresh}>
              Tentar novamente
            </button>
          </div>
        )}
        {!resources && !error && <p role="status">Consultando arquivos…</p>}
        {resources?.length === 0 && !error && (
          <div className="account-empty">
            <FolderOpen size={32} />
            <h3>Espaço para suas próximas ideias.</h3>
            <p>Nenhum arquivo armazenado na sua conta.</p>
          </div>
        )}
        {notice && (
          <p className="account-feedback success" role="status">
            {notice}
          </p>
        )}
        {!!resources?.length && (
          <ul className="account-resources">
            {resources.map((resource) => (
              <li key={resource.resourceType + resource.resourceId}>
                <span className="account-resource-icon">
                  <FolderOpen size={22} />
                </span>
                <div className="account-resource-info">
                  <strong>{resource.name}</strong>
                  <span>
                    {resource.resourceType === "feed"
                      ? "Feed Studio"
                      : "Ferramenta"}{" "}
                    · {resource.fileCount}{" "}
                    {resource.fileCount === 1 ? "arquivo" : "arquivos"}
                  </span>
                  <b>
                    {formatBytes(resource.usedBytes + resource.reservedBytes)}
                  </b>
                  {resource.pendingDeletionBytes > 0 && (
                    <span className="account-resource-pending">
                      {formatBytes(resource.pendingDeletionBytes)} em exclusão.
                      O espaço será liberado após a confirmação.
                    </span>
                  )}
                  {resource.reservedBytes > 0 && (
                    <span>
                      {formatBytes(resource.reservedBytes)} em uploads em
                      andamento.
                    </span>
                  )}
                </div>
                <div className="account-resource-actions">
                  {resource.resourceType === "feed" && (
                    <>
                      <a
                        className="button secondary"
                        href={
                          allowed
                            ? "/simulador?" +
                              new URLSearchParams({
                                feed: resource.resourceId,
                                returnTo: "/minha-conta?secao=armazenamento",
                              })
                            : undefined
                        }
                        aria-disabled={!allowed}
                      >
                        Gerenciar imagens
                      </a>
                      <button
                        className="button secondary account-danger-button"
                        disabled={!allowed || busy}
                        onClick={() => {
                          setSelected(resource);
                          setDeleteError("");
                        }}
                        aria-label={"Excluir feed " + resource.name}
                      >
                        <Trash2 size={16} />
                        {resource.pendingDeletionBytes
                          ? "Concluir exclusão"
                          : "Excluir feed"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="account-field-help">
          A cota considera o tamanho final dos arquivos. As planilhas importadas
          nos dashboards são descartadas após a leitura.
        </p>
      </section>
      <RetentionNotice />
      {selected && (
        <Dialog
          title="Excluir feed e seus arquivos?"
          className="account-dialog"
          busy={busy}
          onClose={() => setSelected(null)}
        >
          <p>
            O feed <strong>{selected.name}</strong> e todas as suas imagens
            serão excluídos. Essa ação não pode ser desfeita.
          </p>
          <p>
            O espaço só será devolvido após a confirmação da exclusão no
            armazenamento.
          </p>
          {deleteError && (
            <p className="account-feedback error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="account-form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Manter feed
            </button>
            <button
              className="button primary"
              disabled={busy || !allowed}
              onClick={() => void remove()}
            >
              {busy ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
