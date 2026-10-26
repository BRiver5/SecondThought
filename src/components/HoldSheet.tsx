import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Hourglass, Zap } from "lucide-react-native";
import { useTheme } from "../theme";
import { Sheet, Field, inputStyle } from "./Sheet";
import { Chip } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { PressableScale } from "./PressableScale";
import { DesirePicker } from "./DesirePicker";
import { useApp } from "../store/appStore";
import { CATEGORIES, QUICK, TRIGGERS } from "../ui/presets";
import { CATEGORY_COLORS } from "../theme/colors";
import { itemPosterior, evidenceCount } from "../lib/desire";
import { decideWait } from "../lib/cooling";
import { paramsOf } from "../ui/derive";
import { money, pct } from "../ui/format";
import { addImpulse, addWant } from "../data/repo";
import { scheduleInterval } from "../services/notifications";
import { haptics } from "../services/haptics";

export function HoldSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (kind: "hold" | "impulse", days: number) => void }) {
  const t = useTheme();
  const { model, settings, today, refresh } = useApp();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Clothes");
  const [trigger, setTrigger] = useState("Ad");
  const [desire, setDesire] = useState(3);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setPrice("");
    setCategory("Clothes");
    setTrigger("Ad");
    setDesire(3);
  }, [visible]);

  const p = Number(price.replace(",", "."));
  const valid = name.trim().length > 0 && p > 0;
  const decision = useMemo(() => (valid ? decideWait(itemPosterior(model, category, trigger), p, desire, paramsOf(settings)) : null), [valid, p, category, trigger, desire, model, settings]);
  const cur = settings.currency;

  const save = async (kind: "hold" | "impulse") => {
    if (!valid) return;
    const w = { name: name.trim(), price: p, category, trigger, desire, note: "" };
    if (kind === "hold" && decision) {
      const id = await addWant(w, today, decision.days, decision.pFade);
      if (settings.reminders) {
        await scheduleInterval({ id: `hold-${id}`, seconds: decision.days * 86400, title: "Second thought time", body: `Your hold on "${w.name}" is over. Still want it?` });
      }
      haptics.success();
    } else {
      await addImpulse(w, today);
      haptics.warning();
    }
    await refresh();
    onSaved(kind, decision?.days ?? 0);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Put it on hold"
      subtitle="Log the urge now, decide when the hold is over."
      footer={
        <View style={{ gap: 10 }}>
          <PrimaryButton label={decision ? `Hold for ${decision.days} ${decision.days === 1 ? "day" : "days"}` : "Hold it"} onPress={() => save("hold")} disabled={!valid} />
          <PressableScale onPress={() => save("impulse")} disabled={!valid} accessibilityLabel="I already bought it" style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8, opacity: valid ? 1 : 0.4 }}>
            <Zap size={15} color={t.colors.danger} />
            <Text style={{ ...t.typography.label, color: t.colors.danger }}>Already bought it on impulse</Text>
          </PressableScale>
        </View>
      }
    >
      <Field label="Quick pick">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {QUICK.map((q) => (
            <Chip
              key={q.name}
              label={q.name}
              active={name === q.name}
              color={CATEGORY_COLORS[q.category]}
              onPress={() => {
                setName(q.name);
                setPrice(String(q.price));
                setCategory(q.category);
              }}
            />
          ))}
        </View>
      </Field>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 2 }}>
          <Field label="What is it">
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Rain jacket" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={`Price, ${cur}`}>
            <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
          </Field>
        </View>
      </View>
      <Field label="Category">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={category === c} color={CATEGORY_COLORS[c]} onPress={() => setCategory(c)} />
          ))}
        </View>
      </Field>
      <Field label="What sparked it">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TRIGGERS.map((c) => (
            <Chip key={c} label={c} active={trigger === c} onPress={() => setTrigger(c)} />
          ))}
        </View>
      </Field>
      <Field label="How much do you want it">
        <DesirePicker value={desire} onChange={setDesire} />
      </Field>
      {decision ? (
        <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Hourglass size={22} color={t.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>
              {decision.days} {decision.days === 1 ? "day" : "days"} · {pct(decision.pFade)} chance the urge passes
            </Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Expected to keep {money(decision.expectedSaved, cur)} · based on {evidenceCount(model, category) < 1 ? "starting guesses" : `${Math.round(evidenceCount(model, category))} past ${category.toLowerCase()} urges`}
            </Text>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
