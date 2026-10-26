// Фонд "на хотелки": каждый месяц приходит лимит, неистраченное переносится,
// но не выше capMult лимитов (иначе копилка превращается в разрешение на
// крупную импульсную покупку). Созревшие хотелки, которые всё ещё хочется,
// конкурируют за остаток — точный 0/1-рюкзак по целым единицам валюты.
// Что не влезло — конфликт с ПРОВЕРЕННЫМИ пересчётом альтернативами.

import { addMonthsKey, monthIndex } from "./time.ts";
import { fadeWithin, type Gamma } from "./desire.ts";

export type FundMonth = { month: string; start: number; added: number; capped: number; spent: number; end: number };

export function fundLedger(firstMonth: string, current: string, allowance: number, capMult: number, spentByMonth: Record<string, number>): FundMonth[] {
  const out: FundMonth[] = [];
  let carry = 0;
  const n = monthIndex(current) - monthIndex(firstMonth);
  for (let i = 0; i <= Math.max(0, n); i++) {
    const month = addMonthsKey(firstMonth, i);
    const raw = carry + allowance;
    const cap = allowance * capMult;
    const start = Math.min(raw, cap);
    const spent = spentByMonth[month] ?? 0;
    const end = start - spent;
    out.push({ month, start: carry, added: allowance, capped: Math.max(0, raw - cap), spent, end });
    carry = end;
  }
  return out;
}

export type Candidate = { id: string; name: string; price: number; value: number };
export type Pick = { chosen: string[]; cost: number; value: number };

// Точный 0/1-рюкзак: максимум ценности, при равной — минимум стоимости.
// Цены в целых единицах валюты (вверх), при большой ёмкости — укрупнение шага.
export function knapsack(items: Candidate[], capacity: number): Pick {
  const cap0 = Math.max(0, Math.floor(capacity));
  const unit = Math.max(1, Math.ceil(cap0 / 4000));
  const cap = Math.floor(cap0 / unit);
  const w = items.map((it) => Math.ceil(it.price / unit));
  const score = items.map((it) => it.value * 1e6 - it.price);
  const n = items.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= cap; c++) {
      dp[i][c] = dp[i - 1][c];
      if (w[i - 1] <= c) {
        const v = dp[i - 1][c - w[i - 1]] + score[i - 1];
        if (v > dp[i][c]) dp[i][c] = v;
      }
    }
  }
  const chosen: string[] = [];
  let c = cap;
  for (let i = n; i >= 1; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      chosen.push(items[i - 1].id);
      c -= w[i - 1];
    }
  }
  const set = new Set(chosen);
  const sel = items.filter((it) => set.has(it.id));
  return { chosen: sel.map((s) => s.id), cost: sel.reduce((s, x) => s + x.price, 0), value: sel.reduce((s, x) => s + x.value, 0) };
}

export type Alternative = {
  kind: "swap" | "next-month" | "hold" | "let-go";
  title: string;
  detail: string;
  cost: number; // цена альтернативы в "очках желания" — меньше лучше
  drops?: string[];
};

export type Conflict = { id: string; name: string; price: number; reason: string; alternatives: Alternative[]; neverFits: boolean };

export type MonthPlan = {
  available: number;
  pick: Pick;
  leftover: number;
  nextMonth: number;
  conflicts: Conflict[];
};

export function planMonth(
  candidates: (Candidate & { posterior: Gamma; waited: number })[],
  available: number,
  allowance: number,
  capMult: number,
  money: (x: number) => string
): MonthPlan {
  const pick = knapsack(candidates, available);
  const leftover = available - pick.cost;
  const nextMonth = Math.min(allowance * capMult, leftover + allowance);
  const chosen = new Set(pick.chosen);
  const conflicts: Conflict[] = [];
  for (const x of candidates) {
    if (chosen.has(x.id)) continue;
    const alts: Alternative[] = [];
    const neverFits = x.price > allowance * capMult;
    if (!neverFits && x.price <= available) {
      // Взять X вместо кого-то: рюкзак на остальных с ёмкостью минус цена X.
      const rest = knapsack(candidates.filter((c) => c.id !== x.id), available - x.price);
      const lost = pick.value - (rest.value + x.value);
      const drops = pick.chosen.filter((id) => !rest.chosen.includes(id));
      const names = candidates.filter((c) => drops.includes(c.id)).map((c) => c.name);
      alts.push({
        kind: "swap",
        title: names.length ? `Buy it instead of ${names.join(" + ")}` : "Buy it now",
        detail: `Plan value ${lost > 0 ? `drops by ${lost.toFixed(1)}` : "stays the same"} · ${money(available - x.price - rest.cost)} left`,
        cost: Math.max(0, lost),
        drops,
      });
    }
    if (!neverFits && x.price <= nextMonth) {
      alts.push({ kind: "next-month", title: "Buy it next month", detail: `Next month's fund: ${money(nextMonth)} after this plan`, cost: 0.3 * x.value });
    } else if (!neverFits) {
      const monthsNeeded = Math.ceil((x.price - leftover) / allowance);
      alts.push({ kind: "next-month", title: `Save up for ${monthsNeeded} months`, detail: `Fund reaches ${money(leftover + monthsNeeded * allowance)} by then`, cost: 0.3 * x.value * monthsNeeded });
    }
    const p = fadeWithin(x.posterior, x.waited, 14);
    alts.push({ kind: "hold", title: "Hold it 14 more days", detail: `${Math.round(p * 100)}% chance the urge passes · saves ${money(x.price * p)} on average`, cost: 0.35 * x.value * (1 - p) + 0.1 });
    alts.push({ kind: "let-go", title: "Let it go", detail: `Keeps ${money(x.price)} in the fund`, cost: x.value });
    alts.sort((a, b) => a.cost - b.cost);
    const reason = neverFits
      ? `Costs more than a full fund (${money(allowance * capMult)}) — it can never fit the fun budget.`
      : x.price > available
        ? `Only ${money(available)} left this month.`
        : `Fits alone, but the plan gets more of what you want without it.`;
    conflicts.push({ id: x.id, name: x.name, price: x.price, reason, alternatives: alts, neverFits });
  }
  return { available, pick, leftover, nextMonth, conflicts };
}
