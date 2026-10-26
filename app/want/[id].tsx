import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, Pencil, RotateCcw, ShoppingBag, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { staggerDelay } from "../../src/theme/motion";
import { useApp } from "../../src/store/appStore";
import { paramsOf, viewOf } from "../../src/ui/derive";
import { IconButton, SectionTitle, Stepper } from "../../src/components/Bits";
import { Card } from "../../src/components/Card";
import { FadeCurve } from "../../src/components/FadeCurve";
import { PressableScale } from "../../src/components/PressableScale";
import { BurstOverlay } from "../../src/components/BurstOverlay";
import { inputStyle } from "../../src/components/Sheet";
import { categoryPosterior, evidenceCount, globalPosterior, survival, triggerMultiplier, medianFade } from "../../src/lib/desire";
import { decideWait } from "../../src/lib/cooling";
import { checkIn, resolve } from "../../src/ui/actions";
import { deleteWant, reopenWant, updateWant } from "../../src/data/repo";
import { goBack } from "../../src/ui/presets";
import { CATEGORY_COLORS } from "../../src/theme/colors";
import { dayLabel, daysBetween } from "../../src/lib/time";
import { money, num, pct, plural } from "../../src/ui/format";

const STATUS_LABEL = { waiting: "On hold", bought: "Bought after waiting", skipped: "Let go", impulse: "Impulse buy" } as const;

export default function WantDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wants, checkins, model, settings, today, refresh } = useApp();
  // Снимок при входе: развязка убирает хотелку из "waiting", экран не должен стать пустым.
  const live = wants.find((w) => w.id === id);
  const [snap] = useState(() => live);
  const w = live ?? snap;
  const [burst, setBurst] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [priceDraft, setPriceDraft] = useState(String(w?.price ?? ""));
  const [whatItch, setWhatItch] = useState(settings.itchPerDay);
  const [whatPrice, setWhatPrice] = useState(w?.price ?? 0);
  const params = paramsOf(settings);

  const v = useMemo(() => (w ? viewOf(w, checkins, model, params, today) : null), [w, checkins, model, settings, today]);
  if (!w || !v) return null;

  const cur = settings.currency;
  const fmt = (x: number) => money(x, cur);
  const horizon = Math.max(14, Math.min(60, Math.ceil(Math.max(w.wait_days, v.waited) * 1.6)));
  const curve = Array.from({ length: horizon + 1 }, (_, i) => survival(v.g, i));
  const g0 = globalPosterior(model);
  const c0 = categoryPosterior(model, w.category);
  const mult = triggerMultiplier(model, w.trigger);
  const whatIf = decideWait(v.g, whatPrice, w.desire, { ...params, itchPerDay: whatItch });
  const mine = checkins.filter((c) => c.want_id === w.id);
  const waiting = w.status === "waiting";

  const sections = [
    // Кривая
    <Card key="curve" style={{ gap: 12 }}>
      <SectionTitle title="Will the urge last?" />
      <FadeCurve values={curve} today={Math.min(v.waited, horizon)} waitDay={Math.min(w.wait_days, horizon)} />
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
        Half of {w.category.toLowerCase()} urges sparked by "{w.trigger}" fade within {num(medianFade(v.g))} days. Today: {pct(v.stillNow)} chance you still want it.
      </Text>
    </Card>,
    // Почему такой срок
    <Card key="why" style={{ gap: 12 }}>
      <SectionTitle title={`Why ${plural(w.wait_days, "day")}`} />
      <WhyRow label="Your overall fade pace" value={`${num(1 / (g0.a / g0.b))} days avg`} note={`${Math.round(model.global.n)} urges learned so far`} />
      <WhyRow label={`${w.category} pace`} value={`${num(c0.b / c0.a)} days avg`} note={evidenceCount(model, w.category) < 1 ? "No own history yet — borrows your overall pace" : `Blended with overall pace, ${num(evidenceCount(model, w.category))} own fades`} />
      <WhyRow label={`Trigger "${w.trigger}"`} value={`×${mult.toFixed(2)} speed`} note={mult > 1.05 ? "These urges fade faster than average" : mult < 0.95 ? "These urges stick around longer" : "About average"} />
      <WhyRow label="Itch cost" value={`${fmt(v.decision.itch)}/day`} note={`Your ${fmt(settings.itchPerDay)} base × desire ${w.desire}/5`} />
      <View style={{ height: 1, backgroundColor: t.colors.border }} />
      <Text style={{ ...t.typography.caption, color: t.colors.ink }}>
        Waiting pays while the chance the urge fades tomorrow is worth more than a day of itch. For {fmt(w.price)} that balance tips at day {num(Math.max(0, v.decision.unclamped))}
        {v.decision.clamp === "max" ? `, capped at your ${settings.maxWait}-day maximum` : v.decision.clamp === "min" ? ", so a one-day minimum applies" : ""}.
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pill label="Chance it passes" value={pct(v.decision.pFade)} color={t.colors.accent} />
        <Pill label="Expected kept" value={fmt(v.decision.expectedSaved)} color={t.colors.accent} />
        <Pill label="Itch cost" value={fmt(v.decision.itchCost)} color={t.colors.urge} />
      </View>
    </Card>,
    // What-if
    <Card key="whatif" style={{ gap: 14 }}>
      <SectionTitle title="What if" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Price</Text>
        <Stepper value={whatPrice} onChange={setWhatPrice} step={10} min={5} max={5000} format={fmt} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Base itch</Text>
        <Stepper value={whatItch} onChange={setWhatItch} step={1} min={1} max={50} format={fmt} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Compare title="Now" rows={[["Hold", plural(v.decision.days, "day")], ["Passes", pct(v.decision.pFade)], ["Kept", fmt(v.decision.expectedSaved)]]} />
        <Compare title="What if" accent rows={[["Hold", plural(whatIf.days, "day"), delta(whatIf.days - v.decision.days, "d")], ["Passes", pct(whatIf.pFade), delta(Math.round((whatIf.pFade - v.decision.pFade) * 100), "pt")], ["Kept", fmt(whatIf.expectedSaved), deltaMoney(whatIf.expectedSaved - v.decision.expectedSaved, fmt)]]} />
      </View>
      {waiting && whatIf.days !== w.wait_days && whatPrice === w.price ? (
        <PressableScale onPress={async () => { await updateWant(w.id, { wait_days: whatIf.days }); await refresh(); }} style={{ alignSelf: "flex-start", backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ ...t.typography.label, color: t.colors.accent }}>Use {plural(whatIf.days, "day")} for this hold</Text>
        </PressableScale>
      ) : null}
    </Card>,
    // Чек-ины
    <Card key="log" style={{ gap: 10 }}>
      <SectionTitle title={`Check-ins · ${mine.length}`} />
      {mine.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No check-ins yet. They narrow down when an urge actually faded.</Text> : null}
      {mine.map((c) => (
        <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.still ? t.colors.urge : t.colors.accent }} />
          <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{c.still ? "Still wanted it" : "Felt it fading"}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{dayLabel(c.day)} · day {daysBetween(w.created_day, c.day)}</Text>
        </View>
      ))}
    </Card>,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={goBack}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }} />
        <IconButton label="Delete" onPress={async () => { await deleteWant(w.id); await refresh(); goBack(); }}>
          <Trash2 size={17} color={t.colors.danger} />
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 6, gap: 14, paddingBottom: insets.bottom + 40 }}>
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CATEGORY_COLORS[w.category] }} />
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{w.category} · {STATUS_LABEL[w.status]}</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink }}>{w.name}</Text>
          {editing ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput autoFocus value={priceDraft} onChangeText={setPriceDraft} keyboardType="decimal-pad" style={[inputStyle(t), { flex: 1 }]} />
              <PressableScale
                onPress={async () => {
                  const p = Number(priceDraft.replace(",", "."));
                  if (p > 0) {
                    await updateWant(w.id, { price: p });
                    setWhatPrice(p);
                    await refresh();
                  }
                  setEditing(false);
                }}
                style={{ backgroundColor: t.colors.accent, borderRadius: t.radius.pill, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Save</Text>
              </PressableScale>
            </View>
          ) : (
            <PressableScale onPress={() => setEditing(true)} accessibilityLabel="Edit price" style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: t.colors.urge }}>{fmt(w.price)}</Text>
              <Pencil size={14} color={t.colors.inkFaint} />
            </PressableScale>
          )}
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            Held {dayLabel(w.created_day)} · "{w.trigger}" · desire {w.desire}/5 · {waiting ? (v.ripe ? "hold is over" : `${plural(v.left, "day")} left of ${w.wait_days}`) : `decided ${w.resolved_day ? dayLabel(w.resolved_day) : ""}`}
          </Text>
        </Animated.View>

        {waiting ? (
          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ flexDirection: "row", gap: 10 }}>
            {v.ripe ? (
              <>
                <BigBtn label="Let it go" icon={<ThumbsDown size={18} color={t.colors.onAccent} />} color={t.colors.accent} onPress={async () => { await resolve(w, "skipped"); setBurst(`Kept ${fmt(w.price)}`); }} />
                <BigBtn label="Buy it" icon={<ShoppingBag size={18} color={t.colors.onAccent} />} color={t.colors.planned} onPress={async () => { await resolve(w, "bought"); setBurst("Bought with a clear head"); }} />
              </>
            ) : (
              <>
                <BigBtn label="Still want it" icon={<ThumbsUp size={18} color={t.colors.onAccent} />} color={t.colors.urge} onPress={() => checkIn(w, true)} />
                <BigBtn label="Let go early" icon={<ThumbsDown size={18} color={t.colors.onAccent} />} color={t.colors.accent} onPress={async () => { await resolve(w, "skipped"); setBurst(`Kept ${fmt(w.price)}`); }} />
              </>
            )}
          </Animated.View>
        ) : w.status !== "impulse" ? (
          <PressableScale onPress={async () => { await reopenWant(w.id); await refresh(); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
            <RotateCcw size={15} color={t.colors.ink} />
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Undo decision</Text>
          </PressableScale>
        ) : null}

        {sections.map((s, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(120 + staggerDelay(i)).duration(400)}>
            {s}
          </Animated.View>
        ))}
      </ScrollView>
      <BurstOverlay message={burst} onDone={() => setBurst(null)} />
    </View>
  );
}

function delta(x: number, unit: string) {
  if (x === 0) return "±0";
  return `${x > 0 ? "+" : "−"}${Math.abs(x)}${unit}`;
}

function WhyRow({ label, value, note }: { label: string; value: string; note: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{label}</Text>
        <Text style={{ ...t.typography.label, color: t.colors.accent }}>{value}</Text>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
    </View>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, padding: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: t.colors.inkMuted }}>{label}</Text>
    </View>
  );
}

function Compare({ title, rows, accent }: { title: string; rows: (string | undefined)[][]; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: t.radius.md, padding: 12, gap: 8, backgroundColor: accent ? t.colors.accentSoft : t.colors.surfaceAlt }}>
      <Text style={{ ...t.typography.overline, color: accent ? t.colors.accent : t.colors.inkMuted }}>{title}</Text>
      {rows.map(([k, val, dl]) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{k}</Text>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>
            {val}
            {dl ? <Text style={{ fontSize: 11, color: t.colors.inkMuted }}> {dl}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BigBtn({ label, icon, color, onPress }: { label: string; icon: React.ReactNode; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: color, borderRadius: t.radius.pill, paddingVertical: 14 }}>
      {icon}
      <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: t.colors.onAccent }}>{label}</Text>
    </PressableScale>
  );
}

function deltaMoney(x: number, fmt: (v: number) => string) {
  if (Math.abs(x) < 0.5) return "±0";
  return `${x > 0 ? "+" : "−"}${fmt(Math.abs(Math.round(x)))}`;
}
