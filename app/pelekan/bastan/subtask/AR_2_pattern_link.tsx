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
type PatternKey =
  | "approval"
  | "abandonment"
  | "sacrifice"
  | "hope_change"
  | "emotional"
  | "boundaries"
  | "avoid_conflict"
  | "control"
  | "unequal"
  | "confused"
  | "unknown";

type PatternItem = {
  key: PatternKey;
  title: string;
  desc: string;
  example: string;
};

type SavedFinal = {
  version: 1;
  savedAt: string;
  pattern: PatternKey;
  example: string;
  warning: string;
  confirmNoLabel: boolean;
};

type RCAr1Saved = {
  version: 1;
  savedAt: string;
  selectedBehaviors: string[];
  details: Record<string, { intent: string; result: string }>;
  top3: string[];
  nextTime: Record<string, string>;
  finalConfirm: boolean;
};

type ModalKind = "info" | "warn" | "error" | "success";

/* ----------------------------- Storage Keys ----------------------------- */
const KEY_AR1_FINAL = "pelekan:bastan:subtask:AR_1_own_share:final:v1";
const KEY_AR2_FINAL = "pelekan:bastan:subtask:AR_2_pattern_link:final:v1";
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

const PATTERNS: PatternItem[] = [
  {
    key: "approval",
    title: "تاییدطلبی",
    desc: "بیشتر حواسم به راضی نگه داشتن طرف مقابل بود تا خودم",
    example: "ناراحت بودم ولی چیزی نمی‌گفتم.",
  },
  {
    key: "abandonment",
    title: "ترس از رهاشدن",
    desc: "بیشتر از خود رابطه، از تنها شدن می‌ترسیدم",
    example: "می‌دیدم بده ولی می‌موندم.",
  },
  {
    key: "sacrifice",
    title: "فداکاری افراطی",
    desc: "نیازهای خودم رو عقب مینداختم تا رابطه حفظ بشه",
    example: "خواسته‌هام رو کنار می‌ذاشتم",
  },
  {
    key: "hope_change",
    title: "امید به تغییر",
    desc: "به چیزی که «می‌تونست بشه» دل بسته بودم نه چیزی که بود",
    example: "می‌گفتم درست می‌شه",
  },
  {
    key: "emotional",
    title: "انتخاب هیجانی",
    desc: "تصمیم‌هام از احساس لحظه‌ای می‌اومد نه واقعیت",
    example: "دلتنگی همه‌چی رو می‌شست",
  },
  {
    key: "boundaries",
    title: "مرزهای سست",
    desc: "حد و مرز می‌ذاشتم ولی رو حرفم نمی‌موندم",
    example: "خودم مرز رو می‌شکستم",
  },
  {
    key: "avoid_conflict",
    title: "فرار از تعارض",
    desc: "از دعوا می‌ترسیدم حتی به قیمت له شدن خودم",
    example: "سکوت می‌کردم",
  },
  {
    key: "control",
    title: "کنترل‌گری پنهان",
    desc: "با رفتارم می‌خواستم طرف مقابل رو عوض کنم",
    example: "خیلی خوب بودن برای تغییر",
  },
  {
    key: "unequal",
    title: "رابطه نابرابر",
    desc: "وزن رابطه روی من بود و من بیشتر می‌کشیدم",
    example: "من بیشتر تلاش می‌کردم",
  },
  {
    key: "confused",
    title: "گیجی",
    desc: "واقعاً نمی‌دونستم دارم چی‌کار می‌کنم، فقط جلو می‌رفتم",
    example: "بعدها فهمیدم چی شد",
  },
  {
    key: "unknown",
    title: "نمیدونم",
    desc: "الان هنوز برام روشن نیست، فقط تکرار رو می‌بینم",
    example: "اسمش رو بلد نیستم",
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
export default function AR2PatternLinkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const subtaskKey = "AR_2_pattern_link";
  const headerNo = subtaskNumberFa(subtaskKey);
  const title = "الگوی تکرارشونده";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [top3Ids, setTop3Ids] = useState<string[]>([]);
  const top3Labels = useMemo(() => {
    return (top3Ids || []).slice(0, 3).map((id) => BEHAVIORS.find((x) => x.id === id)?.label || id);
  }, [top3Ids]);

  const [pattern, setPattern] = useState<PatternKey | null>(null);
  const [example, setExample] = useState("");
  const [warning, setWarning] = useState("");
  const [confirmNoLabel, setConfirmNoLabel] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRefExample = useRef<TextInput | null>(null);
  const inputRefWarning = useRef<TextInput | null>(null);

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
  }>({ visible: false, kind: "info", title: "", message: "", primaryText: "باشه" });

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false, loading: false }));
  }, []);

  const openModal = useCallback((cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
    setModal({ ...cfg, visible: true } as any);
  }, []);

  /* ----------------------------- Helpers ----------------------------- */
  const scrollToInput = useCallback(
  (ref: React.RefObject<TextInput | null>, extraOffset = 22) => {
    const input = ref.current as any;
    const scroll = scrollRef.current as any;
    if (!input || !scroll) return;

    const node = findNodeHandle(input);
    if (!node) return;

    const responder = scroll.getScrollResponder?.();
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
  },
  []
);

  /* ----------------------------- Load AR1 top3 + AR2 FINAL ----------------------------- */
  const loadTop3FromAr1 = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_AR1_FINAL);
      if (!raw) return [];
      const j = JSON.parse(raw) as RCAr1Saved;
      if (!j || j.version !== 1) return [];
      const ids = Array.isArray(j.top3) ? j.top3 : [];
      return ids.slice(0, 3).map((x) => String(x || "").trim()).filter(Boolean);
    } catch {
      return [];
    }
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR2_FINAL);
    if (!raw) return { loaded: false as const };
    const j = JSON.parse(raw) as SavedFinal;
    if (!j || j.version !== 1) return { loaded: false as const };

    setPattern(j.pattern);
    setExample(String(j.example || ""));
    setWarning(String(j.warning || ""));
    setConfirmNoLabel(!!j.confirmNoLabel);

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        const ids = await loadTop3FromAr1();
        if (!alive) return;
        setTop3Ids(ids);

        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
          setIsReview(true);
          setStep(5);
        } else {
          setIsReview(false);
          setStep(1);
        }
      } finally {
        if (alive) setBooting(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [loadFinalIfAny, loadTop3FromAr1]);

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

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = true;

  const canGo3 = top3Labels.length === 3; // باید سه سهم داشته باشیم
  const canGo4 = !!pattern;

  const exampleOk = useMemo(() => String(example || "").trim().length >= 20, [example]);
  const warningOk = useMemo(() => String(warning || "").trim().length >= 25, [warning]);

  const step5Ok = useMemo(() => {
    if (!pattern) return false;
    if (!exampleOk) return false;
    if (!warningOk) return false;
    if (!confirmNoLabel) return false;
    return true;
  }, [confirmNoLabel, exampleOk, pattern, warningOk]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    if (!pattern) return;

    const payload: SavedFinal = {
      version: 1,
      savedAt: new Date().toISOString(),
      pattern,
      example: String(example || ""),
      warning: String(warning || ""),
      confirmNoLabel,
    };

    await AsyncStorage.setItem(KEY_AR2_FINAL, JSON.stringify(payload));
  }, [confirmNoLabel, example, pattern, warning]);

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

    if (!pattern) return "fail";

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const payloadToSend: SavedFinal = {
      version: 1,
      savedAt: new Date().toISOString(),
      pattern,
      example: String(example || ""),
      warning: String(warning || ""),
      confirmNoLabel,
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
        subtaskKey: "AR_2_pattern_link",
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
  }, [apiBase, closeModal, confirmNoLabel, example, openModal, pattern, phone, token, warning]);

  const doFinalize = useCallback(async () => {
    if (!step5Ok) return;
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
      setStep(5);
    }
  }, [closeModal, completeOnServer, openModal, persistFinalLocal, router, step5Ok]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

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
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵</Text>
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
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>اینجا دنبال مقصر نیستیم</Text>
              <Text style={styles.p}>
                قرار نیست خودت رو قضاوت کنی{"\n"}
                فقط می‌خوایم «الگو» رو ببینیم{"\n"}
                تا از نقش قربانی، آروم آروم بیای بیرون
              </Text>

              <View style={{ height: 12 }} />

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setStep(2)}
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
                <Text style={styles.h1}>سهم‌های تو داخل رابطه قبلی</Text>
                <Text style={styles.p}>
                  این سه مورد از ریزاقدام قبل میاد{"\n"}
                  الان فقط به این‌ها نگاه کن… حس می‌کنی این‌ها از یک مسیر تکراری اومدن؟
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {top3Labels.length === 3 ? (
                  top3Labels.map((t, i) => (
                    <View key={`${i}-${t}`} style={styles.noteCard}>
                      <Text style={styles.noteTitle}>
                        {i + 1}) {t}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.noteCard}>
                    <Text style={styles.warn}>
                      سه سهم نهایی پیدا نشد. اول ریزاقدام «سهم من» رو کامل کن.
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGo3}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGo3 && { opacity: 0.45 }]}
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
                <Text style={styles.h1}> انتخاب نزدیک‌ترین الگو به خودت </Text>
                <Text style={styles.p}>
                  این انتخاب «تشخیص شخصیت» نیست{"\n"}
                  فقط یک اسم برای مسیر تکراریه که دفعه بعد زودتر ترمز کنی{"\n"}
                  فقط یک مورد رو میتونی انتخاب کنی پس دچار وسواس نشو
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {PATTERNS.map((p) => {
                  const on = pattern === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        if (isReview) return;
                        setPattern(p.key);
                      }}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <Text style={styles.choiceTitle}>{p.title}</Text>
                      <Text style={styles.choiceDesc}>{p.desc}</Text>
                      <Text style={styles.choiceEx}>مثال: {p.example}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
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
                    disabled={!canGo4 || saving}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo4 ? <Text style={styles.warn}>یک الگو باید انتخاب بشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>این الگو تو رابطه تو چطوری دیده می‌شد؟</Text>
                <Text style={styles.p}>فقط یک مثال واقعی و کوتاه بنویس مثلا یک خاطره تلخ از رابطت رو بنویس</Text>
              </View>

              <View style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                <TextInput
                  ref={(r) => {
  inputRefExample.current = r;
}}
                  value={example}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setExample(t);
                  }}
                  onFocus={() => setTimeout(() => scrollToInput(inputRefExample, 22), 60)}
                 
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  blurOnSubmit={false}
                />
                {!isReview ? (
                  <Text style={[styles.small, example.trim().length < 20 ? { color: palette.red } : null]}>
                    {example.trim().length}/20
                  </Text>
                ) : (
                  <Text style={styles.small}>ثبت شده</Text>
                )}
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
                    disabled={!exampleOk || saving}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!exampleOk || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!exampleOk ? <Text style={styles.warn}>حداقل ۲۰ کاراکتر لازم است</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>هشدار برای دفعه بعد</Text>
                <Text style={styles.p}>
                  یک جمله ساده برای خودت بنویس{"\n"}
                  وقتی دوباره این علامت رو دیدی، دقیقاً باید چیکار کنی؟
                </Text>
              </View>

              <View style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                <TextInput
                  ref={(r) => {
  inputRefExample.current = r;
}}
                  value={warning}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setWarning(t);
                  }}
                  onFocus={() => setTimeout(() => scrollToInput(inputRefWarning, 22), 60)}
                  placeholder="وقتی دوباره این حس اومد، باید..…"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  blurOnSubmit={false}
                />
                {!isReview ? (
                  <Text style={[styles.small, warning.trim().length < 25 ? { color: palette.red } : null]}>
                    {warning.trim().length}/25
                  </Text>
                ) : (
                  <Text style={styles.small}>ثبت شده</Text>
                )}
              </View>

              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setConfirmNoLabel((x) => !x);
                  }}
                  style={[
                    styles.choiceCard,
                    confirmNoLabel && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={confirmNoLabel ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={confirmNoLabel ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>
                      قبول دارم که این فقط یک الگوی تکراریه نه یه برچسب بد روی شخصیت من
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
                      setStep(4);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={(!isReview && !step5Ok) || saving}
                    onPress={onFinishPress}
                    style={[
                      styles.primaryBtn,
                      { flex: 1 },
                      ((!isReview && !step5Ok) || saving) && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !step5Ok ? (
                  <Text style={styles.warn}>متن هشدار و تایید آخر باید کامل باشه.</Text>
                ) : null}

                <Text style={[styles.small, { textAlign: "center" }]}>
                  شناخت الگو یعنی دیدن زودتر، نه مقصر کردن خودت
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

  choiceTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right" },
  choiceDesc: { color: "rgba(231,238,247,.72)", fontSize: 12, marginTop: 6, textAlign: "right", lineHeight: 18 },
  choiceEx: { color: "rgba(231,238,247,.58)", fontSize: 11, marginTop: 6, textAlign: "right" },

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