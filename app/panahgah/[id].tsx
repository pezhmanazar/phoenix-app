// app/panahgah/[id].tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio, AVPlaybackStatusSuccess } from "expo-av";
import { Ionicons } from "@expo/vector-icons";           // ⬅️ اضافه شد
import { byId } from "@/lib/panahgah/registry";
import type { Step } from "@/lib/panahgah/types";
import {
  getVisitIndex, bumpVisitIndex,
  addHistoryEntry, getHistory
} from "@/lib/panahgah/storage";

export default function Runner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = byId(id!);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    (async () => {
      if (!scenario) return;
      const visitsSoFar = await getVisitIndex(scenario.id);
      const plan = scenario.getPlanForVisit(visitsSoFar + 1);
      setSteps(plan);
      const hist = await getHistory(scenario.id);
      setHasHistory((hist?.length ?? 0) > 0);
    })();
  }, [scenario?.id]);

  async function next() {
    if (!steps) return;
    if (idx < steps.length - 1) setIdx((i) => i + 1);
    else {
      if (scenario) await bumpVisitIndex(scenario.id);
      router.back();
    }
  }

  if (!scenario || !steps) {
    return (
      <SafeAreaView style={[styles.center]}>
        <Text>در حال آماده‌سازی…</Text>
      </SafeAreaView>
    );
  }

  const step = steps[idx];

  return (
    <SafeAreaView style={[styles.root]}>
      {/* Header */}
      <View style={[styles.header]}>
        <Text style={[styles.headerTitle]}>{scenario.title}</Text>
        <Text style={{ opacity: 0.6, textAlign: "center", marginTop: 4 }}>
          مرحله {idx + 1} از {steps.length}
        </Text>
      </View>

      {/* بدنهٔ اصلی */}
      {step.type === "voice" && <VoiceStep step={step} onDone={next} />}
      {step.type === "form" && (
        <FormStep
          step={step}
          scenarioId={scenario.id}
          onSaved={() => setHasHistory(true)}
          onDone={next}
          bottomPad={insets.bottom}
        />
      )}
      {step.type === "breath" && <BreathStep step={step} onDone={next} />}

      {/* دکمهٔ پایین صفحه: سوابق */}
      {hasHistory && (
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity
            onPress={() => router.push(`/panahgah/history/${scenario.id}`)}
            activeOpacity={0.9}
            style={styles.footerBtn}
          >
            <Ionicons name="time-outline" size={18} color="#111" style={{ marginLeft: 8 }} />
            <Text style={styles.footerText}>سوابق این موقعیت</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ——— همان کامپوننت‌های VoiceStep / FormStep / BreathStep بدون تغییر منطقی ——— */

function VoiceStep({ step, onDone }: { step: Extract<Step, { type: "voice" }>; onDone: () => void }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);
  async function toggle() {
    if (!soundRef.current) {
      setLoading(true);
      const { sound } = await Audio.Sound.createAsync(
        typeof step.uri === "string" ? { uri: step.uri } : step.uri
      );
      soundRef.current = sound;
      setLoading(false);
      setPlaying(true);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((st) => {
        const s = st as AVPlaybackStatusSuccess;
        if (s.isLoaded) setPlaying(s.isPlaying);
      });
      return;
    }
    const s = soundRef.current;
    const status = (await s.getStatusAsync()) as AVPlaybackStatusSuccess;
    if (status.isPlaying) { await s.pauseAsync(); setPlaying(false); }
    else { await s.playAsync(); setPlaying(true); }
  }
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepTitle}>{step.title}</Text>
      <TouchableOpacity onPress={toggle} style={styles.buttonSolid} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "در حال آماده‌سازی…" : (playing ? "توقف" : "پخش")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDone} style={[styles.buttonOutline, { borderColor: "#10B981" }]}>
        <Text style={[styles.buttonText, { color: "#10B981" }]}>گوش دادم، مرحله بعد</Text>
      </TouchableOpacity>
    </View>
  );
}

function FormStep({
  step, scenarioId, onSaved, onDone, bottomPad,
}: {
  step: Extract<Step, { type: "form" }>;
  scenarioId: string;
  onSaved: () => void;
  onDone: () => void;
  bottomPad: number;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function saveAndNext() {
    const lines = step.fields.map((f) => {
      const val = (values[f.key] ?? "").trim();
      return `${f.label}:\n${val || "—"}`;
    });
    const payload = lines.join("\n\n");
    try {
      setSaving(true);
      await addHistoryEntry(scenarioId, payload);
      onSaved();
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + bottomPad }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>{step.title}</Text>
        {step.fields.map((f) => (
          <View key={f.key} style={{ marginBottom: 12 }}>
            <Text style={{ opacity: 0.6, marginBottom: 6, textAlign: "right" }}>{f.label}</Text>
            <TextInput
              value={values[f.key] ?? ""}
              onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
              placeholder="بنویس…"
              placeholderTextColor="#94A3B8"
              multiline
              style={{
                borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12,
                padding: 12, minHeight: 90, textAlign: "right", backgroundColor: "white", color: "#111",
              }}
            />
          </View>
        ))}
        <TouchableOpacity onPress={saveAndNext} disabled={saving} style={[styles.buttonSolid, { opacity: saving ? 0.6 : 1 }]}>
          <Text style={styles.buttonText}>{saving ? "در حال ذخیره…" : "انجام شد"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BreathStep({ step, onDone }: { step: Extract<Step, { type: "breath" }>; onDone: () => void }) {
  const [t, setT] = useState(step.seconds);
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step.seconds]);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepTitle}>{step.title}</Text>
      {!!step.hints?.length && (
        <Text style={{ opacity: 0.6, textAlign: "center", marginBottom: 12 }}>
          {step.hints.join(" • ")}
        </Text>
      )}
      <Text style={{ fontSize: 40, textAlign: "center", marginVertical: 16 }}>
        {mm}:{ss}
      </Text>
      <TouchableOpacity onPress={onDone} style={[styles.buttonSolid, { backgroundColor: "#059669" }]}>
        <Text style={styles.buttonText}>{t === 0 ? "تمام، مرحله بعد" : "کافیه، ادامه بده"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { borderBottomWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", backgroundColor: "#F5F7FA" },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  stepBox: { flex: 1, padding: 16, gap: 10, justifyContent: "center" },
  stepTitle: { fontWeight: "900", fontSize: 18, textAlign: "center", marginBottom: 8 },

  buttonSolid: { borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 8, backgroundColor: "#111827" },
  buttonOutline: { borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 2, marginTop: 10 },
  buttonText: { color: "white", fontWeight: "900" },

  // ⬇️ Footer
  footer: { paddingHorizontal: 16, backgroundColor: "transparent" },
  footerBtn: {
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "white",
    borderRadius: 12, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", // برای آیکن + متن
  },
  footerText: { fontWeight: "900", color: "#111" },
});