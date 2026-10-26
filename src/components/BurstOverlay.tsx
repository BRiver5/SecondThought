import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "../theme";
import { SuccessBurst } from "./SuccessBurst";

// Payoff поверх экрана: бейдж-вспышка + подпись, сам исчезает по onDone.
export function BurstOverlay({ message, onDone }: { message: string | null; onDone: () => void }) {
  const t = useTheme();
  if (!message) return null;
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", zIndex: 60 }]}>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, paddingVertical: 22, paddingHorizontal: 28, alignItems: "center", gap: 10, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16 }}>
        <SuccessBurst visible onDone={() => setTimeout(onDone, 900)} size={72} />
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink, textAlign: "center", maxWidth: 240 }}>{message}</Text>
      </View>
    </Animated.View>
  );
}
