// app/pelekan/bastan/subtask/ML_5_learning_confirm.tsx

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
  if (k === "ML_5_learning_confirm") return "ریز اقدام پنجم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type ReviewItem = {
  key: string;
  title: string;
  hint: string;
  storageKey: string;
};

type CompletedItem = {
  key: string;
  title: string;
  hint: string;
  found: boolean;
  savedAt?: string | null;
  shortPreview?: string | null;
};

type ML5Saved = {
  version: 1;
  savedAt: string;

  // snapshot of what was detected
  completedKeys: string[];
  completedCount: number;

  // step2 (new)
  learnings: string[]; // min 3
  principles: string[]; // min 3

  // step3 (kept)
  acceptanceText: string; // min 20

  // step4
  commitmentText: string; // min 10
  agreeLocked: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "ML_5_learning_confirm";
const KEY_ML5_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

const finalKeyFor = (k: string) => `pelekan:bastan:subtask:${k}:final:v1`;

/* ----------------------------- Review Items (Action 6) ----------------------------- */

const REVIEW_ITEMS: ReviewItem[] = [
  {
    key: "ML_1_what_did_i_learn",
    title: "درس‌های رابطه",
    hint: "جمع‌بندی یادگیری از رابطه و اشتباهات",
    storageKey: finalKeyFor("ML_1_what_did_i_learn"),
  },
  {
    key: "ML_2_pattern_awareness",
    title: "الگوی قابل توقف",
    hint: "شناخت نشانه‌های نشخوار و ابزار قطع آن",
    storageKey: finalKeyFor("ML_2_pattern_awareness"),
  },
  {
    key: "ML_3_values_next_time",
    title: "ارزش‌های غیرقابل مذاکره",
    hint: "ارزش‌ها، مرزها، و برنامه‌های اگه-آنگاه",
    storageKey: finalKeyFor("ML_3_values_next_time"),
  },
  {
    key: "ML_4_golden_rule",
    title: "اصل طلایی رابطه",
    hint: "قانون طلایی تو برای رابطه‌ی بعدی",
    storageKey: finalKeyFor("ML_4_golden_rule"),
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

export default function ML5LearningConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "پذیرش یادگیری";
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

  // review data
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [selectedKeyForDetails, setSelectedKeyForDetails] = useState<string>(REVIEW_ITEMS[0]?.key || "");

  // step2 (new)
  const [learnings, setLearnings] = useState<string[]>(["", "", ""]);
  const [principles, setPrinciples] = useState<string[]>(["", "", ""]);

  // step3 (kept)
  const [acceptanceText, setAcceptanceText] = useState("");

  // step4
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

  const completedKeys = useMemo(() => completedItems.filter((x) => x.found).map((x) => x.key), [completedItems]);
  const completedCount = completedKeys.length;

  const cleanedLearnings = useMemo(
    () => learnings.map((x) => String(x || "").trim()).filter((x) => !!x),
    [learnings]
  );
  const cleanedPrinciples = useMemo(
    () => principles.map((x) => String(x || "").trim()).filter((x) => !!x),
    [principles]
  );

  const activeDetail = useMemo(() => {
    const it = completedItems.find((x) => x.key === selectedKeyForDetails) || null;
    return it;
  }, [completedItems, selectedKeyForDetails]);

  const detailTitle = useMemo(() => {
    const item = REVIEW_ITEMS.find((x) => x.key === selectedKeyForDetails);
    return item?.title || "جزئیات";
  }, [selectedKeyForDetails]);

  /* ----------------------------- Load ML5 FINAL if any ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_ML5_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as ML5Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const l1 = Array.isArray(j.learnings) ? (j.learnings as any[]) : [];
    const p1 = Array.isArray(j.principles) ? (j.principles as any[]) : [];

    setLearnings(l1.length ? l1.map((x) => String(x || "")) : ["", "", ""]);
    setPrinciples(p1.length ? p1.map((x) => String(x || "")) : ["", "", ""]);
    setAcceptanceText(String(j.acceptanceText || ""));
    setCommitmentText(String(j.commitmentText || ""));
    setAgreeLocked(!!j.agreeLocked);

    return { loaded: true as const };
  }, []);

  /* ----------------------------- Detect completed subtasks locally ----------------------------- */

  const safeFaList = useCallback((arr: any, max = 12) => {
    const a = Array.isArray(arr) ? arr : [];
    const out: string[] = [];
    for (const item of a) {
      if (out.length >= max) break;
      const s = String(item || "").trim();
      if (!s) continue;
      out.push(s);
    }
    return out;
  }, []);

  const buildPreview = useCallback(
    (key: string, obj: any): string | null => {
      try {
        if (!obj || typeof obj !== "object") return null;

        // ML_1: درس‌های رابطه (نمایش چند مورد فارسی)
        if (key === "ML_1_what_did_i_learn") {
          // تلاش برای فیلدهای رایج
          const lessonsFa = safeFaList(obj?.lessons, 6);
          const mistakesFa = safeFaList(obj?.mistakes, 4);
          const hints: string[] = [];

          if (lessonsFa.length) hints.push(`درس‌ها: ${lessonsFa.slice(0, 3).join("، ")}${lessonsFa.length > 3 ? "…" : ""}`);
          if (mistakesFa.length) hints.push(`اشتباهات: ${mistakesFa.slice(0, 2).join("، ")}${mistakesFa.length > 2 ? "…" : ""}`);

          if (hints.length) return hints.join(" • ");
          return "ثبت شده";
        }

        // ML_2: الگوی قابل توقف (نمایش نشانه‌ها/ابزارها به فارسی اگر موجود)
        if (key === "ML_2_pattern_awareness") {
          const signs = safeFaList(obj?.ruminationSigns ?? obj?.signs ?? obj?.rSigns, 8);
          const tools = safeFaList(obj?.interruptTools ?? obj?.tools ?? obj?.rTools, 8);
          const grounding = safeFaList(obj?.groundings ?? obj?.ground ?? obj?.grounds, 6);
          const anchors = safeFaList(obj?.anchors ?? obj?.anchor ?? obj?.a, 6);

          const parts: string[] = [];
          if (signs.length) parts.push(`نشانه‌ها: ${signs.slice(0, 2).join("، ")}${signs.length > 2 ? "…" : ""}`);
          if (tools.length) parts.push(`ابزار قطع: ${tools.slice(0, 2).join("، ")}${tools.length > 2 ? "…" : ""}`);
          if (grounding.length) parts.push(`زمین‌گیر: ${grounding.slice(0, 2).join("، ")}${grounding.length > 2 ? "…" : ""}`);
          if (anchors.length) parts.push(`لنگر: ${anchors.slice(0, 2).join("، ")}${anchors.length > 2 ? "…" : ""}`);

          if (parts.length) return parts.join(" • ");
          return "ثبت شده";
        }

        // ML_3: ارزش‌های غیرقابل مذاکره (قبلی خوب بود + کمی بهتر)
        if (key === "ML_3_values_next_time") {
          const valuesCount = Array.isArray(obj?.values) ? obj.values.length : null;
          const nnCount = Array.isArray(obj?.nonNegotiables)
            ? obj.nonNegotiables.filter((x: any) => String(x?.text || x || "").trim()).length
            : null;
          const ifCount = Array.isArray(obj?.ifThenPlans)
            ? obj.ifThenPlans.filter((x: any) => String(x?.actionText || x?.action || x || "").trim()).length
            : null;

          const c = [
            valuesCount != null ? `ارزش‌ها: ${valuesCount}` : null,
            nnCount != null ? `مرزها: ${nnCount}` : null,
            ifCount != null ? `اگر-آنگاه: ${ifCount}` : null,
          ].filter(Boolean);
          return c.length ? c.join(" • ") : "ثبت شده";
        }

        // ML_4: اصل طلایی رابطه (نمایش متن فارسی اگر موجود)
        if (key === "ML_4_golden_rule") {
          const t =
            String(obj?.goldenRule || obj?.rule || obj?.text || obj?.answer || "").trim() ||
            String(obj?.summary || "").trim();
          if (t) return `اصل: ${t.slice(0, 42)}${t.length > 42 ? "…" : ""}`;
          return "ثبت شده";
        }

        // fallback
        if (typeof obj?.savedAt === "string") return "ثبت شده";
        return "ثبت شده";
      } catch {
        return null;
      }
    },
    [safeFaList]
  );

  const detectCompleted = useCallback(async () => {
    const keys = REVIEW_ITEMS.map((x) => x.storageKey);
    const pairs = await AsyncStorage.multiGet(keys);

    const result: CompletedItem[] = REVIEW_ITEMS.map((it) => {
      const foundPair = pairs.find((p) => p[0] === it.storageKey);
      const raw = foundPair?.[1] || null;
      if (!raw) {
        return { key: it.key, title: it.title, hint: it.hint, found: false, savedAt: null, shortPreview: null };
      }

      try {
        const j = JSON.parse(raw);
        const savedAt = typeof j?.savedAt === "string" ? String(j.savedAt) : null;
        const shortPreview = buildPreview(it.key, j);
        return { key: it.key, title: it.title, hint: it.hint, found: true, savedAt, shortPreview };
      } catch {
        return { key: it.key, title: it.title, hint: it.hint, found: true, savedAt: null, shortPreview: "ثبت شده" };
      }
    });

    setCompletedItems(result);

    const firstDone = result.find((x) => x.found)?.key || result[0]?.key || "";
    if (firstDone) setSelectedKeyForDetails(firstDone);
  }, [buildPreview]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        await detectCompleted();
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
  }, [detectCompleted, loadFinalIfAny]);

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

  /* ----------------------------- Updates ----------------------------- */

  const updateLearning = useCallback(
    (idx: number, t: string) => {
      if (isReview) return;
      setLearnings((prev) => prev.map((x, i) => (i === idx ? t : x)));
    },
    [isReview]
  );

  const updatePrinciple = useCallback(
    (idx: number, t: string) => {
      if (isReview) return;
      setPrinciples((prev) => prev.map((x, i) => (i === idx ? t : x)));
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */

  const step1Ok = completedCount >= 1;

  // step2 now requires writing
  const step2Ok = cleanedLearnings.length >= 3 && cleanedPrinciples.length >= 3;

  // step3 kept: acceptance
  const step3Ok = String(acceptanceText || "").trim().length >= 20;

  const step4Ok = String(commitmentText || "").trim().length >= 10 && !!agreeLocked;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: ML5Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      completedKeys,
      completedCount,

      learnings: cleanedLearnings.slice(0, 10),
      principles: cleanedPrinciples.slice(0, 10),

      acceptanceText: String(acceptanceText || "").trim(),

      commitmentText: String(commitmentText || "").trim(),
      agreeLocked: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_ML5_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [acceptanceText, cleanedLearnings, cleanedPrinciples, commitmentText, completedCount, completedKeys]);

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
        completedCount,
        completedKeys,

        learningsCount: cleanedLearnings.length,
        principlesCount: cleanedPrinciples.length,
        acceptanceLen: String(acceptanceText || "").trim().length,
        commitmentLen: String(commitmentText || "").trim().length,
        agreeLocked,

        summary: {
          completedTitles: completedItems.filter((x) => x.found).map((x) => x.title).slice(0, 10),
          learnings: cleanedLearnings.slice(0, 3),
          principles: cleanedPrinciples.slice(0, 3),
          acceptanceSample: String(acceptanceText || "").trim().slice(0, 120),
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
    completedCount,
    completedKeys,
    cleanedLearnings,
    cleanedPrinciples,
    acceptanceText,
    commitmentText,
    agreeLocked,
    completedItems,
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
        <Text style={styles.stepPillText}>۱) مرور</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) استخراج</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) پذیرش</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) تعهد</Text>
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
    <Text style={styles.h1}>مرور ریزاقدام‌های اقدام ششم</Text>
    <Text style={styles.p}>
      اینجا فقط «یادآوری» می‌کنی که در اقدام ششم چه چیزهایی رو ثبت کردی.
      {"\n\n"}اگه ریزاقدامی انجام شده باشه، تیک می‌خوره.
    </Text>

    <View style={[styles.noteCard, { marginTop: 10 }]}>
      <Text style={styles.noteTitle}>وضعیت</Text>
      <Text style={styles.small}>
        انجام‌شده‌ها: {completedCount} از {REVIEW_ITEMS.length}
      </Text>
    </View>

    <View style={{ gap: 10, marginTop: 12 }}>
      {completedItems.map((it) => {
        const on = it.found;
        return (
          <Pressable
            key={it.key}
            onPress={() => setSelectedKeyForDetails(it.key)}
            style={[
              styles.choiceCard,
              on && styles.choiceCardOn,
              selectedKeyForDetails === it.key && { borderColor: "rgba(212,175,55,.30)" },
            ]}
          >
            <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
              <Ionicons
                name={on ? "checkbox" : "square-outline"}
                size={18}
                color={on ? palette.green : "rgba(231,238,247,.55)"}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                <Text style={[styles.small, { flexShrink: 1 }]}>{it.hint}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>

    {!step1Ok ? (
      <Text style={[styles.warn, { marginTop: 10 }]}>
        برای ادامه: حداقل یکی از ریزاقدام‌های اقدام ششم باید روی همین دستگاه ذخیره شده باشه.
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

          {/* ----------------------------- Step 2 (NEW: Extract) ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>استخراج یادگیری و اصول</Text>
                <Text style={styles.p}>
                  اینجا قرار نیست «نمایش» بدیم.
                  {"\n"}باید از دل چیزهایی که در مرحله قبل مرور کردی، خودت بیرون بکشی:
                  {"\n"}• ۳ یادگیری اصلی
                  {"\n"}• ۳ اصل پایبندی (قانون رفتاری)
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>سه یادگیری اصلی (اجباری)</Text>
                <Text style={styles.small}>کوتاه، دقیق، قابل اجرا.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {[0, 1, 2].map((idx) => (
                    <View key={`learn_${idx}`} style={styles.choiceCard}>
                      <Text style={[styles.choiceText, { marginBottom: 8 }]}>{`یادگیری #${idx + 1}`}</Text>
                      <TextInput
                        editable={!isReview}
                        value={learnings[idx] || ""}
                        onChangeText={(t) => updateLearning(idx, t)}
                        placeholder="مثلاً: من وقتی خط قرمز رابطه رد شد، وارد مذاکره‌ی احساسی نمی‌شم."
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                      />
                    </View>
                  ))}
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>سه اصل پایبندی (اجباری)</Text>
                  <Text style={styles.small}>قانون رفتاریِ «از این به بعد».</Text>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {[0, 1, 2].map((idx) => (
                      <View key={`pr_${idx}`} style={styles.choiceCard}>
                        <Text style={[styles.choiceText, { marginBottom: 8 }]}>{`اصل #${idx + 1}`}</Text>
                        <TextInput
                          editable={!isReview}
                          value={principles[idx] || ""}
                          onChangeText={(t) => updatePrinciple(idx, t)}
                          placeholder="مثلاً: هیچ رابطه‌ای بدون احترام متقابل ادامه پیدا نمی‌کنه."
                          placeholderTextColor="rgba(231,238,247,.45)"
                          style={[styles.input, isReview && { opacity: 0.7 }]}
                          multiline
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>خلاصه‌ی تو:</Text>
                  <Text style={styles.pairText}>
                    • انجام‌شده‌ها: {completedCount}
                    {"\n"}• یادگیری‌ها (کامل): {cleanedLearnings.length}
                    {"\n"}• اصول (کامل): {cleanedPrinciples.length}
                  </Text>
                </View>
              </View>

              {!step2Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: ۳ یادگیری + ۳ اصل پایبندی لازمه.</Text>
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
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo3 || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 (Acceptance) ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پذیرش واقعیت</Text>
                <Text style={styles.p}>
                  اینجا یادگیری‌هات رو از «حرف» به «پذیرش» تبدیل می‌کنی.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>متن پذیرش (اجباری)</Text>
                <Text style={styles.small}>
                  قالب پیشنهادی:
                  {"\n"}• می‌پذیرم که ...
                  {"\n"}• قبلاً اشتباه من این بود که ...
                  {"\n"}• از این به بعد ...
                </Text>

                <View style={{ height: 10 }} />

                <TextInput
                  editable={!isReview}
                  value={acceptanceText}
                  onChangeText={(t) => (isReview ? null : setAcceptanceText(t))}
                  placeholder="می‌پذیرم که..."
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, { minHeight: 120 }, isReview && { opacity: 0.7 }]}
                  multiline
                />

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>خلاصه‌ی تو:</Text>
                  <Text style={styles.pairText}>
                    • یادگیری‌ها: {cleanedLearnings.length}
                    {"\n"}• اصول: {cleanedPrinciples.length}
                    {"\n"}• طول پذیرش: {String(acceptanceText || "").trim().length}
                  </Text>
                </View>
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: متن پذیرش لازمه.</Text>
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
                <Text style={styles.h1}>تعهد نهایی</Text>
                <Text style={styles.p}>
                  اینجا پذیرش یادگیری رو رسمی می‌کنی.
                  {"\n\n"}خلاصه:
                  {"\n"}• انجام‌شده‌ها: {completedCount}
                  {"\n"}• یادگیری‌ها: {cleanedLearnings.length}
                  {"\n"}• اصول: {cleanedPrinciples.length}
                </Text>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>اصل من بعد از این مسیر</Text>
                  <Text style={styles.small}>
                    ۱) توجیه نمی‌کنم
                    {"\n"}۲) معامله نمی‌کنم
                    {"\n"}۳) یادگیریم رو تبدیل به رفتار می‌کنم
                  </Text>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>متن تعهد (اجباری)</Text>
                  <Text style={styles.small}>کوتاه و قاطع بنویس.</Text>

                  <View style={{ height: 10 }} />
                  <TextInput
                    editable={!isReview}
                    value={commitmentText}
                    onChangeText={(t) => (isReview ? null : setCommitmentText(t))}
                    placeholder="من متعهد می‌شوم که..."
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
                      <Text style={[styles.choiceText, { flex: 1 }]}>
                        قول میدم یادگیری‌هام رو با تنبلی و توجیه خراب نکنم و از این به بعد طبقش رفتار کنم.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {!step4Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: متن تعهد + تیک قفل لازمه.</Text> : null}
              </View>

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