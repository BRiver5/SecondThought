// Срок ожидания для хотелки — не "правило 30 дней", а решение задачи:
//   выгода(t) = цена · (1 − S(t))           — ожидаемо сэкономленное: желание прошло
//   цена зуда(t) = зуд/день · ∫₀ᵗ S(u) du   — ожидаемые дни, пока всё ещё хочется
// Максимум разности там, где риск угасания завтра h(t) падает до зуд/цена:
//   a / (b + t) = зуд / цена   →   t* = a·цена/зуд − b.
// Дорогое ждёт дольше, сильное желание (больше зуда) — короче.

import { hazard, medianFade, survival, survivalIntegral, type Gamma } from "./desire.ts";

export type WaitParams = { itchPerDay: number; maxWait: number; minWait: number };

export type WaitDecision = {
  days: number;
  unclamped: number;
  pFade: number; // вероятность, что за срок желание пройдёт
  expectedSaved: number;
  itchCost: number;
  net: number;
  itch: number; // зуд в день с учётом силы желания
  hazardAtEnd: number;
  median: number;
  clamp: "none" | "min" | "max";
};

export function itchFor(itchPerDay: number, desire: number): number {
  return itchPerDay * (0.4 + 0.2 * desire); // desire 1..5 → ×0.6..×1.4
}

export function netBenefit(g: Gamma, price: number, itch: number, t: number): number {
  return price * (1 - survival(g, t)) - itch * survivalIntegral(g, t);
}

export function decideWait(g: Gamma, price: number, desire: number, p: WaitParams): WaitDecision {
  const itch = itchFor(p.itchPerDay, desire);
  const raw = itch > 0 ? (g.a * price) / itch - g.b : p.maxWait;
  let days = Math.round(raw);
  let clamp: WaitDecision["clamp"] = "none";
  if (days < p.minWait) {
    days = p.minWait;
    clamp = "min";
  } else if (days > p.maxWait) {
    days = p.maxWait;
    clamp = "max";
  }
  const s = survival(g, days);
  return {
    days,
    unclamped: raw,
    pFade: 1 - s,
    expectedSaved: price * (1 - s),
    itchCost: itch * survivalIntegral(g, days),
    net: netBenefit(g, price, itch, days),
    itch,
    hazardAtEnd: hazard(g, days),
    median: medianFade(g),
    clamp,
  };
}

// Кривая выгоды по дням — для виджета "почему столько" (максимум = выбранный день).
export function benefitCurve(g: Gamma, price: number, desire: number, itchPerDay: number, horizon: number): number[] {
  const itch = itchFor(itchPerDay, desire);
  const out: number[] = [];
  for (let t = 0; t <= horizon; t++) out.push(netBenefit(g, price, itch, t));
  return out;
}
