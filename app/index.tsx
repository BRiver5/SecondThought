import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { BarChart3, Check, ChevronRight, Clock3, History, Plus, Settings as Cog, ShoppingBag, ThumbsDown, ThumbsUp, TriangleAlert, Wallet } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useDerived, type WaitingView } from "../src/ui/derive";
import { IconButton } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { CooldownTicket } from "../src/components/CooldownTicket";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { FundBar } from "../src/components/FundBar";
import { SwipeRow } from "../src/components/SwipeRow";
import { HoldSheet } from "../src/components/HoldSheet";
import { BurstOverlay } from "../src/components/BurstOverlay";
import { Sheet } from "../src/components/Sheet";
import { resolve, checkIn, extendHold } from "../src/ui/actions";
import { deleteWant } from "../src/data/repo";
import { CATEGORY_COLORS } from "../src/theme/colors";
import { pct, plural } from "../src/ui/format";

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const d = useDerived();
  const cur = useApp((s) => s.settings.currency);
  const [adding, setAdding] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);
  const [menu, setMenu] = useState<WaitingView | null>(null);
  const planned = new Set(d.plan.pick.chosen);
  const conflictIds = new Set(d.plan.conflicts.map((c) => c.id));
  const counterFmt = (v: number) => {
    "worklet";
    return cur.length > 1 ? `${Math.round(v)} ${cur}` : `${cur}${Math.round(v)}`;
  };

  const letGo = async (v: WaitingView) => {
    await resolve(v.w, "skipped");
    setBurst(`Kept ${d.fmt(v.w.price)} — the urge passed`);
  };
  const buy = async (v: WaitingView) => {
    await resolve(v.w, "bought");
    setBurst(`Bought after ${plural(v.waited, "day")} of thought`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {/* Верхняя панель вне ScrollView — липкие заголовки секций не уезжают под часы */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", backgroundColor: t.colors.background }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: t.colors.ink, letterSpacing: -0.5 }}>Second Thought</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {d.waiting.length ? `${plural(d.waiting.length, "urge")} on hold · ${d.ripe.length} ready` : "Hold the urge, buy what lasts"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IconButton label="History" onPress={() => router.push("/history")}>
            <History size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Stats" onPress={() => router.push("/stats")}>
            <BarChart3 size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Cog size={18} color={t.colors.ink} />
          </IconButton>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} stickyHeaderIndices={[2, 4]}>
        {/* 0 — hero */}
        <Animated.View entering={FadeInDown.duration(450)} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <View style={{ backgroundColor: t.colors.accent, borderRadius: 26, padding: 20, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View>
                <Text style={{ ...t.typography.overline, color: t.colors.accentSoft }}>Kept by waiting</Text>
                <AnimatedCounter value={d.saved} formatter={counterFmt} style={{ fontSize: 44, fontWeight: "800", color: t.colors.onAccent, padding: 0, margin: 0 }} />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: t.colors.onAccent }}>{d.streak.current}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.accentSoft }}>{d.streak.current === 1 ? "day" : "days"} impulse-free</Text>
              </View>
            </View>
            <PressableScale onPress={() => router.push("/plan")} accessibilityLabel="Open fun fund plan" style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Wallet size={16} color={t.colors.onAccent} />
                <Text style={{ ...t.typography.label, color: t.colors.onAccent, flex: 1 }}>Fun fund · {d.fmt(d.available)} left this month</Text>
                <ChevronRight size={16} color={t.colors.onAccent} />
              </View>
              <HeroFund d={d} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* 1 — rail */}
        <View style={{ paddingTop: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1 }}>On hold · {d.waiting.length}</Text>
            <PressableScale onPress={() => setAdding(true)} accessibilityLabel="Hold an urge" style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.colors.urge, borderRadius: t.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Plus size={16} color={t.colors.onAccent} />
              <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Hold</Text>
            </PressableScale>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 2 }}>
            {d.waiting.map((v, i) => (
              <Animated.View key={v.w.id} entering={FadeInRight.delay(staggerDelay(i)).duration(400)}>
                <CooldownTicket name={v.w.name} price={d.fmt(v.w.price)} category={v.w.category} waited={v.waited} total={v.w.wait_days} still={v.stillNow} onPress={() => router.push(`/want/${v.w.id}`)} />
              </Animated.View>
            ))}
            {d.waiting.length === 0 ? (
              <PressableScale onPress={() => setAdding(true)} accessibilityLabel="Hold your first urge" style={{ width: 260, borderRadius: t.radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.colors.inkFaint, padding: 16, gap: 6 }}>
                <Clock3 size={22} color={t.colors.urge} />
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>Feel like buying something?</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Put it on hold first. The app learns how fast your urges fade and picks the wait for you.</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        </View>

        {/* 2 — sticky header */}
        <StickyTitle title={`Ready to decide · ${d.ripe.length}`} hint="Swipe right to let go, left to buy" />
        {/* 3 */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {d.ripe.length === 0 ? (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, paddingVertical: 6 }}>Nothing is ready yet. Holds that run out show up here.</Text>
          ) : null}
          {d.ripe.map((v, i) => (
            <Animated.View key={v.w.id} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
              <SwipeRow right={{ label: "Let go", icon: <ThumbsDown size={18} color={t.colors.onAccent} />, onTrigger: () => letGo(v) }} left={{ label: "Buy", icon: <ShoppingBag size={18} color={t.colors.onAccent} />, onTrigger: () => buy(v) }}>
                <PressableScale onPress={() => router.push(`/want/${v.w.id}`)} onLongPress={() => setMenu(v)} delayLongPress={350} style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: CATEGORY_COLORS[v.w.category] }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>{v.w.name}</Text>
                    <Text style={{ ...t.typography.caption, color: planned.has(v.w.id) ? t.colors.accent : conflictIds.has(v.w.id) ? t.colors.signal : t.colors.inkMuted }}>
                      {planned.has(v.w.id) ? "Fits this month's fund · " : conflictIds.has(v.w.id) ? "Doesn't fit the plan · " : ""}waited {plural(v.waited, "day")}
                    </Text>
                  </View>
                  <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{d.fmt(v.w.price)}</Text>
                </PressableScale>
              </SwipeRow>
            </Animated.View>
          ))}
          {d.plan.conflicts.length ? (
            <PressableScale onPress={() => router.push("/plan")} style={{ flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: t.colors.urgeSoft, borderRadius: t.radius.md, padding: 12 }}>
              <TriangleAlert size={18} color={t.colors.signal} />
              <Text style={{ ...t.typography.caption, color: t.colors.ink, flex: 1 }}>
                {plural(d.plan.conflicts.length, "item")} won't fit the fun fund. See ranked options.
              </Text>
              <ChevronRight size={16} color={t.colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>

        {/* 4 — sticky header */}
        <StickyTitle title={`Still cooling · ${d.cooling.length}`} hint="Quick check-in teaches the model" />
        {/* 5 */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {d.cooling.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, paddingVertical: 6 }}>No urges cooling right now.</Text> : null}
          {d.cooling.map((v, i) => {
            const checkedToday = v.lastCheck?.day === useApp.getState().today;
            return (
              <Animated.View key={v.w.id} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
                <PressableScale onPress={() => router.push(`/want/${v.w.id}`)} onLongPress={() => setMenu(v)} delayLongPress={350} style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CATEGORY_COLORS[v.w.category] }} />
                    <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink, flex: 1 }} numberOfLines={1}>{v.w.name}</Text>
                    <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{plural(v.left, "day")} left · {pct(v.stillNow)} still</Text>
                  </View>
                  {checkedToday ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Check size={14} color={t.colors.accent} />
                      <Text style={{ ...t.typography.caption, color: t.colors.accent }}>Checked in today: {v.lastCheck?.still ? "still want it" : "fading"}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <MiniBtn label="Still want it" icon={<ThumbsUp size={14} color={t.colors.urge} />} onPress={() => checkIn(v.w, true)} />
                      <MiniBtn label="Fading" icon={<ThumbsDown size={14} color={t.colors.accent} />} onPress={() => checkIn(v.w, false)} />
                    </View>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <HoldSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={(kind, days) => {
          setAdding(false);
          setBurst(kind === "hold" ? `On hold for ${plural(days, "day")}` : "Logged. The streak starts again.");
        }}
      />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.w.name ?? ""} subtitle={menu ? `${d.fmt(menu.w.price)} · held ${plural(menu.waited, "day")}` : undefined}>
        {menu ? (
          <View style={{ gap: 8 }}>
            <MenuRow label="Open details" onPress={() => { const id = menu.w.id; setMenu(null); router.push(`/want/${id}`); }} />
            <MenuRow label="Hold 7 more days" onPress={async () => { await extendHold(menu.w, 7); setMenu(null); }} />
            <MenuRow label="Let it go now" onPress={async () => { const v = menu; setMenu(null); await letGo(v); }} />
            <MenuRow label="Delete" danger onPress={async () => { await deleteWant(menu.w.id); setMenu(null); await useApp.getState().refresh(); }} />
          </View>
        ) : null}
      </Sheet>
      <BurstOverlay message={burst} onDone={() => setBurst(null)} />
    </View>
  );
}

function HeroFund({ d }: { d: ReturnType<typeof useDerived> }) {
  const t = useTheme();
  const cur = d.ledger[d.ledger.length - 1];
  const total = d.available + cur.spent;
  return (
    <FundBar
      total={total}
      legendColor={t.colors.accentSoft}
      parts={[
        { label: `Spent ${d.fmt(cur.spent)}`, value: cur.spent, color: t.colors.urge },
        { label: `Planned ${d.fmt(d.plan.pick.cost)}`, value: d.plan.pick.cost, color: t.colors.accentSoft },
        { label: `Free ${d.fmt(d.plan.leftover)}`, value: d.plan.leftover, color: "rgba(255,255,255,0.35)" },
      ]}
    />
  );
}

function StickyTitle({ title, hint }: { title: string; hint: string }) {
  const t = useTheme();
  // Липкий внешний View, строка внутри — row в липком заголовке на Android ломался.
  return (
    <View style={{ backgroundColor: t.colors.background, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
        <Text style={{ fontSize: 11, color: t.colors.inkFaint }}>{hint}</Text>
      </View>
    </View>
  );
}

function MiniBtn({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surfaceAlt, paddingVertical: 8 }}>
      {icon}
      <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>{label}</Text>
    </PressableScale>
  );
}

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ paddingVertical: 14, paddingHorizontal: 14, borderRadius: t.radius.md, backgroundColor: t.colors.surfaceAlt }}>
      <Text style={{ ...t.typography.body, color: danger ? t.colors.danger : t.colors.ink }}>{label}</Text>
    </PressableScale>
  );
}
