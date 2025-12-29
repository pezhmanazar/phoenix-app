// app/pelekan/bastan/subtask/AR_3_boundary_next_time.tsx
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
type RCAr1Saved = {
  version: 1;
  savedAt: string;
  selectedBehaviors: string[];
  details: Record<string, { intent: string; result: string }>;
  top3: string[];
  nextTime: Record<string, string>;
  finalConfirm: boolean;
};

type RCAr3Saved = {
  version: 1;
  savedAt: string;
  top3: string[]; // ids
  boundaries: Record<string, string>; // id -> text
  readyForEach: string[]; // ids
  agreeProtectNotControl: boolean;
  agreeSelfAction: boolean;
  agreeNotPunish: boolean;
};

/* ----------------------------- Storage Keys ----------------------------- */
const KEY_AR1_FINAL = "pelekan:bastan:subtask:AR_1_own_share:final:v1";
const KEY_AR3_FINAL = "pelekan:bastan:subtask:AR_3_boundary_next_time:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const BEHAVIORS: { id: string; label: string }[] = [
  { id: "ar1_b1", label: "موندم وقتی باید می رفتم" },
  { id: "ar1_b2", label: "حرف نزدم وقتی باید مرز می‌ذاشتم" },
  { id: "ar1_b3", label: "واقعیت رو توجیه کردم وقتی باید اونو می‌دیدم" },
  { id: "ar1_b4", label: "نیازم رو نگفتم و انتظار داشتم خودش بفهمه" },
  { id: "ar1_b5", label: "از ترس دعوا، کوتاه اومدم" },
  { id: "ar1_b6", label: "حد و مرز رو چند بار شکستم" },
  { id: "ar1_b7", label: "با امید تغییرش فرصت های زیادی بهش دادم" },
  { id: "ar1_b8", label: "نشونه‌ها رو کوچیک کردم تا آروم بشم" },
  { id: "ar1_b9", label: "وقتی ناراحت بودم واکنش تند نشون دادم" },
  { id: "ar1_b10", label: "وقتی دیدم اذیت میشم باز هم ادامه دادم" },
  { id: "ar1_b11", label: "مرز گذاشتم ولی پای مرزم نایستادم" },
  { id: "ar1_b12", label: "برای حفظ رابطه، خودم رو نادیده گرفتم" },
  { id: "ar1_b13", label: "به جای دیدن واقعیت، به خاطره‌های خوب چسبیدم" },
  { id: "ar1_b14", label: "مشکل رو گردن شرایط انداختم نه انتخاب‌هام" },
  { id: "ar1_b15", label: "هشدار دیگران رو جدی نگرفتم" },
  { id: "ar1_b16", label: "فکر کردم عشق یعنی تحمل" },
  { id: "ar1_b17", label: "ترس از تنها شدن تصمیم‌هام رو کنترل کرد" },
  { id: "ar1_b18", label: "وقتی ناراحت بودم، احساساتم رو قورت دادم" },
  { id: "ar1_b19", label: "مسئله‌ها رو عقب انداختم به امید اینکه خودبه‌خود حل بشن" },
  { id: "ar1_b20", label: "وقتی باید تصمیم می‌گرفتم، صبر بی‌جا کردم" },
  { id: "ar1_b21", label: "فکر می‌کردم عشق واقعی بالاخره مشکلاتش تموم میشه" },
];

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
export default function AR3BoundaryNextTimeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const subtaskKey = "AR_3_boundary_next_time";
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

  // داده‌های ورودی از ریز اقدام اول
  const [top3, setTop3] = useState<string[]>([]);

  // مرحله 1
  const [agreeProtectNotControl, setAgreeProtectNotControl] = useState(false);

  // مرحله 2
  const [readyForEach, setReadyForEach] = useState<string[]>([]);

  // مرحله 3
  const [boundaries, setBoundaries] = useState<Record<string, string>>({});

  // مرحله 4
  const [agreeSelfAction, setAgreeSelfAction] = useState(false);
  const [agreeNotPunish, setAgreeNotPunish] = useState(false);

  // مودال ها
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

  const labelOf = useCallback((id: string) => {
    return BEHAVIORS.find((x) => x.id === id)?.label || id;
  }, []);

  const top3Set = useMemo(() => new Set(top3), [top3]);
  const readySet = useMemo(() => new Set(readyForEach), [readyForEach]);

  /* ----------------------------- Load AR1 + Load FINAL(AR3) if any ----------------------------- */
  const loadAR1Top3 = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR1_FINAL);
    if (!raw) return { ok: false as const, top3: [] as string[] };

    const j = JSON.parse(raw) as RCAr1Saved;
    if (!j || j.version !== 1) return { ok: false as const, top3: [] as string[] };

    const t3 = Array.isArray(j.top3) ? j.top3.slice(0, 3) : [];
    if (t3.length !== 3) return { ok: false as const, top3: [] as string[] };
    return { ok: true as const, top3: t3 };
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RCAr3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setTop3(Array.isArray(j.top3) ? j.top3 : []);
    setAgreeProtectNotControl(!!j.agreeProtectNotControl);
    setReadyForEach(Array.isArray(j.readyForEach) ? j.readyForEach : []);
    setBoundaries(j.boundaries && typeof j.boundaries === "object" ? j.boundaries : {});
    setAgreeSelfAction(!!j.agreeSelfAction);
    setAgreeNotPunish(!!j.agreeNotPunish);

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        // 1) اگر AR3 قبلاً ثبت شده، مستقیم حالت مرور
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
          setIsReview(true);
          setStep(4);
          return;
        }

        // 2) در غیر این صورت باید top3 را از AR1 بخوانیم
        const r = await loadAR1Top3();
        if (!alive) return;

        if (!r.ok) {
          openModal({
            kind: "error",
            title: "ریزاقدام اول پیدا نشد",
            message: "برای ساخت مرزها، ابتدا باید ریز اقدام اول را کامل کرده و سه سهم رو انتخاب کرده باشی.",
            primaryText: "بازگشت",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
          return;
        }

        setTop3(r.top3);
        // مقادیر اولیه منطقی
        setAgreeProtectNotControl(false);
        setReadyForEach([]);
        setBoundaries({});
        setAgreeSelfAction(false);
        setAgreeNotPunish(false);
      } catch {
        // اگر خراب شد، حداقل بگذار صفحه بالا بیاید
      } finally {
        if (alive) setBooting(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [closeModal, loadAR1Top3, loadFinalIfAny, openModal, router]);

  /* ----------------------------- Helpers ----------------------------- */
  const toggleReady = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      if (!id) return;
      if (!top3Set.has(id)) return;

      setReadyForEach((prev) => {
        const set = new Set(prev);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return Array.from(set);
      });
    },
    [isReview, top3Set]
  );

  const setBoundaryText = useCallback(
    (idRaw: string, v: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      if (!id) return;
      setBoundaries((prev) => ({ ...(prev || {}), [id]: String(v || "") }));
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = agreeProtectNotControl && top3.length === 3;

  const canGo3 = useMemo(() => {
    if (top3.length !== 3) return false;
    for (const id of top3) {
      if (!readySet.has(id)) return false;
    }
    return true;
  }, [readySet, top3]);

  const boundariesOk = useMemo(() => {
    if (top3.length !== 3) return false;
    for (const id of top3) {
      const txt = String(boundaries[id] || "").trim();
      if (txt.length < 30) return false;
      if (txt.length > 160) return false;
    }
    return true;
  }, [boundaries, top3]);

  const canGo4 = boundariesOk;

  const step4Ok = agreeSelfAction && agreeNotPunish && boundariesOk;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: RCAr3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      top3,
      boundaries,
      readyForEach,
      agreeProtectNotControl,
      agreeSelfAction,
      agreeNotPunish,
    };
    await AsyncStorage.setItem(KEY_AR3_FINAL, JSON.stringify(payload));
  }, [agreeNotPunish, agreeProtectNotControl, agreeSelfAction, boundaries, readyForEach, top3]);

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
        message: "سه سهم پیدا نشد. لطفاً ریز اقدام اول رو کامل کن.",
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
      label: labelOf(id),
      boundary: String(boundaries[id] || ""),
    }));

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        boundariesCount: 3,
        protectNotControl: agreeProtectNotControl,
        selfAction: agreeSelfAction,
        notPunish: agreeNotPunish,
      },
      items,
      readyForEach,
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
        subtaskKey: "AR_3_boundary_next_time",
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
    agreeNotPunish,
    agreeProtectNotControl,
    agreeSelfAction,
    apiBase,
    boundaries,
    closeModal,
    labelOf,
    openModal,
    phone,
    router,
    token,
    top3,
    readyForEach,
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

  const title = "مرزهای دفعه بعد";

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

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مرز یعنی مراقبت، نه جنگ</Text>
                <Text style={styles.p}>
                  اینجا قرار نیست گذشته رو درست کنی
                  {"\n"}قراره برای دفعه بعد از خودت محافظت کنی
                  {"\n"}
                  {"\n"}مرز یعنی کاری که «تو» انجام می‌دی
                  {"\n"}نه چیزی که بخوای از طرف مقابل بگیری
                  {"\n"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeProtectNotControl((x) => !x);
                  }}
                  style={[
                    styles.choiceCard,
                    agreeProtectNotControl && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeProtectNotControl ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeProtectNotControl ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>می‌پذیرم مرز برای محافظت از خودمه، نه کنترل طرف مقابل</Text>
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
            </>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مرز رو به تجربه واقعی وصل کن</Text>
                <Text style={styles.p}>
                  این سه سهم از ریز اقدام اول انتخاب شده
                  {"\n"}برای هر کدوم تصمیم بگیر که مرز بسازی
                  {"\n"} توضیح اضافه و تحلیل لازم نیست
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {top3.map((id, idx) => {
                  const on = readySet.has(id);
                  return (
                    <View key={id} style={styles.noteCard}>
                      <Text style={styles.noteTitle}>
                        {idx + 1}) {labelOf(id)}
                      </Text>

                      <Text style={[styles.small, { marginTop: 8 }]}>اگه اون موقع مرز داشتی، شرایط فرق می‌کرد؟ اگه اره تایید کن که مرز بسازی</Text>

                      <View style={{ marginTop: 10 }}>
                        <Pressable
                          onPress={() => toggleReady(id)}
                          style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                          disabled={isReview}
                        >
                          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                            <Ionicons
                              name={on ? "checkmark-circle" : "ellipse-outline"}
                              size={18}
                              color={on ? palette.green : "rgba(231,238,247,.55)"}
                            />
                            <Text style={styles.choiceText}>برای این مورد مرز می‌سازم</Text>
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
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

                {!canGo3 ? <Text style={styles.warn}>برای هر سه مورد باید تصمیم «مرز می‌سازم» فعال بشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مرزهای رفتاری من</Text>
                <Text style={styles.p}>
                  برای هر مورد فقط «یک جمله» بنویس
                  {"\n"}مرز باید مشخص کنه از این به بعد در شرایط مشابه چیکار میکنی.
                  {"\n"}نه اینکه «طرف مقابلت باید چه کار کنه»
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {top3.map((id, idx) => {
                  const txt = String(boundaries[id] || "");
                  const len = txt.trim().length;
                  const keyB = `${id}:boundary`;

                  return (
                    <View key={id} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>
                        {idx + 1}) {labelOf(id)}
                      </Text>

                      <TextInput
                        ref={(r) => {
                          inputRefs.current[keyB] = r;
                        }}
                        value={txt}
                        onChangeText={(t) => setBoundaryText(id, t)}
                        onFocus={() => setTimeout(() => scrollToInput(keyB, 22), 60)}
                        placeholder="اگر دوباره این اتفاق افتاد، من..…"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        maxLength={160}
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        blurOnSubmit={false}
                      />

                      <Text style={[styles.small, !isReview && (len < 30 || len > 160) ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/30`}
                      </Text>
                    </View>
                  );
                })}
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

                {!canGo4 ? <Text style={styles.warn}>برای هر سه مورد حداقل یک جمله (۳۰ کاراکتر) لازمه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>تعهد برای مرزها</Text>
                <Text style={styles.p}>
                  مرز یعنی مسئولیت رفتار خودم
                  {"\n"}نه تغییر دادن دیگری
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {top3.map((id, idx) => (
                  <View key={id} style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
                    <Text style={styles.noteTitle}>
                      {idx + 1}) {labelOf(id)}
                    </Text>
                    <Text style={[styles.p, { marginTop: 8 }]}>{String(boundaries[id] || "").trim() || "—"}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 10, gap: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeSelfAction((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeSelfAction && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeSelfAction ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeSelfAction ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>این مرزها مشخص می‌کنن از این به بعد «من چی کار می‌کنم»</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNotPunish((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeNotPunish && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNotPunish ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNotPunish ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم که این مرزها برای تنبیه یا تهدید نیستن</Text>
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
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, ((!isReview && !step4Ok) || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !step4Ok ? <Text style={styles.warn}>مرزها باید کامل باشد و هر دو تایید باید تیک زده بشه</Text> : null}
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
    minHeight: 100,
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