import { apiRequest } from "../auth/api";
export interface Task {
  id: string;
  userId: string;
  title: string;
  scheduledDate: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TaskRange {
  today: string;
  timeZone: string;
  tasks: Task[];
}
export function listTasks(from: string, to: string, signal?: AbortSignal) {
  return apiRequest<TaskRange>("/tasks?" + new URLSearchParams({ from, to }), {
    signal,
  });
}
export function createTask(title: string, scheduledDate: string) {
  return apiRequest<Task>("/tasks", {
    method: "POST",
    body: { title, scheduledDate },
  });
}
export function editTask(id: string, title: string) {
  return apiRequest<Task>("/tasks/" + id, {
    method: "PATCH",
    body: { title },
  });
}
export function completeTask(id: string, completed: boolean) {
  return apiRequest<Task>("/tasks/" + id + "/completion", {
    method: "PATCH",
    body: { completed },
  });
}
export function deleteTask(id: string) {
  return apiRequest<void>("/tasks/" + id, { method: "DELETE" });
}
