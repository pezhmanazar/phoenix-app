// app/pelekan/bastan/subtask/CC_2_signature.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../hooks/useAuth";
import { useUser } from "../../../../hooks/useUser";

/* ----------------------------- UI ----------------------------- */

const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  red: "#FCA5A5",
  green: "#22C55E",
};

/* ----------------------------- Utils ----------------------------- */

function subtaskNumberFa(key: string) {
  if (key === "CC_2_signature") return "ریز اقدام دوم";
  return "ریز اقدام";
}

function todayFa() {
  try {
    return new Intl.DateTimeFormat("fa-IR").format(new Date());
  } catch {
    return "";
  }
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type CC2Saved = {
  version: 1;
  savedAt: string;
  fullName: string;
  dateFa: string;
  confirmed: boolean;
};

/* ----------------------------- Keys ----------------------------- */

const SUBTASK_KEY = "CC_2_signature";
const KEY_CC2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Modal ----------------------------- */

function ThemedModal({
  visible,
  kind,
  title,
  message,
  primaryText,
  onPrimary,
  secondaryText,
  onSecondary,
  loading,
}: {
  visible: boolean;
  kind: ModalKind;
  title: string;
  message?: string;
  primaryText: string;
  onPrimary: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  loading?: boolean;
}) {
  if (!visible) return null;

  const icon =
    kind === "success"
      ? "checkmark-circle"
      : kind === "warn"
      ? "warning"
      : kind === "info"
      ? "information-circle"
      : "alert-circle";

  const iconColor =
    kind === "success"
      ? palette.green
      : kind === "warn"
      ? palette.orange
      : kind === "info"
      ? palette.muted
      : palette.red;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
          <Text style={styles.modalTitle}>{title}</Text>
        </View>

        {!!message && <Text style={styles.modalMsg}>{message}</Text>}

        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPrimary}
            disabled={loading}
            style={[styles.modalPrimaryBtn, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.modalPrimaryText}>{primaryText}</Text>
            )}
          </TouchableOpacity>

          {secondaryText && onSecondary && (
            <TouchableOpacity onPress={onSecondary} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>{secondaryText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

/* ----------------------------- Screen ----------------------------- */

export default function CC2SignatureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);

  const { me } = useUser();
  const { token } = useAuth();
  const phone = String(me?.phone || "").trim();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [booting, setBooting] = useState(true);
  const [isReview, setIsReview] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dateFa] = useState(todayFa());
  const [confirmed, setConfirmed] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [modal, setModal] = useState<any>({ visible: false });

  /* ----------------------------- Load review ----------------------------- */

  useEffect(() => {
    const run = async () => {
      const raw = await AsyncStorage.getItem(KEY_CC2_FINAL);
      if (!raw) {
        setBooting(false);
        return;
      }

      try {
        const j = JSON.parse(raw) as CC2Saved;
        if (j?.version === 1) {
          setFullName(j.fullName);
          setConfirmed(j.confirmed);
          setIsReview(true);
          setStep(3);
        }
      } catch {}
      setBooting(false);
    };
    run();
  }, []);

  /* ----------------------------- Scroll reset ----------------------------- */

  useEffect(() => {
    if (booting) return;
    InteractionManager.runAfterInteractions(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [step, booting]);

  /* ----------------------------- Guards ----------------------------- */

  const step2Ok = fullName.trim().length >= 3;
  const step3Ok = step2Ok && confirmed;

  /* ----------------------------- Finalize ----------------------------- */

  const finalize = useCallback(async () => {
    if (!step3Ok || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const payload: CC2Saved = {
        version: 1,
        savedAt: new Date().toISOString(),
        fullName: fullName.trim(),
        dateFa,
        confirmed: true,
      };

      await AsyncStorage.setItem(KEY_CC2_FINAL, JSON.stringify(payload));
      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

      await fetch(`${apiBase}/api/pelekan/bastan/subtask/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone,
          subtaskKey: SUBTASK_KEY,
          payload,
        }),
      });

      setModal({
        visible: true,
        kind: "success",
        title: "تعهد ثبت شد",
        message: "این امضا قفل شد و قابل تغییر نیست.",
        primaryText: "خروج",
        onPrimary: () => router.back(),
      });
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [apiBase, dateFa, fullName, phone, router, step3Ok, token]);

  /* ----------------------------- UI ----------------------------- */

  if (booting) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{headerNo}</Text>
          <Text style={styles.headerSub}>امضای تعهدنامه</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16 }}>
        {/* Step 1 */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.h1}>معنای این امضا</Text>

            {[
              "تماس هیجانی ممنوع",
              "چک‌کردن و سرک کشیدن ممنوع",
              "پیام احساسی یا بهانه‌دار ممنوع",
              "دور زدن ذهنی این تعهد ممنوع",
            ].map((t) => (
              <Text key={t} style={styles.bullet}>• {t}</Text>
            ))}

            <Text style={styles.note}>
              امضا یعنی حتی اگر دلم لرزید، رفتارم تغییر نمی‌کند.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStep(2)}
            >
              <Text style={styles.primaryBtnText}>ادامه</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.h1}>ثبت امضا</Text>

            <TextInput
              editable={!isReview}
              value={fullName}
              onChangeText={setFullName}
              placeholder="نام و نام خانوادگی"
              placeholderTextColor={palette.muted}
              style={styles.input}
            />

            <Text style={styles.date}>تاریخ: {dateFa}</Text>

            <TouchableOpacity
              disabled={!step2Ok}
              style={[styles.primaryBtn, !step2Ok && { opacity: 0.4 }]}
              onPress={() => setStep(3)}
            >
              <Text style={styles.primaryBtnText}>ادامه</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.h1}>تأیید نهایی</Text>

            <Pressable
              disabled={isReview}
              onPress={() => setConfirmed((v) => !v)}
              style={styles.choiceCard}
            >
              <Ionicons
                name={confirmed ? "checkbox" : "square-outline"}
                size={20}
                color={confirmed ? palette.green : palette.muted}
              />
              <Text style={styles.choiceText}>
                با آگاهی کامل این تعهد را امضا می‌کنم
              </Text>
            </Pressable>

            <TouchableOpacity
              disabled={!step3Ok || saving}
              style={[styles.primaryBtn, (!step3Ok || saving) && { opacity: 0.4 }]}
              onPress={finalize}
            >
              <Text style={styles.primaryBtnText}>ثبت و پایان</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ThemedModal {...modal} />
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    right: -80,
    height: 220,
    backgroundColor: palette.gold,
    opacity: 0.08,
    borderRadius: 200,
  },
  glowBottom: {
    position: "absolute",
    bottom: -120,
    left: -80,
    right: -80,
    height: 220,
    backgroundColor: palette.orange,
    opacity: 0.08,
    borderRadius: 200,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: { padding: 6 },
  headerTitle: { color: palette.gold, fontSize: 12 },
  headerSub: { color: palette.text, fontSize: 16, fontWeight: "600" },
  card: {
    backgroundColor: palette.glass2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  h1: { color: palette.text, fontSize: 18, marginBottom: 12 },
  bullet: { color: palette.muted, marginBottom: 6 },
  note: { color: palette.orange, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 12,
    color: palette.text,
    marginBottom: 10,
  },
  date: { color: palette.muted, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: palette.gold,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontWeight: "600" },
  choiceCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  choiceText: { color: palette.text, flexShrink: 1 },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: palette.glass2,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { color: palette.text, fontSize: 16 },
  modalMsg: { color: palette.muted, marginTop: 8 },
  modalPrimaryBtn: {
    backgroundColor: palette.gold,
    padding: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  modalPrimaryText: { color: "#000", fontWeight: "600" },
  modalSecondaryBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    flex: 1,
    alignItems: "center",
  },
  modalSecondaryText: { color: palette.text },
});