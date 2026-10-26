// Стрик дней без импульсных покупок и калибровка прогнозов модели.
// Покупка после честного ожидания стрик НЕ рвёт — рвёт только "купил сразу".

import { addDays, daysBetween } from "./time.ts";

export type DayStatus = "clean" | "impulse" | "planned" | "none";

export function streaks(firstDay: string | null, today: string, impulseDays: string[]): { current: number; best: number } {
  if (!firstDay) return { current: 0, best: 0 };
  const bad = new Set(impulseDays);
  let best = 0;
  let run = 0;
  const total = daysBetween(firstDay, today);
  for (let i = 0; i <= total; i++) {
    const d = addDays(firstDay, i);
    if (bad.has(d)) run = 0;
    else run++;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

export function dayStatuses(today: string, days: number, impulseDays: string[], plannedDays: string[], firstDay: string | null): { day: string; status: DayStatus }[] {
  const imp = new Set(impulseDays);
  const pl = new Set(plannedDays);
  const out: { day: string; status: DayStatus }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const before = !firstDay || day < firstDay;
    out.push({ day, status: before ? "none" : imp.has(day) ? "impulse" : pl.has(day) ? "planned" : "clean" });
  }
  return out;
}

// Брайер: (p − исход)² по развязкам, где при постановке на паузу записан
// прогноз "пройдёт за срок". Плюс бины надёжности для графика.
export function calibration(rows: { p: number; faded: boolean }[]): { brier: number | null; baseline: number | null; bins: { lo: number; predicted: number; actual: number; n: number }[] } {
  if (rows.length === 0) return { brier: null, baseline: null, bins: [] };
  const rate = rows.filter((r) => r.faded).length / rows.length;
  const brier = rows.reduce((s, r) => s + (r.p - (r.faded ? 1 : 0)) ** 2, 0) / rows.length;
  const baseline = rows.reduce((s, r) => s + (rate - (r.faded ? 1 : 0)) ** 2, 0) / rows.length;
  const bins = [0, 0.25, 0.5, 0.75].map((lo) => {
    const inBin = rows.filter((r) => r.p >= lo && (lo === 0.75 ? r.p <= 1 : r.p < lo + 0.25));
    return {
      lo,
      n: inBin.length,
      predicted: inBin.length ? inBin.reduce((s, r) => s + r.p, 0) / inBin.length : 0,
      actual: inBin.length ? inBin.filter((r) => r.faded).length / inBin.length : 0,
    };
  });
  return { brier, baseline, bins };
}
