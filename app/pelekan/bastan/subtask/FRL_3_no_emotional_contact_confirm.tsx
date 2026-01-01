// app/pelekan/bastan/subtask/FRL_3_no_emotional_contact_confirm.tsx
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
  if (k === "FRL_3_no_emotional_contact_confirm") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type EmotionalContactKey =
  | "voice_message"
  | "long_call"
  | "late_night_contact"
  | "personal_checkin"
  | "nostalgia_past"
  | "explain_feelings"
  | "argue_defend"
  | "flirt_joke"
  | "emoji_sticker"
  | "social_media_like"
  | "instant_reply_when_triggered";

type CalmTechniqueKey = "breath_4_6" | "grounding_5_4_3_2_1" | "delay_10_min" | "cold_water" | "open_app_rules";

type FRL3Saved = {
  version: 1;
  savedAt: string;

  acceptedScienceTruth: boolean; // step 1
  riskContacts: EmotionalContactKey[]; // step 2 (min 4)

  acceptedNoGameTruth: boolean; // step 3
  agreeNoEmotionalContact: boolean; // step 3
  agreeNoReactionToProvocation: boolean; // step 3
  agreeNoRetaliation: boolean; // step 3
  calmTechniques: CalmTechniqueKey[]; // step 3 (min 1)

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_3_no_emotional_contact_confirm";
const KEY_FRL3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const RISK_CONTACTS: { key: EmotionalContactKey; title: string; desc: string; danger?: boolean }[] = [
  {
    key: "voice_message",
    title: "ویس",
    desc: "ویس یعنی لحن + احساس + اتصال. این یکی از سریع‌ترین محرک‌های وابستگیه.",
    danger: true,
  },
  {
    key: "long_call",
    title: "تماس طولانی",
    desc: "چند دقیقه اول شاید اجرایی باشه ولی بعدش ناخودآگاه می‌ره سمت رابطه.",
    danger: true,
  },
  {
    key: "late_night_contact",
    title: "تماس یا چت شبانه",
    desc: "شب یعنی خستگی + احساسات بیشتر + کنترل کمتر.",
  },
  {
    key: "personal_checkin",
    title: "احوال‌پرسی شخصی",
    desc: "«خوبی؟ دلم برات تنگ شده؟» یعنی ورود به کانال احساسی.",
  },
  {
    key: "nostalgia_past",
    title: "حرف زدن از گذشته و خاطره‌ها",
    desc: "گذشته سوختِ امید می‌سازه و ذهن رو دوباره وصل می‌کنه.",
  },
  {
    key: "explain_feelings",
    title: "توضیح احساسات و درد دل",
    desc: "درد دل کردن برای «آروم شدن»، مغز رو شرطی می‌کنه که آرامش زمانی اتفاق میفته که با اون تماس داشته باشم.",
  },
  {
    key: "argue_defend",
    title: "بحث، دفاع و اثبات حقانیت",
    desc: "بحث یعنی درگیری عصبی همراه با میل به ادامه دادن تماس.",
  },
  {
    key: "flirt_joke",
    title: "شوخی، طعنه و صمیمیت",
    desc: "صمیمیت ریز اما واقعی: پل برگشت به رابطه میشه.",
  },
  {
    key: "emoji_sticker",
    title: "ایموجی،استیکر یا گیف",
    desc: "برای مغز پیامِ «هنوز نزدیکیم» می‌سازه.",
  },
  {
    key: "social_media_like",
    title: "لایک کردن، دیدن استوری و واکنش توو شبکه‌های اجتماعی",
    desc: "ارتباط غیرمستقیم هم محرکه و امید تولید میکنه.",
  },
  {
    key: "instant_reply_when_triggered",
    title: "پاسخ فوری وقتی تحریک شدم",
    desc: "پاسخ فوری یعنی تصمیم با هیجانات، نه با منطق. پس باید مکث بسازی.",
  },
];

const CALM_TECHNIQUES: { key: CalmTechniqueKey; title: string; desc: string }[] = [
  { key: "breath_4_6", title: "تنفس ۴–۶", desc: "۴ ثانیه دم، ۶ ثانیه بازدم، ۶ چرخه." },
  {
    key: "grounding_5_4_3_2_1",
    title: "فعال‌کردن حواس پنج‌گانه",
    desc: "۵ چیز رو ببین، ۴ چیز رو لمس کن، ۳ صدا رو گوش کن، ۲ چیز رو بو کن ، ۱ مزه رو بچش.",
  },
  {
    key: "delay_10_min",
    title: "مکث ۱۰ دقیقه‌ای",
    desc: "از چت خارج شو، تایمر ۱۰ دقیقه‌ای بذار و بعد تصمیم بگیر (اغلب تصمیم می‌گیری هیچی نگی).",
  },
  {
    key: "cold_water",
    title: "آب سرد یا شوک حسی کوتاه",
    desc: "صورت و مچ دستت رو با آب سرد به مدت  ۲۰ الی ۳۰ ثانیه بشور برای پایین آوردن موج هیجان.",
  },
  {
    key: "open_app_rules",
    title: "برگشت به اپ و مرور قوانین",
    desc: "قبل از هر واکنش: همین صفحه رو دوباره بخون تا مغز از حالت واکنشی خارج شه.",
  },
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
export default function FRL3NoEmotionalContactConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "تعهد عدم تماس هیجانی";

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
  const [acceptedScienceTruth, setAcceptedScienceTruth] = useState(false);

  // Step 2
  const [riskContacts, setRiskContacts] = useState<EmotionalContactKey[]>([]);

  // Step 3
  const [acceptedNoGameTruth, setAcceptedNoGameTruth] = useState(false);
  const [agreeNoEmotionalContact, setAgreeNoEmotionalContact] = useState(false);
  const [agreeNoReactionToProvocation, setAgreeNoReactionToProvocation] = useState(false);
  const [agreeNoRetaliation, setAgreeNoRetaliation] = useState(false);
  const [calmTechniques, setCalmTechniques] = useState<CalmTechniqueKey[]>([]);

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
    const raw = await AsyncStorage.getItem(KEY_FRL3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedScienceTruth(!!j.acceptedScienceTruth);

    const rc = Array.isArray(j.riskContacts) ? (j.riskContacts as any[]) : [];
    setRiskContacts(rc.filter(Boolean) as EmotionalContactKey[]);

    setAcceptedNoGameTruth(!!j.acceptedNoGameTruth);
    setAgreeNoEmotionalContact(!!j.agreeNoEmotionalContact);
    setAgreeNoReactionToProvocation(!!j.agreeNoReactionToProvocation);
    setAgreeNoRetaliation(!!j.agreeNoRetaliation);

    const ct = Array.isArray(j.calmTechniques) ? (j.calmTechniques as any[]) : [];
    setCalmTechniques(ct.filter(Boolean) as CalmTechniqueKey[]);

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
  const toggleRiskContact = useCallback(
    (k: EmotionalContactKey) => {
      if (isReview) return;
      setRiskContacts((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const toggleCalmTechnique = useCallback(
    (k: CalmTechniqueKey) => {
      if (isReview) return;
      setCalmTechniques((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const step1Ok = acceptedScienceTruth;
  const step2Ok = riskContacts.length >= 4;

  const step3Ok =
    acceptedNoGameTruth &&
    agreeNoEmotionalContact &&
    agreeNoReactionToProvocation &&
    agreeNoRetaliation &&
    calmTechniques.length >= 1;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;

  const canFinalize = canGo4;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedRiskTitles = useMemo(() => {
    const set = new Set(riskContacts);
    return RISK_CONTACTS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [riskContacts]);

  const selectedCalmTitles = useMemo(() => {
    const set = new Set(calmTechniques);
    return CALM_TECHNIQUES.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [calmTechniques]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedScienceTruth: true,
      riskContacts: riskContacts || [],

      acceptedNoGameTruth: true,
      agreeNoEmotionalContact: true,
      agreeNoReactionToProvocation: true,
      agreeNoRetaliation: true,
      calmTechniques: calmTechniques || [],

      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [riskContacts, calmTechniques]);

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

    // payload تحلیل‌پذیر: جزئیات کامل محلی می‌ماند، سرور snapshot می‌گیرد
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedScienceTruth: true,

        riskContactsCount: riskContacts.length,
        hasMinRiskContacts: riskContacts.length >= 4,

        acceptedNoGameTruth: acceptedNoGameTruth,
        agreeNoEmotionalContact: agreeNoEmotionalContact,
        agreeNoReactionToProvocation: agreeNoReactionToProvocation,
        agreeNoRetaliation: agreeNoRetaliation,

        calmTechniquesCount: calmTechniques.length,
        hasCalmTechnique: calmTechniques.length >= 1,

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
    riskContacts.length,
    calmTechniques.length,
    acceptedNoGameTruth,
    agreeNoEmotionalContact,
    agreeNoReactionToProvocation,
    agreeNoRetaliation,
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
        <Text style={styles.stepPillText}>۱) علم</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) خطرها</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) تعهد</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) پایان</Text>
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
    {/* متن اصلی */}
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>چرا «تماس هیجانی» خطرناکه؟</Text>
      <Text style={styles.p}>
        این ریزاقدام قرار نیست «قویت» کنه؛ قراره **لغزش رو غیرممکن** کنه.
        {"\n\n"}
        توضیح علمی ساده:
        {"\n"}
        مغز در رابطه، روی «سیگنال‌های اتصال» شرطی می‌شه (صدا، لحن، صمیمیت، خاطره و حتی بحث کردن).
        تماس—even کوتاه—سیستم وابستگی و پاداش رو دوباره روشن می‌کنه.
        {"\n\n"}
        نتیجه:
        {"\n"}• فکر و خیال بیشتر
        {"\n"}• امید پنهان
        {"\n"}• میل به ادامه دادن تماس
        {"\n\n"}
        ما اینجا یک خط می‌کشیم: **فقط تماس اجرایی، نه هیجانی.**
      </Text>
    </View>

    {/* قانون پایه (جدا شده تا نچسبه) */}
    <View style={[styles.noteCard, { marginTop: 10, marginBottom: 10 }]}>
      <Text style={styles.noteTitle}>قانون پایه</Text>
      <Text style={styles.small}>
        هر چیزی که «آرامشِ لحظه‌ای» بده اما «وابستگی» بسازه، سمّه.
        {"\n"}
        تماس هیجانی دقیقاً همین کار رو می‌کنه.
      </Text>
    </View>

    {/* چک‌باکس تعهد */}
    <Pressable
      onPress={() => {
        if (isReview) return;
        setAcceptedScienceTruth((x) => !x);
      }}
      style={[styles.choiceCard, acceptedScienceTruth && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
      disabled={isReview}
    >
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Ionicons
          name={acceptedScienceTruth ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={acceptedScienceTruth ? palette.green : "rgba(231,238,247,.55)"}
        />
        <Text style={styles.choiceText}>قبول دارم: تماس هیجانی سوختِ وابستگیه، حتی اگه کوتاه باشه</Text>
      </View>
    </Pressable>

    <View style={{ height: 12 }} />

    {/* دکمه ادامه */}
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
  </>
) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>شکل‌های تماس هیجانی</Text>
                <Text style={styles.p}>
                  اینجا باید دقیق انتخاب کنی تا بعداً با خودت کل‌کل نکنی.
                  {"\n\n"}
                  نکته مهم:
                  {"\n"}
                  «به‌ظاهر کوچیک»‌ها خطرناک‌ترند؛ چون ذهن توجیه‌شون می‌کنه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>چک‌لیست محرک‌ها</Text>
                <Text style={styles.small}>حداقل ۴ مورد رو انتخاب کن.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {RISK_CONTACTS.map((r) => {
                    const on = riskContacts.includes(r.key);
                    const danger = !!r.danger;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => toggleRiskContact(r.key)}
                        disabled={isReview}
                        style={[
                          styles.choiceCard,
                          on && styles.choiceCardOn,
                          danger && { borderColor: "rgba(252,165,165,.22)", backgroundColor: "rgba(252,165,165,.04)" },
                          isReview && { opacity: 0.7 },
                        ]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={18}
                            color={on ? (danger ? "rgba(252,165,165,.95)" : palette.green) : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }, danger && { color: "rgba(252,165,165,.95)" }]}>
                              {r.title}
                            </Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{r.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                  {selectedRiskTitles.length ? (
                    selectedRiskTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل ۴ مورد انتخاب کن.</Text> : null}

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
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>تعهد نهایی (قفل رفتاری)</Text>
                <Text style={styles.p}>
                  این قسمت، همون جاییه که اکثر آدم‌ها خرابش می‌کنن: یعنی وسط تحریک شدن.
                  {"\n\n"}
                  بعضی آدما برای کنترل کردن پارتنر سابق‌شون «تحریک» می‌سازن مثلا:
                  {"\n"}• جلوی تو با یک نفر دیگه گرم می‌گیرن
                  {"\n"}• از آشنایی یا رابطه جدید حرف می‌زنن
                  {"\n"}• کاری می‌کنن تو واکنش نشون بدی
                  {"\n\n"}
                  توضیح علمی ساده:
                  {"\n"}
                  تحریک کردن یک نوع قلاب توجهه و اگه تو واکنش نشون بدی (حتی  با عصبانیت) یعنی به مغزش پاداش دادی که «می‌تونه تو رو کنترل کنه».
                  {"\n\n"}
                  مقابله‌به‌مثل هم همون بازیه: تو وارد میدون می‌شی و جنگ رو معتبر می‌کنی.
                </Text>
              </View>

              <View style={[styles.dangerCard, { marginTop: 10 }]}>
                <Text style={styles.dangerTitle}>قانون طلایی اینه که «توو زمینش بازی نکن»</Text>
                <Text style={styles.small}>
                  یعنی اگه تحریک شدم:
                  {"\n"}۱) هیچ واکنشی نشون نمی‌دم
                  {"\n"}۲) مقابله‌به‌مثل نمی‌کنم
                  {"\n"}۳) یک تکنیک آرام‌سازی رو اجرا می‌کنم
                </Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAcceptedNoGameTruth((x) => !x);
                    }}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      acceptedNoGameTruth && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                      { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={acceptedNoGameTruth ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={acceptedNoGameTruth ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>قبول دارم: واکنش من یعنی «پاداش دادن» به تحریک و باز کردن درِ نفوذ</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoEmotionalContact((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, agreeNoEmotionalContact && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoEmotionalContact ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoEmotionalContact ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        تعهد می‌دم هیچ تماس هیجانی نداشته باشم (ویس، احوال‌پرسی، خاطره، توضیح احساس، بحث و دفاع)
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoReactionToProvocation((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, agreeNoReactionToProvocation && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoReactionToProvocation ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoReactionToProvocation ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم تحریک رو با «بی‌واکنشی» پاسخ بدم (بی‌واکنشی در چهره، کلام، پیام و رفتار)</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoRetaliation((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, agreeNoRetaliation && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoRetaliation ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoRetaliation ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        تعهد می‌دم مقابله‌به‌مثل نکنم (مثلاً گرم گرفتن عمدی با دیگری برای سوزوندن اون)
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={[styles.exampleBox, { marginTop: 12, borderColor: "rgba(252,165,165,.18)" }]}>
                  <Text style={[styles.small, { color: "rgba(252,165,165,.88)" }]}>چرا مقابله‌به‌مثل بده؟</Text>
                  <Text style={[styles.exampleText, { color: "rgba(231,238,247,.80)" }]}>
                    {"• چون تو رو از «کنترل» به «واکنش» می‌بره\n" +
                      "• چون به طرف مقابل پیام می‌ده هنوز روی تو نفوذ داره\n" +
                      "• چون سیستم عصبی تو رو وارد حلقه‌ی وابستگی-رقابت می‌کنه\n" +
                      "• چون بعدش معمولاً شرم و افت عزت‌نفس میاد"}
                  </Text>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>تکنیک آرام‌سازی (حداقل ۱ مورد)</Text>
                  <Text style={styles.small}>این‌ها رو برای لحظه‌ای انتخاب کن که وسوسه‌ی «تماس» یا «واکنش» میاد.</Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {CALM_TECHNIQUES.map((c) => {
                      const on = calmTechniques.includes(c.key);
                      return (
                        <Pressable
                          key={c.key}
                          onPress={() => toggleCalmTechnique(c.key)}
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
                              <Text style={[styles.choiceText, { flexShrink: 1 }]}>{c.title}</Text>
                              <Text style={[styles.small, { flexShrink: 1 }]}>{c.desc}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={[styles.pairCard, { marginTop: 12 }]}>
                    <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                    {selectedCalmTitles.length ? (
                      selectedCalmTitles.map((t, idx) => (
                        <Text key={`${t}-${idx}`} style={styles.pairText}>
                          • {t}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.pairText}>—</Text>
                    )}
                  </View>
                </View>
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: هر ۴ تعهد باید تیک بخوره و حداقل یک تکنیک آرام‌سازی انتخاب بشه.
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
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo4 || saving}
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
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  خلاصه‌ی تعهد تو:
                  {"\n"}• محرک‌های انتخاب‌شده: {riskContacts.length}
                  {"\n"}• تکنیک‌های آرام‌سازی: {calmTechniques.length}
                  {"\n\n"}
                  جمله‌ی سخت:
                  {"\n"}
                  «تماس هیجانی، آرامش لحظه‌ای می‌ده؛ ولی وابستگی رو دوباره روشن می‌کنه.»
                  {"\n\n"}
                  و درباره تحریک:
                  {"\n"}
                  اگه واکنش نشون بدی، یعنی بهش یاد دادی هنوز می‌تونه تو رو کنترل کنه.
                  پس انتخاب تو اینه که کنترلش کنی، نه اینکه واکنش نشون بدی
                </Text>

                <View style={[styles.pairCard, { marginTop: 10 }]}>
                  <Text style={styles.pairLabel}>محرک‌های منتخب:</Text>
                  {selectedRiskTitles.length ? (
                    selectedRiskTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>

                <View style={[styles.pairCard, { marginTop: 10 }]}>
                  <Text style={styles.pairLabel}>آرام‌سازی منتخب:</Text>
                  {selectedCalmTitles.length ? (
                    selectedCalmTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
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

  exampleBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    alignSelf: "stretch",
  },
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