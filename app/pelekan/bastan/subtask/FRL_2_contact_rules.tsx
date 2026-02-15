// app/pelekan/bastan/subtask/FRL_2_contact_rules.tsx
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
  if (k === "FRL_2_contact_rules") return "ریز اقدام سوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type ContactChannel =
  | "sms_only"
  | "messenger_text_only"
  | "call_only_urgent"
  | "third_party"
  | "in_person_only_if_required";

type ContactRuleKey =
  | "time_window_only"
  | "no_instant_reply"
  | "neutral_tone"
  | "no_personal_checkin"
  | "end_when_off_topic"
  | "no_unfinished_debate"
  | "no_contact_when_emotional"
  | "no_voice_no_long_call"
  | "no_night_contact";

type CalmTechniqueKey = "breath_4_6" | "grounding_5_4_3_2_1" | "leave_scene" | "open_app_rules";

type FRL2Saved = {
  version: 1;
  savedAt: string;

  acceptedProtocol: boolean; // step1
  channel: ContactChannel | null; // step2

  rules: ContactRuleKey[]; // step3 (min 3)
  acceptedProvocationTruth: boolean; // step4 (علمی: بازی در زمین او)
  agreeNoReaction: boolean; // step4
  agreeNoRetaliation: boolean; // step4
  calmTechniques: CalmTechniqueKey[]; // step4 (min 1)

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_2_contact_rules";
const KEY_FRL2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const CHANNEL_OPTIONS: { key: ContactChannel; title: string; desc: string }[] = [
  { key: "sms_only", title: "فقط پیامک", desc: "کوتاه، اجرایی، بدون بحث. (کم‌خطرترین)" },
  { key: "messenger_text_only", title: "پیام‌رسان فقط متن", desc: "بدون ویس، بدون تماس، بدون استیکر و ایموجی و جمله‌ی احساسی." },
  { key: "call_only_urgent", title: "تماس فقط برای موارد فوری", desc: "حداکثر چند دقیقه. مکالمه‌ی طولانی ممنوع." },
  { key: "third_party", title: "با واسطه", desc: "اگه امکانش هست: بهترین گزینه برای کاهش محرک." },
  { key: "in_person_only_if_required", title: "حضوری فقط اگر اجبار عملی باشد", desc: "کوتاه، رسمی، در حداقلی‌ترین زمان ممکن. (پرریسک‌تر)" },
];

const RULE_OPTIONS: { key: ContactRuleKey; title: string; desc: string }[] = [
  {
    key: "time_window_only",
    title: "فقط در بازه زمانی مشخص",
    desc: "مثلاً فقط ۹ تا ۱۸. تماس بیرون از این بازه ممنوع.",
  },
  {
    key: "no_instant_reply",
    title: "پاسخ فوری لازم نیست",
    desc: "مغزِ مضطرب دنبال «اتصال» می‌گرده. تأخیر یعنی کنترل رو پس می‌گیری.",
  },
  {
    key: "neutral_tone",
    title: "لحن خنثی و رسمی",
    desc: "بدون شوخی، کنایه، جملات دوپهلو. فقط اجرایی.",
  },
  {
    key: "no_personal_checkin",
    title: "بدون احوال‌پرسی شخصی",
    desc: "«خوبی؟ دلم برات تنگ شده؟» یعنی ورود به کانال احساسی.",
  },
  {
    key: "end_when_off_topic",
    title: "به محض خروج از موضوع: پایان",
    desc: "وقتی بحث رفت سمت گذشته، احساسات و سرزنش = تمام.",
  },
  {
    key: "no_unfinished_debate",
    title: "بحث نیمه‌کاره ممنوع",
    desc: "بحث نیمه‌کاره یعنی بهانه برای تماس بعدی.",
  },
  {
    key: "no_contact_when_emotional",
    title: "وقتی هیجانی هستم تماس ممنوع",
    desc: "هیجان بالا = تصمیم بد. اول آرام‌سازی، بعد اگه واقعا لازم بود، تماس بگیر.",
  },
  {
    key: "no_voice_no_long_call",
    title: "ویس و تماس طولانی ممنوع",
    desc: "ویس و تماس طولانی، سریع‌ترین مسیر برای برگشت به رابطه‌ست.",
  },
  {
    key: "no_night_contact",
    title: "تماس شبانه ممنوع",
    desc: "شب = خستگی + احساسات بیشتر + تصمیم‌گیری بدتر.",
  },
];

const CALM_TECHNIQUES: { key: CalmTechniqueKey; title: string; desc: string }[] = [
  { key: "breath_4_6", title: "تنفس ۴–۶", desc: "۴ ثانیه دم، ۶ ثانیه بازدم، ۶ چرخه." },
  { key: "grounding_5_4_3_2_1", title: "فعال‌کردن حواس پنجگانه ", desc: "۵ چیز رو ببین، ۴ چیز رو لمس کن، به ۳ صدا گوش کن،  ۲ چیز رو بو کن و ۱ مزه رو بچش." },
  { key: "leave_scene", title: "ترک موقعیت", desc: "اگه حضوری تحریک اتفاق افتاد و ترک موقعیت جلب توجه نمی‌کنه اونجا رو ترک کن." },
  { key: "open_app_rules", title: "برگشت به اپ و مرور قوانین", desc: "قبل از هر واکنش، قوانین رو اینجا دوباره بخون و تکنیک تب پناهگاه رو انجام بده." },
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
export default function FRL2ContactRulesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "قوانین تماس مجاز";

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
  const [acceptedProtocol, setAcceptedProtocol] = useState(false);

  // Step 2
  const [channel, setChannel] = useState<ContactChannel | null>(null);

  // Step 3
  const [rules, setRules] = useState<ContactRuleKey[]>([]);

  // Step 4 (provocation)
  const [acceptedProvocationTruth, setAcceptedProvocationTruth] = useState(false);
  const [agreeNoReaction, setAgreeNoReaction] = useState(false);
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
    const raw = await AsyncStorage.getItem(KEY_FRL2_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL2Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedProtocol(!!j.acceptedProtocol);

    const ch = (String(j.channel || "") as ContactChannel) || null;
    setChannel(ch);

    const rr = Array.isArray(j.rules) ? (j.rules as any[]) : [];
    setRules(rr.filter(Boolean) as ContactRuleKey[]);

    setAcceptedProvocationTruth(!!j.acceptedProvocationTruth);
    setAgreeNoReaction(!!j.agreeNoReaction);
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
        if (loaded) setStep(5);
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
  const onPickChannel = useCallback(
    (k: ContactChannel) => {
      if (isReview) return;
      setChannel(k);
    },
    [isReview]
  );

  const toggleRule = useCallback(
    (k: ContactRuleKey) => {
      if (isReview) return;
      setRules((prev) => {
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
  const step1Ok = acceptedProtocol;
  const step2Ok = !!channel;
  const step3Ok = rules.length >= 3;
  const step4Ok =
    acceptedProvocationTruth &&
    agreeNoReaction &&
    agreeNoRetaliation &&
    calmTechniques.length >= 1;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canGo5 = step1Ok && step2Ok && step3Ok && step4Ok;

  const canFinalize = canGo5;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedChannelTitle = useMemo(() => {
    const f = CHANNEL_OPTIONS.find((x) => x.key === channel);
    return f?.title || "—";
  }, [channel]);

  const selectedRulesTitles = useMemo(() => {
    const set = new Set(rules);
    return RULE_OPTIONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [rules]);

  const selectedCalmTitles = useMemo(() => {
    const set = new Set(calmTechniques);
    return CALM_TECHNIQUES.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [calmTechniques]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedProtocol: true,
      channel: channel || "sms_only",

      rules: rules || [],

      acceptedProvocationTruth: true,
      agreeNoReaction: true,
      agreeNoRetaliation: true,
      calmTechniques: calmTechniques || [],

      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL2_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [channel, rules, calmTechniques]);

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

    // payload تحلیل‌پذیر و تمیز: کل جزئیات برای خود اپ لوکال می‌ماند
    // و سرور یک snapshot کافی برای داده/تحلیل می‌گیرد.
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedProtocol: true,
        channel: channel,
        rulesCount: rules.length,
        hasMinRules: rules.length >= 3,

        // provocation module
        acceptedProvocationTruth: acceptedProvocationTruth,
        agreeNoReaction: agreeNoReaction,
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
    channel,
    rules.length,
    calmTechniques.length,
    acceptedProvocationTruth,
    agreeNoReaction,
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
        <Text style={styles.stepPillText}>۱) پروتکل</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) کانال</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) قوانین</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) تحریک</Text>
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
                <Text style={styles.h1}>پروتکل تماس</Text>
                <Text style={styles.p}>
                  وقتی مجبور به ارتباط هستی، مغز هنوز هم می‌تونه از تماس «امید» بسازه.
                  {"\n\n"}
                  از نظر نوروساینس:
                  {"\n"}
                  تماس‌های مبهم و کش‌دار، سیستم پاداش و دلبستگی رو فعال می‌کنن.
                  {"\n\n"}
                  هدف این ریزاقدام:
                  {"\n"}• تماس رو «اجرایی» کنه، نه «احساسی»
                  {"\n"}• محرک‌ها رو با قانون محدود کنه
                  {"\n"}• جلوی «لغزش‌های کوچیک» رو بگیره
                </Text>

                <View style={[styles.noteCard, { marginTop: 10 }]}>
                  <Text style={styles.noteTitle}>قانون طلایی</Text>
                  <Text style={styles.small}>
                    هر چیزی که «ابهام» بسازه، مغز رو وارد خیال و امید می‌کنه.
                    {"\n"}پس ما تماس رو از عشق جدا می‌کنیم: مثل یک نامه اداری.
                  </Text>
                </View>

                <Pressable
  onPress={() => {
    if (isReview) return;
    setAcceptedProtocol((x) => !x);
  }}
  style={[
    styles.choiceCard,
    { marginTop: 12 }, 
    acceptedProtocol && styles.choiceCardOn,
    isReview && { opacity: 0.7 },
  ]}
  disabled={isReview}
>
  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
    <Ionicons
      name={acceptedProtocol ? "checkmark-circle" : "ellipse-outline"}
      size={18}
      color={acceptedProtocol ? palette.green : "rgba(231,238,247,.55)"}
    />
    <Text style={styles.choiceText}>
      قبول دارم: اینجا فقط «پروتکل تماس» می‌سازم، نه رابطه
    </Text>
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
                <Text style={styles.h1}>کانال مجاز ارتباطی</Text>
                <Text style={styles.p}>
                  کانال اشتباه یعنی راهِ برگشتِ احساسی.
                  {"\n"}ویس و تماس طولانی، مغز رو سریع‌تر از هرچیزی وارد وابستگی بیمارگون می‌کنه.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {CHANNEL_OPTIONS.map((c) => {
                  const on = channel === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => onPickChannel(c.key)}
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
                          <Text style={[styles.choiceText, { flexShrink: 1 }]}>{c.title}</Text>
                          <Text style={[styles.small, { flexShrink: 1 }]}>{c.desc}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، یک کانال رو انتخاب کن.</Text> : null}

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
                <Text style={styles.h1}>قوانین تماس (حداقل ۳ مورد)</Text>
                <Text style={styles.p}>
                  این قوانین «قفل رفتاری» هستند.
                  {"\n\n"}
                  نکته علمی:
                  {"\n"}
                  وقتی تحریک می‌شی، قشر پیش‌پیشانی (یعنی مرکز کنترل) ضعیف می‌شه و آمیگدالا (یعنی مرکز هیجانات) فرمان می‌ده.
                  {"\n"}
                  قانون، قبل از موج هیجان نوشته می‌شه تا وسط موج، تصمیم‌گیری لازم نباشه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>چک‌لیست قوانین</Text>
                <Text style={styles.small}>حداقل ۳ مورد انتخاب کن.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {RULE_OPTIONS.map((r) => {
                    const on = rules.includes(r.key);
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => toggleRule(r.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{r.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{r.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                  {selectedRulesTitles.length ? (
                    selectedRulesTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {!step3Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل ۳ قانون را انتخاب کن.</Text> : null}

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
                <Text style={styles.h1}>توو زمینش بازی نکن</Text>
                <Text style={styles.p}>
                  بعضی آدم‌ها برای کنترل تو، «تحریک» می‌سازن:
                  {"\n"}• جلوی تو با جنس مخالف گرم می‌گیرن
                  {"\n"}• از رابطه یا آشنایی جدید حرف می‌زنن
                  {"\n"}• جوری رفتار می‌کنن که تو واکنش نشون بدی
                  {"\n\n"}
                  توضیح علمی ساده:
                  {"\n"}
                  تحریک، یک «قلابِ توجه»ه. اگه واکنش بدی (حتی با عصبانیت)، مغز اون پاداش می‌گیره: یعنی فهمیده می‌تونه تو رو حرکت بده.
                  {"\n\n"}
                  مقابله‌به‌مثل هم دقیقاً همان بازیه:
                  {"\n"}تو وارد میدون می‌شی و اعتبار می‌دی که «این جنگ» ارزش داره.
                  {"\n\n"}
                  اینجا هدف ما: **صفر واکنش + اجرای آرام‌سازی**
                </Text>
              </View>

              <View style={[styles.dangerCard, { marginTop: 10 }]}>
                <Text style={styles.dangerTitle}>قانون تحریک</Text>
                <Text style={styles.small}>
                  اگر تحریک شدم:
                  {"\n"}۱) هیچ واکنشی نمی‌دم
                  {"\n"}۲) مقابله‌به‌مثل نمی‌کنم
                  {"\n"}۳) یک تکنیک آرام‌سازی رو اجرا می‌کنم
                </Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAcceptedProvocationTruth((x) => !x);
                    }}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      acceptedProvocationTruth && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                      { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={acceptedProvocationTruth ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={acceptedProvocationTruth ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        قبول دارم تحریک یعنی «قلاب»، و واکنش یعنی «پاداش دادن» به اون
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoReaction((x) => !x);
                    }}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      agreeNoReaction && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                      { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoReaction ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoReaction ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم هیچ واکنش بیرونی نشون ندم (چهره،کلام، پیام و رفتار)</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoRetaliation((x) => !x);
                    }}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      agreeNoRetaliation && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                      { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoRetaliation ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoRetaliation ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        تعهد می‌دم مقابله‌به‌مثل نکنم (مثل گرم گرفتن عمدی با یکی دیگه برای سوزوندن اون)
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={[styles.exampleBox, { marginTop: 12, borderColor: "rgba(252,165,165,.18)" }]}>
                  <Text style={[styles.small, { color: "rgba(252,165,165,.88)" }]}>چرا مقابله‌به‌مثل بده؟</Text>
                  <Text style={[styles.exampleText, { color: "rgba(231,238,247,.80)" }]}>
                    {"• چون تو رو از «کنترل» به سمت «واکنش» می‌بره\n" +
                      "• چون به طرف مقابل پیام میده هنوز روی تو نفوذ داره\n" +
                      "• چون سیستم عصبی تو رو دوباره وارد حلقه وابستگی - رقابت می‌کنه\n" +
                      "• چون بعدش معمولاً شرم و افت عزت‌نفس میاد"}
                  </Text>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>تکنیک آرام‌سازی (حداقل ۱ مورد)</Text>
                  <Text style={styles.small}>این‌ها رو برای لحظه‌ی تحریک انتخاب کن.</Text>

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

              {!step4Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: هر سه تعهد تحریک باید تیک بخوره + حداقل یک تکنیک آرام‌سازی انتخاب شود.
                </Text>
              ) : null}

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
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  خلاصه پروتکل تو:
                  {"\n"}• کانال: {selectedChannelTitle}
                  {"\n"}• تعداد قوانین: {rules.length}
                  {"\n"}• تکنیک‌های آرام‌سازی: {calmTechniques.length}
                  {"\n\n"}
                  یادآوری سخت:
                  {"\n"}
                  اگر تحریک شدی و از خودت واکنش نشون دادی، یعنی به اون یاد دادی هنوز می‌تونه تو رو کنترل کنه.
                  {"\n\n"}
                  تو اینجا انتخاب می‌کنی:
                  {"\n"}«کنترل» به جای «واکنش».
                </Text>

                <View style={[styles.pairCard, { marginTop: 10 }]}>
                  <Text style={styles.pairLabel}>قوانین منتخب:</Text>
                  {selectedRulesTitles.length ? (
                    selectedRulesTitles.map((t, idx) => (
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
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(4)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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