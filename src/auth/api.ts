import { authConfiguration } from "./config";

export interface PlatformUser {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message = "Não foi possível concluir. Tente novamente.",
    public readonly code = "",
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
let csrfPending: Promise<string> | null = null;
export function resetCsrf() {
  csrfToken = null;
  csrfPending = null;
}

try {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (
        key === "social-media-studio-auth" ||
        key.startsWith("social-media-studio-auth-")
      )
        storage.removeItem(key);
    }
  }
} catch {
  /* Navegadores podem bloquear o armazenamento local. */
}

async function getCsrf() {
  if (csrfToken) return csrfToken;
  if (!csrfPending) {
    csrfPending = (async () => {
      const response = await fetch(authConfiguration.apiUrl + "/auth/csrf", {
        credentials: "include",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new ApiError(response.status);
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("csrfToken" in value) ||
        typeof value.csrfToken !== "string"
      )
        throw new ApiError(502);
      csrfToken = value.csrfToken;
      return csrfToken;
    })().finally(() => {
      csrfPending = null;
    });
  }
  return csrfPending;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
  retry = true,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers["X-CSRF-Token"] = await getCsrf();
  const signals = [AbortSignal.timeout(options.timeoutMs ?? 15_000)];
  if (options.signal) signals.push(options.signal);
  const response = await fetch(authConfiguration.apiUrl + path, {
    method,
    credentials: "include",
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
    signal: AbortSignal.any(signals),
  });
  const nextCsrf = response.headers.get("X-CSRF-Token");
  if (nextCsrf) csrfToken = nextCsrf;
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = value && typeof value === "object" ? value : {};
    const code =
      "code" in error && typeof error.code === "string" ? error.code : "";
    if (response.status === 403 && code === "csrf_invalid" && retry) {
      resetCsrf();
      return apiRequest<T>(path, options, false);
    }
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : undefined;
    throw new ApiError(response.status, message, code);
  }
  return value as T;
}

export async function registerCurrentUser(
  signal: AbortSignal,
): Promise<PlatformUser> {
  const value: unknown = await apiRequest("/users/me", {
    method: "POST",
    signal,
  });
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !("email" in value) ||
    !(value.email === null || typeof value.email === "string") ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    !("phone" in value) ||
    !(value.phone === null || typeof value.phone === "string") ||
    !("createdAt" in value) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !("updatedAt" in value) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  ) {
    throw new ApiError(502);
  }
  return {
    id: value.id,
    email: value.email,
    name: value.name,
    phone: value.phone,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
