// app/pelekan/bastan/subtask/TD_4_if_then_plan.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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
  if (k === "TD_4_if_then_plan") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type RulePresetKey = "p1" | "p2" | "p3" | "p4" | "p5" | "custom";

type TD4Saved = {
  version: 1;
  savedAt: string;
  acceptedWhy: boolean;

  // core
  presetKey: RulePresetKey;
  ruleText: string;

  altKey: string; // preset id or "custom"
  altText: string;

  // commitment
  commit7Days: boolean;
  agreeBrainNotTrusted: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "TD_4_if_then_plan";
const KEY_TD4_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const RULE_PRESETS: { key: RulePresetKey; title: string; text: string }[] = [
  {
    key: "p1",
    title: "قانون ۱۰ دقیقه",
    text: "وقتی موج ناراحتی میاد، تا ۱۰ دقیقه هیچ تصمیمی نمی‌گیرم. فقط زمان می‌خرم.",
  },
  {
    key: "p2",
    title: "قانون «اول پناهگاه»",
    text: "وقتی وسوسه‌ی چک کردن یا پیام دادن میاد، اول می‌رم تب «پناهگاه» و تکنیک ضدوسوسه اونجا رو انجام می‌دم.",
  },
  {
    key: "p3",
    title: "قانون قطع دسترسی",
    text: "وقتی موج ناراحتی میاد، گوشی رو سریع از دسترس خارج می‌کنم مثلا سریع اون رو خاموش میکنم.",
  },
  {
    key: "p4",
    title: "قانون ۹۰ ثانیه",
    text: "وقتی موج ناراحتی میاد، ۹۰ ثانیه فقط نفس عمیق می‌کشم و بعد دوباره تصمیم می‌گیرم.",
  },
  {
    key: "p5",
    title: "قانون «یک نفر»",
    text: "وقتی موج ناراحتی میاد، به‌جای تماس با اکسم یا چک کردنش، فقط به یک نفر امن پیام می‌دم یا باهاش تماس می‌گیرم یا داخل تب پناه به پشتیبان پیام میدم.",
  },
  { key: "custom", title: "خودم می‌نویسم", text: "" },
];

type AltPreset = { key: string; title: string; desc: string };
const ALT_PRESETS: AltPreset[] = [
  { key: "breath_3m", title: "تنفس ۳ دقیقه‌ای", desc: "۳ دقیقه نفس عمیق (آهسته و پیوسته)." },
  { key: "walk_6m", title: "راه رفتن ۶ دقیقه‌ای", desc: "بدون موبایل، فقط حرکت." },
  { key: "water", title: "دوش کوتاه یا شستن با آب", desc: " شستن صورت یا دوش کوتاه برای قطع موج." },
  { key: "write_3", title: "۳ خط نوشتن", desc: "فقط ۳ خط: چی شد؟ چی می‌خوام؟ الان چیکار می‌کنم؟" },
  { key: "safe_tab", title: "رفتن به «پناهگاه»", desc: "مستقیم برو تب پناهگاه و تکنیک ضدوسوسه." },
  { key: "custom", title: " خودم می‌نویسم", desc: "" },
];

/* ----------------------------- Themed Modal ----------------------------- */
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

/* ----------------------------- Screen ----------------------------- */
export default function TD4IfThenPlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "برنامه مواجهه با محرک‌ها";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..5
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedWhy, setAcceptedWhy] = useState(false);

  // Step 2
  const [presetKey, setPresetKey] = useState<RulePresetKey>("p1");
  const [ruleText, setRuleText] = useState<string>(RULE_PRESETS.find((x) => x.key === "p1")?.text || "");

  // Step 3
  const [altKey, setAltKey] = useState<string>("breath_3m");
  const [altText, setAltText] = useState<string>(ALT_PRESETS.find((x) => x.key === "breath_3m")?.title || "تنفس ۳ دقیقه‌ای");

  // Step 4
  const [commit7Days, setCommit7Days] = useState(false);
  const [agreeBrainNotTrusted, setAgreeBrainNotTrusted] = useState(false);

  // Modals
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

  const trimLen = (s: string) => String(s || "").trim().length;

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_TD4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as TD4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedWhy(!!j.acceptedWhy);

    const pk = (String(j.presetKey || "p1") as RulePresetKey) || "p1";
    setPresetKey(pk);
    setRuleText(String(j.ruleText || ""));

    setAltKey(String(j.altKey || "breath_3m"));
    setAltText(String(j.altText || ""));

    setCommit7Days(!!j.commit7Days);
    setAgreeBrainNotTrusted(!!j.agreeBrainNotTrusted);

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
        if (loaded) setStep(5); // در مرور: مستقیم جمع‌بندی
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

  /* ----------------------------- Smooth scroll on step ----------------------------- */
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

  /* ----------------------------- Step 2 helpers ----------------------------- */
  const onPickPreset = useCallback(
    (k: RulePresetKey) => {
      if (isReview) return;
      setPresetKey(k);
      const found = RULE_PRESETS.find((x) => x.key === k);
      if (k === "custom") {
        // keep existing ruleText if user already typed something
        if (trimLen(ruleText) < 1) setRuleText("");
      } else {
        setRuleText(String(found?.text || ""));
      }
    },
    [isReview, ruleText]
  );

  const onRuleTextChange = useCallback(
    (t: string) => {
      if (isReview) return;
      setRuleText(String(t || ""));
      // اگر کاربر دستی نوشت، منطقیه preset رو custom کنیم (بدون تغییر اجباری)
      if (presetKey !== "custom") setPresetKey("custom");
    },
    [isReview, presetKey]
  );

  /* ----------------------------- Step 3 helpers ----------------------------- */
  const onPickAlt = useCallback(
    (k: string) => {
      if (isReview) return;
      setAltKey(k);
      const f = ALT_PRESETS.find((x) => x.key === k);
      if (k === "custom") {
        if (trimLen(altText) < 1) setAltText("");
      } else {
        setAltText(String(f?.title || ""));
      }
    },
    [altText, isReview]
  );

  const onAltTextChange = useCallback(
    (t: string) => {
      if (isReview) return;
      setAltText(String(t || ""));
      if (altKey !== "custom") setAltKey("custom");
    },
    [altKey, isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const ruleOk = useMemo(() => trimLen(ruleText) >= 10, [ruleText]);
  const altOk = useMemo(() => trimLen(altText) >= 6, [altText]);
  const commitOk = useMemo(() => commit7Days && agreeBrainNotTrusted, [commit7Days, agreeBrainNotTrusted]);

  const canGo2 = acceptedWhy;
  const canGo3 = acceptedWhy && ruleOk;
  const canGo4 = acceptedWhy && ruleOk && altOk;
  const canGo5 = acceptedWhy && ruleOk && altOk && commitOk;
  const canFinalize = canGo5;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: TD4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      acceptedWhy: true,
      presetKey,
      ruleText: String(ruleText || ""),
      altKey: String(altKey || ""),
      altText: String(altText || ""),
      commit7Days: true,
      agreeBrainNotTrusted: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_TD4_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [altKey, altText, presetKey, ruleText]);

  /* ----------------------------- Server submit (ONLY completion) ----------------------------- */
  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام شدن باید وارد حساب باشی",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    // ✅ فقط متادیتا (بدون متن‌های حساس)
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedWhy: true,
        hasRule: ruleOk,
        hasAlt: altOk,
        committed: commitOk,
        durationSec,
      },
    };

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        phone: p,
        subtaskKey: SUBTASK_KEY,
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
      message: faOnlyTitle(err || "مشکلی پیش آمد"),
      primaryText: "باشه",
      onPrimary: closeModal,
    });
    return "fail";
  }, [altOk, apiBase, closeModal, commitOk, openModal, phone, ruleOk, token]);

  const doFinalize = useCallback(async () => {
    if (!canFinalize) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) server
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) local
      await persistFinalLocal();

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلا ثبت شده",
          message: "این ریز اقدام قبلا ثبت شده و نیازی به ثبت دوباره نیست",
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
        message: "این ریز اقدام قفل شد و قابل تغییر نیست",
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
    setConfirmLockModal(true);
  }, [isReview, router]);

  /* ----------------------------- Step Pills ----------------------------- */
  const StepPills = (
    <View style={styles.stepPills}>
      <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۱) منطق</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) قانون</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) جایگزین</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) تعهد</Text>
      </View>
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵) پایان</Text>
      </View>
    </View>
  );

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
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور فعال است: می‌تونی مراحل رو ببینی ولی قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {StepPills}

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قانون کنترل تکانه</Text>
                <Text style={styles.p}>
                  مشکل این نیست که «نمی‌فهمی چی درسته».
                  {"\n"}مشکل اینه که وقتی موج میاد، مغز تصمیم‌گیری دقیق نداره.
                  {"\n\n"}اینجا قرار نیست با موج بجنگی.
                  {"\n"}فقط قرارِ یک قانون از پیش‌تعیین‌شده داشته باشی که در لحظه‌ی موج ناراحتی، جای تو تصمیم بگیره.
                  {"\n\n"}پس:
                  {"\n"}۱) یک قانون ساده انتخاب می‌کنی
                  {"\n"}۲) یک رفتار جایگزین ثابت انتخاب می‌کنی
                  {"\n"}۳) برای ۷ روز انجامش می‌دی
                  {"\n"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptedWhy((x) => !x);
                  }}
                  style={[styles.choiceCard, acceptedWhy && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptedWhy ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptedWhy ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم در «لحظه موج» تصمیم‌گیری‌ام قابل اعتماد نیست و باید از قانون اطاعت کنم</Text>
                  </View>
                </Pressable>

                <View style={{ height: 12 }} />

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGo2}
                  onPress={() => {
                    if (!isReview && !startedAtRef.current) startedAtRef.current = Date.now();
                    setStep(2);
                  }}
                  style={[styles.primaryBtn, !canGo2 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>ادامه</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قانون تو (فقط یک قانون)</Text>
                <Text style={styles.p}>
                  یک قانون انتخاب کن که در لحظه‌ی موج ناراحتی، جای تو تصمیم بگیره.
                  {"\n"}قانون باید کوتاه، قابل اجرا و بی چون و چرا باشه.
                  {"\n\n"}نکته: اگر می‌خوای خودت بنویسی، «خودم می‌نویسم» رو انتخاب کن.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {RULE_PRESETS.map((r) => {
                  const on = presetKey === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => onPickPreset(r.key)}
                      disabled={isReview}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.choiceText}>{r.title}</Text>
                          {r.key !== "custom" ? <Text style={styles.small}>{r.text}</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }, isReview && { opacity: 0.95 }]}>
                <Text style={styles.noteTitle}>متن قانون</Text>
                <TextInput
                  value={ruleText}
                  onChangeText={onRuleTextChange}
                  placeholder="مثال: وقتی موج میاد، ۱۰ دقیقه هیچ تصمیمی نمی‌گیرم و فقط زمان می‌خرم."
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  multiline
                />
                <Text style={[styles.small, !isReview && !ruleOk ? { color: palette.red } : null]}>
                  {isReview ? "ثبت شده" : `${trimLen(ruleText)}/10`}
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo3 || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo3 ? <Text style={styles.warn}>برای رفتن به مرحله بعد، متن قانون باید حداقل ۱۰ کاراکتر داشته باشد.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>رفتار جایگزین ثابت</Text>
                <Text style={styles.p}>
                  وقتی موج ناراحتی میاد، «فکر کردن» خطرناکه.
                  {"\n"}پس باید یک رفتار ساده داشته باشی که بدون بحث انجامش بدی.
                  {"\n\n"}یک گزینه رو انتخاب کن یا خودت اونو بنویس.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {ALT_PRESETS.map((a) => {
                  const on = altKey === a.key;
                  return (
                    <Pressable
                      key={a.key}
                      onPress={() => onPickAlt(a.key)}
                      disabled={isReview}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.choiceText}>{a.title}</Text>
                          {a.key !== "custom" ? <Text style={styles.small}>{a.desc}</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }, isReview && { opacity: 0.95 }]}>
                <Text style={styles.noteTitle}>متن رفتار جایگزین</Text>
                <TextInput
                  value={altText}
                  onChangeText={onAltTextChange}
                  placeholder="مثال: ۶ دقیقه راه می‌رم بدون موبایل."
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  multiline
                />
                <Text style={[styles.small, !isReview && !altOk ? { color: palette.red } : null]}>
                  {isReview ? "ثبت شده" : `${trimLen(altText)}/6`}
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo4 || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo4 ? <Text style={styles.warn}>برای رفتن به مرحله بعد، رفتار جایگزین باید حداقل ۶ کاراکتر داشته باشد.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قفل تعهد (۷ روز)</Text>
                <Text style={styles.p}>
                  اینجا «تمرین ذهنی» نیست.
                  {"\n"}این یک قرارداد رفتاریه: توو ۷ روز آینده، قانونی که انتخاب کردی باید اجرا بشه حتی اگر مغزت گفت «این بار فرق داره».
                  {"\n\n"}دو مورد زیر رو تیک بزن تا قفل فعال بشه.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setCommit7Days((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, commit7Days && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={commit7Days ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={commit7Days ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>تعهد می‌دم این قانون رو به مدت ۷ روز، بدون چونه‌زنی اجرا کنم</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeBrainNotTrusted((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, agreeBrainNotTrusted && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeBrainNotTrusted ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeBrainNotTrusted ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم در «لحظه موج»، مغزم بهانه‌ساز می‌شه و من باید از قانون اطاعت کنم</Text>
                  </View>
                </Pressable>

                <View style={[styles.pairCard, { marginTop: 2 }]}>
                  <Text style={styles.pairLabel}>قانون تو:</Text>
                  <Text style={styles.pairText}>{String(ruleText || "").trim() || "—"}</Text>
                  <View style={{ height: 10 }} />
                  <Text style={styles.pairLabel}>رفتار جایگزین:</Text>
                  <Text style={styles.pairText}>{String(altText || "").trim() || "—"}</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo5 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo5 || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo5 ? <Text style={styles.warn}>برای رفتن به مرحله بعد، هر دو تعهد باید تیک بخوره.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  از این به بعد، وقتی موج ناراحتی میاد:
                  {"\n"}۱) بحث نمی‌کنی
                  {"\n"}۲) تصمیم نمی‌گیری
                  {"\n"}۳) فقط «قانون» رو اجرا می‌کنی
                  {"\n\n"}این یعنی تو موج رو «تأیید» نمی‌کنی؛ فقط ازش عبور می‌کنی.
                  {"\n\n"}قانون تو:
                  {"\n"}{String(ruleText || "").trim() || "—"}
                  {"\n\n"}رفتار جایگزین تو:
                  {"\n"}{String(altText || "").trim() || "—"}
                  {"\n"}
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={saving || (!isReview && !canFinalize)}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه مراحل باید کامل بشه.</Text> : null}

                {isReview ? (
                  <Text style={styles.small}>نکته: در حالت مرور، می‌تونی با «بازگشت» مراحل ۲ تا ۴ رو ببینی. فقط ادیت قفله.</Text>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Booting */}
      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال بارگذاری اطلاعات ذخیره‌شده…</Text>
          </View>
        </View>
      ) : null}

      {/* Confirm lock */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت، این رو بدون"
        message="با زدن «ثبت و پایان»، این ریز اقدام قفل میشه و دیگه امکان تغییر وجود نداره."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلا نه"
        loading={saving}
        onPrimary={() => {
          setConfirmLockModal(false);
          doFinalize();
        }}
        onSecondary={() => setConfirmLockModal(false)}
      />

      {/* Result modal */}
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
  small: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right", lineHeight: 18 },
  warn: { color: "rgba(252,165,165,.95)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  choiceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  choiceCardOn: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },
  choiceText: { color: palette.text, fontWeight: "800", fontSize: 13, textAlign: "right", lineHeight: 18, flex: 1 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

  inputFinal: {
    marginTop: 10,
    minHeight: 84,
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