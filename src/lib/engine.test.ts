import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, learn, itemPosterior, survival, survivalIntegral, categoryPosterior, triggerMultiplier, rebuild, type Outcome } from "./desire.ts";
import { decideWait, netBenefit, itchFor } from "./cooling.ts";
import { knapsack, planMonth, fundLedger } from "./budget.ts";
import { forecast } from "./forecast.ts";
import { streaks, calibration } from "./track.ts";

test("survival integral matches numeric integration", () => {
  for (const g of [{ a: 2, b: 16 }, { a: 1, b: 5 }, { a: 0.7, b: 3 }]) {
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) s += survival(g, ((i + 0.5) / n) * 10) * (10 / n);
    assert.ok(Math.abs(s - survivalIntegral(g, 10)) < 1e-3);
  }
});

test("faded outcomes speed up the category, persisted ones slow it down", () => {
  let s = emptyState();
  const base = categoryPosterior(s, "Gadgets");
  for (let i = 0; i < 6; i++) s = learn(s, "Gadgets", "Ad", { kind: "faded", lastWanted: 0, decided: 2 });
  const fast = categoryPosterior(s, "Gadgets");
  assert.ok(fast.a / fast.b > base.a / base.b);
  let p = emptyState();
  for (let i = 0; i < 6; i++) p = learn(p, "Books", "Need-ish", { kind: "persisted", decided: 20 });
  const slow = categoryPosterior(p, "Books");
  assert.ok(slow.a / slow.b < base.a / base.b);
  assert.ok(triggerMultiplier(s, "Ad") >= 1);
});

test("rebuild from the journal reproduces incremental learning", () => {
  const journal: { category: string; trigger: string; outcome: Outcome }[] = [
    { category: "Home", trigger: "Sale", outcome: { kind: "faded", lastWanted: 1, decided: 4 } },
    { category: "Home", trigger: "Bored", outcome: { kind: "persisted", decided: 9 } },
  ];
  let s = emptyState();
  for (const j of journal) s = learn(s, j.category, j.trigger, j.outcome);
  assert.deepEqual(rebuild(journal), s);
});

test("optimal wait is the argmax of net benefit and grows with price", () => {
  const g = itemPosterior(emptyState(), "Clothes", "Ad");
  const params = { itchPerDay: 5, maxWait: 60, minWait: 1 };
  const d = decideWait(g, 120, 3, params);
  const itch = itchFor(5, 3);
  let bestT = 0;
  for (let t = 1; t <= 60; t++) if (netBenefit(g, 120, itch, t) > netBenefit(g, 120, itch, bestT)) bestT = t;
  assert.ok(Math.abs(bestT - d.days) <= 1);
  assert.ok(decideWait(g, 300, 3, params).days > d.days);
  assert.ok(decideWait(g, 120, 5, params).days < d.days);
  assert.equal(decideWait(g, 5, 3, params).clamp, "min");
});

test("knapsack is exact on a small brute-force check", () => {
  const items = [
    { id: "a", name: "a", price: 40, value: 4 },
    { id: "b", name: "b", price: 35, value: 3 },
    { id: "c", name: "c", price: 30, value: 3 },
    { id: "d", name: "d", price: 70, value: 6 },
  ];
  let best = 0;
  for (let m = 0; m < 16; m++) {
    const sel = items.filter((_, i) => m & (1 << i));
    if (sel.reduce((s, x) => s + x.price, 0) <= 100) best = Math.max(best, sel.reduce((s, x) => s + x.value, 0));
  }
  assert.equal(knapsack(items, 100).value, best);
});

test("plan conflicts carry verified alternatives", () => {
  const g = { a: 2, b: 16 };
  const c = [
    { id: "a", name: "Jacket", price: 80, value: 5, posterior: g, waited: 10 },
    { id: "b", name: "Lamp", price: 50, value: 3, posterior: g, waited: 7 },
  ];
  const plan = planMonth(c, 100, 100, 2, (x) => `$${x}`);
  assert.deepEqual(plan.pick.chosen, ["a"]);
  assert.equal(plan.conflicts.length, 1);
  const kinds = plan.conflicts[0].alternatives.map((a) => a.kind);
  assert.ok(kinds.includes("swap") && kinds.includes("hold"));
  const never = planMonth([{ ...c[0], price: 500 }], 100, 100, 2, (x) => `$${x}`);
  assert.ok(never.conflicts[0].neverFits);
});

test("fund ledger caps rollover", () => {
  const l = fundLedger("2026-01", "2026-04", 100, 2, { "2026-02": 30 });
  assert.equal(l[3].end, 200);
  assert.equal(l[1].end, 170);
});

test("forecast is deterministic and saves more with longer waits", () => {
  const hist = [
    { price: 60, category: "Clothes", trigger: "Ad", desire: 3 },
    { price: 150, category: "Gadgets", trigger: "Sale", desire: 4 },
  ];
  const s = emptyState();
  const a = forecast(hist, 4, s, { itchPerDay: 5, maxWait: 30, minWait: 1 }, 12)!;
  const b = forecast(hist, 4, s, { itchPerDay: 5, maxWait: 30, minWait: 1 }, 12)!;
  assert.deepEqual(a, b);
  const c = forecast(hist, 4, s, { itchPerDay: 1, maxWait: 30, minWait: 1 }, 12)!;
  assert.ok(c.fadeShare > a.fadeShare);
});

test("streaks ignore planned buys and calibration scores", () => {
  const r = streaks("2026-10-01", "2026-10-10", ["2026-10-04"]);
  assert.equal(r.current, 6);
  assert.equal(r.best, 6);
  const cal = calibration([{ p: 0.9, faded: true }, { p: 0.2, faded: false }]);
  assert.ok(cal.brier! < cal.baseline!);
});
