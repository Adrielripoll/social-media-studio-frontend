import { apiRequest } from "../auth/api";
export interface Client {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export function listClients(signal?: AbortSignal) {
  return apiRequest<{ clients: Client[] }>("/clients", { signal });
}
export function saveClient(name: string, id?: string) {
  return apiRequest<Client>(id ? "/clients/" + id : "/clients", {
    method: id ? "PATCH" : "POST",
    body: { name },
  });
}
export function deleteClient(id: string) {
  return apiRequest<void>("/clients/" + id, { method: "DELETE" });
}
