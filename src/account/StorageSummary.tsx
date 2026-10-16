import { HardDrive, RefreshCw } from "lucide-react";
import { useAccount } from "./AccountContext";
import "./account.css";
export function formatBytes(bytes: number) {
  if (bytes < 1000) return bytes + " B";
  const unit = bytes >= 1e9 ? "GB" : bytes >= 1e6 ? "MB" : "KB";
  const divisor = unit === "GB" ? 1e9 : unit === "MB" ? 1e6 : 1000;
  return (
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
      bytes / divisor,
    ) +
    " " +
    unit
  );
}
export default function StorageSummary() {
  const state = useAccount();
  if (!state) return null;
  const { account, error, loading, refresh } = state;
  if (error)
    return (
      <section
        className="account-storage account-storage-error"
        aria-label="Armazenamento"
      >
        <p role="alert">{error}</p>
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={15} />
          Tentar novamente
        </button>
      </section>
    );
  if (!account)
    return (
      <div className="account-storage" role="status">
        {loading ? "Consultando armazenamento…" : "Armazenamento indisponível."}
      </div>
    );
  const { storage, plan, access } = account;
  const occupied = storage.usedBytes + storage.reservedBytes;
  const full = storage.availableBytes === 0;
  const percent = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(storage.percentUsed);
  const end = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(
    new Date(
      access.paidUntil ? Date.parse(access.paidUntil) - 1 : access.trialEndsAt,
    ),
  );
  return (
    <section
      className={"account-storage" + (full ? " is-full" : "")}
      aria-label="Armazenamento da conta"
    >
      <div className="account-storage-plan">
        <HardDrive size={19} aria-hidden="true" />
        <div>
          <strong>{plan.name}</strong>
          <span>
            {access.allowed
              ? (access.status === "trialing"
                  ? "Teste gratuito até "
                  : access.status === "canceled"
                    ? "Cancelada · acesso até "
                    : "Acesso pago até ") + end
              : "Acesso suspenso"}
          </span>
        </div>
      </div>
      <div className="account-storage-usage">
        <div className="account-storage-label">
          <strong>
            {formatBytes(occupied)} de {formatBytes(storage.limitBytes)}
          </strong>
          <span>{formatBytes(storage.availableBytes)} disponíveis</span>
        </div>
        <div className="account-storage-bar">
          <meter
            min={0}
            max={storage.limitBytes}
            value={Math.min(occupied, storage.limitBytes)}
            aria-label="Espaço de armazenamento ocupado"
            aria-valuetext={
              percent +
              "% ocupado: " +
              formatBytes(occupied) +
              " de " +
              formatBytes(storage.limitBytes)
            }
          />
          <span className="account-storage-percent" aria-hidden="true">
            {percent}% ocupado
          </span>
        </div>
        <span>Compartilhado entre todas as ferramentas.</span>
      </div>
      {(full ||
        !access.allowed ||
        storage.pendingDeletionBytes > 0 ||
        storage.reservedBytes > 0) && (
        <p className="account-storage-notice" role="status">
          {!access.allowed
            ? "Seu acesso está suspenso. Novos uploads estão bloqueados. "
            : full
              ? "Cota esgotada. Exclua arquivos para liberar espaço. "
              : ""}
          {storage.pendingDeletionBytes > 0
            ? formatBytes(storage.pendingDeletionBytes) +
              " em exclusão; o espaço será liberado após a confirmação. "
            : ""}
          {storage.reservedBytes > 0
            ? formatBytes(storage.reservedBytes) +
              " reservados para uploads em andamento."
            : ""}
        </p>
      )}
    </section>
  );
}
