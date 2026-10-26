// Сводка состояния для экранов: одна функция, которую зовут и Home, и Plan,
// и деталь — чтобы виджеты одного числа не считали его по-разному.

import { useMemo } from "react";
import { useApp } from "../store/appStore";
import type { Checkin, Settings, Want } from "../data/repo";
import { itemPosterior, survival, type Gamma, type ModelState } from "../lib/desire";
import { decideWait, type WaitDecision, type WaitParams } from "../lib/cooling";
import { fundLedger, planMonth, type FundMonth, type MonthPlan } from "../lib/budget";
import { streaks } from "../lib/track";
import { daysBetween, monthKey } from "../lib/time";
import { money } from "./format";

export type WaitingView = {
  w: Want;
  g: Gamma;
  waited: number;
  left: number;
  ripe: boolean;
  stillNow: number; // P(всё ещё хочется сегодня) по модели
  lastCheck: Checkin | null;
  value: number;
  decision: WaitDecision;
};

export type Derived = {
  params: WaitParams;
  waiting: WaitingView[];
  ripe: WaitingView[];
  cooling: WaitingView[];
  resolved: Want[];
  firstDay: string | null;
  streak: { current: number; best: number };
  ledger: FundMonth[];
  available: number;
  plan: MonthPlan;
  saved: number;
  spentPlanned: number;
  spentImpulse: number;
  fmt: (x: number) => string;
};

export const paramsOf = (s: Settings): WaitParams => ({ itchPerDay: s.itchPerDay, maxWait: s.maxWait, minWait: 1 });

export function wantValue(w: Want, last: Checkin | null, waited: number): number {
  const base = last && last.still === 0 ? w.desire * 0.5 : w.desire;
  return Math.round((base + Math.min(1, waited / 30)) * 10) / 10;
}

export function viewOf(w: Want, checkins: Checkin[], model: ModelState, params: WaitParams, today: string): WaitingView {
  const g = itemPosterior(model, w.category, w.trigger);
  const waited = daysBetween(w.created_day, today);
  const mine = checkins.filter((c) => c.want_id === w.id);
  const lastCheck = mine.length ? mine[mine.length - 1] : null;
  // Последнее "ещё хочу" — желание дожило до этого дня, дальше условная выживаемость.
  const stillDays = mine.filter((c) => c.still === 1).map((c) => daysBetween(w.created_day, c.day));
  const anchor = stillDays.length ? Math.min(waited, Math.max(...stillDays)) : 0;
  return {
    w,
    g,
    waited,
    left: Math.max(0, w.wait_days - waited),
    ripe: waited >= w.wait_days,
    stillNow: survival(g, waited) / survival(g, anchor),
    lastCheck,
    value: wantValue(w, lastCheck, waited),
    decision: decideWait(g, w.price, w.desire, params),
  };
}

export function computeDerived(wants: Want[], checkins: Checkin[], model: ModelState, settings: Settings, today: string, allowanceOverride?: number): Derived {
  const params = paramsOf(settings);
  const fmt = (x: number) => money(x, settings.currency);
  const allowance = allowanceOverride ?? settings.allowance;
  const waiting = wants.filter((w) => w.status === "waiting").map((w) => viewOf(w, checkins, model, params, today));
  waiting.sort((a, b) => a.left - b.left || b.w.price - a.w.price);
  const ripe = waiting.filter((v) => v.ripe);
  const cooling = waiting.filter((v) => !v.ripe);
  const resolved = wants.filter((w) => w.status !== "waiting");
  const firstDay = wants.length ? wants.reduce((m, w) => (w.created_day < m ? w.created_day : m), wants[0].created_day) : null;
  const impulseDays = wants.filter((w) => w.status === "impulse").map((w) => w.created_day);
  const spentBy: Record<string, number> = {};
  for (const w of wants) if ((w.status === "bought" || w.status === "impulse") && w.resolved_day) spentBy[monthKey(w.resolved_day)] = (spentBy[monthKey(w.resolved_day)] ?? 0) + w.price;
  const ledger = fundLedger(firstDay ? monthKey(firstDay) : monthKey(today), monthKey(today), allowance, settings.capMult, spentBy);
  const cur = ledger[ledger.length - 1];
  const available = Math.max(0, Math.min(cur.start + cur.added, allowance * settings.capMult) - cur.spent);
  const plan = planMonth(
    ripe.map((v) => ({ id: v.w.id, name: v.w.name, price: v.w.price, value: v.value, posterior: v.g, waited: v.waited })),
    available,
    allowance,
    settings.capMult,
    fmt
  );
  const sum = (f: (w: Want) => boolean) => wants.filter(f).reduce((s, w) => s + w.price, 0);
  return {
    params,
    waiting,
    ripe,
    cooling,
    resolved,
    firstDay,
    streak: streaks(firstDay, today, impulseDays),
    ledger,
    available,
    plan,
    saved: sum((w) => w.status === "skipped"),
    spentPlanned: sum((w) => w.status === "bought"),
    spentImpulse: sum((w) => w.status === "impulse"),
    fmt,
  };
}

export function useDerived(): Derived {
  const { wants, checkins, model, settings, today, version } = useApp();
  return useMemo(() => computeDerived(wants, checkins, model, settings, today), [version, today]);
}
