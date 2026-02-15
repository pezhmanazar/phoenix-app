// app/pelekan/bastan/subtask/ML_4_golden_rule.tsx

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
  if (k === "ML_4_golden_rule") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type PatternKey =
  | "p_justify_disrespect"
  | "p_follow_disappear"
  | "p_ignore_lies"
  | "p_cling_when_cold"
  | "p_accept_emotional_blackmail"
  | "p_return_after_silent_treatment"
  | "p_shrink_needs"
  | "p_redflag_exception"
  | "p_self_blame"
  | "p_wait_for_change"
  | "p_custom";

type ActionKey =
  | "a_end_conversation"
  | "a_leave_place"
  | "a_mute_block"
  | "a_no_contact_24h"
  | "a_call_safe_friend"
  | "a_walk_20m"
  | "a_breath_446"
  | "a_write_note"
  | "a_open_app_tab"
  | "a_custom";

type RedLine = { id: string; behavior: string; meaning: string; action: string };

type ML4Saved = {
  version: 1;
  savedAt: string;

  // step1
  patterns: PatternKey[];
  customPatternTitle?: string | null;

  // step2
  redLines: RedLine[]; // min 3 valid

  // step3
  selectedRedLineId: string | null;
  goldenRuleText: string; // required
  acceptNotToSaveRelationship: boolean; // lock #1
  acceptNoExceptions: boolean; // lock #2

  // step4
  immediateActions: ActionKey[]; // min 1
  nextActions: ActionKey[]; // min 1
  customActionText?: string | null; // if a_custom used in any list
  rule2x: boolean; // at least one of rule2x / rule24h
  rule24h: boolean;
  commitmentText: string; // min len
  agreeLocked: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "ML_4_golden_rule";
const KEY_ML4_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */

const MIN_PATTERNS = 3;
const MIN_RED_LINES = 3;

const PATTERNS: { key: Exclude<PatternKey, "p_custom">; title: string; desc: string }[] = [
  {
    key: "p_justify_disrespect",
    title: "بی‌احترامی رو توجیه کردم",
    desc: "تحقیر یاتوهین دیدم ولی گفتم «عصبیه، درست میشه».",
  },
  {
    key: "p_follow_disappear",
    title: "وقتی ناپدید شد و من پیگیری کردم",
    desc: "اون باهام قطع ارتباط کرد و من دنبال توضیح رفتم.",
  },
  {
    key: "p_ignore_lies",
    title: "دروغ رو نادیده گرفتم",
    desc: "شواهد دروغ به شکل واضح دیده میشد ولی خودم رو زدم به نفهمی.",
  },
  {
    key: "p_cling_when_cold",
    title: "وقتی باهام سرد شد ولی من بیشتر بهش چسبیدم",
    desc: "برای برگردوندنش خودم رو کوچک کردم.",
  },
  {
    key: "p_accept_emotional_blackmail",
    title: "باج‌گیری هیجانی رو پذیرفتم",
    desc: "تهدید، ترسوندن و احساس گناه‌دادن به من، باعث شد کوتاه بیام.",
  },
  {
    key: "p_return_after_silent_treatment",
    title: "برای اینکه منو لال کنه باهام قهر کرد ولی من باز بهش برگشتم",
    desc: "قهر یا سکوت به‌جای گفت‌وگوانجام داد، و من عقب‌نشینی کردم.",
  },
  {
    key: "p_shrink_needs",
    title: "نیازهام رو حذف کردم",
    desc: "گفتم مهم نیست، تا رابطه باقی بمونه.",
  },
  {
    key: "p_redflag_exception",
    title: "خط قرمز رو استثنا کردم",
    desc: "گفتم «این یکی فرق داره» و دوباره فرصت دادم.",
  },
  {
    key: "p_self_blame",
    title: "خودم رو مقصر کردم",
    desc: "به‌جای دیدن واقعیت، خودم رو بردم زیر سوال.",
  },
  {
    key: "p_wait_for_change",
    title: "منتظر تغییرِ بدون عمل موندم",
    desc: "وعده‌ها رو باور کردم بدون شواهد.",
  },
];

const IMMEDIATE_ACTIONS: { key: Exclude<ActionKey, "a_custom">; title: string; desc: string }[] = [
  { key: "a_end_conversation", title: "قطع مکالمه", desc: "بدون بحث و توضیح: مکالمه تمام." },
  { key: "a_leave_place", title: "ترک موقعیت", desc: "از اون مکان خارج می‌شم تا مغزم بتونه فکر کنه." },
  { key: "a_mute_block", title: "قطع ارتباط با ساکت کردن اعلان‌ها", desc: "اعلان‌ها رو می‌بندم تا تحریک نشم که بهش جواب بدم." },
  { key: "a_breath_446", title: "تنفس ۴–۴–۶", desc: "۵ دقیقه برای برگشت سیستم عصبی." },
  {
    key: "a_write_note",
    title: "یادداشت فوری",
    desc: "یک جمله داخل دفترچم می‌نویسم که «اصل طلایی من نقض شد» و بعد اقدامات لازمی که باید انجام بدم رو می‌نویسم.",
  },
  { key: "a_open_app_tab", title: "اومدن به اپ ققنوس", desc: "باز کردن تب پناهگاه داخل اپ و انجام دادن یک تکنیک حمایتی." },
];

const NEXT_ACTIONS: { key: Exclude<ActionKey, "a_custom">; title: string; desc: string }[] = [
  {
    key: "a_no_contact_24h",
    title: "قطع ارتباط کامل تا ۲۴ ساعت",
    desc: "۲۴ ساعت هیچ پیامی نمیدم، چکش نمی‌کنم و استوری‌هاش رو نکاه نمی‌کنم و استوری تیکه‌دار هم نمی‌ذارم.",
  },
  { key: "a_call_safe_friend", title: "تماس با آدم امن", desc: "با یک نفر مشخص برای مهار کردن لغزش تماس می‌‌گیرم." },
  { key: "a_walk_20m", title: "پیاده‌روی ۲۰ دقیقه", desc: "حرکت بدن برای کاهش وسوسه." },
  { key: "a_open_app_tab", title: "برگشتن به همین صفحه", desc: "مرور کردن اصل طلایی در این صفحه" },
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

export default function ML4GoldenRuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "اصل طلایی رابطه";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // ✅ جلوگیری از لرزش/قفل شدن اسکرول: اسکرول-به-ابتدا فقط وقتی مرحله عوض میشه (نه روی mount)
  const didMountRef = useRef(false);
  const isUserScrollingRef = useRef(false);

  // Step 1
  const [patterns, setPatterns] = useState<PatternKey[]>([]);
  const [customPatternTitle, setCustomPatternTitle] = useState("");

  // Step 2
  const [redLines, setRedLines] = useState<RedLine[]>([
    { id: "rl_1", behavior: "", meaning: "", action: "" },
    { id: "rl_2", behavior: "", meaning: "", action: "" },
    { id: "rl_3", behavior: "", meaning: "", action: "" },
  ]);

  // Step 3
  const [selectedRedLineId, setSelectedRedLineId] = useState<string | null>(null);
  const [goldenRuleText, setGoldenRuleText] = useState("");
  const [acceptNotToSaveRelationship, setAcceptNotToSaveRelationship] = useState(false);
  const [acceptNoExceptions, setAcceptNoExceptions] = useState(false);

  // Step 4
  const [immediateActions, setImmediateActions] = useState<ActionKey[]>([]);
  const [nextActions, setNextActions] = useState<ActionKey[]>([]);
  const [customActionText, setCustomActionText] = useState("");
  const [rule2x, setRule2x] = useState(true);
  const [rule24h, setRule24h] = useState(false);
  const [commitmentText, setCommitmentText] = useState("");
  const [agreeLocked, setAgreeLocked] = useState(false);

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

  /* ----------------------------- Helpers ----------------------------- */

  const hasCustomPattern = patterns.includes("p_custom");
  const hasCustomActionUsed = useMemo(
    () => immediateActions.includes("a_custom") || nextActions.includes("a_custom"),
    [immediateActions, nextActions]
  );

  const cleanedRedLines = useMemo(() => {
    const norm = (s: any) => String(s || "").trim();
    return redLines
      .map((x) => ({
        ...x,
        behavior: norm(x.behavior),
        meaning: norm(x.meaning),
        action: norm(x.action),
      }))
      .filter((x) => !!x.id);
  }, [redLines]);

  const validRedLines = useMemo(() => {
    const ok = (s: string) => s.trim().length >= 3;
    return cleanedRedLines.filter((x) => ok(x.behavior) && ok(x.meaning) && ok(x.action));
  }, [cleanedRedLines]);

  const selectedLine = useMemo(() => {
    if (!selectedRedLineId) return null;
    return cleanedRedLines.find((x) => x.id === selectedRedLineId) || null;
  }, [cleanedRedLines, selectedRedLineId]);

  const autoGoldenRule = useMemo(() => {
    if (!selectedLine) return "";
    const b = selectedLine.behavior || "…";
    const a = selectedLine.action || "…";
    return ` ${b}، بدون مذاکره ${a}.`;
  }, [selectedLine]);

  useEffect(() => {
    if (isReview) return;
    if (!selectedLine) return;
    setGoldenRuleText((prev) => {
      const p = String(prev || "").trim();
      if (!p) return autoGoldenRule;
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGoldenRule, selectedRedLineId, isReview]);

  const togglePattern = useCallback(
    (k: PatternKey) => {
      if (isReview) return;
      setPatterns((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const updateRedLine = useCallback(
    (id: string, patch: Partial<RedLine>) => {
      if (isReview) return;
      setRedLines((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [isReview]
  );

  const addRedLine = useCallback(() => {
    if (isReview) return;
    const nextId = `rl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setRedLines((prev) => [...prev, { id: nextId, behavior: "", meaning: "", action: "" }]);
  }, [isReview]);

  const removeRedLine = useCallback(
    (id: string) => {
      if (isReview) return;
      setRedLines((prev) => {
        const next = prev.filter((x) => x.id !== id);
        return next.length
          ? next
          : [
              { id: "rl_1", behavior: "", meaning: "", action: "" },
              { id: "rl_2", behavior: "", meaning: "", action: "" },
              { id: "rl_3", behavior: "", meaning: "", action: "" },
            ];
      });
      if (selectedRedLineId === id) setSelectedRedLineId(null);
    },
    [isReview, selectedRedLineId]
  );

  const toggleAction = useCallback(
    (list: "immediate" | "next", k: ActionKey) => {
      if (isReview) return;
      if (list === "immediate") {
        setImmediateActions((prev) => {
          const has = prev.includes(k);
          if (has) return prev.filter((x) => x !== k);
          return [...prev, k];
        });
      } else {
        setNextActions((prev) => {
          const has = prev.includes(k);
          if (has) return prev.filter((x) => x !== k);
          return [...prev, k];
        });
      }
    },
    [isReview]
  );

  const actionTitle = useCallback((k: ActionKey) => {
    if (k === "a_custom") return "سایر (دلخواه)";
    const all = [...IMMEDIATE_ACTIONS, ...NEXT_ACTIONS];
    const f = all.find((x) => x.key === k);
    return f?.title || "—";
  }, []);

  /* ----------------------------- Load FINAL if any ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_ML4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as ML4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const pp = Array.isArray(j.patterns) ? (j.patterns as any[]) : [];
    setPatterns(pp.filter(Boolean) as PatternKey[]);
    setCustomPatternTitle(String(j.customPatternTitle || ""));

    const rl = Array.isArray(j.redLines) ? (j.redLines as any[]) : [];
    setRedLines(
      rl.length
        ? (rl
            .filter(Boolean)
            .map((x) => ({
              id: String(x.id || ""),
              behavior: String(x.behavior || ""),
              meaning: String(x.meaning || ""),
              action: String(x.action || ""),
            }))
            .filter((x) => !!x.id) as RedLine[])
        : [
            { id: "rl_1", behavior: "", meaning: "", action: "" },
            { id: "rl_2", behavior: "", meaning: "", action: "" },
            { id: "rl_3", behavior: "", meaning: "", action: "" },
          ]
    );

    setSelectedRedLineId((String((j as any).selectedRedLineId || "") || null) as any);
    setGoldenRuleText(String(j.goldenRuleText || ""));
    setAcceptNotToSaveRelationship(!!j.acceptNotToSaveRelationship);
    setAcceptNoExceptions(!!j.acceptNoExceptions);

    const ia = Array.isArray(j.immediateActions) ? (j.immediateActions as any[]) : [];
    setImmediateActions(ia.filter(Boolean) as ActionKey[]);
    const na = Array.isArray(j.nextActions) ? (j.nextActions as any[]) : [];
    setNextActions(na.filter(Boolean) as ActionKey[]);
    setCustomActionText(String(j.customActionText || ""));

    setRule2x(!!j.rule2x);
    setRule24h(!!j.rule24h);
    setCommitmentText(String(j.commitmentText || ""));
    setAgreeLocked(!!j.agreeLocked);

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
        if (loaded) setStep(4);
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

    // ✅ مهم: روی mount اسکرول نکن (این همون لرزش/قفل شدنِ اسکرول رو می‌سازه)
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    // ✅ اگر کاربر در حال اسکروله، زورکی scrollTo نزن
    if (isUserScrollingRef.current) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    });

    return () => {
      cancelled = true;
      // @ts-ignore
      if (typeof task?.cancel === "function") task.cancel();
    };
  }, [step, booting]);

  /* ----------------------------- Validation ----------------------------- */

  const step1Ok =
    patterns.length >= MIN_PATTERNS && (!hasCustomPattern || String(customPatternTitle || "").trim().length >= 2);

  const step2Ok = validRedLines.length >= MIN_RED_LINES;

  const step3Ok =
    !!selectedRedLineId &&
    String(goldenRuleText || "").trim().length >= 8 &&
    !!acceptNotToSaveRelationship &&
    !!acceptNoExceptions;

  const step4Ok =
    immediateActions.length >= 1 &&
    nextActions.length >= 1 &&
    (!hasCustomActionUsed || String(customActionText || "").trim().length >= 3) &&
    (rule2x || rule24h) &&
    String(commitmentText || "").trim().length >= 10 &&
    !!agreeLocked;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: ML4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      patterns: patterns || [],
      customPatternTitle: hasCustomPattern ? String(customPatternTitle || "").trim() : null,

      redLines: (cleanedRedLines || []).map((x) => ({
        id: x.id,
        behavior: x.behavior,
        meaning: x.meaning,
        action: x.action,
      })),

      selectedRedLineId: selectedRedLineId || null,
      goldenRuleText: String(goldenRuleText || "").trim(),
      acceptNotToSaveRelationship: true,
      acceptNoExceptions: true,

      immediateActions: immediateActions || [],
      nextActions: nextActions || [],
      customActionText: hasCustomActionUsed ? String(customActionText || "").trim() : null,
      rule2x: !!rule2x,
      rule24h: !!rule24h,
      commitmentText: String(commitmentText || "").trim(),
      agreeLocked: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_ML4_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [
    patterns,
    hasCustomPattern,
    customPatternTitle,
    cleanedRedLines,
    selectedRedLineId,
    goldenRuleText,
    immediateActions,
    nextActions,
    hasCustomActionUsed,
    customActionText,
    rule2x,
    rule24h,
    commitmentText,
  ]);

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

    const summaryRedLines = validRedLines.slice(0, 3).map((x) => ({
      behavior: x.behavior,
      action: x.action,
    }));

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        patternsCount: patterns.length,
        hasMinPatterns: patterns.length >= MIN_PATTERNS,
        hasCustomPattern: hasCustomPattern,
        customPatternTitle: hasCustomPattern ? String(customPatternTitle || "").trim() : null,

        redLinesCount: validRedLines.length,
        hasMinRedLines: validRedLines.length >= MIN_RED_LINES,

        hasGoldenRule: !!selectedRedLineId && String(goldenRuleText || "").trim().length >= 8,
        goldenRuleText: String(goldenRuleText || "").trim(),
        acceptNotToSaveRelationship,
        acceptNoExceptions,

        immediateActionsCount: immediateActions.length,
        nextActionsCount: nextActions.length,
        hasCustomAction: hasCustomActionUsed,
        customActionText: hasCustomActionUsed ? String(customActionText || "").trim() : null,

        rule2x,
        rule24h,

        commitmentLen: String(commitmentText || "").trim().length,
        agreeLocked: agreeLocked,

        summary: {
          redLinesSample: summaryRedLines,
          immediate: immediateActions.slice(0, 4).map(actionTitle),
          next: nextActions.slice(0, 4).map(actionTitle),
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
    phone,
    token,
    patterns,
    hasCustomPattern,
    customPatternTitle,
    validRedLines,
    selectedRedLineId,
    goldenRuleText,
    acceptNotToSaveRelationship,
    acceptNoExceptions,
    immediateActions,
    nextActions,
    hasCustomActionUsed,
    customActionText,
    rule2x,
    rule24h,
    commitmentText,
    agreeLocked,
    actionTitle,
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
      setStep(4);
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
        <Text style={styles.stepPillText}>۱) الگو</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) خط قرمز</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) اصل طلایی</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
      </View>
    </View>
  );

  const scrollContentStyle = useMemo(
    () => ({ padding: 16, paddingBottom: 18 + insets.bottom + 24 }),
    [insets.bottom]
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isUserScrollingRef.current = true;
          }}
          onScrollEndDrag={() => {
            isUserScrollingRef.current = false;
          }}
          onMomentumScrollBegin={() => {
            isUserScrollingRef.current = true;
          }}
          onMomentumScrollEnd={() => {
            isUserScrollingRef.current = false;
          }}
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
              <Text style={styles.h1}>نقطه‌ای که من به خودم خیانت می‌کنم کجاست؟</Text>
              <Text style={styles.p}>
                این مرحله درباره رابطه قبلی نیست؛ درباره الگوی تکراریِ خودته.
                {"\n"}فقط انتخاب کن و تحلیل نکن.
                {"\n\n"}حداقل {MIN_PATTERNS} مورد لازمه.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>قانون</Text>
                <Text style={styles.small}>
                  اگه دوباره وارد رابطه‌ای شدم و این الگوها شروع شد، یعنی دارم به خودم خیانت می‌کنم، پس باید «قانون توقف» داشته باشم.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {PATTERNS.map((v) => {
                  const on = patterns.includes(v.key);
                  return (
                    <Pressable
                      key={v.key}
                      onPress={() => togglePattern(v.key)}
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
                          <Text style={[styles.choiceText, { flexShrink: 1 }]}>{v.title}</Text>
                          <Text style={[styles.small, { flexShrink: 1 }]}>{v.desc}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}

                {/* Custom pattern */}
                <Pressable
                  onPress={() => togglePattern("p_custom")}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    patterns.includes("p_custom") && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={patterns.includes("p_custom") ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={patterns.includes("p_custom") ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>سایر (الگوی دلخواه)</Text>
                  </View>

                  {patterns.includes("p_custom") ? (
                    <View style={{ marginTop: 10 }}>
                      <TextInput
                        editable={!isReview}
                        value={customPatternTitle}
                        onChangeText={(t) => (isReview ? null : setCustomPatternTitle(t))}
                        placeholder="الگوی خودم رو کوتاه بنویس"
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                      />
                    </View>
                  ) : null}
                </Pressable>
              </View>

              {!step1Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: حداقل {MIN_PATTERNS} الگو انتخاب کن{hasCustomPattern ? " و متن الگوی دلخواه رو بنویس" : ""}.
                </Text>
              ) : null}

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
                <Text style={styles.h1}>سه خط قرمزِ غیرقابل مذاکره</Text>
                <Text style={styles.p}>
                  ارزشِ مبهم به درد نمی‌خوره. اینجا «رفتاری و اجرایی» بنویس.
                  {"\n\n"}فرمول هر خط قرمز:
                  {"\n"}• وقتی یا اگه ... رخ میده
                  {"\n"}• یعنی ...
                  {"\n"}• پس من ...
                  {"\n\n"}حداقل {MIN_RED_LINES} موردِ کامل لازمه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>نکته</Text>
                <Text style={styles.small}>
                  «دوستم نداشت» یا «حسم بد شد» خط قرمز نیست چون این قابل مشاهده نیست. رفتار قابل مشاهده بنویس.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {redLines.map((x, idx) => {
                  const isDefault = idx < 3 && (x.id === "rl_1" || x.id === "rl_2" || x.id === "rl_3");
                  return (
                    <View key={x.id} style={styles.choiceCard}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.choiceText, { flex: 1 }]}>{`خط قرمز #${idx + 1}`}</Text>
                        {!isReview && redLines.length > 3 && !isDefault ? (
                          <TouchableOpacity onPress={() => removeRedLine(x.id)} activeOpacity={0.85} style={styles.iconBtn}>
                            <Ionicons name="trash" size={16} color="rgba(231,238,247,.85)" />
                          </TouchableOpacity>
                        ) : (
                          <View style={{ width: 34, height: 34 }} />
                        )}
                      </View>

                      <View style={{ height: 10 }} />

                      <Text style={[styles.small, { marginBottom: 6 }]}>وقتی یا اگه... (رفتار قابل مشاهده)</Text>
                      <TextInput
                        editable={!isReview}
                        value={x.behavior}
                        onChangeText={(t) => updateRedLine(x.id, { behavior: t })}
                        placeholder="مثلاً: بی‌احترامی یا تحقیر کرد…"
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                      />

                      <View style={{ height: 10 }} />

                      <Text style={[styles.small, { marginBottom: 6 }]}>یعنی... (معنای عملی برای من)</Text>
                      <TextInput
                        editable={!isReview}
                        value={x.meaning}
                        onChangeText={(t) => updateRedLine(x.id, { meaning: t })}
                        placeholder="مثلاً: امنیت روانی ندارم…"
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                      />

                      <View style={{ height: 10 }} />

                      <Text style={[styles.small, { marginBottom: 6 }]}>پس من... (اقدام من)</Text>
                      <TextInput
                        editable={!isReview}
                        value={x.action}
                        onChangeText={(t) => updateRedLine(x.id, { action: t })}
                        placeholder="مثلاً: مکالمه رو قطع می‌کنم و فاصله می‌گیرم."
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                      />
                    </View>
                  );
                })}
              </View>

              {!isReview ? (
                <TouchableOpacity onPress={addRedLine} activeOpacity={0.9} style={[styles.secondaryBtn, { marginTop: 12 }]}>
                  <Text style={styles.secondaryBtnText}>افزودن خط قرمز جدید</Text>
                </TouchableOpacity>
              ) : null}

              <View style={[styles.pairCard, { marginTop: 12 }]}>
                <Text style={styles.pairLabel}>خط قرمزهای کامل‌شده:</Text>
                {validRedLines.length ? (
                  validRedLines.map((t, i) => (
                    <Text key={`${t.id}-${i}`} style={styles.pairText}>
                      • {t.behavior} ← {t.meaning} ← {t.action}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.pairText}>—</Text>
                )}
              </View>

              {!step2Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل {MIN_RED_LINES} خط قرمزِ کامل بنویس.</Text>
              ) : null}

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
                <Text style={styles.h1}>اصل طلایی</Text>
                <Text style={styles.p}>
                  این اصل برای «نجات رابطه» نیست؛ برای نجات خودته.
                  {"\n"}اگه چند قانون بذاری، مغزت همیشه استثنا می‌سازه.
                  {"\n\n"}یکی از خط قرمزهای مرحله قبل رو انتخاب کن و تبدیلش کن به «قانون توقف».
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>انتخاب منبع اصلی</Text>
                <Text style={styles.small}>یکی رو انتخاب کن. بعد از ثبت، مذاکره و استثنا ممنوع.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {validRedLines.map((x) => {
                    const on = selectedRedLineId === x.id;
                    return (
                      <Pressable
                        key={x.id}
                        onPress={() => (isReview ? null : setSelectedRedLineId(x.id))}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>
                              {x.behavior} ← {x.action}
                            </Text>
                            <Text style={[styles.small, { flexShrink: 1, marginTop: 6 }]}>{x.meaning}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!selectedRedLineId ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، باید یک خط قرمزِ کامل رو انتخاب کنی.</Text>
                ) : null}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>متن اصل طلایی</Text>
                <Text style={styles.small}>این متن باید ساده، قطعی و غیرقابل دور زدن باشه.</Text>

                <View style={{ height: 10 }} />

                <TextInput
                  editable={!isReview}
                  value={goldenRuleText}
                  onChangeText={(t) => (isReview ? null : setGoldenRuleText(t))}
                  placeholder="اگه ... اتفاق افتاد، من بدون مذاکره ... رو انجام می‌دم."
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, { minHeight: 80 }, isReview && { opacity: 0.7 }]}
                  multiline
                />

                {selectedRedLineId ? (
                  <View style={[styles.pairCard, { marginTop: 12 }]}>
                    <Text style={styles.pairLabel}>پیشنهاد خودکار:</Text>
                    <Text style={styles.pairText}>• {autoGoldenRule || "—"}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptNotToSaveRelationship((x) => !x);
                  }}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    acceptNotToSaveRelationship && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                    { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptNotToSaveRelationship ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptNotToSaveRelationship ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={[styles.choiceText, { flex: 1 }]}>می‌پذیرم: اصل طلایی برای نجات رابطه نیست؛ برای نجات منه.</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAcceptNoExceptions((x) => !x);
                  }}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    acceptNoExceptions && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                    { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptNoExceptions ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptNoExceptions ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={[styles.choiceText, { flex: 1 }]}>
                      می‌پذیرم: اگه دنبال «استثنا» بگردم، یعنی دارم وارد خودفریبی میشم.
                    </Text>
                  </View>
                </Pressable>
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: انتخاب منبع + متن اصل طلایی + هر دو تیک ضد دور زدن لازمه.</Text>
              ) : null}

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
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!step3Ok || saving) && { opacity: 0.45 }]}
                    disabled={!step3Ok || saving}
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
                <Text style={styles.h1}>پروتکل اجرا</Text>
                <Text style={styles.p}>
                  اصل طلایی بدون اجرا، فقط یک جمله سادست.
                  {"\n"}اینجا مغزت باید وارد حالت خودکار بشه.
                  {"\n\n"}خلاصه انتخاب‌های تو:
                  {"\n"}• الگوها: {patterns.length}
                  {"\n"}• خط قرمزهای کامل: {validRedLines.length}
                  {"\n"}• اصل طلایی: {String(goldenRuleText || "").trim() ? "✓" : "—"}
                </Text>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>اصل طلایی من</Text>
                  <Text style={styles.small}>{String(goldenRuleText || "").trim() || "—"}</Text>
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>اقدام فوری (حداقل یدونه رو انتخاب کن)</Text>
                <Text style={styles.small}>در لحظه نقض: بدون مذاکره.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {IMMEDIATE_ACTIONS.map((a) => {
                    const on = immediateActions.includes(a.key);
                    return (
                      <Pressable
                        key={a.key}
                        onPress={() => toggleAction("immediate", a.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{a.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{a.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => toggleAction("immediate", "a_custom")}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      immediateActions.includes("a_custom") && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={immediateActions.includes("a_custom") ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={immediateActions.includes("a_custom") ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={styles.choiceText}>سایر (اقدام دلخواه)</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}> اقدام تو تا ۲۴ ساعت (حداقل یدونه رو بنویس)</Text>
                <Text style={styles.small}>بعد از نقض اصل طلاییت مغزت دنبال برگشته پس با این‌ها مهارش می‌کنن.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {NEXT_ACTIONS.map((a) => {
                    const on = nextActions.includes(a.key);
                    return (
                      <Pressable
                        key={a.key}
                        onPress={() => toggleAction("next", a.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{a.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{a.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => toggleAction("next", "a_custom")}
                    disabled={isReview}
                    style={[
                      styles.choiceCard,
                      nextActions.includes("a_custom") && styles.choiceCardOn,
                      isReview && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={nextActions.includes("a_custom") ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={nextActions.includes("a_custom") ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={styles.choiceText}>سایر (اقدام دلخواه)</Text>
                    </View>
                  </Pressable>
                </View>

                {hasCustomActionUsed ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.small, { marginBottom: 6 }]}>متن اقدام دلخواه (اجباری)</Text>
                    <TextInput
                      editable={!isReview}
                      value={customActionText}
                      onChangeText={(t) => (isReview ? null : setCustomActionText(t))}
                      placeholder="اقدام دلخواه من…"
                      placeholderTextColor="rgba(231,238,247,.45)"
                      style={[styles.input, isReview && { opacity: 0.7 }]}
                      multiline
                    />
                  </View>
                ) : null}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}> معیار تشخیص نقض</Text>
                <Text style={styles.small}>این بخش جلوی دستکاری روانی و توجیه کردن توسط خودت رو می‌گیره.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setRule2x((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, rule2x && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={rule2x ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={rule2x ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>قانون ۲ بار: اگه این رفتار ۲ بار تکرار شد، نقض محسوب میشه.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (isReview) return;
                      setRule24h((x) => !x);
                    }}
                    disabled={isReview}
                    style={[styles.choiceCard, rule24h && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={rule24h ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={rule24h ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        قانون ۲۴ ساعت: اگه تا ۲۴ ساعت مسئولیت این نقض رو طرف مقابل بر عهده نگرفت و عذرخواهی نکرد و تلاش نکرد جبران کنه، نقض محسوب میشه.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {!rule2x && !rule24h ? <Text style={[styles.warn, { marginTop: 10 }]}>حداقل یکی از معیارها باید انتخاب بشه.</Text> : null}
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>متن تعهد (اجباری)</Text>
                <Text style={styles.small}>کوتاه، قاطع، بدون توجیه.</Text>

                <View style={{ height: 10 }} />
                <TextInput
                  editable={!isReview}
                  value={commitmentText}
                  onChangeText={(t) => (isReview ? null : setCommitmentText(t))}
                  placeholder="مثلاً: من درد قطع ارتباط کردن رو به درد له شدن توسط اون آدم ترجیح می‌دم."
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, { minHeight: 90 }, isReview && { opacity: 0.7 }]}
                  multiline
                />
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeLocked((x) => !x);
                  }}
                  disabled={isReview}
                  style={[
                    styles.choiceCard,
                    agreeLocked && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                    { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                  ]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeLocked ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeLocked ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={[styles.choiceText, { flex: 1 }]}>تعهد می‌دم: اگه اصل طلایی نقض شد، توجیه نمی‌کنم و طبق پروتکل عمل کنم.</Text>
                  </View>
                </Pressable>
              </View>

              {!step4Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ثبت: اقدام فوری + اقدام ۲۴ساعته + معیار تشخیص + متن تعهد + تیک قفل لازمه.
                </Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(3)}
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

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    color: palette.text,
    textAlign: "right",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 18,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
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