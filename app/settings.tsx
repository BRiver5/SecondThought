import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { Chip, IconButton, Stepper } from "../src/components/Bits";
import { Segmented } from "../src/components/Segmented";
import { Toggle } from "../src/components/Toggle";
import { PressableScale } from "../src/components/PressableScale";
import { setSetting, wipeAll, type Settings } from "../src/data/repo";
import { notificationsAvailable, requestNotificationPermission, cancelAll } from "../src/services/notifications";
import { money } from "../src/ui/format";
import { goBack } from "../src/ui/presets";

const CURRENCIES = ["$", "€", "£", "kr"];

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, refresh } = useApp();
  const [confirm, setConfirm] = useState(false);
  const fmt = (x: number) => money(x, settings.currency);
  const put = async (k: keyof Settings, v: string | number | boolean) => {
    await setSetting(k, v);
    await refresh();
  };

  const groups: { title: string; rows: React.ReactNode[] }[] = [
    {
      title: "Fun fund",
      rows: [
        <Row key="a" title="Monthly amount" note="What you allow yourself for wants">
          <Stepper value={settings.allowance} onChange={(v) => put("allowance", v)} step={10} min={0} max={5000} format={fmt} />
        </Row>,
        <Row key="c" title="Rollover cap" note="Unspent money carries over, up to this many monthly amounts">
          <View style={{ width: 150 }}>
            <Segmented items={[{ key: "1", label: "1×" }, { key: "2", label: "2×" }, { key: "3", label: "3×" }]} value={String(settings.capMult) as "1" | "2" | "3"} onChange={(k) => put("capMult", Number(k))} />
          </View>
        </Row>,
        <Row key="cur" title="Currency" note="">
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}>
            {CURRENCIES.map((c) => (
              <Chip key={c} label={c} active={settings.currency === c} onPress={() => put("currency", c)} />
            ))}
          </View>
        </Row>,
      ],
    },
    {
      title: "Holds",
      rows: [
        <Row key="i" title="Itch cost per day" note="How much a day of wanting costs you. Higher = shorter holds">
          <Stepper value={settings.itchPerDay} onChange={(v) => put("itchPerDay", v)} step={1} min={1} max={50} format={fmt} />
        </Row>,
        <Row key="m" title="Longest hold" note="No hold is ever longer than this">
          <Stepper value={settings.maxWait} onChange={(v) => put("maxWait", v)} step={5} min={5} max={90} format={(x) => `${x} d`} />
        </Row>,
      ],
    },
    {
      title: "App",
      rows: [
        <Row key="r" title="Hold-over reminders" note={notificationsAvailable ? "A nudge when a hold runs out" : "Works in the installed app"}>
          <Toggle
            value={settings.reminders && notificationsAvailable}
            onValueChange={async (v) => {
              if (v) {
                const ok = await requestNotificationPermission();
                await put("reminders", ok);
              } else {
                await cancelAll();
                await put("reminders", false);
              }
            }}
          />
        </Row>,
        <Row key="h" title="Vibration" note="Taps, swipes and check-ins">
          <Toggle value={settings.haptics} onValueChange={(v) => put("haptics", v)} />
        </Row>,
        <Row key="w" title="Erase all data" note={confirm ? "This deletes every hold, decision and what the model learned." : "Start over from scratch"}>
          <PressableScale
            onPress={async () => {
              if (!confirm) return setConfirm(true);
              await wipeAll();
              setConfirm(false);
              await refresh();
            }}
            style={{ borderRadius: t.radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: confirm ? t.colors.danger : t.colors.surfaceAlt }}
          >
            <Text style={{ ...t.typography.label, color: confirm ? t.colors.onAccent : t.colors.danger }}>{confirm ? "Erase" : "Erase…"}</Text>
          </PressableScale>
        </Row>,
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={goBack}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 40 }}>
        {groups.map((g, gi) => (
          <Animated.View key={g.title} entering={FadeInDown.delay(staggerDelay(gi)).duration(400)} style={{ gap: 8 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, marginLeft: 4 }}>{g.title}</Text>
            <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, overflow: "hidden" }}>
              {g.rows.map((r, i) => (
                <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.colors.border }}>
                  {r}
                </View>
              ))}
            </View>
          </Animated.View>
        ))}
        <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Everything stays on this phone. No account, no internet.</Text>
      </ScrollView>
    </View>
  );
}

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>{title}</Text>
          {note ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text> : null}
        </View>
        {children}
      </View>
    </View>
  );
}
