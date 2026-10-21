import { test, expect } from "@playwright/test";
import {
  calendarDates,
  dailyHistory,
  summarizeDaily,
} from "../src/dashboards/daily-results";
import { engagementRate, interactions } from "../src/dashboards/metrics";
import { importedDailyPoints } from "./helpers/dashboards";

test("alcance é média diária; outras métricas são totais e interações são fornecidas diretamente", () => {
  const report = summarizeDaily(
    dailyHistory(importedDailyPoints(), "2026-09-22", "2026-09-24"),
  )!;
  expect(report.reach).toBe(200);
  expect(report.views).toBe(1800);
  expect(report.newFollowers).toBe(3);
  expect(interactions(report)).toBe(60);
  expect(engagementRate(report)).toBeNull();
});
test("não preenche lacunas e impede totais parciais, mantendo a média dos dias conhecidos", () => {
  const points = importedDailyPoints().filter(
    (point) => point.date !== "2026-09-23",
  );
  const history = dailyHistory(points, "2026-09-22", "2026-09-24");
  expect(history[1].views).toBeNull();
  const report = summarizeDaily(history)!;
  expect(report.views).toBeNull();
  expect(report.newFollowers).toBeNull();
  expect(report.reach).toBe(200);
});
test("zero é mantido e os limites de datas evitam intervalos inválidos ou excessivos", () => {
  const history = dailyHistory(
    importedDailyPoints(),
    "2026-09-23",
    "2026-09-23",
  );
  expect(summarizeDaily(history)?.newFollowers).toBe(0);
  for (const dates of [
    ["2026-02-31", "2026-03-01"],
    ["2026-10-01", "2026-09-01"],
    ["1900-01-01", "2026-10-01"],
  ]) {
    expect(calendarDates(dates[0], dates[1])).toEqual([]);
  }
});
