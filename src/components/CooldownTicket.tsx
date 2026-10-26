import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { CATEGORY_COLORS } from "../theme/colors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Билет "на паузе" в верхней ленте: дуга сколько ожидания уже прожито
// (наполняется к созреванию), вырезы-перфорация по бокам, как у корешка билета.
export function CooldownTicket({
  name,
  price,
  category,
  waited,
  total,
  still,
  onPress,
}: {
  name: string;
  price: string;
  category: string;
  waited: number;
  total: number;
  still: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const size = 54;
  const sw = 6;
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.min(1, total > 0 ? waited / total : 1);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(frac, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [frac]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));
  const left = Math.max(0, total - waited);
  const ripe = left === 0;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${name}, ${ripe ? "ready to decide" : `${left} days left`}`} style={{ width: 150 }}>
      <View style={{ backgroundColor: ripe ? t.colors.accent : t.colors.surface, borderRadius: t.radius.lg, padding: 14, gap: 10, overflow: "hidden", borderWidth: 1, borderColor: ripe ? t.colors.accent : t.colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <Svg width={size} height={size} style={{ position: "absolute" }}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={ripe ? "rgba(255,255,255,0.25)" : t.colors.urgeSoft} strokeWidth={sw} fill="none" />
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={ripe ? t.colors.onAccent : t.colors.urge}
                strokeWidth={sw}
                strokeDasharray={C}
                strokeLinecap="round"
                fill="none"
                rotation={-90}
                originX={size / 2}
                originY={size / 2}
                animatedProps={props}
              />
            </Svg>
            <Text style={{ fontSize: 16, fontWeight: "800", color: ripe ? t.colors.onAccent : t.colors.ink }}>{ripe ? "Go" : left}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: ripe ? t.colors.accentSoft : t.colors.inkFaint }}>{ripe ? "READY" : left === 1 ? "DAY LEFT" : "DAYS LEFT"}</Text>
            <Text style={{ fontSize: 12, color: ripe ? t.colors.accentSoft : t.colors.inkMuted, marginTop: 2 }}>{Math.round(still * 100)}% still</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: ripe ? "rgba(255,255,255,0.3)" : t.colors.border }} />
          ))}
        </View>
        <View>
          <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: ripe ? t.colors.onAccent : t.colors.ink }}>{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_COLORS[category] ?? t.colors.inkFaint }} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: ripe ? t.colors.onAccent : t.colors.urge }}>{price}</Text>
          </View>
        </View>
      </View>
      {/* Перфорация корешка */}
      <View style={{ position: "absolute", left: -7, top: 72, width: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.background }} />
      <View style={{ position: "absolute", right: -7, top: 72, width: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.background }} />
    </PressableScale>
  );
}
