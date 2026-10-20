import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { apiRequest, ApiError } from "../auth/api";
import { useAccount } from "../account/AccountContext";

export default function ClientLogo({ id, name }: { id: string; name: string }) {
  const account = useAccount();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ url: string | null }>(`/clients/${id}/logo`, {
      signal: controller.signal,
    })
      .then((value) => setUrl(value.url))
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Não foi possível carregar o logo. Recarregue a página para tentar novamente.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  async function update(file?: File) {
    if (busy) return;
    setError("");
    setNotice("");
    if (
      file &&
      (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024)
    ) {
      setError("Escolha uma imagem JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    setBusy(true);
    try {
      if (file) {
        const body = new FormData();
        body.append("file", file);
        const result = await apiRequest<{ url: string }>(
          `/clients/${id}/logo`,
          { method: "POST", body, timeoutMs: 60_000 },
        );
        setUrl(result.url);
      } else {
        await apiRequest(`/clients/${id}/logo`, {
          method: "DELETE",
          timeoutMs: 60_000,
        });
        setUrl(null);
      }
      setNotice(file ? "Logo atualizado." : "Logo removido.");
      account?.refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Não foi possível atualizar o logo. Tente novamente.",
      );
      account?.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="client-logo"
      aria-label="Logo da empresa"
      aria-busy={loading || busy}
    >
      <div className="client-logo-image">
        {url ? (
          <img
            src={url}
            alt={`Logo de ${name}`}
            onError={() => {
              setUrl(null);
              setError(
                "Não foi possível exibir o logo. Recarregue a página para tentar novamente.",
              );
            }}
          />
        ) : (
          <UserRound size={32} aria-hidden="true" />
        )}
      </div>
      <div className="client-logo-controls">
        <strong>
          Logo da empresa <span className="workspace-muted">(opcional)</span>
        </strong>
        <p className="workspace-muted">
          JPG, PNG ou WebP · até 5 MB. Consome a cota de armazenamento da conta.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar logo da empresa"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void update(file);
          }}
        />
        <div className="client-logo-actions">
          <button
            className="button secondary"
            disabled={loading || busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Aguarde…" : url ? "Trocar logo" : "Adicionar logo"}
          </button>
          {url && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void update()}
            >
              Remover logo
            </button>
          )}
        </div>
        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="workspace-muted" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
