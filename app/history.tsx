import { useMemo, useState } from "react";
import { SectionList, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, Search } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { IconButton, Chip } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { EmptyState } from "../src/components/EmptyState";
import { Sheet } from "../src/components/Sheet";
import { inputStyle } from "../src/components/Sheet";
import { deleteWant, reopenWant, type Want } from "../src/data/repo";
import { CATEGORY_COLORS } from "../src/theme/colors";
import { dayLabel, daysBetween, monthKey, monthLabelLong } from "../src/lib/time";
import { money, plural } from "../src/ui/format";
import { goBack } from "../src/ui/presets";

type Filter = "all" | "skipped" | "bought" | "impulse";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "skipped", label: "Let go" },
  { key: "bought", label: "Bought" },
  { key: "impulse", label: "Impulse" },
];

export default function HistoryScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wants, settings, refresh } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [menu, setMenu] = useState<Want | null>(null);
  const fmt = (x: number) => money(x, settings.currency);

  const resolved = wants.filter((w) => w.status !== "waiting" && w.resolved_day);
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = resolved
      .filter((w) => filter === "all" || w.status === filter)
      .filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.category.toLowerCase().includes(needle) || w.trigger.toLowerCase().includes(needle))
      .sort((a, b) => (a.resolved_day! < b.resolved_day! ? 1 : -1));
    const groups = new Map<string, Want[]>();
    for (const w of rows) {
      const k = monthKey(w.resolved_day!);
      groups.set(k, [...(groups.get(k) ?? []), w]);
    }
    return [...groups.entries()].map(([k, data]) => ({ key: k, data, kept: data.filter((w) => w.status === "skipped").reduce((s, w) => s + w.price, 0) }));
  }, [wants, q, filter]);

  const tone = (w: Want) => (w.status === "skipped" ? t.colors.accent : w.status === "bought" ? t.colors.planned : t.colors.danger);
  const label = (w: Want) => (w.status === "skipped" ? "Let go" : w.status === "bought" ? "Bought" : "Impulse");

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, gap: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconButton label="Back" onPress={goBack}>
            <ArrowLeft size={18} color={t.colors.ink} />
          </IconButton>
          <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink }}>Decisions</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, ...inputStyle(t), paddingVertical: 4 }}>
          <Search size={16} color={t.colors.inkFaint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search name, category, trigger" placeholderTextColor={t.colors.inkFaint} style={{ flex: 1, color: t.colors.ink, paddingVertical: 8, fontSize: 15 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(w) => w.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={<EmptyState title={resolved.length ? "No matches" : "No decisions yet"} description={resolved.length ? "Try another word or filter." : "Holds you let go or buy land here, grouped by month."} />}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: t.colors.background, paddingTop: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{monthLabelLong(section.key)}</Text>
              <Text style={{ ...t.typography.overline, color: t.colors.accent }}>Kept {fmt(section.kept)}</Text>
            </View>
          </View>
        )}
        renderItem={({ item: w, index }) => (
          <Animated.View entering={FadeInDown.delay(staggerDelay(index)).duration(350)} style={{ marginBottom: 8 }}>
            <PressableScale onPress={() => router.push(`/want/${w.id}`)} onLongPress={() => setMenu(w)} delayLongPress={350} style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_COLORS[w.category] }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }} numberOfLines={1}>{w.name}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                  {dayLabel(w.resolved_day!)} · {w.status === "impulse" ? "no hold" : `after ${plural(daysBetween(w.created_day, w.resolved_day!), "day")}`} · {w.trigger}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink, textDecorationLine: w.status === "skipped" ? "line-through" : "none" }}>{fmt(w.price)}</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: tone(w) }}>{label(w)}</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ""} subtitle={menu ? `${label(menu)} · ${fmt(menu.price)}` : undefined}>
        {menu ? (
          <View style={{ gap: 8 }}>
            {menu.status !== "impulse" ? (
              <PressableScale onPress={async () => { await reopenWant(menu.id); setMenu(null); await refresh(); }} style={{ padding: 14, borderRadius: t.radius.md, backgroundColor: t.colors.surfaceAlt }}>
                <Text style={{ ...t.typography.body, color: t.colors.ink }}>Undo — put it back on hold</Text>
              </PressableScale>
            ) : null}
            <PressableScale onPress={async () => { await deleteWant(menu.id); setMenu(null); await refresh(); }} style={{ padding: 14, borderRadius: t.radius.md, backgroundColor: t.colors.surfaceAlt }}>
              <Text style={{ ...t.typography.body, color: t.colors.danger }}>Delete</Text>
            </PressableScale>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
