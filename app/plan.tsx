import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, CalendarClock, Check, Hourglass, PackageCheck, ShoppingBag, ThumbsDown } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { computeDerived, paramsOf, useDerived } from "../src/ui/derive";
import { IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { Card } from "../src/components/Card";
import { FundBar } from "../src/components/FundBar";
import { PressableScale } from "../src/components/PressableScale";
import { BurstOverlay } from "../src/components/BurstOverlay";
import { EmptyState } from "../src/components/EmptyState";
import { forecast } from "../src/lib/forecast";
import { addMonthsKey, daysBetween, monthKey, monthLabelLong } from "../src/lib/time";
import { extendHold, resolve } from "../src/ui/actions";
import { goBack } from "../src/ui/presets";
import { plural } from "../src/ui/format";
import type { Alternative } from "../src/lib/budget";

const ALT_ICON = { swap: ShoppingBag, "next-month": CalendarClock, hold: Hourglass, "let-go": ThumbsDown } as const;

export default function Plan() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const d = useDerived();
  const { wants, checkins, model, settings, today, version } = useApp();
  const [allow, setAllow] = useState(settings.allowance);
  const [maxWait, setMaxWait] = useState(settings.maxWait);
  const [burst, setBurst] = useState<string | null>(null);
  const cur = d.ledger[d.ledger.length - 1];
  const byId = new Map(d.ripe.map((v) => [v.w.id, v]));

  const alt = useMemo(() => computeDerived(wants, checkins, model, settings, today, allow), [version, allow]);
  const hist = wants.filter((w) => w.status !== "impulse").map((w) => ({ price: w.price, category: w.category, trigger: w.trigger, desire: w.desire }));
  const weeksObs = d.firstDay ? Math.max(1, daysBetween(d.firstDay, today) / 7) : 1;
  // Тяжёлый прогон — лениво, по версии стора и параметрам what-if.
  const fcNow = useMemo(() => forecast(hist, weeksObs, model, paramsOf(settings), 12), [version]);
  const fcIf = useMemo(() => forecast(hist, weeksObs, model, { ...paramsOf(settings), maxWait }, 12), [version, maxWait]);

  const apply = async (conflictId: string, a: Alternative) => {
    const v = byId.get(conflictId);
    if (!v) return;
    if (a.kind === "swap") {
      await resolve(v.w, "bought");
      setBurst(`Bought ${v.w.name}`);
    } else if (a.kind === "let-go") {
      await resolve(v.w, "skipped");
      setBurst(`Kept ${d.fmt(v.w.price)}`);
    } else if (a.kind === "hold") {
      await extendHold(v.w, 14);
      setBurst("Held 14 more days");
    } else {
      const next = `${addMonthsKey(monthKey(today), 1)}-01`;
      await extendHold(v.w, Math.max(1, daysBetween(today, next)) + (v.waited - v.w.wait_days));
      setBurst("Moved to next month");
    }
  };

  const blocks = [
    <Card key="fund" style={{ gap: 12 }}>
      <SectionTitle title={`Fun fund · ${monthLabelLong(monthKey(today))}`} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ fontSize: 34, fontWeight: "800", color: t.colors.ink }}>{d.fmt(d.available)}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>available now</Text>
      </View>
      <FundBar
        total={d.available + cur.spent}
        parts={[
          { label: `Spent ${d.fmt(cur.spent)}`, value: cur.spent, color: t.colors.urge },
          { label: `In plan ${d.fmt(d.plan.pick.cost)}`, value: d.plan.pick.cost, color: t.colors.accent },
          { label: `Free ${d.fmt(d.plan.leftover)}`, value: d.plan.leftover, color: t.colors.accentSoft },
        ]}
      />
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
        {d.fmt(settings.allowance)} a month. Unspent money rolls over up to {d.fmt(settings.allowance * settings.capMult)}
        {cur.capped > 0 ? ` — ${d.fmt(cur.capped)} over the cap didn't roll over this month` : ""}. Carried in: {d.fmt(cur.start)}.
      </Text>
    </Card>,
    <Card key="pick" style={{ gap: 10 }}>
      <SectionTitle title={`Best use of the fund · ${d.plan.pick.chosen.length}`} />
      {d.ripe.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No holds are over yet. When one is and you still want it, it competes for the fund here.</Text> : null}
      {d.plan.pick.chosen.map((id) => {
        const v = byId.get(id)!;
        return (
          <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PackageCheck size={18} color={t.colors.accent} />
            <PressableScale onPress={() => router.push(`/want/${id}`)} style={{ flex: 1 }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>{v.w.name}</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Value {v.value} · desire {v.w.desire}/5 · waited {plural(v.waited, "day")}</Text>
            </PressableScale>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>{d.fmt(v.w.price)}</Text>
          </View>
        );
      })}
      {d.ripe.length > 0 ? (
        <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Exact pick: the set of ready items with the most total value that fits {d.fmt(d.available)}.</Text>
      ) : null}
    </Card>,
    ...d.plan.conflicts.map((c) => (
      <Card key={c.id} style={{ gap: 10, borderWidth: 1, borderColor: t.colors.urge }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink, flex: 1 }}>{c.name}</Text>
          <Text style={{ ...t.typography.subtitle, color: t.colors.urge }}>{d.fmt(c.price)}</Text>
        </View>
        <Text style={{ ...t.typography.caption, color: t.colors.signal }}>{c.reason}</Text>
        {c.alternatives.map((a, i) => {
          const Icon = ALT_ICON[a.kind];
          return (
            <PressableScale key={a.kind} onPress={() => apply(c.id, a)} accessibilityLabel={a.title} style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: t.radius.md, backgroundColor: i === 0 ? t.colors.accentSoft : t.colors.surfaceAlt }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: t.colors.inkFaint, width: 14 }}>{i + 1}</Text>
              <Icon size={17} color={i === 0 ? t.colors.accent : t.colors.inkMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>{a.title}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{a.detail}</Text>
              </View>
              {i === 0 ? <Check size={16} color={t.colors.accent} /> : null}
            </PressableScale>
          );
        })}
      </Card>
    )),
    <Card key="whatif" style={{ gap: 12 }}>
      <SectionTitle title="What if the monthly fund was…" />
      <View style={{ alignItems: "center" }}>
        <Stepper value={allow} onChange={setAllow} step={10} min={0} max={5000} format={d.fmt} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Col title={`Now · ${d.fmt(settings.allowance)}`} rows={[["Available", d.fmt(d.available)], ["Fits", plural(d.plan.pick.chosen.length, "item")], ["Conflicts", String(d.plan.conflicts.length)], ["Left over", d.fmt(d.plan.leftover)]]} />
        <Col accent title={`If · ${d.fmt(allow)}`} rows={[["Available", d.fmt(alt.available)], ["Fits", plural(alt.plan.pick.chosen.length, "item")], ["Conflicts", String(alt.plan.conflicts.length)], ["Left over", d.fmt(alt.plan.leftover)]]} />
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
        {alt.plan.pick.chosen.length === d.plan.pick.chosen.length && alt.available === d.available
          ? "Same plan either way."
          : `The fund history is replayed from your first month with the new amount, so rollover and the cap are included.`}
      </Text>
    </Card>,
    <Card key="forecast" style={{ gap: 12 }}>
      <SectionTitle title="Next 12 weeks · simulation" />
      {fcNow && fcIf ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Longest hold</Text>
            <Stepper value={maxWait} onChange={setMaxWait} step={5} min={5} max={90} format={(x) => `${x} d`} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Col title={`Now · ${settings.maxWait} d`} rows={[["Kept (median)", d.fmt(fcNow.saved[1])], ["Range", `${d.fmt(fcNow.saved[0])}–${d.fmt(fcNow.saved[2])}`], ["Urges pass", `${Math.round(fcNow.fadeShare * 100)}%`], ["Avg hold", `${fcNow.avgWait.toFixed(1)} d`]]} />
            <Col accent title={`If · ${maxWait} d`} rows={[["Kept (median)", d.fmt(fcIf.saved[1])], ["Range", `${d.fmt(fcIf.saved[0])}–${d.fmt(fcIf.saved[2])}`], ["Urges pass", `${Math.round(fcIf.fadeShare * 100)}%`], ["Avg hold", `${fcIf.avgWait.toFixed(1)} d`]]} />
          </View>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            400 runs: about {fcNow.urges.toFixed(1)} new urges, each drawn from your own history and given the hold the model would pick. Same random draws for both columns.
          </Text>
        </>
      ) : (
        <EmptyState title="Nothing to simulate yet" description="Hold a few urges first — the forecast uses your own prices and pace." />
      )}
    </Card>,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={goBack}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink }}>Fund plan</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14, paddingBottom: insets.bottom + 40 }}>
        {blocks.map((b, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
            {b}
          </Animated.View>
        ))}
      </ScrollView>
      <BurstOverlay message={burst} onDone={() => setBurst(null)} />
    </View>
  );
}

function Col({ title, rows, accent }: { title: string; rows: string[][]; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: t.radius.md, padding: 12, gap: 8, backgroundColor: accent ? t.colors.accentSoft : t.colors.surfaceAlt }}>
      <Text numberOfLines={1} style={{ ...t.typography.overline, color: accent ? t.colors.accent : t.colors.inkMuted }}>{title}</Text>
      {rows.map(([k, v]) => (
        <View key={k}>
          <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>{k}</Text>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}
