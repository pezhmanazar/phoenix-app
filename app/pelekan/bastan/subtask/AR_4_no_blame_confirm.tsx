// app/pelekan/bastan/subtask/AR_4_no_blame_confirm.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  findNodeHandle,
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

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "AR_1_own_share") return "ریز اقدام اول";
  if (k === "AR_2_pattern_link") return "ریز اقدام دوم";
  if (k === "AR_3_boundary_next_time") return "ریز اقدام سوم";
  if (k === "AR_4_no_blame_confirm") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

/* ----------------------------- Types ----------------------------- */
type RCAr3Saved = {
  version: 1;
  savedAt: string;
  top3: string[];
  boundaries: Record<string, string>;
  readyForEach: string[];
  agreeProtectNotControl: boolean;
  agreeSelfAction: boolean;
  agreeNotPunish: boolean;
};

type AR4Saved = {
  version: 1;
  savedAt: string;

  // ورودی از AR3 برای خلاصه‌سازی
  top3: string[];
  boundaries: Record<string, string>;

  // مرحله 1
  agreeResponsibilityNotHumiliation: boolean;

  // مرحله 2
  agreeVictimToAgent: boolean;
  agreeNotCriminal: boolean;

  // مرحله 3
  finalDecision: string;
  agreeNoSelfBlame: boolean;

  // مرحله 4
  finalSeal: boolean;
};

/* ----------------------------- Storage Keys ----------------------------- */
const KEY_AR3_FINAL = "pelekan:bastan:subtask:AR_3_boundary_next_time:final:v1";

// ✅ key صحیح جدید
const KEY_AR4_FINAL = "pelekan:bastan:subtask:AR_4_no_blame_confirm:final:v1";

// ⛔️ key قدیمی (برای مهاجرت)
const KEY_R4_FINAL_OLD = "pelekan:bastan:subtask:R_4_no_blame_confirm:final:v1";

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
                <Text style={styles.modalPrimaryText}>در حال انجام</Text>
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
export default function AR4NoBlameConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  // ✅ فقط همین کلید
  const subtaskKey = "AR_4_no_blame_confirm";
  const headerNo = subtaskNumberFa(subtaskKey);

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // داده‌های AR3
  const [top3, setTop3] = useState<string[]>([]);
  const [boundaries, setBoundaries] = useState<Record<string, string>>({});

  // Step 1
  const [agreeResponsibilityNotHumiliation, setAgreeResponsibilityNotHumiliation] = useState(false);

  // Step 2
  const [agreeVictimToAgent, setAgreeVictimToAgent] = useState(false);
  const [agreeNotCriminal, setAgreeNotCriminal] = useState(false);

  // Step 3
  const [finalDecision, setFinalDecision] = useState("");
  const [agreeNoSelfBlame, setAgreeNoSelfBlame] = useState(false);

  // Step 4
  const [finalSeal, setFinalSeal] = useState(false);

  // مودال‌ها
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

  /* ----------------------------- Scroll to input ----------------------------- */
  const scrollToInput = useCallback((id: string, extraOffset = 22) => {
    const input = inputRefs.current[id] as any;
    const scroll = scrollRef.current as any;
    if (!input || !scroll) return;

    const node = findNodeHandle(input);
    if (!node) return;

    const responder = scroll.getScrollResponder?.();
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
  }, []);

  /* ----------------------------- Load AR3 + Load FINAL(AR4) if any ----------------------------- */
  const loadAR3 = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR3_FINAL);
    if (!raw) return { ok: false as const, top3: [] as string[], boundaries: {} as Record<string, string> };

    const j = JSON.parse(raw) as RCAr3Saved;
    if (!j || j.version !== 1) return { ok: false as const, top3: [] as string[], boundaries: {} as Record<string, string> };

    const t3 = Array.isArray(j.top3) ? j.top3.slice(0, 3) : [];
    if (t3.length !== 3) return { ok: false as const, top3: [] as string[], boundaries: {} as Record<string, string> };

    const b = j.boundaries && typeof j.boundaries === "object" ? j.boundaries : {};
    return { ok: true as const, top3: t3, boundaries: b };
  }, []);

  // ✅ مهاجرت: اگر نسخه‌ی قدیمی R_4 بود، تبدیلش کن به AR_4
  const migrateOldKeyIfAny = useCallback(async () => {
    const newRaw = await AsyncStorage.getItem(KEY_AR4_FINAL);
    if (newRaw) return;

    const oldRaw = await AsyncStorage.getItem(KEY_R4_FINAL_OLD);
    if (!oldRaw) return;

    try {
      const j = JSON.parse(oldRaw) as AR4Saved;
      if (j && j.version === 1) {
        await AsyncStorage.setItem(KEY_AR4_FINAL, oldRaw);
        await AsyncStorage.removeItem(KEY_R4_FINAL_OLD);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as AR4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setTop3(Array.isArray(j.top3) ? j.top3 : []);
    setBoundaries(j.boundaries && typeof j.boundaries === "object" ? j.boundaries : {});

    setAgreeResponsibilityNotHumiliation(!!j.agreeResponsibilityNotHumiliation);
    setAgreeVictimToAgent(!!j.agreeVictimToAgent);
    setAgreeNotCriminal(!!j.agreeNotCriminal);
    setFinalDecision(String(j.finalDecision || ""));
    setAgreeNoSelfBlame(!!j.agreeNoSelfBlame);
    setFinalSeal(!!j.finalSeal);

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        await migrateOldKeyIfAny();
        if (!alive) return;

        // 1) اگر AR4 قبلاً ثبت شده، مستقیم حالت مرور
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
          setIsReview(true);
          setStep(4);
          return;
        }

        // 2) در غیر این صورت باید AR3 موجود باشد
        const r = await loadAR3();
        if (!alive) return;

        if (!r.ok) {
          openModal({
            kind: "error",
            title: "ریزاقدام سوم پیدا نشد",
            message: "برای «پذیرش بدون سرزنش»، اول باید ریز اقدام سوم (مرزهای دفعه بعد) را کامل کرده باشی.",
            primaryText: "بازگشت",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
          return;
        }

        setTop3(r.top3);
        setBoundaries(r.boundaries);

        // مقادیر اولیه
        setAgreeResponsibilityNotHumiliation(false);
        setAgreeVictimToAgent(false);
        setAgreeNotCriminal(false);
        setFinalDecision("");
        setAgreeNoSelfBlame(false);
        setFinalSeal(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [closeModal, loadAR3, loadFinalIfAny, migrateOldKeyIfAny, openModal, router]);

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = agreeResponsibilityNotHumiliation;
  const canGo3 = agreeVictimToAgent && agreeNotCriminal;

  const decisionOk = useMemo(() => {
    const t = String(finalDecision || "").trim();
    if (t.length < 60) return false;
    if (t.length > 180) return false;
    return true;
  }, [finalDecision]);

  const canGo4 = decisionOk && agreeNoSelfBlame;
  const step4Ok = canGo4 && finalSeal;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: AR4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      top3,
      boundaries,
      agreeResponsibilityNotHumiliation,
      agreeVictimToAgent,
      agreeNotCriminal,
      finalDecision: String(finalDecision || ""),
      agreeNoSelfBlame,
      finalSeal,
    };
    await AsyncStorage.setItem(KEY_AR4_FINAL, JSON.stringify(payload));
  }, [
    agreeNoSelfBlame,
    agreeNotCriminal,
    agreeResponsibilityNotHumiliation,
    agreeVictimToAgent,
    boundaries,
    finalDecision,
    finalSeal,
    top3,
  ]);

  /* ----------------------------- Server submit ----------------------------- */
  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام شدن باید وارد حساب کاربری بشی",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    if (top3.length !== 3) {
      openModal({
        kind: "error",
        title: "داده کافی نیست",
        message: "سه مورد برای جمع‌بندی پیدا نشد. لطفاً ریز اقدام سوم رو کامل کن.",
        primaryText: "بازگشت",
        onPrimary: () => {
          closeModal();
          router.back();
        },
      });
      return "fail";
    }

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const items = top3.map((id) => ({
      id,
      boundary: String(boundaries?.[id] || "").trim(),
    }));

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        responsibilityNotHumiliation: agreeResponsibilityNotHumiliation,
        victimToAgent: agreeVictimToAgent,
        notCriminal: agreeNotCriminal,
        noSelfBlame: agreeNoSelfBlame,
        finalSeal,
      },
      finalDecision: String(finalDecision || "").trim(),
      items,
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
        // ✅ کلید درست سرور
        subtaskKey: "AR_4_no_blame_confirm",
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
    agreeNoSelfBlame,
    agreeNotCriminal,
    agreeResponsibilityNotHumiliation,
    agreeVictimToAgent,
    apiBase,
    boundaries,
    closeModal,
    finalDecision,
    finalSeal,
    openModal,
    phone,
    router,
    token,
    top3,
  ]);

  const doFinalize = useCallback(async () => {
    if (!step4Ok) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) server
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) local
      await persistFinalLocal();
      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

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
  }, [closeModal, completeOnServer, openModal, persistFinalLocal, router, step4Ok]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  const title = "پذیرش بدون سرزنش";

  /* ----------------------------- UI pieces ----------------------------- */
  const StepPills = (
    <View style={styles.stepPills}>
      <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۱</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴</Text>
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
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 72 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور فعال است و قابل تغییر نیست</Text>
            </View>
          ) : null}

          {StepPills}

          {/* Step 1 */}
          {step === 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>مسئولیت ≠ تحقیر</Text>
              <Text style={styles.p}>
                این مرحله برای قوی‌تر شدن توئه، نه برای زدن تو{"\n"}
                مسئولیت یعنی «من سهم دارم و می‌تونم تغییر کنم»{"\n"}
                تحقیر یعنی «من خرابم و لیاقت ندارم»{"\n"}
              </Text>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setAgreeResponsibilityNotHumiliation((x) => !x);
                }}
                style={[
                  styles.choiceCard,
                  agreeResponsibilityNotHumiliation && styles.choiceCardOn,
                  isReview && { opacity: 0.7 },
                ]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={agreeResponsibilityNotHumiliation ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={agreeResponsibilityNotHumiliation ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>می‌پذیرم مسئولیت با خودزنی و تحقیرکردن خودم فرق داره</Text>
                </View>
              </Pressable>

              <View style={{ height: 12 }} />

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!canGo2}
                onPress={() => setStep(2)}
                style={[styles.primaryBtn, !canGo2 && { opacity: 0.45 }]}
              >
                <Text style={styles.primaryBtnText}>ادامه</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نه قربانی هستی، نه مجرم</Text>
                <Text style={styles.p}>
                  اینجا جاییه که باید از دو تله خارج بشی:{"\n"}
                  ۱) «من هیچ نقشی نداشتم»{"\n"}
                  ۲) «همه‌چیز تقصیر من بود»{"\n\n"}
                  می‌خوایم به این نقطه‌ی سالم برسیم که «من آسیب دیدم، ولی هنوز حق انتخاب دارم»
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeVictimToAgent((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeVictimToAgent && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeVictimToAgent ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeVictimToAgent ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قول میدم از نقش قربانی که هیچ قدرتی نداره، بیرون بیام</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNotCriminal((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeNotCriminal && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNotCriminal ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNotCriminal ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قول میدم به نقش «مجرمِ بد» هم سقوط نکنم</Text>
                  </View>
                </Pressable>
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
                    disabled={!canGo3 || saving}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo3 ? <Text style={styles.warn}>هر دو تایید باید فعال بشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 3 */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>تصمیم‌گیری</Text>
                <Text style={styles.p}>
                  باید تصمیم خودت رو در قالب یک جمله بیان کنی{"\n"}
                  این جمله قرار نیست «قشنگ» باشه{"\n"}
                  بلکه باید «عملی» باشه{"\n\n"}
                  مثل یک دستور برای خودت که دفعه بعد دقیقاً چیکار می‌کنی؟
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                <View style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                  <Text style={styles.noteTitle}>جمله نهایی من</Text>

                  <TextInput
                    ref={(r) => {
                      inputRefs.current["finalDecision"] = r;
                    }}
                    value={finalDecision}
                    onChangeText={(t) => {
                      if (isReview) return;
                      setFinalDecision(String(t || ""));
                    }}
                    onFocus={() => setTimeout(() => scrollToInput("finalDecision", 22), 60)}
                    placeholder="مثلاً: اگر دوباره فلان علامت رو دیدم، بدون بحث اضافه مرزم رو اجرا می‌کنم و عقب‌نشینی نمی‌کنم…"
                    placeholderTextColor="rgba(231,238,247,.35)"
                    multiline
                    maxLength={180}
                    style={[styles.input, isReview && styles.inputReadOnly]}
                    textAlign="right"
                    textAlignVertical="top"
                    editable={!isReview}
                    selectTextOnFocus={!isReview}
                    blurOnSubmit={false}
                  />

                  <Text style={[styles.small, !isReview && (!decisionOk ? { color: palette.red } : null)]}>
                    {isReview ? "ثبت شده" : `${String(finalDecision || "").trim().length}/60`}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNoSelfBlame((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeNoSelfBlame && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNoSelfBlame ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNoSelfBlame ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قول میدم با خودم مثل دشمن رفتار نکنم و از خودم مراقبت کنم</Text>
                  </View>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(2);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGo4 || saving}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo4 ? (
                  <Text style={styles.warn}>جمله باید حداقل ۶۰ کاراکتر داشته باشه و تایید آخر هم باید زده بشه</Text>
                ) : null}
              </View>
            </>
          ) : null}

          {/* Step 4 */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مُهر نهایی</Text>
                <Text style={styles.p}>
                  اینجا خلاصه‌ی مرزهای توئه{"\n"}
                  و یک مهر نهایی که این مسیر رو برای خودت رسمی می‌کنی
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {top3.map((id, idx) => (
                  <View key={id} style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
                    <Text style={styles.noteTitle}>{idx + 1}) مرز</Text>
                    <Text style={[styles.p, { marginTop: 8 }]}>{String(boundaries?.[id] || "").trim() || "—"}</Text>
                  </View>
                ))}

                <View style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
                  <Text style={styles.noteTitle}>جمله نهایی</Text>
                  <Text style={[styles.p, { marginTop: 8 }]}>{String(finalDecision || "").trim() || "—"}</Text>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setFinalSeal((x) => !x);
                  }}
                  style={[styles.choiceCard, finalSeal && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={finalSeal ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={finalSeal ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>
                      این مسیر رو می‌پذیرم؛ مسئولیت خودم رو قبول دارم، خودم رو تحقیر نمی‌کنم و از خودم مراقبت می‌کنم.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(3);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={(!isReview && !step4Ok) || saving}
                    onPress={() => {
                      if (isReview) {
                        router.back();
                        return;
                      }
                      setConfirmLockModal(true);
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, ((!isReview && !step4Ok) || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !step4Ok ? <Text style={styles.warn}>همه تاییدها و مهر نهایی باید فعال باشه</Text> : null}
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
            <Text style={styles.bootText}>در حال بارگذاری</Text>
          </View>
        </View>
      ) : null}

      {/* Confirm lock */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت این رو بدون"
        message="بعد از ثبت دیگه امکان تغییر وجود نداره"
        primaryText="ثبت و قفل کن"
        secondaryText="فعلا نه"
        loading={saving}
        onPrimary={async () => {
          setConfirmLockModal(false);

          if (!step4Ok) return;
          if (savingRef.current) return;
          savingRef.current = true;

          try {
            setSaving(true);

            const r = await completeOnServer();
            if (r === "fail") return;

            await persistFinalLocal();
            await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

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

  stepPills: { flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginBottom: 12 },
  stepPill: {
    width: 34,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepPillOn: { backgroundColor: "rgba(212,175,55,.12)", borderColor: "rgba(212,175,55,.28)" },
  stepPillText: { color: "rgba(231,238,247,.85)", fontWeight: "900", fontSize: 12, textAlign: "center" },

  h1: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center", lineHeight: 22 },
  p: { color: "rgba(231,238,247,.78)", marginTop: 8, textAlign: "right", lineHeight: 20, fontSize: 12 },
  small: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right" },
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
  input: {
    marginTop: 10,
    minHeight: 110,
    padding: 12,
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
  bootText: {
    color: "rgba(231,238,247,.88)",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
  },

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