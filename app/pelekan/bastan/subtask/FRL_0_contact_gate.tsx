// app/pelekan/bastan/subtask/FRL_0_contact_gate.tsx
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
  if (k === "FRL_0_contact_gate") return "ریز اقدام";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type GateChoice = "not_forced" | "forced";

type FRL0Saved = {
  version: 1;
  savedAt: string;
  gateChoice: GateChoice;

  // only if gateChoice === "not_forced"
  checklist: {
    noFriendship: boolean;
    noSometimesTalk: boolean;
    noDM: boolean;
    noCallVoice: boolean;
    noTurnAccidentalToIntentional: boolean;

    nohbd: boolean; // ✅ مورد جدید: تبریک مناسبت‌ها ممنوع

    noFollow: boolean;
    noStoryCheck: boolean;
    noAskFriends: boolean;
    noViaOthers: boolean;
    noWaitingForMessage: boolean;

    noTripHangouts: boolean;
    noGatheringsWithChance: boolean;
    noUnnecessaryWork: boolean;
    noHelpAskGive: boolean;
    noBorrowLendMoney: boolean;

    noRumination: boolean;
    noHiddenHope: boolean;
    noMindReading: boolean;
    noBehaviorAnalysis: boolean;

    finalCommitment: boolean;
  };

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_0_contact_gate";
const KEY_FRL0_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

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

/* ----------------------------- Checklist Model ----------------------------- */
const CHECKLIST_ITEMS: { key: keyof FRL0Saved["checklist"]; title: string }[] = [
  // Direct
  { key: "noFriendship", title: "می‌دونم «دوست موندن» با پارتنر یا همسر سابق اشتباهه" },
  { key: "noSometimesTalk", title: "می‌دونم «گاهی‌وقت‌ها حرف زدن» ممنوعه" },
  { key: "noDM", title: "می‌دونم پیام دادن به هر بهونه‌ای ممنوعه" },
  { key: "noCallVoice", title: "می‌دونم تماس تلفنی یا ویس ممنوعه" },
  { key: "noTurnAccidentalToIntentional", title: "می‌دونم دیدار اتفاقی نباید به دیدار عمدی تبدیل بشه" },
  { key: "nohbd", title: "می‌دونم تبریک مناسبت‌های خاص مثل تولد و سال نو ممنوعه" },

  // Indirect
  { key: "noFollow", title: "می‌دونم فالو داشتن، آنفالو و ری‌فالو کردن ممنوعه" },
  { key: "noStoryCheck", title: "می‌دونم چک کردن استوری، پروفایل و ساعت آنلاین بودن ممنوعه" },
  { key: "noAskFriends", title: "می‌دونم پرس‌وجو از دوستان مشترک ممنوعه" },
  { key: "noViaOthers", title: "می‌دونم پیام از طریق واسطه ممنوعه" },
  { key: "noWaitingForMessage", title: "می‌دونم منتظر پیام موندن یا براش سناریو ساختن ممنوعه" },

  // Situational
  { key: "noTripHangouts", title: "می‌دونم سفر یا برنامه مشترک ممنوعه" },
  { key: "noGatheringsWithChance", title: "می‌دونم حضور در دورهمی‌های با احتمال حضور اون، ممنوعه" },
  { key: "noUnnecessaryWork", title: "می‌دونم همکاری غیرضروری ممنوعه" },
  { key: "noHelpAskGive", title: "می‌دونم کمک خواستن یا کمک دادن ممنوعه" },
  { key: "noBorrowLendMoney", title: "می‌دونم پول قرض گرفتن یا قرض دادن ممنوعه" },

  // Hidden emotional
  { key: "noRumination", title: "می‌دونم نشخوار آگاهانه درباره اون، ممنوعه" },
  { key: "noHiddenHope", title: "می‌دونم نگه داشتن امید پنهون به بازگشت، ممنوعه" },
  { key: "noMindReading", title: "می‌دونم ذهن‌خوانی و حدس‌زدن احساس اون ممنوعه مثلا بگی میدونم الان بهم فکر میکنه" },
  { key: "noBehaviorAnalysis", title: "می‌دونم تحلیل رفتارهاش برای آروم شدن، ممنوعه" },

  // Final lock
  { key: "finalCommitment", title: "متعهد می‌شوم هیچ تماس مستقیم، غیرمستقیم و هیجانی با اون نداشته باشم و اگر به شکل ناگهانی دیدمش از تکنیک تب پناهگاه کمک بگیرم" },
];

function emptyChecklist(): FRL0Saved["checklist"] {
  return {
    noFriendship: false,
    noSometimesTalk: false,
    noDM: false,
    noCallVoice: false,
    noTurnAccidentalToIntentional: false,
    nohbd: false,

    noFollow: false,
    noStoryCheck: false,
    noAskFriends: false,
    noViaOthers: false,
    noWaitingForMessage: false,

    noTripHangouts: false,
    noGatheringsWithChance: false,
    noUnnecessaryWork: false,
    noHelpAskGive: false,
    noBorrowLendMoney: false,

    noRumination: false,
    noHiddenHope: false,
    noMindReading: false,
    noBehaviorAnalysis: false,

    finalCommitment: false,
  };
}

/* ----------------------------- Screen ----------------------------- */
export default function FRL0ContactGateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "دوراهی تماس";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // steps: 1 gate, 2 checklist (if not_forced), 3 finish
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  const [gateChoice, setGateChoice] = useState<GateChoice | null>(null);
  const [checklist, setChecklist] = useState<FRL0Saved["checklist"]>(emptyChecklist());

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
    const raw = await AsyncStorage.getItem(KEY_FRL0_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL0Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const gc = (String(j.gateChoice || "") as GateChoice) || null;
    setGateChoice(gc);

    setChecklist(j.checklist ? { ...emptyChecklist(), ...j.checklist } : emptyChecklist());

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
        if (loaded) setStep(3);
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

  /* ----------------------------- Handlers ----------------------------- */
  const onPickGate = useCallback(
    (v: GateChoice) => {
      if (isReview) return;
      setGateChoice(v);
      // reset checklist if they switch
      setChecklist(emptyChecklist());
    },
    [isReview]
  );

  const toggleChecklist = useCallback(
    (k: keyof FRL0Saved["checklist"]) => {
      if (isReview) return;
      setChecklist((c) => ({ ...c, [k]: !c[k] }));
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const gateOk = useMemo(() => !!gateChoice, [gateChoice]);

  const checklistOk = useMemo(() => {
    if (gateChoice !== "not_forced") return true;
    return CHECKLIST_ITEMS.every((it) => !!checklist[it.key]);
  }, [checklist, gateChoice]);

  const canFinalize = useMemo(() => {
    if (!gateChoice) return false;
    if (gateChoice === "forced") return true;
    return checklistOk;
  }, [checklistOk, gateChoice]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL0Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      gateChoice: gateChoice || "forced",
      checklist: gateChoice === "not_forced" ? checklist : { ...emptyChecklist(), finalCommitment: true },
      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL0_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [checklist, gateChoice]);

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

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        gateChoice: gateChoice || "forced",
        // فشرده، برای لاگ/تحلیل
        checklistAllChecked: gateChoice === "not_forced" ? checklistOk : true,
        checklistCount: gateChoice === "not_forced" ? CHECKLIST_ITEMS.filter((x) => checklist[x.key]).length : 0,
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
  }, [apiBase, checklist, checklistOk, closeModal, gateChoice, openModal, phone, token]);

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
      setStep(3);
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
        <Text style={styles.stepPillText}>۱) دوراهی</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) چک‌لیست</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) پایان</Text>
      </View>
    </View>
  );

  const gateChoiceTitle = useMemo(() => {
    if (gateChoice === "not_forced") return "مجبور نیستم (قطع ارتباط کامل)";
    if (gateChoice === "forced") return "مجبورم (تماس نقش‌محور)";
    return "—";
  }, [gateChoice]);

  const checkedCount = useMemo(() => {
    return CHECKLIST_ITEMS.filter((x) => !!checklist[x.key]).length;
  }, [checklist]);

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

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>اول تکلیف رو روشن کن</Text>
                <Text style={styles.p}>
                  اینجا نقطه‌ایه که مغز معمولاً شروع می‌کنه «استثنا» ساختن.
                  {"\n"}پس ما اول یک دوراهی دقیق می‌سازیم.
                  {"\n\n"}
                  اگر واقعاً مجبور نیستی (یعنی اگه همکار،همکلاسی، شریک کاری و همسایه نیستید یا فرزند مشترک ندارید )، باید قطع ارتباط کامل رو انتخاب کنی.
                  {"\n"}
                  {"\n"}اگر مجبور هستی ارتباط داشته باشی باید همین‌جا تمومش کنی و برو ادامهٔ ریزاقدام‌های تماس نقش‌محور رو انجام بده.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => onPickGate("not_forced")}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    gateChoice === "not_forced" && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={gateChoice === "not_forced" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={gateChoice === "not_forced" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceText}>مجبور نیستم در ارتباط باشم</Text>
                      <Text style={styles.small}>پس باید «قطع ارتباط کامل» رو انجام بدم و راه فرار نذارم.</Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => onPickGate("forced")}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    gateChoice === "forced" && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={gateChoice === "forced" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={gateChoice === "forced" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceText}>مجبورم در ارتباط باشم</Text>
                      <Text style={styles.small}>به دلیل نقش‌های واقعی (مثل کار، درس، همسایگی و فرزند مشترک  ) باید تماس «نقش‌محور» رو تنظیم کنم.</Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.back()}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!gateOk || saving}
                    onPress={() => {
                      if (!isReview && !startedAtRef.current) startedAtRef.current = Date.now();
                      if (gateChoice === "not_forced") setStep(2);
                      else setStep(3);
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, (!gateOk || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{gateChoice === "not_forced" ? "رفتن به چک‌لیست" : "رفتن به پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!gateOk ? <Text style={styles.warn}>برای ادامه، یکی از دو گزینه رو انتخاب کن.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>چک‌لیست قطع ارتباط کامل</Text>
                <Text style={styles.p}>
                  این چک‌لیست برای «آموزش» نیست.
                  {"\n"}برای اینه که وقتی حالت بد شد، مغزت نتونه با «استثنا» دوباره تماس رو باز کنه.
                  {"\n\n"}برای ادامه باید همه موارد، تیک بخورن.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {CHECKLIST_ITEMS.map((it) => {
                  const on = !!checklist[it.key];
                  return (
                    <Pressable
                      key={String(it.key)}
                      onPress={() => toggleChecklist(it.key)}
                      disabled={isReview}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{it.title}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.pairCard, { marginTop: 10 }]}>
                <Text style={styles.pairLabel}>پیشرفت:</Text>
                <Text style={styles.pairText}>
                  {checkedCount} / {CHECKLIST_ITEMS.length}
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  اگر یک مورد رو نمی‌تونی تیک بزنی یعنی هنوز «بخش‌هایی از تماس» برات توجیه‌پذیر مونده و همین نقطه، آسیب اصلیه.
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
                    style={[styles.primaryBtn, { flex: 1 }, (!checklistOk || saving) && { opacity: 0.45 }]}
                    disabled={!checklistOk || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!checklistOk ? <Text style={styles.warn}>برای ادامه، همه موارد باید تیک بخورن.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  انتخاب تو:
                  {"\n"}• {gateChoiceTitle}
                  {"\n\n"}
                  {gateChoice === "not_forced"
                    ? "از این لحظه «هیچ نوع تماس» نباید اتفاق بیفته. حتی اگر حالِت بد شد."
                    : "از این لحظه، تماس باید فقط «نقش‌محور» باشد. برای قوانین دقیق، برو سراغ زیر‌اقدام‌های بعدی همین اقدام."}
                  {"\n\n"}وقتی ثبت کنی، این ریز اقدام قفل میشه.
                </Text>

                {gateChoice === "not_forced" ? (
                  <View style={[styles.pairCard, { marginTop: 10 }]}>
                    <Text style={styles.pairLabel}>چک‌لیست:</Text>
                    <Text style={styles.pairText}>
                      {checkedCount} / {CHECKLIST_ITEMS.length}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (gateChoice === "not_forced") setStep(2);
                      else setStep(1);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={saving || (!isReview && !canFinalize)}
                    onPress={() => {
                      if (isReview) {
                        router.back();
                        return;
                      }
                      setConfirmLockModal(true);
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? <Text style={styles.warn}>برای ثبت، باید همه شروط کامل باشد.</Text> : null}
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