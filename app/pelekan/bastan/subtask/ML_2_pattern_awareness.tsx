// app/pelekan/bastan/subtask/ML_2_pattern_awareness.tsx
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
  if (k === "ML_2_pattern_awareness") return "ریز اقدام دوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type RuminationKey =
  | "r_replay_convo"
  | "r_if_only"
  | "r_rebuild_texts"
  | "r_guess_intent"
  | "r_fantasy_return"
  | "r_compare_next"
  | "r_unanswered_why"
  | "r_convince_self"
  | "r_future_scenarios"
  | "r_self_blame"
  | "r_check_feelings"
  | "r_more_anxious"
  | "r_repeat_no_output"
  | "r_betray_self";

type InterruptToolKey =
  | "i_say_stop"
  | "i_change_posture"
  | "i_cold_water"
  | "i_breath_446"
  | "i_touch_object"
  | "i_wash_face"
  | "i_time_place"
  | "i_anchor_sentence";

type GroundKey =
  | "g_3_things_see"
  | "g_2_body_sense"
  | "g_here_now_sentence"
  | "g_30s_breath";

type AnchorKey = "a1" | "a2" | "a3" | "a4";

type ML2Saved = {
  version: 1;
  savedAt: string;

  acceptedTruth: boolean; // step1

  ruminationSigns: RuminationKey[]; // step2 (min 3)

  interruptTools: InterruptToolKey[]; // step3 (min 2)
  grounding: GroundKey | null; // step3 (required)
  anchor: AnchorKey | null; // step3 (required)

  agreeAntiRumination: boolean; // step4

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "ML_2_pattern_awareness";
const KEY_ML2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const RUMINATION_SIGNS: { key: RuminationKey; title: string; desc: string }[] = [
  { key: "r_replay_convo", title: "مرور مکرر یک مکالمه قدیمی", desc: "دیالوگ‌ها و صحنه‌ها مدام توو ذهنم تکرار میشه." },
  { key: "r_if_only", title: "«اگه اون روز اینو می‌گفتم...»", desc: "فکرهای شرطی که هیچ خروجی واقعی ندارد." },
  { key: "r_rebuild_texts", title: "بازسازی پیام‌ها یا چت‌ها", desc: "هی دوباره پیام‌ها رو مرور یا بازنویسی می‌کنم." },
  { key: "r_guess_intent", title: "حدس زدن نیت واقعی او", desc: "می‌خوام بفهمم «واقعا چی تو سرش بود»." },
  { key: "r_fantasy_return", title: "خیال‌پردازی درباره برگشت", desc: "سناریوی برگشت توو ذهنم می‌چینم، عذرخواهیش رو تصور می‌کنم، پیام دادنش رو خیال می‌کنم…" },
  { key: "r_compare_next", title: "مقایسه خودم با نفر بعدی", desc: "ذهنم وارد رقابت و مقایسه میشه." },
  { key: "r_unanswered_why", title: "سؤال‌های بی‌پاسخ «چرا؟»", desc: "چرا این کارو کرد؟ چرا من؟ چرا اون؟" },
  { key: "r_convince_self", title: "تلاش برای قانع کردن خودم", desc: "با فکر کردن می‌خوام احساس بدم رو حل کنم." },
  { key: "r_future_scenarios", title: "ساخت سناریوهای آینده", desc: "اگه فلان بشه، اگه دوباره ببینمش…" },
  { key: "r_self_blame", title: "سرزنش خودم بابت گذشته", desc: "مرور اشتباهات گذشته با تنبیه ذهنی." },
  { key: "r_check_feelings", title: "چک‌کردن احساساتم هر چند دقیقه یکبار", desc: "هی می‌پرسم الان بهتر شدم یا بدتر؟" },
  { key: "r_more_anxious", title: "فکرهایی که اضطراب رو بیشتر می‌کنه", desc: "بعدش خسته‌تر و آشفته‌تر میشم." },
  { key: "r_repeat_no_output", title: "تکرار یک نتیجه بدون تصمیم جدید", desc: "هی می‌رسم به همون نقطه، بدون خروجی عملی." },
  { key: "r_betray_self", title: "چسبیدن به فکرهایی که خودم رو له میکنه", desc: "میدونم بده ولی رهایش نمی‌کنم." },
];

const INTERRUPT_TOOLS: { key: InterruptToolKey; title: string; desc: string }[] = [
  { key: "i_say_stop", title: "با صدا بگم: «ایست. این نشخواره.»", desc: "دستور توقف، نه گفت‌وگو." },
  { key: "i_change_posture", title: "تغییر وضعیت بدن", desc: "بلند شدن، راه رفتن  و حرکات کششی کوتاه." },
  { key: "i_cold_water", title: "آب سرد", desc: "یه جرعه آب سرد بخورم  یا شستن دست‌ها و صورت با آب سرد." },
  { key: "i_breath_446", title: "تنفس ۴–۴–۶", desc: "۴ ثانیه دم، ۴ ثانیه مکث و ۶ ثانیه بازدم به مدت پنج دقیقه ." },
  { key: "i_touch_object", title: "لمس یک شیء واقعی", desc: "یک چیز مشخص رو لمس می‌کنم و اون رو توصیف می‌کنم." },
  { key: "i_wash_face", title: "انقباض و انبساط کامل بدنی", desc: "سه بار  کل بدنم رو سفت و شل میکنم" },
  { key: "i_time_place", title: "گفتن تاریخ و مکان", desc: "«امروز مثلا شنبه‌ست و من الان داخل اتاقم نشستم» برگشت به اکنون." },
  { key: "i_anchor_sentence", title: "تکرار جمله لنگر", desc: "جمله‌ای که برمیگردونه رو با خودت تکرار کن." },
];

const GROUNDINGS: { key: GroundKey; title: string; desc: string }[] = [
  { key: "g_3_things_see", title: "۳ چیزی که می‌بینم", desc: "سه چیز رو نام ببرم." },
  { key: "g_2_body_sense", title: "۲ حس بدنی که احساس می‌کنم", desc: "مثلاً گرما، فشار و تنفس." },
  { key: "g_here_now_sentence", title: "جمله‌ی بازگشت", desc: "«مثلا الان من اینجام، این فکر واقعیت زندگی من نیست.»" },
  { key: "g_30s_breath", title: "۳۰ ثانیه تمرکز روی نفس", desc: "فقط ۳۰ ثانیه." },
];

const ANCHORS: { key: AnchorKey; title: string; text: string }[] = [
  { key: "a1", title: "لنگر ۱ (واقعیت)", text: "این فکر نشخواره؛ من با واقعیتِ امروز کار می‌کنم." },
  { key: "a2", title: "لنگر ۲ (مرز)", text: "فکرِ بدون خروجی، حق نداره وقت من رو بخوره." },
  { key: "a3", title: "لنگر ۳ (تصمیم)", text: "اگر خروجی نداره، قطعش می‌کنم و برمی‌گردم." },
  { key: "a4", title: "لنگر ۴ (قدم بعدی)", text: "من نشخوار ذهنی رو ادامه نمی‌دم بجاش  من یک عمل کوتاه رو انجام می‌دم." },
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
export default function ML2PatternAwarenessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "الگوی قابل توقف (نشخوار فکری)";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedTruth, setAcceptedTruth] = useState(false);

  // Step 2
  const [ruminationSigns, setRuminationSigns] = useState<RuminationKey[]>([]);

  // Step 3
  const [interruptTools, setInterruptTools] = useState<InterruptToolKey[]>([]);
  const [grounding, setGrounding] = useState<GroundKey | null>(null);
  const [anchor, setAnchor] = useState<AnchorKey | null>(null);

  // Step 4
  const [agreeAntiRumination, setAgreeAntiRumination] = useState(false);

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

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_ML2_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as ML2Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedTruth(!!j.acceptedTruth);

    const rs = Array.isArray(j.ruminationSigns) ? (j.ruminationSigns as any[]) : [];
    setRuminationSigns(rs.filter(Boolean) as RuminationKey[]);

    const it = Array.isArray(j.interruptTools) ? (j.interruptTools as any[]) : [];
    setInterruptTools(it.filter(Boolean) as InterruptToolKey[]);

    const gr = (String(j.grounding || "") as GroundKey) || null;
    setGrounding(gr);

    const an = (String(j.anchor || "") as AnchorKey) || null;
    setAnchor(an);

    setAgreeAntiRumination(!!j.agreeAntiRumination);

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
        if (loaded) setStep(4); // مرور: مستقیم تعهد/جمع‌بندی
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

  /* ----------------------------- Pickers ----------------------------- */
  const toggleRumination = useCallback(
    (k: RuminationKey) => {
      if (isReview) return;
      setRuminationSigns((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const toggleInterrupt = useCallback(
    (k: InterruptToolKey) => {
      if (isReview) return;
      setInterruptTools((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const onPickGround = useCallback(
    (k: GroundKey) => {
      if (isReview) return;
      setGrounding(k);
    },
    [isReview]
  );

  const onPickAnchor = useCallback(
    (k: AnchorKey) => {
      if (isReview) return;
      setAnchor(k);
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const step1Ok = acceptedTruth;
  const step2Ok = ruminationSigns.length >= 3;
  const step3Ok = interruptTools.length >= 2 && !!grounding && !!anchor;
  const step4Ok = agreeAntiRumination;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;

  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Derived texts ----------------------------- */
  const selectedAnchorText = useMemo(() => {
    const f = ANCHORS.find((x) => x.key === anchor);
    return f?.text || "—";
  }, [anchor]);

  const selectedRuminationTitles = useMemo(() => {
    const set = new Set(ruminationSigns);
    return RUMINATION_SIGNS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [ruminationSigns]);

  const selectedInterruptTitles = useMemo(() => {
    const set = new Set(interruptTools);
    return INTERRUPT_TOOLS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [interruptTools]);

  const selectedGroundTitle = useMemo(() => {
    const f = GROUNDINGS.find((x) => x.key === grounding);
    return f?.title || "—";
  }, [grounding]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: ML2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedTruth: true,
      ruminationSigns: ruminationSigns || [],

      interruptTools: interruptTools || [],
      grounding: grounding || "g_here_now_sentence",
      anchor: anchor || "a1",

      agreeAntiRumination: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_ML2_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [ruminationSigns, interruptTools, grounding, anchor]);

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

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedTruth: true,

        ruminationCount: ruminationSigns.length,
        hasMinRumination: ruminationSigns.length >= 3,

        interruptToolsCount: interruptTools.length,
        hasMinInterruptTools: interruptTools.length >= 2,

        hasGrounding: !!grounding,
        hasAnchor: !!anchor,

        anchorText: selectedAnchorText,

        agreeAntiRumination,

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
  }, [
    apiBase,
    phone,
    token,
    ruminationSigns.length,
    interruptTools.length,
    grounding,
    anchor,
    selectedAnchorText,
    agreeAntiRumination,
    openModal,
    closeModal,
  ]);

  const doFinalize = useCallback(async () => {
    if (!canFinalize) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      const r = await completeOnServer();
      if (r === "fail") return;

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
      setStep(4);
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
        <Text style={styles.stepPillText}>۱) تشخیص</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) علامت‌ها</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) قطع + بازگشت</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) تعهد</Text>
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
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>اول تشخیص بده: «فکر»ه یا «نشخوار»؟</Text>
              <Text style={styles.p}>
                نشخوار یعنی یک فکر تکراری که:
                {"\n"}• اطلاعات جدید نداره
                {"\n"}• خروجی عملی نمی‌سازه
                {"\n"}• و فقط اضطراب رو بیشتر می‌کنه
                {"\n\n"}
                این ریزاقدام برای «حل کردن رابطه» نیست؛ برای «قطع کردن نشخوار»ه.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10, marginBottom: 10 }]}>
                <Text style={styles.noteTitle}>قانون</Text>
                <Text style={styles.small}>
                  اگه یک فکر ۳ بار تکرار شد و هیچ تصمیم یا عمل جدیدی نداشت، اون فکر نشخوار ذهنیه و باید قطع بشه.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setAcceptedTruth((x) => !x);
                }}
                style={[styles.choiceCard, acceptedTruth && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={acceptedTruth ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={acceptedTruth ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>قبول دارم: نشخوار رو «حل» نمی‌کنم بلکه «قطع»ش می‌کنم.</Text>
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
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>علامت‌های نشخوار فکری کدوم‌هاست؟</Text>
                <Text style={styles.p}>
                  فقط انتخاب کن. تحلیل نکن.
                  {"\n"}
                  انتخاب حداقل سه مورد لازمه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>چک‌لیست نشخوار (حداقل سه مورد)</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {RUMINATION_SIGNS.map((s) => {
                    const on = ruminationSigns.includes(s.key);
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => toggleRumination(s.key)}
                        disabled={isReview}
                        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{s.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{s.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                  {selectedRuminationTitles.length ? (
                    selectedRuminationTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل ۳ علامت رو انتخاب کن.</Text> : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, (!step2Ok || saving) && { opacity: 0.45 }]}
                    disabled={!step2Ok || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قطع فوری + بازگشت به واقعیت</Text>
                <Text style={styles.p}>
                  نشخوار با «فکر بهتر» قطع نمی‌شه.
                  {"\n"}
                  باید ابزار قطع داشته باشی، بعد یک حرکت کوتاه برای برگشت به اکنون انجام بدی.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>۱) ابزارهای قطع (حداقل ۲تا)</Text>
                <Text style={styles.small}>حداقل دو ابزار انتخاب کن تا وقتی نشخوار شروع شد، سریع اجراش کنی.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {INTERRUPT_TOOLS.map((s) => {
                    const on = interruptTools.includes(s.key);
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => toggleInterrupt(s.key)}
                        disabled={isReview}
                        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{s.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{s.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>ابزارهای انتخاب‌شده:</Text>
                  {selectedInterruptTitles.length ? (
                    selectedInterruptTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۲) بازگشت به واقعیت (یک مورد)</Text>
                <Text style={styles.small}>فقط یکی رو انتخاب کن؛ کوتاه و اجرایی.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {GROUNDINGS.map((x) => {
                    const on = grounding === x.key;
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => onPickGround(x.key)}
                        disabled={isReview}
                        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkmark-circle" : "ellipse-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{x.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!grounding ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، یک روش بازگشت انتخاب کن.</Text> : null}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۳) جمله لنگر (یک مورد)</Text>
                <Text style={styles.small}>این جمله، دکمه‌ی برگشت توست.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {ANCHORS.map((x) => {
                    const on = anchor === x.key;
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => onPickAnchor(x.key)}
                        disabled={isReview}
                        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkmark-circle" : "ellipse-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.exampleText, { marginTop: 6 }]}>{x.text}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!anchor ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، جمله لنگر رو انتخاب کن.</Text> : null}
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: حداقل ۲ ابزار قطع + انتخاب ۱ بازگشت + انتخاب ۱ لنگر لازم است.
                </Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!step3Ok || saving) && { opacity: 0.45 }]}
                    disabled={!step3Ok || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>تعهد ضدنشخوار</Text>
                <Text style={styles.p}>
                  اینجا «قفل» می‌کنی که نشخوار رو بر نگردونی.
                  {"\n\n"}
                  خلاصه انتخاب‌های تو:
                  {"\n"}• علامت‌ها: {ruminationSigns.length}
                  {"\n"}• ابزار قطع: {interruptTools.length}
                  {"\n"}• بازگشت: {selectedGroundTitle}
                  {"\n"}• لنگر: {selectedAnchorText}
                </Text>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>قانون شخصی نشخوار</Text>
                  <Text style={styles.small}>
                    وقتی نشخوار شروع شد:
                    {"\n"}۱) زود تشخیصش بده
                    {"\n"}۲) به شکل فوری قطعش کن
                    {"\n"}۳) بلافاصله به واقعیت واکنون برگرد
                    {"\n"}۴) و جمله لنگر رو چند بار با خودت تکرار کن
                  </Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeAntiRumination((x) => !x);
                      }}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        agreeAntiRumination && styles.choiceCardOn,
                        isReview && { opacity: 0.7 },
                        { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                      ]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeAntiRumination ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeAntiRumination ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>
                          تعهد می‌دم: نشخوار رو «حل» نکنم بلکه «قطع»ش کنم و به این فکر برنگردم.
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {!step4Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: تعهد باید تیک بخوره.</Text> : null}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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
                {isReview ? <Text style={styles.small}>در حالت مرور، فقط نمایش است و امکان ادیت نداری.</Text> : null}
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

  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },

  choiceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  choiceCardOn: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },
  choiceText: { color: palette.text, fontWeight: "800", fontSize: 13, textAlign: "right", lineHeight: 18, flex: 1 },

  dangerCard: {
    borderWidth: 1,
    borderColor: "rgba(252,165,165,.22)",
    backgroundColor: "rgba(252,165,165,.04)",
    borderRadius: 18,
    padding: 14,
  },
  dangerTitle: { color: "rgba(252,165,165,.95)", fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

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

  exampleText: {
    marginTop: 8,
    color: "rgba(231,238,247,.82)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    flexShrink: 1,
  },

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