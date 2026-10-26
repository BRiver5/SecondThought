import { Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { haptics } from "../services/haptics";

const LABELS = ["Meh", "Nice", "Want", "Really want", "Must have"];

// Сила желания 1..5 — пять "огоньков", горят до выбранного.
export function DesirePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const on = i <= value;
          return (
            <PressableScale
              key={i}
              accessibilityLabel={`Desire ${i}`}
              scaleTo={0.85}
              onPress={() => {
                haptics.tick();
                onChange(i);
              }}
              style={{ flex: 1, height: 46, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.colors.urgeSoft : t.colors.surfaceAlt, borderWidth: 1, borderColor: on ? t.colors.urge : t.colors.border }}
            >
              <Flame size={18 + i * 1.5} color={on ? t.colors.urge : t.colors.inkFaint} fill={on ? t.colors.urge : "transparent"} />
            </PressableScale>
          );
        })}
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{LABELS[value - 1]}</Text>
    </View>
  );
}
