// app/pelekan/bastan/subtask/TD_6_detox_confirm.tsx
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
  if (k === "TD_6_detox_confirm") return "ریز اقدام ششم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type StartOption = "now" | "tomorrow_morning" | "not_ready";

type TD6Saved = {
  version: 1;
  savedAt: string;

  acceptedWhy: boolean;
  acceptedDefinition: boolean;
  acceptedSlipRule: boolean;

  startOption: StartOption | null;
  plannedStartAtIso?: string | null;

  // commitment
  agreeFeelingNotDecision: boolean;
  agreeNoCheck7Days: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "TD_6_detox_confirm";
const KEY_TD6_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const START_OPTIONS: { key: StartOption; title: string; desc: string }[] = [
  { key: "now", title: "از همین لحظه شروع می‌کنم", desc: "بهونه‌های ذهنی طبیعی‌ان، اما من شروع می‌کنم." },
  { key: "tomorrow_morning", title: "از فردا صبح شروع می‌کنم", desc: "شروع مشخص: فردا صبح (بدون عقب انداختن دوباره)." },
  { key: "not_ready", title: "الان آماده نیستم", desc: " بعداً برای شروع برمی‌گردم." },
];

function computeTomorrowMorningIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

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
export default function TD6DetoxConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "محرک‌زدایی ۷ روزه";

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
  const [acceptedDefinition, setAcceptedDefinition] = useState(false);

  // Step 3
  const [acceptedSlipRule, setAcceptedSlipRule] = useState(false);

  // Step 4
  const [startOption, setStartOption] = useState<StartOption | null>(null);
  const [agreeFeelingNotDecision, setAgreeFeelingNotDecision] = useState(false);
  const [agreeNoCheck7Days, setAgreeNoCheck7Days] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_TD6_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as TD6Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedWhy(!!j.acceptedWhy);
    setAcceptedDefinition(!!j.acceptedDefinition);
    setAcceptedSlipRule(!!j.acceptedSlipRule);

    const so = (String(j.startOption || "") as StartOption) || null;
    setStartOption(so);

    setAgreeFeelingNotDecision(!!j.agreeFeelingNotDecision);
    setAgreeNoCheck7Days(!!j.agreeNoCheck7Days);

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

  /* ----------------------------- Step helpers ----------------------------- */
  const onPickStart = useCallback(
    (k: StartOption) => {
      if (isReview) return;
      setStartOption(k);
      if (k === "not_ready") {
        // وقتی آماده نیست، قفل/تعهد هم نباید زورکی فعال بشه
        setAgreeFeelingNotDecision(false);
        setAgreeNoCheck7Days(false);
      }
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const defOk = useMemo(() => acceptedDefinition, [acceptedDefinition]);
  const slipOk = useMemo(() => acceptedSlipRule, [acceptedSlipRule]);

  const startOk = useMemo(() => {
    if (!startOption) return false;
    return startOption !== "not_ready";
  }, [startOption]);

  const commitOk = useMemo(() => {
    if (!startOption || startOption === "not_ready") return false;
    return agreeFeelingNotDecision && agreeNoCheck7Days;
  }, [agreeFeelingNotDecision, agreeNoCheck7Days, startOption]);

  const canGo2 = acceptedWhy;
  const canGo3 = acceptedWhy && defOk;
  const canGo4 = acceptedWhy && defOk && slipOk;
  const canGo5 = acceptedWhy && defOk && slipOk && startOk && commitOk;
  const canFinalize = canGo5;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const plannedStartAtIso =
      startOption === "now"
        ? new Date().toISOString()
        : startOption === "tomorrow_morning"
        ? computeTomorrowMorningIso()
        : null;

    const payload: TD6Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedWhy: true,
      acceptedDefinition: true,
      acceptedSlipRule: true,

      startOption: (startOption as StartOption) || "now",
      plannedStartAtIso,

      agreeFeelingNotDecision: true,
      agreeNoCheck7Days: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_TD6_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [startOption]);

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
        acceptedWhy: true,
        acceptedDefinition: true,
        acceptedSlipRule: true,
        startOption: startOption || "now",
        willStart: startOk,
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
  }, [apiBase, closeModal, commitOk, openModal, phone, startOk, startOption, token]);

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
        <Text style={styles.stepPillText}>۱) چرا</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) قواعد</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) لغزش</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) شروع</Text>
      </View>
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵) پایان</Text>
      </View>
    </View>
  );

  const selectedStartTitle = useMemo(() => {
    const f = START_OPTIONS.find((x) => x.key === startOption);
    return f?.title || "—";
  }, [startOption]);

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={insets.top + 12}>
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
                <Text style={styles.h1}>چرا «محرک‌زدایی ۷ روزه» ضروریه؟</Text>
                <Text style={styles.p}>
                  تا وقتی مغزت هر روز «محرک» دریافت کنه، سیستم عصبی آروم نمی‌شه.
                  {"\n"}این ۷ روز برای قوی شدن نیست؛ برای «ریست شدن»ه.
                  {"\n\n"}هدف:
                  {"\n"}• قطع چرخه‌ی چک کردن و خیال‌پردازی
                  {"\n"}• کم شدن شدت موج‌های ناراحتی
                  {"\n"}• زیاد شدن فاصله‌ی بین موج‌ها
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
                    <Text style={styles.choiceText}>قبول دارم این ۷ روز برای «آروم شدن مغز»ه ، نه برای قضاوت کردن خودم</Text>
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
                <Text style={styles.h1}>تعریف دقیق محرک‌زدایی</Text>
                <Text style={styles.p}>
                  توو این ۷ روز:
                  {"\n"}• چک کردن آنلاین شدن و ساعات بازدید ممنوع
                  {"\n"}• دید زدن پیج (حتی با پیج فیک) ممنوع
                  {"\n"}• پرسیدن از دیگران ممنوع
                  {"\n"}• مرور چت‌هاو عکس‌ها ممنوع
                  {"\n"}• خیال‌پردازی آگاهانه و عمدی ممنوع
                  {"\n\n"}اگه هم موج ناراحتی اومد:
                  {"\n"}تصمیم‌گیری ممنوع؛ فقط «قانون کنترل تکانه» اجرا می‌شه.
                  {"\n"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptedDefinition((x) => !x);
                  }}
                  style={[styles.choiceCard, acceptedDefinition && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptedDefinition ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptedDefinition ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم محرک‌زدایی یعنی «قطع چک کردن و قطع خوراک ذهنی» برای ۷ روز</Text>
                  </View>
                </Pressable>

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

                  {!canGo3 ? <Text style={styles.warn}>برای ادامه، باید تعریف محرک‌زدایی رو بپذیری.</Text> : null}
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>اگه لغزش اتفاق افتاد چی؟</Text>
                <Text style={styles.p}>
                  اینو بدون که لغزش یعنی «اطلاعات مهم»، نه «شکست».
                  {"\n\n"}اگه یک بار چک کردی یا افتادی تو مرور:
                  {"\n"}۱) خودت رو سرزنش نمی‌کنی
                  {"\n"}۲) همون لحظه چرخه رو قطع می‌کنی
                  {"\n"}۳) مسیر ۷ روزه رو ادامه می‌دی (نه خودت رو تنبیه کن و نه مسیر رو صفر کن)
                  {"\n"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptedSlipRule((x) => !x);
                  }}
                  style={[styles.choiceCard, acceptedSlipRule && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptedSlipRule ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptedSlipRule ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم اگه لغزش شد، ادامه می‌دم و خودم رو نابود نمی‌کنم</Text>
                  </View>
                </Pressable>

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

                  {!canGo4 ? <Text style={styles.warn}>برای ادامه، باید قاعده‌ی برخورد با لغزش رو بپذیری.</Text> : null}
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>شروع محرک‌زدایی + قفل تعهد</Text>
                <Text style={styles.p}>
                  اینجا «فکر کردن» ممنوعه.
                  {"\n"}یا شروع می‌کنی، یا برمی‌گردی و فعلاً شروع نمی‌کنی.
                  {"\n\n"}یک گزینه رو انتخاب کن:
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {START_OPTIONS.map((s) => {
                  const on = startOption === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => onPickStart(s.key)}
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
                          <Text style={styles.choiceText}>{s.title}</Text>
                          <Text style={styles.small}>{s.desc}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {startOption === "not_ready" ? (
                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>نکته</Text>
                  <Text style={styles.small}>
                    این گزینه یعنی «این زیراقدام الان انجام نمیشه».
                    {"\n"}اینجا قرار نیست با یک تیک، از زیرش در بری.
                    {"\n"} هر وقت آماده بودی دوباره بیا.
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    if (!startOption || startOption === "not_ready") return;
                    setAgreeFeelingNotDecision((x) => !x);
                  }}
                  disabled={isReview || !startOption || startOption === "not_ready"}
                  style={[
                    styles.choiceCard,
                    agreeFeelingNotDecision && styles.choiceCardOn,
                    (isReview || !startOption || startOption === "not_ready") && { opacity: 0.65 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeFeelingNotDecision ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeFeelingNotDecision ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم توو این ۷ روز «احساسم معیار تصمیم نیست»</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    if (!startOption || startOption === "not_ready") return;
                    setAgreeNoCheck7Days((x) => !x);
                  }}
                  disabled={isReview || !startOption || startOption === "not_ready"}
                  style={[
                    styles.choiceCard,
                    agreeNoCheck7Days && styles.choiceCardOn,
                    (isReview || !startOption || startOption === "not_ready") && { opacity: 0.65 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNoCheck7Days ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNoCheck7Days ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>تعهد می‌دم ۷ روز «چک نمی‌کنم» حتی اگه مغزم گفت "فقط یک بار"</Text>
                  </View>
                </Pressable>

                <View style={[styles.pairCard, { marginTop: 2 }]}>
                  <Text style={styles.pairLabel}>شروع انتخابی:</Text>
                  <Text style={styles.pairText}>{selectedStartTitle}</Text>
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

                {!startOption ? <Text style={styles.warn}>برای ادامه، باید نحوه شروع رو انتخاب کنی.</Text> : null}
                {startOption === "not_ready" ? <Text style={styles.warn}>تا وقتی «الان آماده نیستم» انتخاب شده، امکان ثبت و قفل وجود نداره.</Text> : null}
                {startOption && startOption !== "not_ready" && !commitOk ? <Text style={styles.warn}>برای ادامه، هر دو تعهد باید تیک بخوره.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  از این لحظه، برنامه روشنه:
                  {"\n"}• محرک‌هارو باهاشون برخورد میکنی
                  {"\n"}• اون آدم رو چک نمی‌کنی
                  {"\n"}• اگه موج ناراحتی اومد، هیچ تصمیمی نمی‌گیری؛ فقط قانون رو اجرا می‌کنی و از تکنیک پناهگاه هم کمک می‌گیری
                  {"\n\n"}شروع تو:
                  {"\n"}• {selectedStartTitle}
                  {"\n"}
                </Text>
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

                {isReview ? <Text style={styles.small}>نکته: در حالت مرور، می‌تونی مراحل رو ببینی. فقط ادیت قفله.</Text> : null}
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