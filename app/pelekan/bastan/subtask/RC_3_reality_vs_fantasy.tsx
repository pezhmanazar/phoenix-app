// app/pelekan/bastan/subtask/RC_3_reality_vs_fantasy.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "RC_3_reality_vs_fantasy") return "ریز‌اقدام سوم";
  return "ریز‌اقدام";
}

/* ----------------------------- Types ----------------------------- */
type RC3Saved = {
  version: 1;
  savedAt: string; // ISO
  realities: string[]; // length 5
  fantasies: string[]; // length 5
  costs: string[]; // length 5
  finalLine: string;
};

/* ----------------------------- Storage Keys ----------------------------- */
// ✅ فقط بعد از ثبت نهایی ساخته می‌شود (قبلش هیچ ذخیره‌ای نداریم)
const KEY_RC3_FINAL = "pelekan:bastan:subtask:RC_3_reality_vs_fantasy:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Themed Modal ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

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
          ? "rgba(231,238,247,.85)"
          : palette.red;

  return (
    <View style={styles.modalOverlay} pointerEvents="auto">
      <View style={styles.modalCard}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
          <Text style={styles.modalTitle}>{title}</Text>
        </View>

        {!!message ? <Text style={styles.modalMsg}>{message}</Text> : null}

        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPrimary}
            style={[styles.modalPrimaryBtn, loading && { opacity: 0.6 }]}
            disabled={!!loading}
          >
            {loading ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={styles.modalPrimaryText}>در حال انجام…</Text>
              </View>
            ) : (
              <Text style={styles.modalPrimaryText}>{primaryText}</Text>
            )}
          </TouchableOpacity>

          {secondaryText && onSecondary ? (
            <TouchableOpacity activeOpacity={0.9} onPress={onSecondary} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>{secondaryText}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function RC3RealityVsFantasyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const subtaskKey = "RC_3_reality_vs_fantasy";
  const headerNo = subtaskNumberFa(subtaskKey);
  const title = "واقعیت رابطه و خیال‌هاتو جدا کن";

  // 0: intro | 1: start | 2: realities | 3: fantasies | 4: costs | 5: final
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const [realities, setRealities] = useState<string[]>(["", "", "", "", ""]);
  const [fantasies, setFantasies] = useState<string[]>(["", "", "", "", ""]);
  const [costs, setCosts] = useState<string[]>(["", "", "", "", ""]);
  const [finalLine, setFinalLine] = useState<string>("");

  // ✅ ورود/مرور
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  // ✅ قفل submit
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ✅ اسکرول نرم بعد از تغییر step
  const scrollRef = useRef<ScrollView>(null);

  // ✅ برای جلوگیری از رفتن input زیر کیبورد
  const finalInputRef = useRef<TextInput>(null);

  // ✅ انیمیشن ظریف جمله پایانی
  const finalAnim = useRef(new Animated.Value(0)).current;

  // ✅ مودال‌ها
  const [confirmLockModal, setConfirmLockModal] = useState(false);
  const [modal, setModal] = useState<{
    visible: boolean;
    kind: ModalKind;
    title: string;
    message?: string;
    primaryText: string;
    secondaryText?: string;
    onPrimary?: () => void;
    onSecondary?: () => void;
    loading?: boolean;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
    primaryText: "باشه",
  });

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false, loading: false }));
  }, []);

  const openModal = useCallback((cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
    setModal({ ...cfg, visible: true } as any);
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_RC3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RC3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const r = Array.isArray(j.realities) ? j.realities.map((x) => String(x || "")) : [];
    const f = Array.isArray(j.fantasies) ? j.fantasies.map((x) => String(x || "")) : [];
    const c = Array.isArray(j.costs) ? j.costs.map((x) => String(x || "")) : [];

    setRealities([...r, "", "", "", "", ""].slice(0, 5));
    setFantasies([...f, "", "", "", "", ""].slice(0, 5));
    setCosts([...c, "", "", "", "", ""].slice(0, 5));
    setFinalLine(String(j.finalLine || ""));

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;
        setIsReview(!!loaded);
        if (loaded) setStep(5); // ✅ در مرور، مستقیم برو جمع‌بندی تا همه‌چیز جلوی چشم باشد
      } catch {
        if (alive) setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [loadFinalIfAny]);

  useEffect(() => {
    if (booting) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    });

    return () => {
      cancelled = true;
      // @ts-ignore
      if (typeof task?.cancel === "function") task.cancel();
    };
  }, [step, booting]);

  // ✅ انیمیشن ظریف برای مرحله نهایی
  useEffect(() => {
    if (step !== 5) return;
    finalAnim.setValue(0);
    Animated.timing(finalAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [finalAnim, step]);

  /* ----------------------------- Helpers ----------------------------- */
  const setReality = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      const txt = String(v || "");
      setRealities((prev) => {
        const next = [...prev];
        next[idx] = txt;
        return next;
      });
    },
    [isReview]
  );

  const setFantasy = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      const txt = String(v || "");
      setFantasies((prev) => {
        const next = [...prev];
        next[idx] = txt;
        return next;
      });
    },
    [isReview]
  );

  const setCost = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      const txt = String(v || "");
      setCosts((prev) => {
        const next = [...prev];
        next[idx] = txt;
        return next;
      });
    },
    [isReview]
  );

  const trimLen = (s: string) => String(s || "").trim().length;

  const allRealitiesOk = useMemo(() => realities.every((x) => trimLen(x) >= 3), [realities]);
  const allFantasiesOk = useMemo(() => fantasies.every((x) => trimLen(x) >= 3), [fantasies]);
  const allCostsOk = useMemo(() => costs.every((x) => trimLen(x) >= 3), [costs]);
  const finalOk = useMemo(() => trimLen(finalLine) >= 10, [finalLine]);

  const canGoStep2 = true; // step 1 -> 2 always
  const canGoRealitiesDone = allRealitiesOk;
  const canGoFantasiesDone = allFantasiesOk;
  const canGoCostsDone = allCostsOk;
  const canFinalize = allRealitiesOk && allFantasiesOk && allCostsOk && finalOk;

  /* ----------------------------- Server + Local Final ----------------------------- */
  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام‌شدن باید وارد حساب باشی.",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const payloadToSend: RC3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      realities,
      fantasies,
      costs,
      finalLine,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        phone: p,
        subtaskKey: "RC_3_reality_vs_fantasy",
        payload: payloadToSend,
      }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.ok && json?.ok) return "ok";

    const err = String(json?.error || "");
    if (err === "ALREADY_DONE") return "already";

    openModal({
      kind: "error",
      title: "ثبت ناموفق بود",
      message: faOnlyTitle(err || "مشکلی پیش آمد. دوباره تلاش کن."),
      primaryText: "باشه",
      onPrimary: closeModal,
    });
    return "fail";
  }, [apiBase, closeModal, costs, fantasies, finalLine, openModal, phone, realities, token]);

  const persistFinalLocal = useCallback(async () => {
    const payload: RC3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      realities,
      fantasies,
      costs,
      finalLine,
    };
    await AsyncStorage.setItem(KEY_RC3_FINAL, JSON.stringify(payload));
  }, [costs, fantasies, finalLine, realities]);

  const doFinalize = useCallback(async () => {
    if (!canFinalize) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) سرور
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) لوکال (فقط بعد از ok/already)
      await persistFinalLocal();

      // ✅ چه ok چه already: نتیجه نهایی یکیه (ثبت شده)
      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلاً ثبت شده",
          message: "این ریز‌اقدام قبلاً ثبت شده و نیازی به ثبت دوباره نیست.",
          primaryText: "خروج",
          onPrimary: () => {
            closeModal();
            router.back();
          },
        });
        return;
      }

      openModal({
        kind: "success",
        title: "ثبت شد",
        message: "ثبت انجام شد. از این به بعد امکان تغییر این ریز‌اقدام وجود ندارد.",
        primaryText: "خروج",
        onPrimary: () => {
          closeModal();
          router.back();
        },
      });
    } finally {
      setSaving(false);
      savingRef.current = false;
      setIsReview(true);
      setStep(5);
    }
  }, [canFinalize, closeModal, completeOnServer, openModal, persistFinalLocal, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    if (!canFinalize) return;

    setConfirmLockModal(true);
  }, [canFinalize, isReview, router]);

  /* ----------------------------- UI ----------------------------- */
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{headerNo}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top + 12}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Review Banner */}
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور: این ریز‌اقدام قبلاً ثبت شده و قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {/* Step indicator */}
          <View style={styles.stepPills}>
            <View style={[styles.stepPill, step === 0 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۰) توضیح</Text>
            </View>
            <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۱) شروع</Text>
            </View>
            <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۲) واقعیت</Text>
            </View>
            <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۳) خیال</Text>
            </View>
            <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۴) هزینه</Text>
            </View>
            <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۵) پایان</Text>
            </View>
          </View>

          {/* Step 0 */}
          {step === 0 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قبل از شروع، این رو بدون</Text>
                <Text style={styles.p}>
                  قراره توی این تمرین نه قضاوت کنی، نه تحلیل کنی.{"\n"}
                  فقط دو چیز رو از هم جدا می‌کنی:{"\n"}
                  <Text style={{ fontWeight: "900", color: palette.text }}>چیزی که واقعاً بود</Text> و{" "}
                  <Text style={{ fontWeight: "900", color: palette.text }}>چیزی که دلت می‌خواست باشه</Text>.{"\n"}
                  همین قاطی شدنِ این دوتاست که ذهنت رو نگه داشته.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  قانون: کوتاه و ساده بنویس. «کاش، شاید و اگر» رو بذار کنار.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setStep(1)}
                style={[styles.primaryBtn, isReview && { opacity: 0.65 }]}
                disabled={isReview}
              >
                <Text style={styles.primaryBtnText}>ادامه</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Step 1 */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>این تمرین برای زنده کردن رابطه نیست</Text>
                <Text style={styles.p}>
                  هدف اینه که مغزت «واقعیت کامل» رو ببینه.{"\n"}
                  بعدش تصمیم‌گیری راحت‌تر میشه.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  ۵ جمله از واقعیت رابطه رو می‌نویسی، ۵ جمله از خیالپردازی‌های رابطه و بعد هزینه‌ی خیالپردازی‌هات رو
                  می‌نویسی.
                </Text>
              </View>

              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(0)} style={[styles.secondaryBtn, { flex: 1 }]}>
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGoStep2}
                  onPress={() => setStep(2)}
                  style={[styles.primaryBtn, { flex: 1 }, !canGoStep2 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>شروع</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Step 2 - realities */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>واقعیت رابطه چی بود؟</Text>
                <Text style={styles.p}>
                  فقط چیزی که واقعاً اتفاق افتاد رو بنویس.{"\n"}
                  نه تحلیل کن، نه توجیه.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  مثلا: دیر جواب می‌داد یا به قول‌هاش عمل نمی‌کرد یا توجه داخل رابطه کم بود
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {realities.map((val, idx) => {
                  const len = trimLen(val);
                  return (
                    <View key={`r_${idx}`} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>{idx + 1}) واقعیت</Text>
                      <TextInput
                        value={val}
                        onChangeText={(t) => setReality(idx, t)}
                        placeholder={`واقعیت ${idx + 1}…`}
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <Text style={[styles.small, !isReview && len < 3 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/3`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoRealitiesDone}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoRealitiesDone && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGoRealitiesDone ? <Text style={styles.warn}>باید هر ۵ جمله واقعیت رو کوتاه و واضح پر کنی.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 3 - fantasies */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>چی دلت می‌خواست باشه؟</Text>
                <Text style={styles.p}>
                  اینا چیزاییه که تو ذهنت می‌ساختی.{"\n"}
                  نه چیزی که واقعاً وجود داشت.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  مثلا: فکر می‌کردم عوض میشه یا فکر می‌کردم با هم آینده داریم یا فکر می‌کردم من براش مهمم
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {fantasies.map((val, idx) => {
                  const len = trimLen(val);
                  return (
                    <View key={`f_${idx}`} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>{idx + 1}) خیال</Text>
                      <TextInput
                        value={val}
                        onChangeText={(t) => setFantasy(idx, t)}
                        placeholder={`خیال ${idx + 1}…`}
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <Text style={[styles.small, !isReview && len < 3 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/3`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoFantasiesDone}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoFantasiesDone && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGoFantasiesDone ? <Text style={styles.warn}>باید هر ۵ جمله خیال رو کوتاه و واضح پر کنی.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 4 - costs */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>این خیالپردازی‌ها چه هزینه‌ای داشت؟</Text>
                <Text style={styles.p}>
                  قرار نیست خودتو بکوبی.{"\n"}
                  فقط اثر واقعیِ خیال رو بنویس.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  مثلا: وقتم با این رابطه تلف شد یا فرصت‌هامو از دست دادم یا به اهدافم نرسیدم
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {costs.map((val, idx) => {
                  const len = trimLen(val);
                  return (
                    <View key={`c_${idx}`} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>{idx + 1}) فاصله‌ی واقعیت و خیال</Text>

                      <View style={styles.pairCard}>
                        <Text style={styles.pairLabel}>واقعیت:</Text>
                        <Text style={styles.pairText}>{String(realities[idx] || "").trim() || "—"}</Text>
                        <View style={{ height: 10 }} />
                        <Text style={styles.pairLabel}>خیال:</Text>
                        <Text style={styles.pairText}>{String(fantasies[idx] || "").trim() || "—"}</Text>
                      </View>

                      <TextInput
                        value={val}
                        onChangeText={(t) => setCost(idx, t)}
                        placeholder="این خیال چه هزینه‌ای داشت؟"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />

                      <Text style={[styles.small, !isReview && len < 3 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/3`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoCostsDone}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoCostsDone && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGoCostsDone ? <Text style={styles.warn}>باید برای هر ۵ مورد، یک هزینه‌ی کوتاه بنویسی.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 5 - final */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>جمع‌بندی نهایی</Text>
                <Text style={styles.p}>
                  این صفحه رو برای خودت نگه دار.{"\n"}
                  این‌ها واقعیت، خیال و هزینه‌رابطه تموم شده توئه.
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>واقعیت‌ها</Text>
                  {realities.map((t, i) => (
                    <View key={`rv_${i}`} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{String(t || "").trim() || "—"}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>خیال‌ها</Text>
                  {fantasies.map((t, i) => (
                    <View key={`fv_${i}`} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{String(t || "").trim() || "—"}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>هزینه‌ی خیال</Text>
                  {costs.map((t, i) => (
                    <View key={`cv_${i}`} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{String(t || "").trim() || "—"}</Text>
                    </View>
                  ))}
                </View>

                <Animated.View
                  style={[
                    { transform: [{ translateY: finalAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }], opacity: finalAnim },
                  ]}
                >
                  <View style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
                    <Text style={styles.noteTitle}>جمله‌ی پایانی من</Text>
                    <TextInput
                      ref={finalInputRef}
                      value={finalLine}
                      onChangeText={(t) => {
                        if (isReview) return;
                        setFinalLine(String(t || ""));
                      }}
                      placeholder="مثال: من از این به بعد با واقعیت جلو می‌رم، نه با خیال…"
                      placeholderTextColor="rgba(231,238,247,.35)"
                      multiline
                      style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                      textAlign="right"
                      textAlignVertical="top"
                      editable={!isReview}
                      selectTextOnFocus={!isReview}
                      onFocus={() => {
                        requestAnimationFrame(() => {
                          scrollRef.current?.scrollToEnd({ animated: true });
                        });
                      }}
                    />
                    <Text style={[styles.small, !isReview && trimLen(finalLine) < 10 ? { color: palette.red } : null]}>
                      {isReview ? "ثبت شده" : `${trimLen(finalLine)}/10`}
                    </Text>
                  </View>
                </Animated.View>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving || isReview}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={(!isReview && !canFinalize) || saving}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, (((!isReview && !canFinalize) || saving) && { opacity: 0.45 }) as any]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? (
                  <Text style={styles.warn}>برای ثبت نهایی باید همه‌ی بخش‌ها کامل باشد و جمله‌ی پایانی حداقل ۱۰ کاراکتر باشد.</Text>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ لودینگ ورود */}
      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال بارگذاری اطلاعات ذخیره‌شده…</Text>
          </View>
        </View>
      ) : null}

      {/* ✅ مودال هشدار قبل از قفل شدن */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت، این رو بدون"
        message="با زدن «ثبت و پایان»، این ریز‌اقدام قفل میشه و دیگر امکان تغییر متن‌ها رو نخواهی داشت."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلاً نه"
        loading={saving}
        onPrimary={() => {
          setConfirmLockModal(false);
          doFinalize();
        }}
        onSecondary={() => setConfirmLockModal(false)}
      />

      {/* ✅ مودال‌های تم برای خطا/موفقیت/اطلاع */}
      <ThemedModal
        visible={modal.visible}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        primaryText={modal.primaryText}
        secondaryText={modal.secondaryText}
        loading={modal.loading}
        onPrimary={() => {
          const fn = modal.onPrimary;
          if (fn) fn();
          else closeModal();
        }}
        onSecondary={() => {
          const fn = modal.onSecondary;
          if (fn) fn();
          else closeModal();
        }}
      />
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  glowTop: {
    position: "absolute",
    top: 0,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -30,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.glass2,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },
  headerSub: { color: "rgba(231,238,247,.85)", marginTop: 4, fontSize: 12, textAlign: "center" },

  reviewBanner: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.18)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  reviewBannerText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", flex: 1 },

  sectionCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 6,
  },

  stepPills: { flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  stepPillOn: { backgroundColor: "rgba(212,175,55,.12)", borderColor: "rgba(212,175,55,.28)" },
  stepPillText: { color: "rgba(231,238,247,.85)", fontWeight: "800", fontSize: 11, textAlign: "center" },

  h1: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center", lineHeight: 22 },
  p: { color: "rgba(231,238,247,.78)", marginTop: 8, textAlign: "right", lineHeight: 20, fontSize: 12 },
  small: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right" },
  warn: { color: "rgba(252,165,165,.95)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

  inputOne: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 18,
    textAlign: "right",
  },
  inputFinal: {
    marginTop: 10,
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 20,
    textAlign: "right",
  },
  inputReadOnly: {
    backgroundColor: "rgba(0,0,0,.12)",
    borderColor: "rgba(255,255,255,.08)",
  },

  pairCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
  },
  pairLabel: { color: "rgba(231,238,247,.72)", fontWeight: "900", fontSize: 11, textAlign: "right" },
  pairText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", marginTop: 6, lineHeight: 18 },

  reviewCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  reviewTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", marginBottom: 8 },
  bulletRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  bullet: { color: "rgba(231,238,247,.85)", fontSize: 14, lineHeight: 18 },
  bulletText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", flex: 1, lineHeight: 18 },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  primaryBtnText: { color: palette.bg, fontWeight: "900" },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryBtnText: { color: palette.text, fontWeight: "900" },

  bootOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  bootCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(3,7,18,.94)",
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  bootText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "center" },

  /* Modal */
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(3,7,18,.96)",
    padding: 16,
  },
  modalTitle: { color: palette.text, fontWeight: "900", fontSize: 14, textAlign: "right", flex: 1 },
  modalMsg: { color: "rgba(231,238,247,.82)", marginTop: 10, fontSize: 12, lineHeight: 18, textAlign: "right" },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  modalPrimaryText: { color: palette.bg, fontWeight: "900" },
  modalSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalSecondaryText: { color: palette.text, fontWeight: "900" },
});