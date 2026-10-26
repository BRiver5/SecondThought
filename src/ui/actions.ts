import { useApp } from "../store/appStore";
import { addCheckin, resolveWant, updateWant, type Want } from "../data/repo";
import { cancelOne } from "../services/notifications";
import { haptics } from "../services/haptics";

// Общие действия над хотелкой — одинаково с Home, детали и плана.
export async function resolve(w: Want, kind: "bought" | "skipped") {
  const { checkins, model, today, refresh } = useApp.getState();
  await resolveWant(w, checkins, model, kind, today);
  await cancelOne(`hold-${w.id}`);
  kind === "skipped" ? haptics.success() : haptics.press();
  await refresh();
}

export async function checkIn(w: Want, still: boolean) {
  const { today, refresh } = useApp.getState();
  await addCheckin(w.id, today, still);
  haptics.tick();
  await refresh();
}

export async function extendHold(w: Want, days: number) {
  await updateWant(w.id, { wait_days: w.wait_days + days });
  haptics.tap();
  await useApp.getState().refresh();
}
