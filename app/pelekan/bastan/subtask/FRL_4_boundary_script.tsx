// app/pelekan/bastan/subtask/FRL_4_boundary_script.tsx
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
  if (k === "FRL_4_boundary_script") return "ریز اقدام پنجم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type SituationKey =
  | "emotional_checkin"
  | "nostalgia_past"
  | "relationship_restart"
  | "victim_play"
  | "flirt_joke"
  | "pressure_continue"
  | "blame_attack"
  | "jealousy_provocation";

type ScriptKey =
  | "s1_emotional_1"
  | "s1_emotional_2"
  | "s2_past_1"
  | "s2_past_2"
  | "s3_restart_1"
  | "s3_restart_2"
  | "s4_victim_1"
  | "s4_victim_2"
  | "s5_flirt_1"
  | "s5_flirt_2"
  | "s6_pressure_1"
  | "s6_pressure_2"
  | "s7_blame_1"
  | "s7_blame_2"
  | "s8_jealousy_1"
  | "s8_jealousy_2";

type ExitLineKey = "exit_1" | "exit_2" | "exit_3" | "exit_4";

type FRL4Saved = {
  version: 1;
  savedAt: string;

  acceptedTruth: boolean; // step1

  situations: SituationKey[]; // step2 (min 2)
  scripts: ScriptKey[]; // step2 (min 5)
  exitLine: ExitLineKey | null; // step2 (required)

  agreeNoExplain: boolean; // step3
  agreeNoApology: boolean; // step3
  agreeNoDebate: boolean; // step3
  agreeEndAfterRepeat: boolean; // step3

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_4_boundary_script";
const KEY_FRL4_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const SITUATIONS: { key: SituationKey; title: string; desc: string }[] = [
  { key: "emotional_checkin", title: "احوال‌پرسی احساسی", desc: "مثلا: «دلم تنگ شده»، «دلم برات سوخت» یا «چرا سرد شدی؟»" },
  { key: "nostalgia_past", title: "کشیدن گفتگو به سمت گذشته", desc: "مثلا: گفتن خاطره، پیش کشیدن قدیما، صحبت درباره مقصرها، بیان ریزه‌کاری‌های رابطه" },
  { key: "relationship_restart", title: "تلاش برای زنده کردن رابطه", desc: "«مثلا: بیا یه فرصت دیگه به رابطه بدیم» یا «میشه بهم برگردیم؟»" },
  { key: "victim_play", title: "قربانی‌بازی یا بحران‌سازی", desc: "«مثلا: حالم بده»، «هیچ‌کسی رو ندارم» یا «تو باعث شدی من حالم بد بشه…»" },
  { key: "flirt_joke", title: "صمیمیت، شوخی و کنایه", desc: "مثلا: شوخی قدیمی، طعنه زدن، ایموجی صمیمی و گرم‌گرفتن" },
  { key: "pressure_continue", title: "فشار برای ادامه گفتگو", desc: "مثلا: اصرار زیاد، تماس پشت تماس و پیام‌های متوالی" },
  { key: "blame_attack", title: "سرزنش کردن یا حمله", desc: "مثلا: اتهام، تحقیر، دعوا و کشوندن تو به دفاع" },
  { key: "jealousy_provocation", title: "تحریک حسادت", desc: "مثلا: حرف از رابطه جدید، مقایسه کردن تو با دیگری و نمایش عمدی " },
];

const SCRIPTS: {
  key: ScriptKey;
  group: SituationKey;
  title: string;
  text: string;
  note?: string;
}[] = [
  // emotional_checkin
  { key: "s1_emotional_1", group: "emotional_checkin", title: "قطع مودبانه", text: "در مورد احساسات صحبت نمی‌کنم. اگه موضوع دیگه‌ای هست بگو." },
  { key: "s1_emotional_2", group: "emotional_checkin", title: "برگردوندن فرد به چارچوب", text: "این گفتگو داره احساسی میشه ولی من فقط ارتباط اجرایی یا رسمی رو به شما اجازه میدم." },

  // nostalgia_past
  { key: "s2_past_1", group: "nostalgia_past", title: "نه به گذشته", text: "در مورد گذشته صحبت نمی‌کنم. اگه موضوع عملی هست لطفا کوتاه بگو." },
  { key: "s2_past_2", group: "nostalgia_past", title: "تموم‌کردن بحث", text: "این بحث داره به سمت گذشته میره پس من ادامه نمی‌دم." },

  // relationship_restart
  { key: "s3_restart_1", group: "relationship_restart", title: "تصمیم روشن", text: "تصمیمم مشخصه و دربارش بحث نمی‌کنم." },
  { key: "s3_restart_2", group: "relationship_restart", title: "بدون مذاکره", text: "این موضوع برای من بسته شده. لطفاً ادامه ندیم." },

  // victim_play
  { key: "s4_victim_1", group: "victim_play", title: "همدلی بدون ورود", text: "امیدوارم حالت بهتر بشه، اما من وارد این گفتگو نمی‌شم." },
  { key: "s4_victim_2", group: "victim_play", title: "هدایت به منبع مناسب", text: "این چیزی نیست که من بتونم حلش کنم. من واردش نمی‌شم." },

  // flirt_joke
  { key: "s5_flirt_1", group: "flirt_joke", title: "رسمی‌سازی", text: "بیا رسمی و در چارچوب حرف بزنیم." },
  { key: "s5_flirt_2", group: "flirt_joke", title: "قطع صمیمیت", text: "این لحن برای من مناسب نیست. اگه موضوع مهمی هست بفرمایید." },

  // pressure_continue
  { key: "s6_pressure_1", group: "pressure_continue", title: "هشدار کوتاه", text: "اگه ادامه پیدا کنه مکالمه رو تموم می‌کنم." },
  { key: "s6_pressure_2", group: "pressure_continue", title: "قانون تماس", text: "من فقط یک‌بار جواب می‌دم. ادامش رو جواب نمی‌دم." },

  // blame_attack
  { key: "s7_blame_1", group: "blame_attack", title: "نه به دفاع", text: "من وارد دفاع و بحث نمی‌شم. گفتگو رو همین‌جا تموم می‌کنم." },
  { key: "s7_blame_2", group: "blame_attack", title: "قطع درگیری", text: "این لحن و اتهام رو نمی‌پذیرم و ادامه نمی‌دم." },

  // jealousy_provocation
  { key: "s8_jealousy_1", group: "jealousy_provocation", title: "بی‌واکنشی فعال", text: "در مورد این موضوع نظر نمی‌دم." },
  { key: "s8_jealousy_2", group: "jealousy_provocation", title: "خروج از میدان", text: "این گفتگو تحریک‌آمیزه پس من ادامه نمی‌دم." },
];

const EXIT_LINES: { key: ExitLineKey; title: string; text: string }[] = [
  { key: "exit_1", title: "پایان محترمانه", text: "الان مکالمه رو تموم می‌کنم." },
  { key: "exit_2", title: "پایان با قانون", text: "این خارج از چارچوبه؛ مکالمه بسته شد." },
  { key: "exit_3", title: "پایان با شرط", text: "اگه موضوع دیگه‌ای نیست، پاسخ نمی‌دم." },
  { key: "exit_4", title: "پایان قاطع", text: "دیگه ادامه نمی‌دم. خداحافظ." },
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
export default function FRL4BoundaryScriptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "جمله مرزبندی";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedTruth, setAcceptedTruth] = useState(false);

  // Step 2
  const [situations, setSituations] = useState<SituationKey[]>([]);
  const [scripts, setScripts] = useState<ScriptKey[]>([]);
  const [exitLine, setExitLine] = useState<ExitLineKey | null>(null);

  // Step 3
  const [agreeNoExplain, setAgreeNoExplain] = useState(false);
  const [agreeNoApology, setAgreeNoApology] = useState(false);
  const [agreeNoDebate, setAgreeNoDebate] = useState(false);
  const [agreeEndAfterRepeat, setAgreeEndAfterRepeat] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_FRL4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedTruth(!!j.acceptedTruth);

    const ss = Array.isArray(j.situations) ? (j.situations as any[]) : [];
    setSituations(ss.filter(Boolean) as SituationKey[]);

    const sc = Array.isArray(j.scripts) ? (j.scripts as any[]) : [];
    setScripts(sc.filter(Boolean) as ScriptKey[]);

    const ex = (String(j.exitLine || "") as ExitLineKey) || null;
    setExitLine(ex);

    setAgreeNoExplain(!!j.agreeNoExplain);
    setAgreeNoApology(!!j.agreeNoApology);
    setAgreeNoDebate(!!j.agreeNoDebate);
    setAgreeEndAfterRepeat(!!j.agreeEndAfterRepeat);

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
        if (loaded) setStep(3); // مرور: مستقیم جمع‌بندی
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
  const toggleSituation = useCallback(
    (k: SituationKey) => {
      if (isReview) return;
      setSituations((prev) => {
        const has = prev.includes(k);
        if (has) {
          // اگر وضعیت حذف شد، اسکریپت‌های همون گروه هم حذف بشن تا داده تمیز بمونه
          setScripts((sc) => sc.filter((s) => SCRIPTS.find((x) => x.key === s)?.group !== k));
          return prev.filter((x) => x !== k);
        }
        return [...prev, k];
      });
    },
    [isReview]
  );

  const toggleScript = useCallback(
    (k: ScriptKey) => {
      if (isReview) return;
      setScripts((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const onPickExitLine = useCallback(
    (k: ExitLineKey) => {
      if (isReview) return;
      setExitLine(k);
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const step1Ok = acceptedTruth;

  const step2Ok = situations.length >= 2 && scripts.length >= 5 && !!exitLine;

  const step3Ok = agreeNoExplain && agreeNoApology && agreeNoDebate && agreeEndAfterRepeat;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok && step3Ok;

  const canFinalize = canGo3;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedSituationTitles = useMemo(() => {
    const set = new Set(situations);
    return SITUATIONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [situations]);

  const selectedScriptsBySituation = useMemo(() => {
    const set = new Set(scripts);
    const groups = new Map<SituationKey, { title: string; items: { title: string; text: string }[] }>();

    for (const s of SCRIPTS) {
      if (!set.has(s.key)) continue;
      const groupTitle = SITUATIONS.find((x) => x.key === s.group)?.title || "—";
      if (!groups.has(s.group)) groups.set(s.group, { title: groupTitle, items: [] });
      groups.get(s.group)!.items.push({ title: s.title, text: s.text });
    }

    return Array.from(groups.entries()).map(([k, v]) => ({ key: k, ...v }));
  }, [scripts]);

  const selectedExitLineText = useMemo(() => {
    const f = EXIT_LINES.find((x) => x.key === exitLine);
    return f?.text || "—";
  }, [exitLine]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      acceptedTruth: true,

      situations: situations || [],
      scripts: scripts || [],
      exitLine: exitLine || "exit_1",

      agreeNoExplain: true,
      agreeNoApology: true,
      agreeNoDebate: true,
      agreeEndAfterRepeat: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL4_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [situations, scripts, exitLine]);

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
        acceptedTruth: true,

        situationsCount: situations.length,
        hasMinSituations: situations.length >= 2,

        scriptsCount: scripts.length,
        hasMinScripts: scripts.length >= 5,

        hasExitLine: !!exitLine,

        agreeNoExplain,
        agreeNoApology,
        agreeNoDebate,
        agreeEndAfterRepeat,

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
    situations.length,
    scripts.length,
    exitLine,
    agreeNoExplain,
    agreeNoApology,
    agreeNoDebate,
    agreeEndAfterRepeat,
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
        <Text style={styles.stepPillText}>۱) تشخیص</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) جملات</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) تعهد</Text>
      </View>
    </View>
  );

  const scriptsByGroup = useMemo(() => {
    const set = new Set(situations);
    return SITUATIONS.filter((x) => set.has(x.key)).map((sit) => ({
      situation: sit,
      items: SCRIPTS.filter((s) => s.group === sit.key),
    }));
  }, [situations]);

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
                <Text style={styles.h1}>مرز گذاشتن یعنی مراقبت از خودت</Text>
                <Text style={styles.p}>
                  مشکلِ اصلی اینجاست:
                  {"\n"}
                  وقتی طرف مقابل به شکل احساسی تو رو می‌کشه‌ داخل گفتگو، مغز تو وارد «توضیح دادن» میشه؛ و توضیح یعنی دعوت به ادامه .
                  {"\n\n"}
                  این ریزاقدام سه کار با تو می‌کنه:
                  {"\n"}• اول «تشخیص» می‌دی این تماس احساسی هست یا اجرایی
                  {"\n"}• بعد از «جمله آماده» استفاده می‌کنی (اون هم نه به شکل بداهه)
                  {"\n"}• و اگر مرز رعایت نشد، با یک جمله خروج، مکالمه رو تموم می‌کنی
                  {"\n\n"}
                  قانون: **کوتاه، خنثی، بدون توضیح.**
                </Text>

                <View style={[styles.noteCard, { marginTop: 10, marginBottom: 10 }]}>
                  <Text style={styles.noteTitle}>قانون پایه</Text>
                  <Text style={styles.small}>
                    اگر بعد از گفتن مرز، باز هم ادامه بدی، یعنی مرز نذاشتی.
                    {"\n"}
                    مرز یعنی: گفتن جمله آماده همراه با پایانِ رفتار.
                  </Text>
                </View>

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
                    <Text style={styles.choiceText}>قبول دارم: مرز یعنی «بدون توضیح» و اگه لازم شد «قطع مکالمه»</Text>
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
                <Text style={styles.h1}>چک‌لیست موقعیت‌ها + جملات آماده</Text>
                <Text style={styles.p}>
                  اول موقعیت‌هایی که بیشتر برات اتفاق می‌افته رو انتخاب کن (حداقل ۲تا).
                  {"\n"}
                  بعد برای همون موقعیت‌ها، جملات آماده رو انتخاب کن (حداقل ۵ جمله).
                  {"\n\n"}
                  نکته سخت:
                  {"\n"}
                  جمله‌ی زیاد بهتر نیست؛ جمله‌ی مناسب برای «همون موقعیت» مهمه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>۱) انتخاب موقعیت‌ها (حداقل ۲تا)</Text>
                <Text style={styles.small}>این‌ها همون «دام»‌ها هستن.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {SITUATIONS.map((s) => {
                    const on = situations.includes(s.key);
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => toggleSituation(s.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{s.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{s.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                  {selectedSituationTitles.length ? (
                    selectedSituationTitles.map((t, idx) => (
                      <Text key={`${t}-${idx}`} style={styles.pairText}>
                        • {t}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۲) انتخاب جملات آماده (حداقل ۵)</Text>
                <Text style={styles.small}>
                  فقط از موقعیت‌هایی که انتخاب کردی نمایش داده می‌شن.
                  {"\n"}
                  (بداهه‌گویی ممنوع)
                </Text>

                {!situations.length ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>اول حداقل ۲ موقعیت انتخاب کن تا جملات فعال بشن.</Text>
                ) : (
                  <View style={{ gap: 12, marginTop: 10 }}>
                    {scriptsByGroup.map((g) => {
                      return (
                        <View key={g.situation.key} style={styles.groupCard}>
                          <Text style={styles.groupTitle}>{g.situation.title}</Text>
                          <View style={{ gap: 10, marginTop: 10 }}>
                            {g.items.map((it) => {
                              const on = scripts.includes(it.key);
                              return (
                                <Pressable
                                  key={it.key}
                                  onPress={() => toggleScript(it.key)}
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
                                      <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                                      <Text style={[styles.exampleText, { marginTop: 6 }]}>{it.text}</Text>
                                    </View>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>تعداد جملات انتخاب‌شده:</Text>
                  <Text style={styles.pairText}>{scripts.length ? `${scripts.length} جمله` : "—"}</Text>
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>۳) جمله خروج (وقتی مرز رعایت نشد)</Text>
                <Text style={styles.small}>یکی رو انتخاب کن. همین باید آخرین جملت باشه.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {EXIT_LINES.map((x) => {
                    const on = exitLine === x.key;
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => onPickExitLine(x.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{x.title}</Text>
                            <Text style={[styles.exampleText, { marginTop: 6 }]}>{x.text}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!exitLine ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، یک جمله خروج انتخاب کن.</Text> : null}
              </View>

              {!step2Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: حداقل ۲ موقعیت + حداقل ۵ جمله + انتخاب جمله خروج لازمه.
                </Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, (!step2Ok || saving) && { opacity: 0.45 }]}
                    disabled={!step2Ok || saving}
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
                  اینجا نقطه‌ی شکست اکثر آدم‌هاست:
                  {"\n"}
                  جمله رو می‌گن، ولی بعدش شروع می‌کنن توضیح دادن، عذرخواهی کردن، دفاع کردن یا کش دادن مکالمه.
                  {"\n\n"}
                  ما دقیقاً برعکس عمل می‌کنیم:
                  {"\n"}• جمله کوتاه
                  {"\n"}• بدون توضیح
                  {"\n"}• اگه تکرار شد: جمله خروج + پایان مکالمه
                </Text>

                <View style={[styles.pairCard, { marginTop: 10 }]}>
                  <Text style={styles.pairLabel}>خلاصه انتخاب‌های تو:</Text>
                  <Text style={styles.pairText}>• موقعیت‌ها: {situations.length}</Text>
                  <Text style={styles.pairText}>• جملات آماده: {scripts.length}</Text>
                  <Text style={styles.pairText}>• جمله خروج: {selectedExitLineText}</Text>
                </View>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>قانون ضد لغزش</Text>
                  <Text style={styles.small}>
                    وقتی مرز گذاشتی، سه چیز ممنوعه:
                    {"\n"}۱) توضیح
                    {"\n"}۲) عذرخواهی برای مرزگذاری درست
                    {"\n"}۳) بحث و دفاع
                  </Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoExplain((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoExplain && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoExplain ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoExplain ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم بعد از مرزبندی «توضیح» ندم.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoApology((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoApology && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoApology ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoApology ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم برای مرزم «عذرخواهی» نکنم.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeNoDebate((x) => !x);
                      }}
                      disabled={isReview}
                      style={[styles.choiceCard, agreeNoDebate && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeNoDebate ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeNoDebate ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم وارد بحث کردن، دفاع کردن و اثبات حقانیت نشم.</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setAgreeEndAfterRepeat((x) => !x);
                      }}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        agreeEndAfterRepeat && styles.choiceCardOn,
                        isReview && { opacity: 0.7 },
                        { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                      ]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={agreeEndAfterRepeat ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={agreeEndAfterRepeat ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={[styles.choiceText, { flex: 1 }]}>
                          تعهد می‌دم اگر مرزم رعایت نشد: «یک‌بار هشدار بدم بعد در صورت رعایت نشدن، جمله خروج رو بگم و مکالمه رو تموم کنم»
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {!step3Ok ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: هر ۴ تعهد باید تیک بخوره.</Text>
                ) : null}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>یادآوری کوتاه</Text>
                <Text style={styles.small}>
                  بهترین مرزبندی‌ها کوتاه‌اند.
                  {"\n"}
                  خطرناک‌ترین مرزبندی‌ها آن‌هایی هستند که با «توضیح» شروع می‌شوند.
                </Text>
              </View>

              <View style={[styles.pairCard, { marginTop: 12 }]}>
                <Text style={styles.pairLabel}>جملات منتخب تو:</Text>
                {selectedScriptsBySituation.length ? (
                  selectedScriptsBySituation.map((g) => (
                    <View key={String(g.key)} style={{ marginTop: 10 }}>
                      <Text style={[styles.pairText, { color: "rgba(231,238,247,.72)" }]}>{g.title}</Text>
                      {g.items.map((it, idx) => (
                        <Text key={`${it.title}-${idx}`} style={styles.exampleText}>
                          • {it.text}
                        </Text>
                      ))}
                    </View>
                  ))
                ) : (
                  <Text style={styles.pairText}>—</Text>
                )}
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

  groupCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 16,
    padding: 12,
  },
  groupTitle: { color: "rgba(231,238,247,.92)", fontWeight: "900", fontSize: 12, textAlign: "right" },

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