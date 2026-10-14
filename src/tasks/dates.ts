export const TASK_TIME_ZONE = "America/Sao_Paulo";
export function todayDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TASK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function formatTaskDate(date: string, weekday = true) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...(weekday ? { weekday: "long" as const } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date + "T12:00:00Z"));
}
export function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return {
    from: month + "-01",
    to: month + "-" + String(count).padStart(2, "0"),
    count,
  };
}
export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-01T12:00:00Z"));
}

export function formatTaskAddedDate(timestamp: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TASK_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function taskDateFromTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TASK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
