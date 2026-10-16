import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest, ApiError } from "../auth/api";
export interface AccountSummary {
  plan: {
    code: string;
    name: string;
    storageLimitBytes: number;
    features: { images: boolean; videos: boolean };
  };
  access: {
    status:
      | "trialing"
      | "trial_expired"
      | "active"
      | "canceled"
      | "overdue"
      | "subscription_expired";
    paidUntil?: string | null;
    allowed: boolean;
    trialStartedAt: string;
    trialEndsAt: string;
  };
  retention?: {
    status: "protected" | "retained";
    months: number;
    projectedPurgeAt: string | null;
    automaticPurgeEnabled: boolean;
    acceptedAt?: string | null;
    purgedAt?: string | null;
    policy?: { version: string; title: string; paragraphs: string[] };
  };
  storage: {
    limitBytes: number;
    usedBytes: number;
    reservedBytes: number;
    pendingDeletionBytes: number;
    availableBytes: number;
    percentUsed: number;
  };
}
interface AccountState {
  account: AccountSummary | null;
  error: string;
  loading: boolean;
  refresh: () => void;
}
const AccountContext = createContext<AccountState | null>(null);
export function storageChanged() {
  window.dispatchEvent(new Event("storage-usage-changed"));
}
export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setError("");
    void apiRequest<AccountSummary>("/account", { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (
          !value?.plan ||
          !value?.access ||
          typeof value.access.allowed !== "boolean" ||
          !value?.storage ||
          !Number.isFinite(value.storage.limitBytes)
        )
          throw new ApiError(502);
        setAccount(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Não foi possível consultar sua conta e armazenamento.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    window.addEventListener("storage-usage-changed", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("account-access-changed", refresh);
    return () => {
      window.removeEventListener("storage-usage-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("account-access-changed", refresh);
    };
  }, []);
  useEffect(() => {
    if (
      !account ||
      (!account.storage.pendingDeletionBytes && !account.storage.reservedBytes)
    )
      return;
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [account]);
  useEffect(() => {
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!account?.access.allowed) return;
    const end =
      account.access.status === "trialing"
        ? account.access.trialEndsAt
        : account.access.paidUntil;
    if (!end) return;
    const delay = Math.max(0, Date.parse(end) - Date.now());
    if (delay > 2147483647) return;
    const timer = window.setTimeout(() => {
      setAccount((current) =>
        current
          ? { ...current, access: { ...current.access, allowed: false } }
          : current,
      );
      refresh();
    }, delay + 50);
    return () => window.clearTimeout(timer);
  }, [account]);
  return (
    <AccountContext.Provider value={{ account, error, loading, refresh }}>
      {children}
    </AccountContext.Provider>
  );
}
export function useAccount() {
  return useContext(AccountContext);
}
