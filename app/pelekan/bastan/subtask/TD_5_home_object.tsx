// app/pelekan/bastan/subtask/TD_5_home_object.tsx
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
  if (k === "TD_5_home_object") return "ریز اقدام پنجم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type HasObjectsStatus = "none" | "already" | "has";
type PlanPath = "archive_90" | "out_of_home" | "return_to_ex" | "minimize_essential";

type ReturnMethod = "via_friend" | "drop_off" | "pickup_by_them";

type TD5Saved = {
  version: 1;
  savedAt: string;

  acceptedWhy: boolean;

  status: HasObjectsStatus;

  // only if status === "has"
  planPath?: PlanPath | null;

  // return to ex details (optional)
  returnMethod?: ReturnMethod | null;

  // commitment / safety
  agreeNoEmotionalContact: boolean;
  agreeEssentialsNotForced: boolean;

  // optional personal note (local only)
  note?: string;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "TD_5_home_object";
const KEY_TD5_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const STATUS_OPTIONS: { key: HasObjectsStatus; title: string; desc: string }[] = [
  {
    key: "none",
    title: "نه، هیچ چیزی ندارم",
    desc: "هیچ وسیله، یادگاری و هدیه‌ای از اون پیشم نیست.",
  },
  {
    key: "already",
    title: "قبلاً همه رو جمع کردم یا برگردوندم",
    desc: "این کار رو قبلاً انجام دادم و الان چیزی در دسترس نیست.",
  },
  {
    key: "has",
    title: "بله، هنوز چیزهایی هست",
    desc: "هنوز وسایل یا یادگاری‌هایی هست که ممکنه محرک باشه.",
  },
];

const PLAN_PATHS: { key: PlanPath; title: string; desc: string }[] = [
  {
    key: "archive_90",
    title: "آرشیو ۹۰ روزه (پیشنهادی)",
    desc: "وسایل احساسی رو توو یک جعبه می‌ذارم، می‌بندمش، روش تاریخ می‌زنم و از دیدم خارجش می‌کنم.",
  },
  {
    key: "out_of_home",
    title: "خروج از خانه",
    desc: "وسایل رو به یک فرد امن می‌سپارم یا از محیط زندگیم خارجش می‌کنم تا ۹۰ روز بهش دسترسی نداشته باشم.",
  },
  {
    key: "return_to_ex",
    title: "برگردوندن به پارتنر سابق",
    desc: "وسایل متعلق به اون رو بدون پیام احساسی و بدون کش دادن مکالمه، برمی‌گردونم (ترجیحاً با واسطه).",
  },
  {
    key: "minimize_essential",
    title: "حداقل‌سازی اجباری (برای وسایل ضروری یا مشترک)",
    desc: "اگر وسیله ضروری یا مشترک هست، حذفش نمی‌کنم بلکه ازش استفاده می‌کنم که کم کم عادی بشه (هشدار: این عادی‌سازی برای هدیه‌ها کاربرد نداره و اونا باید جمع بشن)).",
  },
];

const RETURN_METHODS: { key: ReturnMethod; title: string; desc: string }[] = [
  {
    key: "via_friend",
    title: "با واسطه (پیشنهادی)",
    desc: "به یک نفر امن می‌دم که تحویل بده تا تماس احساسی شکل نگیره.",
  },
  {
    key: "drop_off",
    title: "تحویل کوتاه و خنثی",
    desc: "در زمان کوتاه، بدون حرف اضافه. فقط تحویل میدم و تمام.",
  },
  {
    key: "pickup_by_them",
    title: "برداشت توسط او",
    desc: "در صورت امکان، می‌گذارم شخص دیگری تحویل بده یا به پیک میدم که براش ببره.",
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
export default function TD5HomeObjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "مدیریت یادگاری‌های فیزیکی";

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
  const [status, setStatus] = useState<HasObjectsStatus | null>(null);

  // Step 3 (only if status === "has")
  const [planPath, setPlanPath] = useState<PlanPath | null>(null);
  const [returnMethod, setReturnMethod] = useState<ReturnMethod | null>(null);

  // Step 4 commitments
  const [agreeNoEmotionalContact, setAgreeNoEmotionalContact] = useState(false);
  const [agreeEssentialsNotForced, setAgreeEssentialsNotForced] = useState(false);

  // optional local note
  const [note, setNote] = useState("");

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

  const trimLen = (s: string) => String(s || "").trim().length;

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_TD5_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as TD5Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedWhy(!!j.acceptedWhy);

    const st = (String(j.status || "") as HasObjectsStatus) || null;
    setStatus(st);

    const pp = (String(j.planPath || "") as PlanPath) || null;
    setPlanPath(pp);

    const rm = (String(j.returnMethod || "") as ReturnMethod) || null;
    setReturnMethod(rm);

    setAgreeNoEmotionalContact(!!j.agreeNoEmotionalContact);
    setAgreeEssentialsNotForced(!!j.agreeEssentialsNotForced);

    setNote(String(j.note || ""));

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
  const onPickStatus = useCallback(
    (k: HasObjectsStatus) => {
      if (isReview) return;
      setStatus(k);

      // reset dependent fields
      if (k !== "has") {
        setPlanPath(null);
        setReturnMethod(null);
      }
    },
    [isReview]
  );

  const onPickPlanPath = useCallback(
    (k: PlanPath) => {
      if (isReview) return;
      setPlanPath(k);
      if (k !== "return_to_ex") setReturnMethod(null);
    },
    [isReview]
  );

  const onPickReturnMethod = useCallback(
    (k: ReturnMethod) => {
      if (isReview) return;
      setReturnMethod(k);
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const statusOk = useMemo(() => !!status, [status]);

  const planOk = useMemo(() => {
    if (status !== "has") return true;
    if (!planPath) return false;
    if (planPath === "return_to_ex") return !!returnMethod;
    return true;
  }, [planPath, returnMethod, status]);

  const commitOk = useMemo(() => {
    // هم برای has هم برای none/already قفل تعهد داریم (اما نرم‌تر)
    return agreeNoEmotionalContact && agreeEssentialsNotForced;
  }, [agreeEssentialsNotForced, agreeNoEmotionalContact]);

  const canGo2 = acceptedWhy;
  const canGo3 = acceptedWhy && statusOk && status === "has";
  const canGo4 = acceptedWhy && statusOk && (status !== "has" ? true : planOk);
  const canGo5 = acceptedWhy && statusOk && (status !== "has" ? true : planOk) && commitOk;
  const canFinalize = canGo5;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: TD5Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedWhy: true,
      status: (status as HasObjectsStatus) || "none",

      planPath: status === "has" ? planPath : null,
      returnMethod: status === "has" ? returnMethod : null,

      agreeNoEmotionalContact: true,
      agreeEssentialsNotForced: true,

      note: String(note || ""),
      durationSec,
    };

    await AsyncStorage.setItem(KEY_TD5_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [note, planPath, returnMethod, status]);

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
        status: status || "none",
        hasPlan: status === "has" ? !!planPath : true,
        returnedToEx: status === "has" ? planPath === "return_to_ex" : false,
        hasReturnMethod: status === "has" && planPath === "return_to_ex" ? !!returnMethod : true,
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
  }, [apiBase, closeModal, commitOk, openModal, phone, planPath, returnMethod, status, token]);

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
        <Text style={styles.stepPillText}>۱) منطق</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) وضعیت</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) مسیر</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
      </View>
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵) پایان</Text>
      </View>
    </View>
  );

  const selectedStatusTitle = useMemo(() => {
    const f = STATUS_OPTIONS.find((x) => x.key === status);
    return f?.title || "—";
  }, [status]);

  const selectedPlanTitle = useMemo(() => {
    const f = PLAN_PATHS.find((x) => x.key === planPath);
    return f?.title || "—";
  }, [planPath]);

  const selectedReturnTitle = useMemo(() => {
    const f = RETURN_METHODS.find((x) => x.key === returnMethod);
    return f?.title || "—";
  }, [returnMethod]);

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
                <Text style={styles.h1}>چرا یادگاری‌های فیزیکی خطرناکن؟</Text>
                <Text style={styles.p}>
                  بعضی چیزها «خاطره» نیستن؛ بلکه «دکمه» هستن.
                  {"\n"}یک بو، یک لباس، یک هدیه، یک عکس چاپی…
                  {"\n\n"}هدف این تمرین پاک کردن گذشته نیست.
                  {"\n"}هدف اینه که «دسترسی هیجانی» قطع بشه تا موج ناراحتی غافلگیرت نکنه.
                  {"\n\n"}و نکته‌ی مهم:
                  {"\n"}ما انتظار نداریم زندگی‌تو نابود کنی.
                  {"\n"}مثلاً قرار نیست فرش یا یخچال یا وسایل ضروری خونه رو جمع کنی.
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
                    <Text style={styles.choiceText}>قبول دارم هدف این تمرین «قطع دسترسی» ه، نه پاک کردن خاطره</Text>
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
                <Text style={styles.h1}>الان وضعیت تو کدومه؟</Text>
                <Text style={styles.p}>
                  اول باید دقیق مشخص کنیم الان چیزی هست یا نه.
                  {"\n"}اگر هیچ چیزی نیست یا قبلاً جمعشون کردی یا برشون گردوندی، مستقیم می‌ریم مرحله آخر.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {STATUS_OPTIONS.map((s) => {
                  const on = status === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => onPickStatus(s.key)}
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

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (!status) return;

                      if (status === "has") setStep(3);
                      else setStep(5); // مستقیم مرحله آخر
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, (!statusOk || saving) && { opacity: 0.45 }]}
                    disabled={!statusOk || saving}
                  >
                    <Text style={styles.primaryBtnText}>{status === "has" ? "ادامه" : "رفتن به پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!statusOk ? <Text style={styles.warn}>برای ادامه، یک گزینه رو انتخاب کن.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مسیر عملی تو چیه؟</Text>
                <Text style={styles.p}>
                  الان دنبال «پاک‌سازی احساسی» نیستیم.
                  {"\n"}فقط یک مسیر عملی انتخاب کن تا دسترسی هیجانی قطع بشه.
                  {"\n\n"}یادآوری: اگر وسیله ضروری یا مشترکی دارید مثل فرش، یخچال و تلویزیون، اون رو حذف نمی‌کنیم؛ فقط ازش استفاده می‌کنیم.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {PLAN_PATHS.map((x) => {
                  const on = planPath === x.key;
                  return (
                    <Pressable
                      key={x.key}
                      onPress={() => onPickPlanPath(x.key)}
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
                          <Text style={styles.choiceText}>{x.title}</Text>
                          <Text style={styles.small}>{x.desc}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {planPath === "return_to_ex" ? (
                <View style={[styles.noteCard, { marginTop: 12 }, isReview && { opacity: 0.95 }]}>
                  <Text style={styles.noteTitle}>روش برگردوندن (بدون تماس احساسی)</Text>
                  <Text style={styles.small}>
                    هدف بستن ارتباطه نه باز کردنش.
                    {"\n"}پس کوتاه، خنثی، بدون بحث.
                  </Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {RETURN_METHODS.map((m) => {
                      const on = returnMethod === m.key;
                      return (
                        <Pressable
                          key={m.key}
                          onPress={() => onPickReturnMethod(m.key)}
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
                              <Text style={styles.choiceText}>{m.title}</Text>
                              <Text style={styles.small}>{m.desc}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={[styles.pairCard, { marginTop: 10 }]}>
                    <Text style={styles.pairLabel}>جمله‌ی پیشنهادی (خنثی و کوتاه):</Text>
                    <Text style={styles.pairText}>«وسایلت رو برگردوندم. موفق باشی.»</Text>
                    <Text style={[styles.small, { marginTop: 8 }]}>
                      ی نکته: هیچ توضیح اضافه، هیچ خاطره‌بازی، هیچ سوالی نباید بکنی و اگه بعدش پیام داد بهش جواب نده.
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={[styles.noteCard, { marginTop: 12 }, isReview && { opacity: 0.95 }]}>
                <Text style={styles.noteTitle}>یادداشت کوتاه (اختیاری)</Text>
                <TextInput
                  value={note}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setNote(String(t || ""));
                  }}
                  placeholder="اگر دوست داری، فقط یک جمله: امروز دقیقاً چی کار می‌کنی؟"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  multiline
                />
                <Text style={styles.small}>{isReview ? "ثبت شده" : `${trimLen(note)}/اختیاری`}</Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!planOk || saving) && { opacity: 0.45 }]}
                    disabled={!planOk || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!planOk ? <Text style={styles.warn}>برای رفتن به مرحله بعد، یک مسیر رو انتخاب کن و اگه «برگردوندن» رو زدی، روش رو هم مشخص کن.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قفل تصمیم (برای جلوگیری از تکانه)</Text>
                <Text style={styles.p}>
                  اینجا قرار نیست موج ناراحتی تصمیم بگیره چون حتما الان ناراحتی داره منصرفت میکنه فعلا این کار رو نکنی.
                  {"\n"}دو تعهد زیر رو تیک بزن تا برنامت «قفل» بشه.
                  {"\n\n"}یادآوری مهم:
                  {"\n"}ما انتظار نداریم وسایل ضروری مثل فرش، یخچال یا وسایل ضروری خونه رو جمع کنی.
                  {"\n"}هدف: فقط «از دید خارج کردن» و «قطع دسترسی»ه.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
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
                    <Text style={styles.choiceText}>تعهد می‌دم این کار رو بدون تماس احساسی، بدون پیام اضافه و بدون کش دادن مکالمه انجام بدم</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeEssentialsNotForced((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, agreeEssentialsNotForced && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeEssentialsNotForced ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeEssentialsNotForced ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم وسایل ضروری یا مشترک قرار نیست حذف بشن</Text>
                  </View>
                </Pressable>

                <View style={[styles.pairCard, { marginTop: 2 }]}>
                  <Text style={styles.pairLabel}>وضعیت انتخابی:</Text>
                  <Text style={styles.pairText}>{selectedStatusTitle}</Text>

                  <View style={{ height: 10 }} />
                  <Text style={styles.pairLabel}>مسیر عملی:</Text>
                  <Text style={styles.pairText}>{status === "has" ? selectedPlanTitle : "—"}</Text>

                  {status === "has" && planPath === "return_to_ex" ? (
                    <>
                      <View style={{ height: 10 }} />
                      <Text style={styles.pairLabel}>روش برگردوندن:</Text>
                      <Text style={styles.pairText}>{selectedReturnTitle}</Text>
                    </>
                  ) : null}
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(3)}
                    style={[styles.secondaryBtn, { flex: 1 }, status !== "has" && { opacity: 0.55 }]}
                    disabled={saving || status !== "has"}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!commitOk || saving) && { opacity: 0.45 }]}
                    disabled={!commitOk || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!commitOk ? <Text style={styles.warn}>برای رفتن به مرحله بعد، هر دو تعهد، باید تیک بخوره.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  این کار «پاک کردن خاطره» نبود.
                  {"\n"}این کار «قطع دسترسی» بود.
                  {"\n\n"}خلاصه انتخاب تو:
                  {"\n"}• وضعیت: {selectedStatusTitle}
                  {"\n"}
                  {status === "has" ? `• مسیر: ${selectedPlanTitle}\n` : ""}
                  {status === "has" && planPath === "return_to_ex" ? `• روش: ${selectedReturnTitle}\n` : ""}
                  {"\n"}قانون طلایی:
                  {"\n"}هر وقت موج ناراحتی سراغت اومد، تصمیم‌گیری ممنوع.
                  {"\n"}فقط نقشه درمانی اجرا میشه.
                  {"\n"}
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (status === "has") setStep(4);
                      else setStep(2);
                    }}
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

                {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه مراحل باید کامل بشه.</Text> : null}

                {isReview ? (
                  <Text style={styles.small}>نکته: در حالت مرور، می‌تونی مراحل رو ببینی. فقط ادیت قفله.</Text>
                ) : null}
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

  inputFinal: {
    marginTop: 10,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
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