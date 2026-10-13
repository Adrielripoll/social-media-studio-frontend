import { authConfiguration } from "./config";

export interface AuthenticatedIdentity {
  id: string;
  email: string | null;
  name: string | null;
}

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super("Não foi possível validar seu acesso.");
  }
}

export async function getCurrentIdentity(
  token: string,
  signal: AbortSignal,
): Promise<AuthenticatedIdentity> {
  const response = await fetch(authConfiguration.apiUrl + "/me", {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) throw new ApiError(response.status);
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
    !(value.name === null || typeof value.name === "string")
  )
    throw new ApiError(502);
  return { id: value.id, email: value.email, name: value.name };
}
