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
    message = "Não foi possível validar seu acesso.",
  ) {
    super(message);
  }
}

export async function registerCurrentUser(
  token: string,
  signal: AbortSignal,
): Promise<PlatformUser> {
  const response = await fetch(authConfiguration.apiUrl + "/users/me", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) {
    if (response.status === 400) {
      const error: unknown = await response.json().catch(() => null);
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        throw new ApiError(400, error.message);
      }
    }
    throw new ApiError(response.status);
  }
  const value: unknown = await response.json();
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
