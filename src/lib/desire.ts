// Модель угасания желания: время, через которое "хочу" проходит само, —
// экспоненциальное с неизвестной скоростью λ (в день), λ ~ Gamma(a, b).
// Апостериорная предсказательная выживаемость — распределение Ломакса:
//   S(t) = P(всё ещё хочу через t дней) = (b / (b + t))^a,  h(t) = a / (b + t).
//
// Состояние НАКАПЛИВАЕТСЯ: каждая развязка (отпустил / купил после ожидания)
// добавляет наблюдение к общему, категорийному и триггерному счётчику, а старые
// данные плавно забываются (FORGET), чтобы привычки двухлетней давности не
// держали модель вечно. Категория частично объединяется с общим уровнем
// (POOL псевдонаблюдений), триггер — множитель скорости, тоже стянутый к 1.

export const MODEL_VERSION = 2;
export const BASE = { a: 2, b: 16 }; // априорно: медиана жизни хотелки ~ 6 дней
export const FORGET = 0.97;
export const POOL = 3;

export type Gamma = { a: number; b: number };
// Чистое свидетельство (без априора): число угасаний и сумма дней наблюдения.
export type Evidence = { n: number; days: number };
export type ModelState = { global: Evidence; cats: Record<string, Evidence>; triggers: Record<string, Evidence> };

export const emptyState = (): ModelState => ({ global: { n: 0, days: 0 }, cats: {}, triggers: {} });

export type Outcome =
  // Отпустил: желание угасло где-то между последним "ещё хочу" и днём решения.
  | { kind: "faded"; lastWanted: number; decided: number }
  // Купил после ожидания: желание пережило весь срок — цензурированное наблюдение.
  | { kind: "persisted"; decided: number };

export function observation(o: Outcome): Evidence {
  if (o.kind === "faded") {
    const lo = Math.max(0, Math.min(o.lastWanted, o.decided));
    return { n: 1, days: Math.max(0.5, (lo + o.decided) / 2) };
  }
  return { n: 0, days: Math.max(0, o.decided) };
}

const fold = (e: Evidence | undefined, obs: Evidence): Evidence => ({
  n: (e?.n ?? 0) * FORGET + obs.n,
  days: (e?.days ?? 0) * FORGET + obs.days,
});

export function learn(state: ModelState, category: string, trigger: string, o: Outcome): ModelState {
  const obs = observation(o);
  return {
    global: fold(state.global, obs),
    cats: { ...state.cats, [category]: fold(state.cats[category], obs) },
    triggers: { ...state.triggers, [trigger]: fold(state.triggers[trigger], obs) },
  };
}

export function globalPosterior(s: ModelState): Gamma {
  return { a: BASE.a + s.global.n, b: BASE.b + s.global.days };
}

// Апостериор категории: общий уровень как априор силой POOL псевдо-угасаний.
export function categoryPosterior(s: ModelState, category: string): Gamma {
  const g = globalPosterior(s);
  const mean = g.a / g.b;
  const e = s.cats[category] ?? { n: 0, days: 0 };
  return { a: POOL + e.n, b: POOL / mean + e.days };
}

// Множитель скорости угасания для триггера относительно общего уровня,
// стянутый к 1 тем же POOL: "Sale"-хотелки обычно проходят быстрее.
export function triggerMultiplier(s: ModelState, trigger: string): number {
  const g = globalPosterior(s);
  const mean = g.a / g.b;
  const e = s.triggers[trigger] ?? { n: 0, days: 0 };
  const rate = (POOL + e.n) / (POOL / mean + e.days);
  return Math.min(3, Math.max(1 / 3, rate / mean));
}

// Итоговый апостериор для конкретной хотелки: скорость категории × множитель
// триггера (масштабирование скорости = деление b).
export function itemPosterior(s: ModelState, category: string, trigger: string): Gamma {
  const c = categoryPosterior(s, category);
  return { a: c.a, b: c.b / triggerMultiplier(s, trigger) };
}

export function survival(g: Gamma, t: number): number {
  if (t <= 0) return 1;
  return Math.pow(g.b / (g.b + t), g.a);
}

export function hazard(g: Gamma, t: number): number {
  return g.a / (g.b + Math.max(0, t));
}

// ∫₀ᵗ S(u) du — ожидаемое число дней "зуда" за первые t дней.
export function survivalIntegral(g: Gamma, t: number): number {
  if (t <= 0) return 0;
  if (Math.abs(g.a - 1) < 1e-9) return g.b * Math.log((g.b + t) / g.b);
  return (g.b / (g.a - 1)) * (1 - Math.pow(g.b / (g.b + t), g.a - 1));
}

// Медиана времени угасания: S(t) = 0.5.
export function medianFade(g: Gamma): number {
  return g.b * (Math.pow(2, 1 / g.a) - 1);
}

// Сколько "наблюдений" стоит за оценкой — для подписи надёжности.
export function evidenceCount(s: ModelState, category: string): number {
  return s.cats[category]?.n ?? 0;
}

// Условная вероятность, что желание угаснет за ещё extra дней, если до сих пор не угасло.
export function fadeWithin(g: Gamma, waited: number, extra: number): number {
  const s0 = survival(g, waited);
  if (s0 <= 0) return 1;
  return 1 - survival(g, waited + extra) / s0;
}

// Пересборка состояния из журнала развязок (при смене MODEL_VERSION).
export function rebuild(journal: { category: string; trigger: string; outcome: Outcome }[]): ModelState {
  return journal.reduce((s, j) => learn(s, j.category, j.trigger, j.outcome), emptyState());
}
