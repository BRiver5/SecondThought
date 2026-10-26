import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, Award, Flame, Hourglass, Leaf } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDerived } from "../src/ui/derive";
import { IconButton, Legend, SectionTitle } from "../src/components/Bits";
import { Card } from "../src/components/Card";
import { CategoryRing } from "../src/components/CategoryRing";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { EmptyState } from "../src/components/EmptyState";
import { CATEGORY_COLORS } from "../src/theme/colors";
import { CATEGORIES, TRIGGERS, goBack } from "../src/ui/presets";
import { dayStatuses, calibration, streaks } from "../src/lib/track";
import { itemPosterior, medianFade } from "../src/lib/desire";
import { addMonthsKey, daysBetween, monthKey, monthLabel } from "../src/lib/time";
import { num, pct, plural } from "../src/ui/format";

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wants, model, today } = useApp();
  const d = useDerived();
  const [sel, setSel] = useState<string | null>(null);

  const scoped = sel ? wants.filter((w) => w.category === sel) : wants;
  const resolved = scoped.filter((w) => w.status !== "waiting" && w.resolved_day);
  const skipped = resolved.filter((w) => w.status === "skipped");
  const held = resolved.filter((w) => w.status !== "impulse");
  const kept = skipped.reduce((s, w) => s + w.price, 0);
  const passShare = held.length ? skipped.length / held.length : 0;
  const firstDay = scoped.length ? scoped.reduce((m, w) => (w.created_day < m ? w.created_day : m), scoped[0].created_day) : null;
  const impulseDays = scoped.filter((w) => w.status === "impulse").map((w) => w.created_day);
  const st = sel ? streaks(firstDay, today, impulseDays) : d.streak;

  const ring = CATEGORIES.map((c) => ({ key: c, color: CATEGORY_COLORS[c], value: wants.filter((w) => w.category === c && w.status === "skipped").reduce((s, w) => s + w.price, 0) }));
  const months = Array.from({ length: 6 }, (_, i) => addMonthsKey(monthKey(today), i - 5));
  const bars = months.map((m) => ({ label: monthLabel(m), value: skipped.filter((w) => monthKey(w.resolved_day!) === m).reduce((s, w) => s + w.price, 0) }));
  const days = dayStatuses(today, 84, impulseDays, resolved.filter((w) => w.status === "bought").map((w) => w.resolved_day!), firstDay);
  const calRows = held.filter((w) => w.p_fade !== null).map((w) => ({ p: w.p_fade!, faded: w.status === "skipped" }));
  const cal = calibration(calRows);
  const pace = useMemo(
    () => TRIGGERS.map((tr) => ({ tr, med: medianFade(itemPosterior(model, sel ?? "Other", tr)), n: scoped.filter((w) => w.trigger === tr).length })).sort((a, b) => a.med - b.med),
    [model, sel, wants]
  );
  const maxPace = Math.max(1, ...pace.map((p) => p.med));
  const biggest = [...skipped].sort((a, b) => b.price - a.price)[0];
  const fastest = [...skipped].sort((a, b) => daysBetween(a.created_day, a.resolved_day!) - daysBetween(b.created_day, b.resolved_day!))[0];
  const longest = [...held.filter((w) => w.status === "bought")].sort((a, b) => daysBetween(b.created_day, b.resolved_day!) - daysBetween(a.created_day, a.resolved_day!))[0];

  const heatColor = (x: number) => (x < 0 ? t.colors.backgroundAlt : x === 0 ? t.colors.accentSoft : x === 0.5 ? t.colors.planned : t.colors.danger);

  if (wants.length === 0) {
    return (
      <Screen title="Stats" insetsTop={insets.top}>
        <EmptyState title="No numbers yet" description="Hold a couple of urges and decide on them — this page fills in with what you kept and how fast urges fade." />
      </Screen>
    );
  }

  const blocks = [
    <View key="cards" style={{ flexDirection: "row", gap: 10 }}>
      <Card style={{ flex: 1, gap: 4, padding: 14 }}>
        <Leaf size={18} color={t.colors.accent} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.colors.ink }}>{d.fmt(kept)}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>kept {sel ? `on ${sel.toLowerCase()}` : "in total"}</Text>
      </Card>
      <Card style={{ flex: 1, gap: 4, padding: 14 }}>
        <Flame size={18} color={t.colors.urge} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.colors.ink }}>{st.current}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>impulse-free · best {st.best}</Text>
      </Card>
      <Card style={{ flex: 1, padding: 14, alignItems: "center" }}>
        <AnimatedRing progress={passShare} size={64} strokeWidth={8} color={t.colors.accent} trackColor={t.colors.accentSoft}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: t.colors.ink }}>{pct(passShare)}</Text>
        </AnimatedRing>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 4 }}>urges passed</Text>
      </Card>
    </View>,
    <Card key="ring" style={{ gap: 12 }}>
      <SectionTitle title="Kept by category" right={sel ? <Text onPress={() => setSel(null)} style={{ ...t.typography.label, color: t.colors.accent }}>Show all</Text> : null} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <CategoryRing
          segments={ring}
          selected={sel}
          onSelect={setSel}
          size={150}
          center={
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: t.colors.ink }}>{sel ?? "All"}</Text>
              <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>tap a slice</Text>
            </View>
          }
        />
        <View style={{ flex: 1 }}>
          <Legend rows={ring.filter((r) => r.value > 0).map((r) => ({ color: r.color, label: r.key, value: d.fmt(r.value), dim: !!sel && sel !== r.key }))} />
          {ring.every((r) => r.value === 0) ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Let an urge go to see it here.</Text> : null}
        </View>
      </View>
    </Card>,
    <Card key="bars" style={{ gap: 12 }}>
      <SectionTitle title="Kept per month" />
      <BarChart data={bars} color={sel ? CATEGORY_COLORS[sel] : t.colors.accent} height={130} />
    </Card>,
    <Card key="heat" style={{ gap: 12 }}>
      <SectionTitle title="Last 12 weeks" />
      <Heatmap cells={days.map((x) => ({ key: x.day, intensity: x.status === "none" ? -1 : x.status === "clean" ? 0 : x.status === "planned" ? 0.5 : 1 }))} colorForIntensity={heatColor} cellSize={20} gap={4} />
      <View style={{ flexDirection: "row", gap: 14 }}>
        {[["Clean", t.colors.accentSoft], ["Bought after waiting", t.colors.planned], ["Impulse", t.colors.danger]].map(([l, c]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
            <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>{l}</Text>
          </View>
        ))}
      </View>
    </Card>,
    <Card key="pace" style={{ gap: 10 }}>
      <SectionTitle title={`How fast urges fade${sel ? ` · ${sel}` : ""}`} />
      {pace.map((p, i) => (
        <View key={p.tr} style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.caption, color: t.colors.ink }}>{p.tr}</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>half gone in {num(p.med)} d{p.n ? ` · ${p.n} logged` : ""}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt }}>
            <Animated.View entering={FadeInDown.delay(staggerDelay(i, 50))} style={{ width: `${(p.med / maxPace) * 100}%`, height: 8, borderRadius: 4, backgroundColor: i === 0 ? t.colors.accent : t.colors.urge }} />
          </View>
        </View>
      ))}
      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Shorter bar: these urges pass on their own sooner, so shorter holds do the job.</Text>
    </Card>,
    <Card key="cal" style={{ gap: 10 }}>
      <SectionTitle title="How honest are the predictions" />
      {cal.brier === null || calRows.length < 5 ? (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Scored once 5 holds are decided — {calRows.length} so far. Fewer would say more about luck than about the model.</Text>
      ) : (
        <>
          <Text style={{ ...t.typography.body, color: t.colors.ink }}>
            Brier score {cal.brier.toFixed(3)} vs {cal.baseline!.toFixed(3)} for always guessing the average — {cal.brier < cal.baseline! ? "the model beats a flat guess." : "not better than a flat guess yet."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", height: 90 }}>
            {cal.bins.map((b) => (
              <View key={b.lo} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end", height: 64 }}>
                  <View style={{ width: 12, height: Math.max(2, b.predicted * 64), borderRadius: 3, backgroundColor: t.colors.inkFaint }} />
                  <View style={{ width: 12, height: Math.max(2, b.actual * 64), borderRadius: 3, backgroundColor: b.n ? t.colors.accent : t.colors.border }} />
                </View>
                <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{Math.round(b.lo * 100)}–{Math.round((b.lo + 0.25) * 100)}% · {b.n}</Text>
              </View>
            ))}
          </View>
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Grey: predicted chance the urge passes. Green: how often it really did.</Text>
        </>
      )}
    </Card>,
    <Card key="best" style={{ gap: 12 }}>
      <SectionTitle title="Highlights" />
      {biggest ? <Highlight icon={<Award size={18} color={t.colors.accent} />} title={`Biggest let-go: ${biggest.name}`} note={`${d.fmt(biggest.price)} stayed in your pocket`} /> : null}
      {fastest ? <Highlight icon={<Leaf size={18} color={t.colors.accent} />} title={`Quickest to fade: ${fastest.name}`} note={`Gone after ${plural(daysBetween(fastest.created_day, fastest.resolved_day!), "day")}`} /> : null}
      {longest ? <Highlight icon={<Hourglass size={18} color={t.colors.planned} />} title={`Most patient buy: ${longest.name}`} note={`Still wanted after ${plural(daysBetween(longest.created_day, longest.resolved_day!), "day")}`} /> : null}
      {!biggest && !longest ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Decide on a hold to unlock highlights.</Text> : null}
    </Card>,
  ];

  return (
    <Screen title="Stats" insetsTop={insets.top} bottom={insets.bottom}>
      {blocks.map((b, i) => (
        <Animated.View key={i} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
          {b}
        </Animated.View>
      ))}
    </Screen>
  );
}

function Screen({ title, insetsTop, bottom = 0, children }: { title: string; insetsTop: number; bottom?: number; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insetsTop + 10, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={goBack}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink }}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14, paddingBottom: bottom + 40 }}>{children}</ScrollView>
    </View>
  );
}

function Highlight({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{title}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
      </View>
    </View>
  );
}
