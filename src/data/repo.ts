// Слой данных поверх expo-sqlite. Все функции идут через один мьютекс (цепочка
// промисов): два refresh()/записи внахлёст давали "execAsync has been rejected"
// и полупримененные транзакции (Steady Weeks).

import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { daysBetween } from "../lib/time";
import { MODEL_VERSION, emptyState, learn, rebuild, type ModelState, type Outcome } from "../lib/desire";

export type Status = "waiting" | "bought" | "skipped" | "impulse";

export type Want = {
  id: string;
  name: string;
  price: number;
  category: string;
  trigger: string;
  desire: number;
  created_day: string;
  wait_days: number;
  p_fade: number | null;
  status: Status;
  resolved_day: string | null;
  note: string;
};

export type Checkin = { id: string; want_id: string; day: string; still: number };

export type Settings = {
  currency: string;
  allowance: number;
  capMult: number;
  itchPerDay: number;
  maxWait: number;
  haptics: boolean;
  reminders: boolean;
};

export const DEFAULT_SETTINGS: Settings = { currency: "$", allowance: 120, capMult: 2, itchPerDay: 5, maxWait: 30, haptics: true, reminders: false };

let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

export function outcomeOf(w: Want, checkins: Checkin[]): Outcome | null {
  if (!w.resolved_day || w.status === "waiting" || w.status === "impulse") return null;
  const decided = daysBetween(w.created_day, w.resolved_day);
  if (w.status === "bought") return { kind: "persisted", decided };
  const wanted = checkins.filter((c) => c.want_id === w.id && c.still === 1).map((c) => daysBetween(w.created_day, c.day));
  return { kind: "faded", lastWanted: wanted.length ? Math.max(...wanted) : 0, decided };
}

function journal(wants: Want[], checkins: Checkin[]) {
  return wants
    .filter((w) => w.resolved_day && (w.status === "bought" || w.status === "skipped"))
    .sort((a, b) => (a.resolved_day! < b.resolved_day! ? -1 : a.resolved_day! > b.resolved_day! ? 1 : 0))
    .map((w) => ({ category: w.category, trigger: w.trigger, outcome: outcomeOf(w, checkins)! }));
}

async function saveModel(s: ModelState) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM model;");
    const put = (key: string, e: { n: number; days: number }) => db.runAsync("INSERT INTO model (key, n, days) VALUES (?, ?, ?);", [key, e.n, e.days]);
    await put("g", s.global);
    for (const [k, e] of Object.entries(s.cats)) await put(`c:${k}`, e);
    for (const [k, e] of Object.entries(s.triggers)) await put(`t:${k}`, e);
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('model_version', ?);", [String(MODEL_VERSION)]);
  });
}

export function loadAll() {
  return locked(async () => {
    const db = await getDb();
    const wants = await db.getAllAsync<Want>("SELECT * FROM wants ORDER BY created_day DESC, rowid DESC;");
    const checkins = await db.getAllAsync<Checkin>("SELECT * FROM checkins ORDER BY day ASC, rowid ASC;");
    const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings;");
    const raw: Record<string, string> = Object.fromEntries(srows.map((r) => [r.key, r.value]));
    const settings: Settings = { ...DEFAULT_SETTINGS };
    if (raw.currency) settings.currency = raw.currency;
    for (const k of ["allowance", "capMult", "itchPerDay", "maxWait"] as const) if (raw[k]) settings[k] = Number(raw[k]);
    if (raw.haptics) settings.haptics = raw.haptics === "1";
    if (raw.reminders) settings.reminders = raw.reminders === "1";

    let model: ModelState;
    if (raw.model_version !== String(MODEL_VERSION)) {
      // Константы модели поменялись — пересобрать накопленное состояние из журнала.
      model = rebuild(journal(wants, checkins));
      await saveModel(model);
    } else {
      model = emptyState();
      const mrows = await db.getAllAsync<{ key: string; n: number; days: number }>("SELECT * FROM model;");
      for (const r of mrows) {
        const e = { n: r.n, days: r.days };
        if (r.key === "g") model.global = e;
        else if (r.key.startsWith("c:")) model.cats[r.key.slice(2)] = e;
        else if (r.key.startsWith("t:")) model.triggers[r.key.slice(2)] = e;
      }
    }
    return { wants, checkins, settings, model };
  });
}

export type NewWant = { name: string; price: number; category: string; trigger: string; desire: number; note: string };

export function addWant(w: NewWant, day: string, waitDays: number, pFade: number) {
  return locked(async () => {
    const db = await getDb();
    const id = generateId();
    await db.runAsync(
      "INSERT INTO wants (id, name, price, category, trigger, desire, created_day, wait_days, p_fade, status, resolved_day, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', NULL, ?);",
      [id, w.name, w.price, w.category, w.trigger, w.desire, day, waitDays, pFade, w.note]
    );
    return id;
  });
}

export function addImpulse(w: NewWant, day: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO wants (id, name, price, category, trigger, desire, created_day, wait_days, p_fade, status, resolved_day, note) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 'impulse', ?, ?);",
      [generateId(), w.name, w.price, w.category, w.trigger, w.desire, day, day, w.note]
    );
  });
}

export function addCheckin(wantId: string, day: string, still: boolean) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("INSERT INTO checkins (id, want_id, day, still) VALUES (?, ?, ?, ?);", [generateId(), wantId, day, still ? 1 : 0]);
  });
}

// Развязка — единственное место, где модель УЧИТСЯ: одно наблюдение поверх
// накопленного состояния, без пересчёта с нуля.
export function resolveWant(w: Want, checkins: Checkin[], model: ModelState, kind: "bought" | "skipped", day: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("UPDATE wants SET status = ?, resolved_day = ? WHERE id = ?;", [kind, day, w.id]);
    const o = outcomeOf({ ...w, status: kind, resolved_day: day }, checkins);
    if (o) await saveModel(learn(model, w.category, w.trigger, o));
  });
}

// Отмена развязки или удаление уже выученной — единственный случай пересборки из журнала.
async function relearn() {
  const db = await getDb();
  const wants = await db.getAllAsync<Want>("SELECT * FROM wants;");
  const checkins = await db.getAllAsync<Checkin>("SELECT * FROM checkins;");
  await saveModel(rebuild(journal(wants, checkins)));
}

export function reopenWant(id: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("UPDATE wants SET status = 'waiting', resolved_day = NULL WHERE id = ? AND status != 'impulse';", [id]);
    await relearn();
  });
}

export function deleteWant(id: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM wants WHERE id = ?;", [id]);
    await db.runAsync("DELETE FROM checkins WHERE want_id = ?;", [id]);
    await relearn();
  });
}

export function updateWant(id: string, patch: Partial<Pick<Want, "name" | "price" | "wait_days" | "desire" | "note">>) {
  return locked(async () => {
    const db = await getDb();
    for (const [k, v] of Object.entries(patch)) await db.runAsync(`UPDATE wants SET ${k} = ? WHERE id = ?;`, [v as string | number, id]);
  });
}

export function setSetting(key: keyof Settings, value: string | number | boolean) {
  return locked(async () => {
    const db = await getDb();
    const v = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);", [key, v]);
  });
}

export function wipeAll() {
  return locked(async () => {
    const db = await getDb();
    await db.execAsync("DELETE FROM wants; DELETE FROM checkins; DELETE FROM model;");
  });
}
