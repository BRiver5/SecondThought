// Монте-Карло прогноз на N недель вперёд: сколько хотелок придёт, сколько из
// них пройдёт само за срок ожидания и сколько денег это сохранит.
// Частота хотелок — Гамма-Пуассон по своей истории, цена/категория/триггер/сила —
// бутстрэп из своих же хотелок, время угасания — λ ~ Gamma(апостериор), T ~ Exp(λ).
// Один и тот же seed для "было/стало" → разница в what-if — от параметров, а не от шума.

import { itemPosterior, type ModelState } from "./desire.ts";
import { decideWait, type WaitParams } from "./cooling.ts";

export type HistoryWant = { price: number; category: string; trigger: string; desire: number };
export type Forecast = { saved: [number, number, number]; spent: [number, number, number]; urges: number; avgWait: number; fadeShare: number };

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number): number {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// Marsaglia–Tsang; для shape < 1 — буст через U^(1/shape).
export function gammaSample(shape: number, rate: number, r: () => number): number {
  if (shape < 1) return gammaSample(shape + 1, rate, r) * Math.pow(Math.max(1e-12, r()), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(r);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = r();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return (d * v) / rate;
  }
}

function poisson(lambda: number, r: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 500);
  return k - 1;
}

const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];

export function forecast(history: HistoryWant[], weeksObserved: number, state: ModelState, params: WaitParams, weeks: number, sims = 400, seed = 7): Forecast | null {
  if (history.length === 0) return null;
  const r = rng(seed);
  const shape = 1 + history.length;
  const rate = 0.5 + Math.max(1, weeksObserved);
  const savedAll: number[] = [];
  const spentAll: number[] = [];
  let urges = 0;
  let waitSum = 0;
  let fades = 0;
  const cache = new Map<string, ReturnType<typeof decideWait> & { a: number; b: number }>();
  for (let s = 0; s < sims; s++) {
    const lambda = gammaSample(shape, rate, r);
    const n = poisson(lambda * weeks, r);
    let saved = 0;
    let spent = 0;
    for (let i = 0; i < n; i++) {
      const h = history[Math.floor(r() * history.length)];
      const key = `${h.category}|${h.trigger}|${h.desire}|${h.price}`;
      let d = cache.get(key);
      if (!d) {
        const g = itemPosterior(state, h.category, h.trigger);
        d = { ...decideWait(g, h.price, h.desire, params), a: g.a, b: g.b };
        cache.set(key, d);
      }
      const t = -Math.log(Math.max(1e-12, r())) / gammaSample(d.a, d.b, r);
      urges++;
      waitSum += d.days;
      if (t < d.days) {
        saved += h.price;
        fades++;
      } else spent += h.price;
    }
    savedAll.push(saved);
    spentAll.push(spent);
  }
  savedAll.sort((a, b) => a - b);
  spentAll.sort((a, b) => a - b);
  return {
    saved: [q(savedAll, 0.1), q(savedAll, 0.5), q(savedAll, 0.9)],
    spent: [q(spentAll, 0.1), q(spentAll, 0.5), q(spentAll, 0.9)],
    urges: urges / sims,
    avgWait: urges ? waitSum / urges : 0,
    fadeShare: urges ? fades / urges : 0,
  };
}
