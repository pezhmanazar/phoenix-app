// app/pelekan/bastan/subtask/CC_3_24h_safety_check.tsx

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
  if (k === "CC_1_read_contract") return "ریز اقدام اول";
  if (k === "CC_2_signature") return "ریز اقدام دوم";
  if (k === "CC_3_24h_safety_check") return "ریز اقدام سوم";
  return "ریز اقدام";
}

function todayFaString() {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}/${m}/${day}`;
    }
  }
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";
type NoContactEventType = "none" | "role_based" | "emotional";

function noContactEventTypeFa(t: NoContactEventType) {
  if (t === "none") return "ندارم";
  if (t === "role_based") return "نقش‌محور (اجباری)";
  if (t === "emotional") return "هیجانی";
  return "نامشخص";
}

type TriggerKey =
  | "alone_night"
  | "social_media"
  | "photos"
  | "route_place"
  | "music"
  | "anniversary"
  | "stress"
  | "family_conflict";

type PlanActionKey =
  | "mute_block"
  | "remove_shortcuts"
  | "delete_chat"
  | "tell_friend"
  | "leave_house"
  | "grounding"
  | "write_note"
  | "timer_10min"
  | "no_scroll"
  | "sleep_plan";

type CC3Saved = {
  version: 1;
  savedAt: string;
  checkedAt: string;
  todayFa: string;
  eventType: NoContactEventType;
  urgeLevel: 0 | 1 | 2 | 3;
  hasEasyAccess: boolean;
  riskTriggers: TriggerKey[];
  planActions: PlanActionKey[];
  safeContactName?: string | null;
  commitmentText: string;
  computed: {
    isSafe: boolean;
    reason: string[];
  };
  finalAcknowledged: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CC_3_24h_safety_check";
const KEY_CC3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Options ----------------------------- */

const TRIGGERS: { key: TriggerKey; title: string; desc: string }[] = [
  { key: "alone_night", title: "امشب تنهام", desc: "وقتی تنها می‌مونی میل به چک کردن یا تماس گرفتن  بالا می‌ره" },
  { key: "social_media", title: "شبکه‌های اجتماعی در دسترس منه", desc: "استوری، پروفایل و اکسپلور محرک اصلیه" },
  { key: "photos", title: "عکس‌ها و چت‌ها در دسترسه", desc: "عکس‌ها و چت‌های قدیمی مثل بمب عمل می‌کنن" },
  { key: "route_place", title: "به مسیر یا مکان‌های مشترک رفت و آمد دارم", desc: "رد شدن از جاهای مشترک یا مکان‌های خاطره‌دار آزاردهنده‌ست" },
  { key: "music", title: "موسیقی یا پلی‌لیست مشترک در دسترسه", desc: "موزیک‌هایی که مستقیم تو رو می‌بره سمت خاطرات، وسوسه کننده‌ست" },
  { key: "anniversary", title: "داخل یک تاریخ‌ خاص هستم", desc: "سالگردها، روزهای مشترک، روز تولد" },
  { key: "stress", title: "استرس و فشار بالایی رومه", desc: "وقتی فشار میاد مغز دنبال مسکن فوری می‌گرده" },
  { key: "family_conflict", title: "تنش خانوادگی دارم", desc: "دلخوری و جر و بحث می‌تونه محرک تماس بشه" },
];

const PLAN_ACTIONS: { key: PlanActionKey; title: string; desc: string }[] = [
  { key: "mute_block", title: "اکست رو بی‌صداش کن یا یک روز کامل بلاکش کن", desc: "حداقل ۲۴ ساعت مسیر تماس رو سخت کن" },
  { key: "remove_shortcuts", title: "میانبرها رو حذف کن", desc: "چت یا شماره یا اکانتش رو از جلوی دستت دور کن مثلا آرشیوش کن یا قفلش کن یا از همه بهتر، پاکش کن" },
  { key: "delete_chat", title: " چت با اون رو ببند", desc: "چت باز مساویه با لغزش" },
  { key: "tell_friend", title: "خبر کردن یک نفر", desc: "به یک آدم امن بگو امروز احتمال داره وسوسه بشم و بهش خبر بده که موقع وسوسه باهاش تماس می‌گیری" },
  { key: "leave_house", title: "تغییر فضا", desc: "اگه خونه برات محرکه، از خونه بیرون برو" },
  { key: "grounding", title: "آرام‌سازی تنفسی", desc: "وقتی موج وسوسه سراغت میاد، ۳ دقیقه تنفس عمیق انجام بده" },
  { key: "write_note", title: "نوشتن یک یادداشت", desc: "فقط ۵ خط بنویس که چرا نباید تماس بگیری؟" },
  { key: "timer_10min", title: "قانون ۱۰ دقیقه", desc: "وقتی میل وسوسه سراغت اومد: ۱۰ دقیقه صبر کن و بعد تصمیم بگیر" },
  { key: "no_scroll", title: " اسکرول نکن", desc: "داخل اکسپلور نچرخ و استوری‌ها رو نگاه نکن چون اینکار سوخت نشخوار فکری رو ایجاد میکنه" },
  { key: "sleep_plan", title: "برنامه خواب داشته باش", desc: "چون خواب بد برابره با ریسک بیشتر" },
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

export default function CC324hSafetyCheckScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "بررسی ایمنی ۲۴ ساعته";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 2 states
  const [todayFa, setTodayFa] = useState<string>(todayFaString());
  const [eventType, setEventType] = useState<NoContactEventType | null>(null);
  const [urgeLevel, setUrgeLevel] = useState<0 | 1 | 2 | 3>(0);
  const [hasEasyAccess, setHasEasyAccess] = useState<boolean>(false);
  const [riskTriggers, setRiskTriggers] = useState<TriggerKey[]>([]);
  const [planActions, setPlanActions] = useState<PlanActionKey[]>([]);
  const [safeContactName, setSafeContactName] = useState<string>("");
  const [commitmentText, setCommitmentText] = useState<string>("");

  // Step 3 (lock)
  const [cooldownDone, setCooldownDone] = useState(false);
  const cooldownTimerRef = useRef<any>(null);
  const [finalAcknowledge, setFinalAcknowledge] = useState(false);

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

  /* ----------------------------- Helpers ----------------------------- */

  const toggleArrayItem = useCallback(<T extends string>(arr: T[], key: T) => {
    if (arr.includes(key)) return arr.filter((x) => x !== key);
    return [...arr, key];
  }, []);

  /* ----------------------------- Computed ----------------------------- */

  const commitmentOk = useMemo(() => String(commitmentText || "").trim().length >= 8, [commitmentText]);
  const planMinRequired = useMemo(() => {
    if (urgeLevel >= 2 || hasEasyAccess) return 3;
    return 2;
  }, [urgeLevel, hasEasyAccess]);

  const step2Ok = useMemo(() => {
    if (!eventType) return false;
    if (!commitmentOk) return false;
    if (planActions.length < planMinRequired) return false;
    return true;
  }, [commitmentOk, eventType, planActions.length, planMinRequired]);

  const computed = useMemo(() => {
    const reason: string[] = [];
    if (!eventType) reason.push("no_event_type");
    if (eventType === "emotional") reason.push("emotional_event");
    if (urgeLevel >= 2) reason.push("high_urge");
    if (hasEasyAccess) reason.push("easy_access");
    if (planActions.length < planMinRequired) reason.push("weak_plan");

    // تعریف سخت‌گیرانه "ایمن"
    const isSafe =
      eventType !== null &&
      eventType !== "emotional" &&
      urgeLevel <= 1 &&
      !hasEasyAccess &&
      planActions.length >= 2;

    return { isSafe, reason };
  }, [eventType, hasEasyAccess, planActions.length, planMinRequired, urgeLevel]);

  const canGo2 = true;
  const canGo3 = step2Ok;
  const canFinalize = step2Ok && cooldownDone && finalAcknowledge;

  /* ----------------------------- Load FINAL (review) ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CC3_FINAL);
    if (!raw) return { loaded: false as const };

    let j: CC3Saved | null = null;
    try {
      j = JSON.parse(raw) as CC3Saved;
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return { loaded: false as const };

    setTodayFa(String(j.todayFa || todayFaString()));
    setEventType(j.eventType);
    setUrgeLevel(j.urgeLevel);
    setHasEasyAccess(!!j.hasEasyAccess);
    setRiskTriggers(Array.isArray(j.riskTriggers) ? j.riskTriggers : []);
    setPlanActions(Array.isArray(j.planActions) ? j.planActions : []);
    setSafeContactName(String(j.safeContactName || ""));
    setCommitmentText(String(j.commitmentText || ""));

    setCooldownDone(true);
    setFinalAcknowledge(!!j.finalAcknowledged);

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const r = await loadFinalIfAny();
        if (!alive) return;

        if (r.loaded) {
          setIsReview(true);
          setStep(3);
          return;
        }

        setIsReview(false);
        setStep(1);
      } catch {
        setIsReview(false);
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

  /* ----------------------------- Step 3 cooldown ----------------------------- */

  useEffect(() => {
    if (isReview) return;

    if (step !== 3) {
      setCooldownDone(false);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
      return;
    }

    setCooldownDone(false);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

    cooldownTimerRef.current = setTimeout(() => {
      setCooldownDone(true);
      cooldownTimerRef.current = null;
    }, 20000);

    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    };
  }, [step, isReview]);

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const checkedAt = new Date().toISOString();

    const payload: CC3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      checkedAt,
      todayFa,
      eventType: (eventType || "none") as NoContactEventType,
      urgeLevel,
      hasEasyAccess,
      riskTriggers,
      planActions,
      safeContactName: String(safeContactName || "").trim() || null,
      commitmentText: String(commitmentText || "").trim(),
      computed,
      finalAcknowledged: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CC3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [
    commitmentText,
    computed,
    eventType,
    hasEasyAccess,
    planActions,
    riskTriggers,
    safeContactName,
    todayFa,
    urgeLevel,
  ]);

  /* ----------------------------- Server submit ----------------------------- */

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

    const checkedAt = new Date().toISOString();
    const et = (eventType || "none") as NoContactEventType;

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        step2: {
          todayFa,
          eventType: et,
          urgeLevel,
          hasEasyAccess,
          riskTriggers,
          planActions,
          safeContactName: String(safeContactName || "").trim() || null,
          commitmentText: String(commitmentText || "").trim(),
        },
        step3: {
          cooldownDone,
          finalAcknowledge,
          checkedAt,
        },
        summary: {
          lastSafetyCheckResult: et, // خیلی مهم: همون enum دیتابیس
          isSafe: computed.isSafe,
          reason: computed.reason,
          checkedAt,
        },
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
    closeModal,
    commitmentText,
    computed.isSafe,
    computed.reason,
    cooldownDone,
    eventType,
    finalAcknowledge,
    hasEasyAccess,
    openModal,
    phone,
    planActions,
    riskTriggers,
    safeContactName,
    todayFa,
    token,
    urgeLevel,
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
          title: "قبلاً ثبت شده",
          message: "این ریز اقدام قبلاً ثبت شده و نیازی به ثبت دوباره نیست.",
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
        message: computed.isSafe
          ? "بررسی ایمنی ثبت شد."
          : "ثبت شد. فعلاً «ایمن نیستی» و این یعنی باید ۲۴ ساعت محافظت رو جدی‌تر اجرا کنی.",
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
      setStep(3);
    }
  }, [canFinalize, closeModal, completeOnServer, computed.isSafe, openModal, persistFinalLocal, router]);

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
        <Text style={styles.stepPillText}>۱) معنا</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) ارزیابی</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) قفل</Text>
      </View>
    </View>
  );

  /* ----------------------------- UI bits ----------------------------- */

  const EventChoice = ({
    v,
    title,
    desc,
  }: {
    v: NoContactEventType;
    title: string;
    desc: string;
  }) => {
    const on = eventType === v;
    return (
      <Pressable
        onPress={() => (isReview ? null : setEventType(v))}
        disabled={isReview}
        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.75 }]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={on ? "radio-button-on" : "radio-button-off"}
            size={18}
            color={on ? (v === "emotional" ? palette.orange : palette.green) : "rgba(231,238,247,.55)"}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.choiceText}>{title}</Text>
            <Text style={[styles.small, { marginTop: 4 }]}>{desc}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const ToggleRow = ({
    on,
    title,
    desc,
    danger,
    onPress,
    disabled,
  }: {
    on: boolean;
    title: string;
    desc?: string;
    danger?: boolean;
    onPress: () => void;
    disabled?: boolean;
  }) => {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={[
          styles.choiceCard,
          on && (danger ? styles.choiceCardWarnOn : styles.choiceCardOn),
          disabled && { opacity: 0.75 },
        ]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={on ? "checkbox" : "square-outline"}
            size={18}
            color={on ? (danger ? palette.orange : palette.green) : "rgba(231,238,247,.55)"}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.choiceText}>{title}</Text>
            {!!desc ? <Text style={[styles.small, { marginTop: 4 }]}>{desc}</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  };

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
              <Text style={styles.reviewBannerText}>حالت مرور فعال است: می‌تونی ببینی ولی قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {StepPills}

          {/* Step 1 */}
          {step === 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>پیش‌نیاز رفتن به پله بعد</Text>
              <Text style={styles.p}>
                اینجا قراره سعی کنی به مدت ۲۴ ساعت از رابطه تموم شده خودت به طور کامل، دور باشی
                {"\n"} و همین مجوز رفتن به مرحله بعد رو بهت میده.
                {"\n"}
              </Text>

              <View style={{ height: 10 }} />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>یادآوری</Text>
                <View style={{ height: 10 }} />
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <Ionicons name="information-circle" size={18} color="rgba(231,238,247,.70)" />
                  <Text style={[styles.small, { flex: 1 }]}>
                    اگر «تماس یا چک کردن هیجانی» داشته باشی، این یعنی فعلاً مجوز رو دریافت نمی‌کنی.
                    {"\n"}البته  اگه این کارو کنی یه شکست به حساب نمیاد بلکه با تلاش دوباره سعی می‌کنی از برگشت به چرخه جلوگیری کنی.
                  </Text>
                </View>
              </View>

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
                <Text style={styles.primaryBtnText}>شروع ارزیابی</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>ارزیابی ۲۴ ساعته</Text>
                <Text style={styles.p}>
                  تاریخ امروز: {todayFa}
                  {"\n"}اینجا به سه بخش جواب می‌دی: رخداد، ریسک، نقشه محافظتی.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۱) رخداد ۲۴ ساعت گذشته</Text>
                <View style={{ height: 10 }} />

                <EventChoice
                  v="none"
                  title="هیچ تماس یا چک کردنی نداشتم"
                  desc="نه پیام، نه تماس، نه سرک‌کشیدن (مثل استوری نگاه کردن یا پروفایل چک کردن یا پرس‌وجو کردن)."
                />
                <View style={{ height: 10 }} />
                <EventChoice
                  v="role_based"
                  title="فقط ارتباط نقش‌محور داشتم"
                  desc="اجباری و خشک باهاش ارتباط داشتم به دلیل کار یا فرزند یا تحصیل البته بدون ایجاد مسیر هیجانی."
                />
                <View style={{ height: 10 }} />
                <EventChoice
                  v="emotional"
                  title="تماس یا چک کردن هیجانی داشتم"
                  desc="هر نوع پیام احساسی، کنایه، حال‌پرسیدن بهونه‌ای، یا چک کردن استوری یا پروفایل."
                />

                {!eventType ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>اول نوع رخداد رو مشخص کن.</Text>
                ) : null}
              </View>

              <View style={{ height: 12 }} />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>۲) ریسک الان</Text>
                <View style={{ height: 10 }} />

                <Text style={styles.small}>الان میل ب تماس یا چک کردن:</Text>
                <View style={{ height: 10 }} />

                <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
                  {([0, 1, 2, 3] as const).map((n) => {
                    const on = urgeLevel === n;
                    const label = n === 0 ? "۰: ندارم" : n === 1 ? "۱: یکم دارم" : n === 2 ? "۲: تقریبا دارم" : "۳: زیاد دارم";
                    return (
                      <Pressable
                        key={n}
                        onPress={() => (isReview ? null : setUrgeLevel(n))}
                        disabled={isReview}
                        style={[
                          styles.pill,
                          on && (n >= 2 ? styles.pillWarnOn : styles.pillOn),
                          isReview && { opacity: 0.75 },
                        ]}
                      >
                        <Text style={styles.pillText}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ height: 12 }} />

                <ToggleRow
                  on={hasEasyAccess}
                  title="همچنین دسترسی فوری بهش دارم (اگه نداری این بخش رو تیک نزن)"
                  desc="یعنی چت، شماره یا اکانت جلوی دستم هست و با ۲ کلیک می‌تونم برم سمتش."
                  danger
                  disabled={isReview}
                  onPress={() => setHasEasyAccess((v) => !v)}
                />

                <View style={{ height: 12 }} />

                <Text style={styles.small}>محرک‌های فعال امروز که میتونه تو رو وسوسه یا منحرف کنه رو انتخاب کن:</Text>
                <View style={{ height: 10 }} />
                {TRIGGERS.map((t) => {
                  const on = riskTriggers.includes(t.key);
                  return (
                    <View key={t.key} style={{ marginTop: 8 }}>
                      <ToggleRow
                        on={on}
                        title={t.title}
                        desc={t.desc}
                        disabled={isReview}
                        onPress={() => setRiskTriggers((arr) => toggleArrayItem(arr, t.key))}
                      />
                    </View>
                  );
                })}
              </View>

              <View style={{ height: 12 }} />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>۳) پلن محافظتی ۲۴ ساعته</Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  حداقل انتخاب لازم: {planMinRequired} مورد
                  {urgeLevel >= 2 || hasEasyAccess ? " (چون ریسک بالاتره)" : ""}
                </Text>

                <View style={{ height: 10 }} />

                {PLAN_ACTIONS.map((a) => {
                  const on = planActions.includes(a.key);
                  return (
                    <View key={a.key} style={{ marginTop: 8 }}>
                      <ToggleRow
                        on={on}
                        title={a.title}
                        desc={a.desc}
                        disabled={isReview}
                        onPress={() => setPlanActions((arr) => toggleArrayItem(arr, a.key))}
                      />
                    </View>
                  );
                })}

                {planActions.length < planMinRequired ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>
                    پلن محافظتی هنوز ضعیفه. حداقل {planMinRequired} مورد انتخاب کن.
                  </Text>
                ) : null}

                <View style={{ height: 12 }} />

                <Text style={styles.noteTitle}>یک نفر امن (اختیاری ولی مفید)</Text>
                <View style={{ height: 10 }} />
                <TextInput
                  value={safeContactName}
                  onChangeText={(t) => (isReview ? null : setSafeContactName(t))}
                  editable={!isReview}
                  placeholder="اسم یک نفر که اگه موج وسوسه سراغت اومد، بهش پیام بدی"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.textInput, isReview && { opacity: 0.7 }]}
                />

                <View style={{ height: 12 }} />

                <Text style={styles.noteTitle}>تعهد ۲۴ ساعته (یک جمله)</Text>
                <Text style={[styles.small, { marginTop: 6 }]}>
                  واضح و بدون توجیه. مثال: «تا ۲۴ ساعت آینده هیچ تماس یا چک کردنی ندارم. اگه موج ناراحتی سراغم اومد، نقشه محافظتی رو اجرا می‌کنم.»
                </Text>

                <View style={{ height: 10 }} />
                <TextInput
                  value={commitmentText}
                  onChangeText={(t) => (isReview ? null : setCommitmentText(t))}
                  editable={!isReview}
                  multiline
                  placeholder="جمله تعهد…"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.textArea, isReview && { opacity: 0.7 }]}
                />
                {!commitmentOk ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>حداقل یک جمله واقعی بنویس.</Text>
                ) : null}

                <View style={{ height: 12 }} />

                {/* status */}
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={step2Ok ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={step2Ok ? palette.green : "rgba(231,238,247,.45)"}
                  />
                  <Text style={styles.small}>
                    {step2Ok ? "مرحله ارزیابی کامله." : "برای ادامه: رخداد + نقشه + تعهد لازمه."}
                  </Text>
                </View>

                {!step2Ok ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>تا وقتی کامل نشه، مرحله قفل، باز نمی‌شه.</Text>
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

          {/* Step 3 */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قفل ثبت</Text>
                <Text style={styles.p}>
                  اینجا «مکث اجباری» داریم.
                  {"\n"}تا مغز از حالت فرار خارج بشه و بعد ثبت کنی.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>مکث</Text>

                <Text style={[styles.small, { marginTop: 8 }]}>این تصمیم ممکنه سخت‌ترین تصمیم این مرحله باشه.</Text>
                <View style={{ height: 6 }} />
                <Text style={styles.small}>
                  {cooldownDone
                    ? "حالا می‌تونی با آگاهی کامل ثبتش کنی."
                    : "چند ثانیه مکث کن. چون عجله کردن یعنی لغزش."}
                </Text>

                <View style={{ height: 12 }} />

                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>نتیجه‌ی ارزیابی</Text>
                  <View style={{ height: 10 }} />

                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={computed.isSafe ? "checkmark-circle" : "warning"}
                      size={18}
                      color={computed.isSafe ? palette.green : palette.orange}
                    />
                    <Text style={styles.small}>
                      {computed.isSafe ? "ایمن هستی." : "فعلاً ایمن نیستی."}
                    </Text>
                  </View>

                  <View style={{ height: 8 }} />

                  <Text style={styles.small}>
  رخداد: {noContactEventTypeFa(eventType ?? "none")}
</Text>
                  <Text style={styles.small}>میل: {String(urgeLevel)}</Text>
                  <Text style={styles.small}>دسترسی فوری: {hasEasyAccess ? "دارم" : "ندارم"}</Text>
                  <Text style={styles.small}>پلن انتخاب شده: {String(planActions.length)}</Text>

                  {!computed.isSafe ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.warn, { marginBottom: 6 }]}>
                        این «نه» یعنی باید پلن رو جدی‌تر اجرا کنی، نه اینکه خودت رو له کنی.
                      </Text>
                      <Text style={styles.small}>
                        اگر امروز ریسک بالاست، هدف فقط یک چیزه: ۲۴ ساعت بدون تماس/چک.
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={() => (isReview ? null : setFinalAcknowledge((v) => !v))}
                  disabled={isReview || !cooldownDone}
                  style={[
                    styles.choiceCard,
                    finalAcknowledge && styles.choiceCardOn,
                    (isReview || !cooldownDone) && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={finalAcknowledge ? "checkbox" : "square-outline"}
                      size={18}
                      color={finalAcknowledge ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={[styles.choiceText, { flexShrink: 1 }]}>
                      با آگاهی کامل ثبت می‌کنم و می‌دونم نتیجش روی مسیرم اثر داره
                    </Text>
                  </View>
                </Pressable>

                {!isReview && !cooldownDone ? (
                  <Text style={[styles.small, { marginTop: 10 }]}>چند ثانیه…</Text>
                ) : null}

                {!isReview && cooldownDone && !finalAcknowledge ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>بدون تأیید نهایی، ثبت فعال نمی‌شه.</Text>
                ) : null}
              </View>

              <View style={{ height: 12 }} />

              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setStep(2)}
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={saving || (!isReview && !canFinalize)}
                  onPress={onFinishPress}
                  style={[
                    styles.primaryBtn,
                    { flex: 1 },
                    (saving || (!isReview && !canFinalize)) && { opacity: 0.45 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و قفل کن"}</Text>
                </TouchableOpacity>
              </View>

              {!isReview && !canFinalize ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ثبت: تکمیل مرحله دو + مکث هنگام ثبت + تأیید نهایی لازمه.
                </Text>
              ) : null}

              {isReview ? <Text style={[styles.small, { marginTop: 8 }]}>در حالت مرور، فقط نمایش است.</Text> : null}
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
        message="با زدن «ثبت و قفل کن»، این بررسی ثبت میشه و دیگه امکان تغییر وجود نداره."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلاً نه"
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

  reviewBannerText: {
    color: "rgba(231,238,247,.88)",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "right",
    flex: 1,
  },

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
  choiceCardWarnOn: { borderColor: "rgba(233,138,21,.35)", backgroundColor: "rgba(233,138,21,.07)" },

  choiceText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 18,
    flex: 1,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  pillOn: { backgroundColor: "rgba(34,197,94,.08)", borderColor: "rgba(34,197,94,.30)" },
  pillWarnOn: { backgroundColor: "rgba(233,138,21,.10)", borderColor: "rgba(233,138,21,.35)" },
  pillText: { color: "rgba(231,238,247,.90)", fontWeight: "900", fontSize: 11, textAlign: "center" },

  textInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: palette.text,
    fontWeight: "800",
    textAlign: "right",
  },

  textArea: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    color: palette.text,
    fontWeight: "800",
    textAlign: "right",
    minHeight: 92,
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
