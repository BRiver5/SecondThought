import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

// Полоса фонда месяца: потрачено · в плане · свободно, сегменты вырастают по очереди.
function Seg({ width, color, delay }: { width: number; color: string; delay: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = 0;
    w.value = withDelay(delay, withTiming(width, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [width]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: "100%", backgroundColor: color }, style]} />;
}

export function FundBar({ total, parts, legendColor }: { total: number; parts: { label: string; value: number; color: string }[]; legendColor?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const sum = Math.max(total, parts.reduce((s, p) => s + p.value, 0), 1);
  return (
    <View>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: 14, borderRadius: 7, backgroundColor: t.colors.backgroundAlt, overflow: "hidden", flexDirection: "row" }}>
        {w > 0 ? parts.map((p, i) => <Seg key={p.label} width={(p.value / sum) * w} color={p.color} delay={i * 120} />) : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={{ ...t.typography.caption, color: legendColor ?? t.colors.inkMuted }}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
