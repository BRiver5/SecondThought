import { useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

// Интерактивная кривая "всё ещё хочу" S(t): палец ведёт бегунок по дням,
// подпись сверху — вероятность на этот день и шанс, что пройдёт к нему.
// Отмечены сегодня и день окончания паузы. Состояние жеста — в useRef
// (обработчики на UI-потоке видят замыкание старого рендера).
export function FadeCurve({ values, today, waitDay, compare }: { values: number[]; today: number; waitDay: number; compare?: number[] }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const H = 150;
  const pad = 8;
  const n = values.length - 1;
  const x = (i: number) => pad + (i / n) * (w - pad * 2);
  const y = (v: number) => pad + (1 - v) * (H - pad * 2);
  const path = (vs: number[]) => vs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = w ? `${path(values)} L${x(n)},${y(0)} L${x(0)},${y(0)} Z` : "";

  const update = (px: number) => {
    if (!w) return;
    const i = Math.max(0, Math.min(n, Math.round(((px - pad) / (w - pad * 2)) * n)));
    if (i !== last.current) {
      last.current = i;
      haptics.tick();
      setScrub(i);
    }
  };
  const end = () => {
    last.current = null;
    setScrub(null);
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(update)(e.x))
    .onUpdate((e) => runOnJS(update)(e.x))
    .onFinalize(() => runOnJS(end)());

  const shown = scrub ?? waitDay;
  const v = values[Math.min(n, shown)] ?? 0;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>
          {scrub === null ? `End of hold · day ${waitDay}` : `Day ${scrub}`}
        </Text>
        <Text style={{ ...t.typography.label, color: t.colors.urge }}>
          {Math.round(v * 100)}% still want · {Math.round((1 - v) * 100)}% passed
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: H }} accessibilityLabel="Urge curve, drag to read any day">
          {w > 0 ? (
            <Svg width={w} height={H}>
              <Rect x={x(Math.min(today, n))} y={pad} width={Math.max(0, x(Math.min(waitDay, n)) - x(Math.min(today, n)))} height={H - pad * 2} fill={t.colors.urgeSoft} opacity={0.6} />
              {[0.25, 0.5, 0.75].map((g) => (
                <Line key={g} x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke={t.colors.border} strokeDasharray="3 5" />
              ))}
              <Path d={area} fill={t.colors.urge} opacity={0.1} />
              {compare ? <Path d={path(compare)} stroke={t.colors.inkFaint} strokeWidth={2} strokeDasharray="5 4" fill="none" /> : null}
              <Path d={path(values)} stroke={t.colors.urge} strokeWidth={3} fill="none" />
              <Line x1={x(Math.min(waitDay, n))} x2={x(Math.min(waitDay, n))} y1={pad} y2={H - pad} stroke={t.colors.accent} strokeWidth={2} />
              <Line x1={x(Math.min(today, n))} x2={x(Math.min(today, n))} y1={pad} y2={H - pad} stroke={t.colors.ink} strokeWidth={1} strokeDasharray="2 3" />
              <Circle cx={x(shown)} cy={y(v)} r={scrub === null ? 5 : 8} fill={t.colors.surface} stroke={t.colors.urge} strokeWidth={3} />
            </Svg>
          ) : null}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: t.colors.inkFaint }}>day 0</Text>
        <Text style={{ fontSize: 11, color: t.colors.inkFaint }}>dotted: today · green: end of hold</Text>
        <Text style={{ fontSize: 11, color: t.colors.inkFaint }}>day {n}</Text>
      </View>
    </View>
  );
}
