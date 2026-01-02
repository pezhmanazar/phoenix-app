// app/pelekan/bastan/subtask/ML_1_what_did_i_learn.tsx
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
  if (k === "ML_1_what_did_i_learn") return "ریز اقدام اول";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type LessonKey =
  | "l_boundaries"
  | "l_early_red_flags"
  | "l_self_respect"
  | "l_values_mismatch"
  | "l_attachment_trigger"
  | "l_people_pleasing"
  | "l_need_validation"
  | "l_conflict_style"
  | "l_emotional_addiction"
  | "l_communication"
  | "l_consistency"
  | "l_reciprocity"
  | "l_trust_actions"
  | "l_aftercare";

type LineKey =
  | "s1_line_1"
  | "s1_line_2"
  | "s2_line_1"
  | "s2_line_2"
  | "s3_line_1"
  | "s3_line_2"
  | "s4_line_1"
  | "s4_line_2"
  | "s5_line_1"
  | "s5_line_2"
  | "s6_line_1"
  | "s6_line_2";

type AnchorKey = "a1" | "a2" | "a3" | "a4";

type ML1Saved = {
  version: 1;
  savedAt: string;

  acceptedTruth: boolean; // step1

  ownLessonsText: string; // step2 (required)

  lessons: LessonKey[]; // step3 (min 6) — checklist is 12+
  lines: LineKey[]; // step3 (min 5)
  anchor: AnchorKey | null; // step3 (required)

  agreeNoRumination: boolean; // step4
  agreeNoIdealization: boolean; // step4
  agreeNoSelfBlameLoop: boolean; // step4
  agreeActOnLearning: boolean; // step4

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "ML_1_what_did_i_learn";
const KEY_ML1_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
/** ✅ چک‌لیست درس‌ها: 14 مورد */
const LESSONS: { key: LessonKey; title: string; desc: string }[] = [
  { key: "l_boundaries", title: "مرزها داخل رابطه دیر گفته شد", desc: "من دیر مرز گذاشتم یا مرزها رو جدی نگرفتم (مثل نه گفتن، محدودیت‌های رابطه و قوانین شفافیت)." },
  { key: "l_early_red_flags", title: "خط‌های قرمز اوایل رابطه نادیده گرفته شد", desc: "اول رابطه نشانه‌های واضحی بود، ولی بخاطر امید، هیجان و ترس اون‌هارو نادیده گرفتم." },
  { key: "l_self_respect", title: "کاهش احترام به خود", desc: "برای نگه داشتن رابطه از عزت‌نفسم خرج کردم (مثلا اجازده دادم تحقیرم کنه، بهش التماس کردم، بیش از حد تحمل کردم)." },
  { key: "l_values_mismatch", title: "ناسازگاری ارزش‌ها", desc: "خواسته‌های بنیادی، هدف‌ها و نگاه به زندگیمون هم‌راستا نبود." },
  { key: "l_attachment_trigger", title: "فعال شدن سبک دلبستگی", desc: "ترس از رهاشدن، چسبندگی و کنترل یا اجتناب، تصمیم‌هام رو هدایت کرد." },
  { key: "l_people_pleasing", title: "خشنودسازی دیگران", desc: "برای تایید گرفتن، خودم رو کوچک کردم یا نقش بازی کردم." },
  { key: "l_need_validation", title: "وابستگی به تایید", desc: "تایید اون برام معیار ارزشمندی شد (نه معیارهای خودم)." },
  { key: "l_conflict_style", title: "سبک دعوا و حل تعارض غلط بود", desc: "یا فرار کردیم یا رفتار انفجاری داشتیم و مهارت گفت‌وگوی بالغ نداشتیم." },
  { key: "l_emotional_addiction", title: "اعتیاد هیجانی", desc: "بالا و پایین‌های هیجانی رو به اشتباه به عنوان عشق تلقی کردم." },
  { key: "l_communication", title: "ارتباط شفاف نبود", desc: "خواسته‌هام رو واضح نگفتم یا از گفتن حقیقت ترسیدم." },
  { key: "l_consistency", title: "حرفاش قشنگ بود ولی ثبات رفتاری نداشت", desc: "کلمات قشنگ بدون ثبات و تکرار رفتار، امنیت نمی‌ساره." },
  { key: "l_reciprocity", title: "تعادل دادن و گرفتن", desc: "من بیشتر می‌دادم و کمتر می‌گرفتم (رابطه یک‌طرفه)." },
  { key: "l_trust_actions", title: "اعتماد با عمل ساخته میشه", desc: "وعده یا قسم کافی نیست؛ باید در عمل نشونه‌های پایدار دیده بشه." },
  { key: "l_aftercare", title: "بعد از جدایی باید مراقبت فعال داشت", desc: "رها کردن خودم بعد از جدایی، درد رو طولانی‌تر میکنه." },
];

type LineGroup = "identity" | "selection" | "pattern" | "future" | "selfcare" | "reality";

const LINES: {
  key: LineKey;
  group: LineGroup;
  title: string;
  text: string;
  note?: string;
}[] = [
  { key: "s1_line_1", group: "identity", title: "من ارزشم رو از رابطه نمی‌گیرم", text: "ارزش من وابسته به موندن یا رفتنِ کسی نیست." },
  { key: "s1_line_2", group: "identity", title: "من مسئول خودم هستم", text: "من مسئول ترمیم خودم هستم، نه مسئول تعمیر کردنِ آدم اشتباه." },

  { key: "s2_line_1", group: "selection", title: "انتخاب با معیارهای روشن", text: "از این به بعد انتخاب‌هام بر اساس معیارهای روشنه، نه بر اساس هیجان لحظه‌ای." },
  { key: "s2_line_2", group: "selection", title: "حرف کافی نیست", text: "با حرف قانع نمیشم و ثبات رفتاری معیار منه." },

  { key: "s3_line_1", group: "pattern", title: "خط قرمز یعنی توقف", text: "وقتی عبور از خط قرمز دیدم، نمی‌جنگم برای توجیهش؛ مکث می‌کنم و فاصله می‌گیرم." },
  { key: "s3_line_2", group: "pattern", title: "نه گفتن تمرین منه", text: "نه گفتن رو تمرین می‌کنم، حتی اگه خوشایند نباشه." },

  { key: "s4_line_1", group: "future", title: "مرز قبل از وابستگی", text: "مرزها رو قبل از عادت و وابستگی می‌گذارم، نه بعد از آسیب." },
  { key: "s4_line_2", group: "future", title: "عشق سالم = آرامش + احترام", text: "عشق سالم باید آرامش و احترام بیاره، نه اضطراب و تحقیر." },

  { key: "s5_line_1", group: "selfcare", title: "مراقبت فعال", text: "وقتی دردم میاد، خودم رو رها نمی‌کنم بلکه از خودم مراقبت فعال می‌کنم." },
  { key: "s5_line_2", group: "selfcare", title: "کمک گرفتن، نشونه ضعف نیست", text: "کمک گرفتن یعنی جدی گرفتنِ زندگی خودم." },

  { key: "s6_line_1", group: "reality", title: "واقعیت رو می‌پذیرم", text: "با خیالِ برگشتن زندگی نمی‌کنم؛ با واقعیتِ امروز برنامه می‌ریزم." },
  { key: "s6_line_2", group: "reality", title: "به خودم خیانت نمی‌کنم", text: "برای ترس از تنهایی، به خودم خیانت نمی‌کنم." },
];

const ANCHORS: { key: AnchorKey; title: string; text: string }[] = [
  { key: "a1", title: "لنگر ۱ (واقعیت)", text: "من با واقعیت زندگی می‌کنم، نه با امیدِ بی‌پایه." },
  { key: "a2", title: "لنگر ۲ (عزت‌نفس)", text: "هیچ رابطه‌ای ارزش له شدنِ من رو نداره." },
  { key: "a3", title: "لنگر ۳ (معیار)", text: "ثبات رفتار و آرامش در رابطه، معیارِ عشقه." },
  { key: "a4", title: "لنگر ۴ (قدم بعدی)", text: "من از این درد، یک درسِ عملی می‌سازم." },
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
    kind === "success" ? "checkmark-circle" : kind === "warn" ? "warning" : kind === "info" ? "information-circle" : "alert-circle";

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
export default function ML1WhatDidILearnScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "از این رابطه چی یاد گرفتم؟";

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

  // Step 2 (NEW)
  const [ownLessonsText, setOwnLessonsText] = useState("");

  // Step 3
  const [lessons, setLessons] = useState<LessonKey[]>([]);
  const [lines, setLines] = useState<LineKey[]>([]);
  const [anchor, setAnchor] = useState<AnchorKey | null>(null);

  // Step 4
  const [agreeNoRumination, setAgreeNoRumination] = useState(false);
  const [agreeNoIdealization, setAgreeNoIdealization] = useState(false);
  const [agreeNoSelfBlameLoop, setAgreeNoSelfBlameLoop] = useState(false);
  const [agreeActOnLearning, setAgreeActOnLearning] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_ML1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as ML1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedTruth(!!j.acceptedTruth);
    setOwnLessonsText(String(j.ownLessonsText || ""));

    const ls = Array.isArray(j.lessons) ? (j.lessons as any[]) : [];
    setLessons(ls.filter(Boolean) as LessonKey[]);

    const ln = Array.isArray(j.lines) ? (j.lines as any[]) : [];
    setLines(ln.filter(Boolean) as LineKey[]);

    const an = (String(j.anchor || "") as AnchorKey) || null;
    setAnchor(an);

    setAgreeNoRumination(!!j.agreeNoRumination);
    setAgreeNoIdealization(!!j.agreeNoIdealization);
    setAgreeNoSelfBlameLoop(!!j.agreeNoSelfBlameLoop);
    setAgreeActOnLearning(!!j.agreeActOnLearning);

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
        if (loaded) setStep(4); // مرور: مستقیم جمع‌بندی
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
  const toggleLesson = useCallback(
    (k: LessonKey) => {
      if (isReview) return;
      setLessons((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const toggleLine = useCallback(
    (k: LineKey) => {
      if (isReview) return;
      setLines((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
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

  // NEW: حداقل 2 خط یا 60 کاراکتر، تا “واقعاً نوشتن” رخ بده
  const ownLessonsTrim = useMemo(() => String(ownLessonsText || "").trim(), [ownLessonsText]);
  const ownLessonsLinesCount = useMemo(() => ownLessonsTrim.split("\n").map((x) => x.trim()).filter(Boolean).length, [ownLessonsTrim]);
  const step2Ok = ownLessonsTrim.length >= 60 || ownLessonsLinesCount >= 2;

  const step3Ok = lessons.length >= 6 && lines.length >= 5 && !!anchor;

  const step4Ok = agreeNoRumination && agreeNoIdealization && agreeNoSelfBlameLoop && agreeActOnLearning;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;

  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedLessonTitles = useMemo(() => {
    const set = new Set(lessons);
    return LESSONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [lessons]);

  const selectedLines = useMemo(() => {
    const set = new Set(lines);
    return LINES.filter((x) => set.has(x.key)).map((x) => ({ title: x.title, text: x.text }));
  }, [lines]);

  const selectedAnchorText = useMemo(() => {
    const f = ANCHORS.find((x) => x.key === anchor);
    return f?.text || "—";
  }, [anchor]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: ML1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedTruth: true,
      ownLessonsText: ownLessonsTrim,

      lessons: lessons || [],
      lines: lines || [],
      anchor: anchor || "a1",

      agreeNoRumination: true,
      agreeNoIdealization: true,
      agreeNoSelfBlameLoop: true,
      agreeActOnLearning: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_ML1_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [ownLessonsTrim, lessons, lines, anchor]);

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

        ownLessonsText: ownLessonsTrim,
        ownLessonsChars: ownLessonsTrim.length,
        ownLessonsLines: ownLessonsLinesCount,

        lessonsCount: lessons.length,
        hasMinLessons: lessons.length >= 6,

        linesCount: lines.length,
        hasMinLines: lines.length >= 5,

        hasAnchor: !!anchor,

        agreeNoRumination,
        agreeNoIdealization,
        agreeNoSelfBlameLoop,
        agreeActOnLearning,

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
    ownLessonsTrim,
    ownLessonsLinesCount,
    lessons.length,
    lines.length,
    anchor,
    agreeNoRumination,
    agreeNoIdealization,
    agreeNoSelfBlameLoop,
    agreeActOnLearning,
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
        <Text style={styles.stepPillText}>۱) جهت‌گیری</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) درس‌های خودم</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) چک‌لیست</Text>
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
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>این کار «خاطره‌گویی» نیست؛  بلکه درس‌سازیه.</Text>
                <Text style={styles.p}>
                  اگه از این رابطه فقط «درد» بمونه، مغز تو هر بار دوباره می‌سازدش و دوباره می‌شکندت.
                  {"\n\n"}
                  اما اگه از این رابطه «یادگیری عملی» بسازی، درد تبدیل میشه به مرز، معیار و انتخاب‌های بهتر.
                  {"\n\n"}
                  ترتیب درست:
                  {"\n"}• اول «تو می‌نویسی» که چی یاد گرفتی
                  {"\n"}• بعد چک‌لیست بهت کمک می‌کنه چیزهایی که یادت نمیاد رو پیدا کنی
                </Text>

                <View style={[styles.noteCard, { marginTop: 10, marginBottom: 10 }]}>
                  <Text style={styles.noteTitle}>قانون</Text>
                  <Text style={styles.small}>
                    یادگیری وقتی واقعیه که «قابل اجرا» باشه.
                    {"\n"}
                    یعنی بتونی بگی: «از این به بعد، این کار رو می‌کنم و این کار رو نمی‌کنم».
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
                    <Text style={styles.choiceText}>قبول دارم: هدفم «یادگیری عملی»ه، نه تکرارِ قصه و مقصرسازی</Text>
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

          {/* ----------------------------- Step 2 (NEW) ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>اول «تو» بنویس: از این رابطه چی یاد گرفتی؟</Text>
                <Text style={styles.p}>
                  این قسمت مهم‌ترین بخشه.
                  {"\n"}
                  قبل از چک‌لیست، باید از ذهن خودت بیرون بکشی:
                  {"\n"}• چه الگوهایی تکرار شد؟
                  {"\n"}• تو کجا از خودت گذشتی؟
                  {"\n"}• دفعه بعد چی رو «زودتر» می‌فهمی؟
                  {"\n\n"}
                  حداقل: ۲ خط بنویس.
                </Text>

                <View style={[styles.noteCard, { marginTop: 10 }]}>
                  <Text style={styles.noteTitle}>فرمت پیشنهادی</Text>
                  <Text style={styles.small}>
                    هر خط یک درس عملی:
                    {"\n"}مثال:
                    {"\n"}• «اگر داخل رابطه ثبات نبود، دیگه ادامه نمی‌دم.»
                    {"\n"}• «مرز رو داخل رابطه قبل از ایجاد وابستگی می‌ذارم.»
                  </Text>
                </View>

                <View style={{ marginTop: 12 }}>
                  <TextInput
                    value={ownLessonsText}
                    onChangeText={(t) => {
                      if (isReview) return;
                      setOwnLessonsText(t);
                    }}
                    editable={!isReview}
                    placeholder="اینجا بنویس… (هر خط یک درس)"
                    placeholderTextColor="rgba(231,238,247,.35)"
                    multiline
                    textAlign="right"
                    style={[styles.input, isReview && { opacity: 0.75 }]}
                  />
                  <View style={[styles.pairCard, { marginTop: 10 }]}>
                    <Text style={styles.pairLabel}>وضعیت:</Text>
                    <Text style={styles.pairText}>
                      • خط‌ها: {ownLessonsLinesCount || 0}{"\n"}• کاراکتر: {ownLessonsTrim.length || 0}
                    </Text>
                  </View>

                  {!step2Ok ? (
                    <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه باید واقعاً بنویسی (حداقل ۲ خط یا ۶۰ کاراکتر).</Text>
                  ) : null}
                </View>
              </View>

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
                <Text style={styles.h1}>حالا این چک‌لیست فقط یک یادآوره</Text>
                <Text style={styles.p}>
                  کاری که همین الان کردی، «درس‌سازی» بود.
                  {"\n"}
                  این چک‌لیست کمک می‌کنه چیزهایی که جا افتاده رو پیدا کنی.
                  {"\n\n"}
                  قوانین:
                  {"\n"}• حداقل شش مورد از درس‌ها رو انتخاب کن.
                  {"\n"}• حداقل پنج جمله یادگیری انتخاب کن.
                  {"\n"}• حتما یک لنگر رو انتخاب کن.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>۱) چک‌لیست درس‌ها (حداقل ۶ مورد)</Text>
                <Text style={styles.small}>✅ این لیست ۱۴ مورد داره.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {LESSONS.map((s) => {
                    const on = lessons.includes(s.key);
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => toggleLesson(s.key)}
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
                  {selectedLessonTitles.length ? (
                    selectedLessonTitles.map((t, idx) => (
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
                <Text style={styles.noteTitle}>۲) جمله‌های یادگیری (حداقل  پنج مورد)</Text>
                <Text style={styles.small}>
                  این‌ها جمله‌های «قابل اجرا» هستند.
                  {"\n"}
                  (فقط انتخاب کن و  بداهه‌پردازی لازم نیست)
                </Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {LINES.map((it) => {
                    const on = lines.includes(it.key);
                    return (
                      <Pressable
                        key={it.key}
                        onPress={() => toggleLine(it.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                            <Text style={[styles.exampleText, { marginTop: 6 }]}>{it.text}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>تعداد جمله‌های انتخاب‌شده:</Text>
                  <Text style={styles.pairText}>{lines.length ? `${lines.length} جمله` : "—"}</Text>
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۳) جمله لنگر (برای وقتی که لغزیدی)</Text>
                <Text style={styles.small}>یکی رو انتخاب کن. این جمله باید «برگردوننده» باشه.</Text>

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

                {!anchor ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، یک جمله لنگر انتخاب کن.</Text> : null}
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: حداقل ۶ درس + حداقل ۵ جمله + انتخاب لنگر لازمه.</Text>
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
                <Text style={styles.h1}>تعهد نهایی (درس رو تبدیل به رفتار کن)</Text>
                <Text style={styles.p}>
                  اینجا نقطه‌ی تمایزه:
                  {"\n"}
                  خیلی‌ها «می‌فهمند»، اما رفتارشون همان میمونه.
                  {"\n\n"}
                  ما اینجا یادگیری رو قفل می‌کنیم تا تبدیل بشه به:
                  {"\n"}• معیار انتخاب
                  {"\n"}• مرز
                  {"\n"}• تصمیم
                </Text>

                <View style={[styles.pairCard, { marginTop: 10 }]}>
                  <Text style={styles.pairLabel}>خلاصه:</Text>
                  <Text style={styles.pairText}>• نوشته‌ی تو: {ownLessonsLinesCount || 0} خط</Text>
                  <Text style={styles.pairText}>• درس‌های چک‌لیست: {lessons.length}</Text>
                  <Text style={styles.pairText}>• جمله‌های یادگیری: {lines.length}</Text>
                  <Text style={styles.pairText}>• لنگر: {selectedAnchorText}</Text>
                </View>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>قانون ضد لغزش</Text>
                  <Text style={styles.small}>
                    چهار دام رایج بعد از جدایی:
                    {"\n"}۱) نشخوار فکری
                    {"\n"}۲) ایده‌آل‌سازی
                    {"\n"}۳) خودسرزنشی بی‌پایان
                    {"\n"}۴) یادگیری بدون عمل
                  </Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoRumination((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoRumination && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoRumination ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoRumination ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم وارد نشخوار فکری نشم؛ اگه شروع شد، با تکرار جمله «لنگر» به خودم به مسیر برمی‌گردم.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoIdealization((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoIdealization && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoIdealization ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoIdealization ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم طرف مقابل رو ایده‌آل نکنم؛ معیار من «واقعیت رفتار» اونه.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoSelfBlameLoop((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoSelfBlameLoop && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoSelfBlameLoop ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoSelfBlameLoop ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم خودم رو سرزنش نکنم بلکه از اشتباهاتم «درس» می‌گیرم و جلو میرم.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeActOnLearning((x) => !x);
                      }}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        agreeActOnLearning && styles.choiceCardOn,
                        isReview && { opacity: 0.7 },
                        { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                      ]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeActOnLearning ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeActOnLearning ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم این یادگیری‌ها رو تبدیل به یک تغییر رفتاری واقعی کنم.</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {!step4Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: هر ۴ تعهد باید تیک بخوره.</Text> : null}
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

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>یادآوری کوتاه</Text>
                <Text style={styles.small}>
                  اگر امروز «درس» نسازی، فردا «تکرار» می‌کنی.
                  {"\n"}
                  و یادت نره: اول نوشته‌ی خودت رو اجرا کن بعد چک‌لیست که انتخاب کردی..
                </Text>
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

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.18)",
    borderRadius: 16,
    padding: 12,
    minHeight: 140,
    color: palette.text,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
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