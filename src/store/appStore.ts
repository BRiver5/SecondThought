import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type Checkin, type Settings, type Want } from "../data/repo";
import { emptyState, type ModelState } from "../lib/desire";
import { todayLocal } from "../lib/time";
import { setHapticsEnabled } from "../services/haptics";

type State = {
  ready: boolean;
  version: number;
  today: string;
  wants: Want[];
  checkins: Checkin[];
  model: ModelState;
  settings: Settings;
  refresh: () => Promise<void>;
};

// refresh() — через очередь: два перезапроса внахлёст не должны перетирать друг друга.
let queue: Promise<void> = Promise.resolve();

export const useApp = create<State>((set) => ({
  ready: false,
  version: 0,
  today: todayLocal(),
  wants: [],
  checkins: [],
  model: emptyState(),
  settings: DEFAULT_SETTINGS,
  refresh: () => {
    queue = queue
      .then(async () => {
        const d = await loadAll();
        setHapticsEnabled(d.settings.haptics);
        set((s) => ({ ...d, ready: true, today: todayLocal(), version: s.version + 1 }));
      })
      .catch(() => {});
    return queue;
  },
}));
