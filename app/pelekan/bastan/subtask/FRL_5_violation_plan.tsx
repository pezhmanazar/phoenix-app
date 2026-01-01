// app/pelekan/bastan/subtask/FRL_5_violation_plan.tsx
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
  if (k === "FRL_5_violation_plan") return "ریز اقدام ششم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type ViolationTypeKey =
  | "texted"
  | "called"
  | "met"
  | "checked_social"
  | "stalked"
  | "sexual_contact"
  | "fight"
  | "other";

type TriggerKey =
  | "lonely"
  | "nostalgia"
  | "anger"
  | "anxiety"
  | "alcohol"
  | "sleep_deprived"
  | "bored"
  | "anniversary"
  | "saw_them"
  | "friend_news";

type ImmediateActionKey =
  | "stop_now"
  | "no_followup_24h"
  | "mute_block_24h"
  | "delete_chat_media"
  | "leave_place"
  | "grounding_90sec"
  | "write_log_3min"
  | "tell_accountability";

type RecoveryActionKey =
  | "detox_24h"
  | "reality_check"
  | "self_compassion"
  | "plan_next_block"
  | "sleep_food_walk"
  | "remove_triggers"
  | "support_call"
  | "review_boundary";

/* saved */
type FRL5Saved = {
  version: 1;
  savedAt: string;

  acceptedTruth: boolean; // step1
  acceptedNotEnd: boolean; // step1

  violationTypes: ViolationTypeKey[]; // step2 (min 1)
  triggers: TriggerKey[]; // step2 (min 1)
  immediateActions: ImmediateActionKey[]; // step2 (min 3)
  recoveryActions: RecoveryActionKey[]; // step2 (min 2)

  agreeNoSecondMessage: boolean; // step2
  agreeReturnToPlan: boolean; // step2

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_5_violation_plan";
const KEY_FRL5_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const VIOLATION_TYPES: { key: ViolationTypeKey; title: string; desc: string }[] = [
  { key: "texted", title: "پیام دادم", desc: "حتی یک پیام کوتاه یا ایموجی" },
  { key: "called", title: "تماس گرفتم یا جواب دادم", desc: "یک تماس یا چند تماس کوتاه" },
  { key: "met", title: "دیدار کردم", desc: "قرار گذاشتم یا اتفاقی طولش دادم" },
  { key: "checked_social", title: "شبکه‌های اجتماعیش رو چک کردم", desc: "استوری، پست و پروفایل" },
  { key: "stalked", title: "پیگیری وسواسی کردم", desc: "چک‌کردن مداوم، چک کردن با اکانت فیک و جستجو" },
  { key: "sexual_contact", title: "تماس صمیمی یا جنسی داشتم", desc: "برگشت به صمیمیت گذشته" },
  { key: "fight", title: "دعوا یا بحث سنگین باهاش کردم", desc: "جر و بحث، تهدید و تحقیر" },
  { key: "other", title: "چیز دیگه", desc: "هر نوع لغزش دیگه‌ای" },
];

const TRIGGERS: { key: TriggerKey; title: string; desc: string }[] = [
  { key: "lonely", title: "احساس تنهایی کردم", desc: "شب‌ها، بعد از کار یا آخر هفته" },
  { key: "nostalgia", title: "یه خاطره در درونم زنده شد", desc: "داخل خاطره غرق شدم" },
  { key: "anger", title: "از رفتارهایی که قبلا کرده بود عصبانی شدم و حرصم گرفت", desc: "خواستم تلافی کنم یا ثابت کنم اشتباه کرده یا حرصم رو خالی کنم " },
  { key: "anxiety", title: "اضطراب گرفتم", desc: "ترس از دست دادن یا نامعلوم بودن آینده" },
  { key: "alcohol", title: "الکل یا مواد استفاده کردم", desc: "کنترلم با استفاده این مواد کم شد" },
  { key: "sleep_deprived", title: "نمی‌تونستم بخوابم یا خستگی شدید داشتم", desc: "داخل بی‌خوابی و خستگی ذهن ضعیف‌تر میشه" },
  { key: "bored", title: "بی‌حوصله بودم", desc: "فقط برای پر کردن زمان" },
  { key: "anniversary", title: "داخل تاریخ حساس بودم", desc: "سالگرد، روز خاص، روز تولد خودم یا خودش" },
  { key: "saw_them", title: "دیدن یا شنیدن در موردش به شکل ناگهانی", desc: "تصادفی یا با پیگیری خودم" },
  { key: "friend_news", title: "خبر گرفتن از دیگران", desc: "دوست یا فامیل چیزی گفتن" },
];

const IMMEDIATE_ACTIONS: { key: ImmediateActionKey; title: string; desc: string }[] = [
  { key: "stop_now", title: "الان کاری که کردم رو قطع می‌کنم", desc: "دیگه ادامش نمی‌دم و مکالمه و چک‌کردن رو تموم میکنم" },
  { key: "no_followup_24h", title: "۲۴ ساعت هیچ پیام یا تماس دومی برقرار نمی‌کنم", desc: "لغزش رو به «دنباله» تبدیل نمی‌کنم" },
  { key: "mute_block_24h", title: "۲۴ ساعت کامل اونو میوت یا بلاک میکنم", desc: "برای اینکه لغزش زنجیره‌ای ادامه پیدا نکنه" },
  { key: "delete_chat_media", title: "چت یا پیام محرک رو پاک می‌کنم", desc: "نه برای پاک‌کردن تاریخ؛ بلکه برای قطع کردن محرک" },
  { key: "leave_place", title: "محیط رو عوض می‌کنم", desc: "جایی که داخلش لغزش اتفاق افتاده محرکه، پس به مدت 24 ساعت ازش فاصله بگیر" },
  { key: "grounding_90sec", title: "سه دقیقه حواس پنجگانه خودت رو درگیر کن", desc: "تنفس عمیق بعد سرد کردن صورت با آب سرد و بعد درگیر کردن پنج حس" },
  { key: "write_log_3min", title: "۳ دقیقه ثبت رخداد انجام بده", desc: "بنویس چی شد؟ چی حس کردم؟ چی نیاز داشتم؟" },
  { key: "tell_accountability", title: "یک نفر رو در جریان می‌ذارم", desc: "دوست امن، تراپیست یا حامی" },
];

const RECOVERY_ACTIONS: { key: RecoveryActionKey; title: string; desc: string }[] = [
  { key: "detox_24h", title: "سم‌زدایی ۲۴ ساعته", desc: "حذف همه محرک‌ها + قطع سرچ کردن و چک کردن" },
  { key: "reality_check", title: "واقعیت‌سنجی", desc: "۳ دلیل اینکه این رابطه آسیب‌زا بود رو داخل کاغذ بنویس" },
  { key: "self_compassion", title: "خودهمدلی بدون توجیه", desc: "نه خودت رو سرزنش کن؛ نه کارت رو توجیه کن. فقط برگرد به مسیر درمان" },
  { key: "plan_next_block", title: "پلن ۳ ساعت آینده", desc: "کار مشخص برای سه ساعت آینده تعیین کن مثلا: ورزش میکنم، دوش می‌گیرم، پیاده‌روی می‌کنم و یک کار کوتاه انجام میدم" },
  { key: "sleep_food_walk", title: "بدن رو تنظیم می‌کنم", desc: " هشت ساعت خواب، خوردن غذای سالم، نوشیدن هشت لیوان آب" },
  { key: "remove_triggers", title: "حذف محرک‌ها به شکل فوری", desc: "آلبوم، پیام‌ها، شماره و لوکیشن‌ها" },
  { key: "support_call", title: "تماس حمایتی", desc: "۱۵ دقیقه صحبت امن با یک فرد مورد اعتماد اون هم بدون تحلیل رابطه و صحبت کردن از رابطه" },
  { key: "review_boundary", title: "بازگشت به مرزبندی", desc: "متن‌هایی که داخل اپ نوشتم رو مرور می‌کنم" },
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
export default function FRL5ViolationPlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "پلن جبران لغزش";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..2
  const [step, setStep] = useState<1 | 2>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedTruth, setAcceptedTruth] = useState(false);
  const [acceptedNotEnd, setAcceptedNotEnd] = useState(false);

  // Step 2
  const [violationTypes, setViolationTypes] = useState<ViolationTypeKey[]>([]);
  const [triggers, setTriggers] = useState<TriggerKey[]>([]);
  const [immediateActions, setImmediateActions] = useState<ImmediateActionKey[]>([]);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryActionKey[]>([]);

  const [agreeNoSecondMessage, setAgreeNoSecondMessage] = useState(false);
  const [agreeReturnToPlan, setAgreeReturnToPlan] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_FRL5_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL5Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedTruth(!!j.acceptedTruth);
    setAcceptedNotEnd(!!j.acceptedNotEnd);

    setViolationTypes(Array.isArray(j.violationTypes) ? (j.violationTypes.filter(Boolean) as any) : []);
    setTriggers(Array.isArray(j.triggers) ? (j.triggers.filter(Boolean) as any) : []);
    setImmediateActions(Array.isArray(j.immediateActions) ? (j.immediateActions.filter(Boolean) as any) : []);
    setRecoveryActions(Array.isArray(j.recoveryActions) ? (j.recoveryActions.filter(Boolean) as any) : []);

    setAgreeNoSecondMessage(!!j.agreeNoSecondMessage);
    setAgreeReturnToPlan(!!j.agreeReturnToPlan);

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
        if (loaded) setStep(2); // مرور: مستقیم مرحله ۲ (جمع‌بندی)
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
  const toggle = useCallback(
    <T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>, k: T) => {
      if (isReview) return;
      setter((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const step1Ok = acceptedTruth && acceptedNotEnd;
  const step2Ok =
    violationTypes.length >= 1 &&
    triggers.length >= 1 &&
    immediateActions.length >= 3 &&
    recoveryActions.length >= 2 &&
    agreeNoSecondMessage &&
    agreeReturnToPlan;

  const canGo2 = step1Ok;
  const canFinalize = step1Ok && step2Ok;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedViolationTitles = useMemo(() => {
    const set = new Set(violationTypes);
    return VIOLATION_TYPES.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [violationTypes]);

  const selectedTriggerTitles = useMemo(() => {
    const set = new Set(triggers);
    return TRIGGERS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [triggers]);

  const selectedImmediateTitles = useMemo(() => {
    const set = new Set(immediateActions);
    return IMMEDIATE_ACTIONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [immediateActions]);

  const selectedRecoveryTitles = useMemo(() => {
    const set = new Set(recoveryActions);
    return RECOVERY_ACTIONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [recoveryActions]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL5Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedTruth: true,
      acceptedNotEnd: true,

      violationTypes: violationTypes || [],
      triggers: triggers || [],
      immediateActions: immediateActions || [],
      recoveryActions: recoveryActions || [],

      agreeNoSecondMessage: true,
      agreeReturnToPlan: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL5_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [violationTypes, triggers, immediateActions, recoveryActions]);

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
        acceptedTruth,
        acceptedNotEnd,

        violationTypesCount: violationTypes.length,
        triggersCount: triggers.length,
        immediateActionsCount: immediateActions.length,
        recoveryActionsCount: recoveryActions.length,

        hasMinImmediate: immediateActions.length >= 3,
        hasMinRecovery: recoveryActions.length >= 2,

        agreeNoSecondMessage,
        agreeReturnToPlan,

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
    acceptedTruth,
    acceptedNotEnd,
    violationTypes.length,
    triggers.length,
    immediateActions.length,
    recoveryActions.length,
    agreeNoSecondMessage,
    agreeReturnToPlan,
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
      setStep(2);
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
        <Text style={styles.stepPillText}>۱) پذیرش</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) پلن جبران</Text>
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
              <Text style={styles.h1}>این صفحه برای «لغزش» توئه</Text>
              <Text style={styles.p}>
                اول یه چیز رو دقیق بفهم:
                {"\n"}
                لغزش **نباید** اتفاق بیفته، اما اگه اتفاق افتاد، «آخر دنیا» نیست.
                {"\n\n"}
                خطر واقعی اینه که لغزش رو تبدیل کنی به «زنجیره‌ی لغزش‌ها».
                {"\n"}
                این ریزاقدام فقط برای یک چیزه:
                {"\n"}• قطعِ زنجیره
                {"\n"}• و برگشتن به مسیر درمان
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>قانون طلایی</Text>
                <Text style={styles.small}>
                  «لغزش» یک نقطه‌ست.
                  {"\n"}
                  ولی ادامه دادن لغزش یک مسیره
                  {"\n"}
                  پلن جبران یعنی: نقطه رو به مسیر تبدیل نکنی.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
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
                    <Text style={styles.choiceText}>قبول دارم: لغزش نباید تکرار بشه و باید همون لحظه جلوی زنجیره رو بگیرم.</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptedNotEnd((x) => !x);
                  }}
                  style={[styles.choiceCard, acceptedNotEnd && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptedNotEnd ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptedNotEnd ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم: این آخر دنیا نیست؛ اما باید با «اقدام» جبرانش کنم، نه با توجیه.</Text>
                  </View>
                </Pressable>
              </View>

              {!step1Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، هر دو پذیرش باید تیک بخوره.</Text> : null}

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
                <Text style={styles.h1}>پلن جبران (دو مرحله‌ای)</Text>
                <Text style={styles.p}>
                  اینجا دو بخش داریم:
                  {"\n"}۱) اقدام‌های فوری (برای قطع زنجیره، همین الان)
                  {"\n"}۲) اقدام‌های ۲۴ ساعت آینده (برای برگشت به مسیر)
                  {"\n\n"}
                  حداقل‌ها:
                  {"\n"}• نوع لغزش: ۱ مورد
                  {"\n"}• تحریک کننده: ۱ مورد
                  {"\n"}• اقدام فوری: حداقل ۳ مورد
                  {"\n"}• اقدام ۲۴ ساعته: حداقل ۲ مورد
                </Text>
              </View>

              {/* Type */}
              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>۱) چه لغزشی بود؟ (حداقل ۱)</Text>
                <Text style={styles.small}>دقیق انتخاب کن؛ چون مغز با «ابهام» دوباره لغزش می‌سازه.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {VIOLATION_TYPES.map((x) => {
                    const on = violationTypes.includes(x.key);
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => toggle(setViolationTypes, x.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{x.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                  {selectedViolationTitles.length ? (
                    selectedViolationTitles.map((t, i) => (
                      <Text key={`${t}-${i}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {/* Triggers */}
              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۲) چرا اتفاق افتاد؟ (محرک‌ها؛ حداقل  یدونه)</Text>
                <Text style={styles.small}>ما دنبال مقصر نیستیم؛ دنبال «الگو» هستیم.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {TRIGGERS.map((x) => {
                    const on = triggers.includes(x.key);
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => toggle(setTriggers, x.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{x.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>محرک‌های تو:</Text>
                  {selectedTriggerTitles.length ? (
                    selectedTriggerTitles.map((t, i) => (
                      <Text key={`${t}-${i}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {/* Immediate */}
              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۳) اقدام‌های فوری (همین الان، حداقل سه کار رو انتخاب کن)</Text>
                <Text style={styles.small}>هدف: قطع زنجیره‌ی لغزش.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {IMMEDIATE_ACTIONS.map((x) => {
                    const on = immediateActions.includes(x.key);
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => toggle(setImmediateActions, x.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{x.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>اقدام‌های فوری تو:</Text>
                  {selectedImmediateTitles.length ? (
                    selectedImmediateTitles.map((t, i) => (
                      <Text key={`${t}-${i}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {/* Recovery */}
              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۴) اقدام‌های ۲۴ ساعت آینده (حداقل  دو کار رو انتخاب کن)</Text>
                <Text style={styles.small}>هدف: برگشت به مسیر درمان و کاهش آسیب.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {RECOVERY_ACTIONS.map((x) => {
                    const on = recoveryActions.includes(x.key);
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => toggle(setRecoveryActions, x.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{x.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>اقدام‌های ۲۴ ساعت آینده:</Text>
                  {selectedRecoveryTitles.length ? (
                    selectedRecoveryTitles.map((t, i) => (
                      <Text key={`${t}-${i}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {/* Commitments */}
              <View style={[styles.dangerCard, { marginTop: 12 }]}>
                <Text style={styles.dangerTitle}>تعهد ضد زنجیره</Text>
                <Text style={styles.small}>
                  این دو تعهد، «قفل رفتاری» هستند:
                  {"\n"}• اگر پیام یا تماس اول بوده، پیام یا تماس دوم ممنوع
                  {"\n"}• بعدش باید برگردی به برنامه، نه تحلیل رابطه
                </Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeNoSecondMessage((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, agreeNoSecondMessage && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeNoSecondMessage ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeNoSecondMessage ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم: هیچ پیام، تماس یا چک کردنی تا ۲۴ ساعت آینده انجام ندم.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setAgreeReturnToPlan((x) => !x);
                    }}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      agreeReturnToPlan && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                      { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={agreeReturnToPlan ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={agreeReturnToPlan ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم: بعد از لغزش، به مسیر درمان برگردم (نه توجیه می‌کنم، نه چونه می‌زنم).</Text>
                    </View>
                  </Pressable>
                </View>

                {!step2Ok ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>
                    برای ثبت: نوع لغزش(۱) + محرک(۱) + اقدام فوری(۳) + اقدام ۲۴ساعته(۲) + هر دو تعهد لازمه.
                  </Text>
                ) : null}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(1)}
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

                {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه موارد باید کامل بشه.</Text> : null}
                {isReview ? <Text style={styles.small}>در حالت مرور، فقط نمایش است و امکان ادیت نداری.</Text> : null}
              </View>

              <View style={[styles.pairCard, { marginTop: 12 }]}>
                <Text style={styles.pairLabel}>خلاصه پلن تو:</Text>
                <Text style={styles.pairText}>• لغزش‌ها: {violationTypes.length || "—"}</Text>
                <Text style={styles.pairText}>• تریگرها: {triggers.length || "—"}</Text>
                <Text style={styles.pairText}>• اقدام فوری: {immediateActions.length || "—"}</Text>
                <Text style={styles.pairText}>• اقدام ۲۴ساعته: {recoveryActions.length || "—"}</Text>
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