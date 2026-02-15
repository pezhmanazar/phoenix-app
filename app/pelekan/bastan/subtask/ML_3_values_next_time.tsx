// app/pelekan/bastan/subtask/ML_3_values_next_time.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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
  if (k === "ML_3_values_next_time") return "ریز اقدام سوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type ValueKey =
  | "v_respect"
  | "v_honesty"
  | "v_emotional_safety"
  | "v_stability"
  | "v_responsibility"
  | "v_growth"
  | "v_boundaries"
  | "v_calm"
  | "v_support"
  | "v_maturity"
  | "v_commitment"
  | "v_independence"
  | "v_family"
  | "v_spirituality"
  | "v_intimacy"
  | "v_fairness"
  | "v_trust"
  | "v_kindness"
  | "v_loyalty"
  | "v_communication"
  | "v_custom";

type TriggerKey =
  | "t_loneliness"
  | "t_guilt_pity"
  | "t_fear_abandonment"
  | "t_family_pressure"
  | "t_sexual_craving"
  | "t_sudden_message"
  | "t_nostalgia"
  | "t_comparison"
  | "t_stress_overload"
  | "t_self_doubt"
  | "t_custom";

type NonNegotiable = { id: string; text: string };
type IfThenPlan = { id: string; triggerKey: TriggerKey; actionText: string };

type ML3Saved = {
  version: 1;
  savedAt: string;

  values: ValueKey[]; // step1 (min 5)
  customValueTitle?: string | null; // step1 (if v_custom)
  meanings: Record<string, string>; // step1 optional meanings

  nonNegotiables: NonNegotiable[]; // step2 (min 3)

  ifThenPlans: IfThenPlan[]; // step3 (min 2)
  customTriggerTitle?: string | null; // step3 (if any t_custom used)

  commitmentText: string; // step4
  agreeLocked: boolean; // step4

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "ML_3_values_next_time";
const KEY_ML3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */

const MIN_VALUES = 5;
const MIN_NN = 3;
const MIN_IFTHEN = 2;

const VALUES: { key: Exclude<ValueKey, "v_custom">; title: string; desc: string }[] = [
  { key: "v_respect", title: "احترام", desc: "تحقیر کردن، توهین کردن و کوچک‌کردن خط قرمز به حساب میاد." },
  { key: "v_honesty", title: "صداقت", desc: "دروغ حتی کوچیک، اعتماد رو می‌شکنه." },
  { key: "v_emotional_safety", title: "امنیت روانی", desc: "تهدید، باج‌گیری هیجانی و ترسوندن ممنوع." },
  { key: "v_stability", title: "ثبات", desc: "رفتار موجی و رفت‌وبرگشت‌های فرساینده ممنوع." },
  { key: "v_responsibility", title: "مسئولیت‌پذیری", desc: "پذیرش خطا همرا با جبران خطا و تعهد به تغییر باید در رابط دیده بشه." },
  { key: "v_growth", title: "رشد", desc: "رابطه باید باعث بهتر شدن بشه نه بدتر شدن." },
  { key: "v_boundaries", title: "مرزهای سالم", desc: "نه کنترل زیاد، نه رهاشدگی بیش از حد. مرز یعنی احترام عملی." },
  { key: "v_calm", title: "آرامش", desc: "رابطه نباید میدون جنگ و استرس دائمی باشه." },
  { key: "v_support", title: "حمایت", desc: "حضور و همراهی واقعی در رابطه باید در عمل دیده بشه نه فقط حرف." },
  { key: "v_maturity", title: "بلوغ هیجانی", desc: "قهر، داد زدن و بازی‌های کودکانه ممنوع." },
  { key: "v_commitment", title: "تعهد", desc: "انتخاب آگاهانه همراه با پایبندی باید در رابطه باشه نه اینکه فقط وعده‌های لحظه‌ای داده بشه." },
  { key: "v_independence", title: "استقلال", desc: "وابستگی چسبنده گونه یا سردی افراطی ممنوع." },
  { key: "v_family", title: "خانواده‌محوری", desc: "هم‌جهتی درباره خانواده و آینده جز اصول رابطه‌ست." },
  { key: "v_spirituality", title: "معنا و معنویت", desc: "هم‌جهتی در جهان‌بینی و ارزش‌های عمیق در رابطه مهمه." },
  { key: "v_intimacy", title: "صمیمیت", desc: "نزدیکی امن، محترمانه و بدون دستکاری." },
  { key: "v_fairness", title: "عدالت", desc: "رابطه یک‌طرفه نباشه." },
  { key: "v_trust", title: "اعتماد", desc: "شفافیت، وفاداری و ثبات رفتاری." },
  { key: "v_kindness", title: "مهربانی", desc: "خشونت کلامی یعنی پایان رابطه." },
  { key: "v_loyalty", title: "وفاداری", desc: "دوپهلو و خاکستری بازی ممنوع." },
  { key: "v_communication", title: "گفت‌وگو", desc: "حل مسئله با گفتگو باید اتفاق بیفته نه با قهر و ناپدید شدن." },
];

const TRIGGERS: { key: Exclude<TriggerKey, "t_custom">; title: string; desc: string }[] = [
  { key: "t_loneliness", title: "تنهایی شدید", desc: "وقتی خلأ میاد و دلم می‌خواد برگردم." },
  { key: "t_guilt_pity", title: "حس گناه یا ترحم", desc: "وقتی دلم می‌سوزه و مرزها می‌ریزه." },
  { key: "t_fear_abandonment", title: "ترس از رها شدن", desc: "وقتی می‌ترسم تنها بمونم." },
  { key: "t_family_pressure", title: "فشار خانواده یا اطرافیان", desc: "وقتی می‌گن «برگرد یا خودت رو بساز»." },
  { key: "t_sexual_craving", title: "کشش بدنی یا احساس دلتنگی", desc: "وقتی بدن تصمیم می‌گیره نه عقل." },
  { key: "t_sudden_message", title: "پیام یا تماس ناگهانی", desc: "وقتی از سمتش یه پیام میاد و مغزم قفل می‌کنه." },
  { key: "t_nostalgia", title: "خاطره‌بازی", desc: "وقتی عکس‌ها یا سفرها رو مرور می‌کنم." },
  { key: "t_comparison", title: "مقایسه", desc: "وقتی خودم رو با آدم‌های دیگه مقایسه می‌کنم." },
  { key: "t_stress_overload", title: "استرس و فشار", desc: "وقتی خسته‌ام و تصمیم‌های بد می‌گیرم." },
  { key: "t_self_doubt", title: "شک به خود", desc: "وقتی فکر می‌کنم «من کافی نیستم»." },
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

export default function ML3ValuesNextTimeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "ارزش‌های غیرقابل مذاکره";
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

  // Step 1
  const [values, setValues] = useState<ValueKey[]>([]);
  const [customValueTitle, setCustomValueTitle] = useState("");
  const [meanings, setMeanings] = useState<Record<string, string>>({});

  // Step 2
  const [nonNegotiables, setNonNegotiables] = useState<NonNegotiable[]>([
    { id: "nn_1", text: "" },
    { id: "nn_2", text: "" },
    { id: "nn_3", text: "" },
  ]);

  // Step 3
  const [ifThenPlans, setIfThenPlans] = useState<IfThenPlan[]>([
    { id: "if_1", triggerKey: "t_loneliness", actionText: "" },
    { id: "if_2", triggerKey: "t_sudden_message", actionText: "" },
  ]);
  const [customTriggerTitle, setCustomTriggerTitle] = useState("");

  // Step 4
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

  const hasCustomValue = values.includes("v_custom");
  const anyCustomTriggerUsed = useMemo(() => ifThenPlans.some((p) => p.triggerKey === "t_custom"), [ifThenPlans]);

  const selectedValueTitles = useMemo(() => {
    const set = new Set(values);
    const titles = VALUES.filter((x) => set.has(x.key)).map((x) => x.title);
    if (set.has("v_custom")) titles.push(customValueTitle.trim() || "سایر");
    return titles;
  }, [values, customValueTitle]);

  const cleanedNonNegotiables = useMemo(() => {
    return nonNegotiables.map((x) => ({ ...x, text: String(x.text || "").trim() })).filter((x) => !!x.text);
  }, [nonNegotiables]);

  const cleanedIfThen = useMemo(() => {
    return ifThenPlans
      .map((x) => ({
        ...x,
        actionText: String(x.actionText || "").trim(),
      }))
      .filter((x) => !!x.actionText);
  }, [ifThenPlans]);

  const triggerTitle = useCallback(
    (k: TriggerKey) => {
      if (k === "t_custom") return customTriggerTitle.trim() || "سایر";
      const f = TRIGGERS.find((x) => x.key === k);
      return f?.title || "—";
    },
    [customTriggerTitle]
  );

  /* ----------------------------- Load FINAL if any ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_ML3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as ML3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const vv = Array.isArray(j.values) ? (j.values as any[]) : [];
    setValues(vv.filter(Boolean) as ValueKey[]);

    setCustomValueTitle(String(j.customValueTitle || ""));
    setMeanings((j.meanings && typeof j.meanings === "object" ? j.meanings : {}) as any);

    const nn = Array.isArray(j.nonNegotiables) ? (j.nonNegotiables as any[]) : [];
    setNonNegotiables(
      nn.length
        ? (nn
            .filter(Boolean)
            .map((x) => ({ id: String(x.id || ""), text: String(x.text || "") }))
            .filter((x) => !!x.id) as NonNegotiable[])
        : [
            { id: "nn_1", text: "" },
            { id: "nn_2", text: "" },
            { id: "nn_3", text: "" },
          ]
    );

    const it = Array.isArray(j.ifThenPlans) ? (j.ifThenPlans as any[]) : [];
    setIfThenPlans(
      it.length
        ? (it
            .filter(Boolean)
            .map((x) => ({
              id: String(x.id || ""),
              triggerKey: (String(x.triggerKey || "") as TriggerKey) || "t_loneliness",
              actionText: String(x.actionText || ""),
            }))
            .filter((x) => !!x.id) as IfThenPlan[])
        : [
            { id: "if_1", triggerKey: "t_loneliness", actionText: "" },
            { id: "if_2", triggerKey: "t_sudden_message", actionText: "" },
          ]
    );

    setCustomTriggerTitle(String(j.customTriggerTitle || ""));
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

  const toggleValue = useCallback(
    (k: ValueKey) => {
      if (isReview) return;
      setValues((prev) => {
        const has = prev.includes(k);
        if (has) return prev.filter((x) => x !== k);
        return [...prev, k];
      });
    },
    [isReview]
  );

  const updateMeaning = useCallback(
    (k: string, t: string) => {
      if (isReview) return;
      setMeanings((m) => ({ ...m, [k]: t }));
    },
    [isReview]
  );

  const updateNN = useCallback(
    (id: string, t: string) => {
      if (isReview) return;
      setNonNegotiables((prev) => prev.map((x) => (x.id === id ? { ...x, text: t } : x)));
    },
    [isReview]
  );

  const addNN = useCallback(() => {
    if (isReview) return;
    const nextId = `nn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setNonNegotiables((prev) => [...prev, { id: nextId, text: "" }]);
  }, [isReview]);

  const removeNN = useCallback(
    (id: string) => {
      if (isReview) return;
      setNonNegotiables((prev) => {
        const next = prev.filter((x) => x.id !== id);
        return next.length ? next : [{ id: "nn_1", text: "" }, { id: "nn_2", text: "" }, { id: "nn_3", text: "" }];
      });
    },
    [isReview]
  );

  const updateIfThen = useCallback(
    (id: string, patch: Partial<IfThenPlan>) => {
      if (isReview) return;
      setIfThenPlans((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [isReview]
  );

  const addIfThen = useCallback(() => {
    if (isReview) return;
    const nextId = `if_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setIfThenPlans((prev) => [...prev, { id: nextId, triggerKey: "t_loneliness", actionText: "" }]);
  }, [isReview]);

  const removeIfThen = useCallback(
    (id: string) => {
      if (isReview) return;
      setIfThenPlans((prev) => {
        const next = prev.filter((x) => x.id !== id);
        return next.length
          ? next
          : [
              { id: "if_1", triggerKey: "t_loneliness", actionText: "" },
              { id: "if_2", triggerKey: "t_sudden_message", actionText: "" },
            ];
      });
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */

  const step1Ok = values.length >= MIN_VALUES && (!hasCustomValue || String(customValueTitle || "").trim().length >= 2);

  const step2Ok = cleanedNonNegotiables.length >= MIN_NN;

  const step3Ok =
    cleanedIfThen.length >= MIN_IFTHEN && (!anyCustomTriggerUsed || String(customTriggerTitle || "").trim().length >= 2);

  const step4Ok = String(commitmentText || "").trim().length >= 10 && !!agreeLocked;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: ML3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      values: values || [],
      customValueTitle: hasCustomValue ? String(customValueTitle || "").trim() : null,
      meanings: meanings || {},

      nonNegotiables: (cleanedNonNegotiables || []).map((x) => ({ id: x.id, text: x.text })),

      ifThenPlans: (cleanedIfThen || []).map((x) => ({
        id: x.id,
        triggerKey: x.triggerKey,
        actionText: x.actionText,
      })),
      customTriggerTitle: anyCustomTriggerUsed ? String(customTriggerTitle || "").trim() : null,

      commitmentText: String(commitmentText || "").trim(),
      agreeLocked: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_ML3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [
    values,
    meanings,
    cleanedNonNegotiables,
    cleanedIfThen,
    commitmentText,
    hasCustomValue,
    customValueTitle,
    anyCustomTriggerUsed,
    customTriggerTitle,
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

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        valuesCount: values.length,
        hasMinValues: values.length >= MIN_VALUES,
        hasCustomValue: hasCustomValue,
        customValueTitle: hasCustomValue ? String(customValueTitle || "").trim() : null,

        nonNegotiablesCount: cleanedNonNegotiables.length,
        hasMinNonNegotiables: cleanedNonNegotiables.length >= MIN_NN,

        ifThenCount: cleanedIfThen.length,
        hasMinIfThen: cleanedIfThen.length >= MIN_IFTHEN,
        hasCustomTrigger: anyCustomTriggerUsed,
        customTriggerTitle: anyCustomTriggerUsed ? String(customTriggerTitle || "").trim() : null,

        commitmentLen: String(commitmentText || "").trim().length,
        agreeLocked: agreeLocked,

        summary: {
          values: selectedValueTitles.slice(0, 12),
          nonNegotiablesSample: cleanedNonNegotiables.slice(0, 3).map((x) => x.text),
          ifThenSample: cleanedIfThen.slice(0, 2).map((x) => `اگر ${triggerTitle(x.triggerKey)} شد → ${x.actionText}`),
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
    values.length,
    values,
    hasCustomValue,
    customValueTitle,
    cleanedNonNegotiables,
    cleanedIfThen,
    anyCustomTriggerUsed,
    customTriggerTitle,
    commitmentText,
    agreeLocked,
    selectedValueTitles,
    triggerTitle,
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
        <Text style={styles.stepPillText}>۱) ارزش‌ها</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) مرزها</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) اگر-آنگاه</Text>
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

      {/* IMPORTANT: Android jitter fix => do NOT use behavior="height" */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          onScrollBeginDrag={() => Keyboard.dismiss()}
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
              <Text style={styles.h1}>ارزش‌های غیرقابل مذاکره</Text>
              <Text style={styles.p}>
                تا پايان مسير درمانيت داخل ققنوس پيشنهاد ميشه وارد رابطه عاطفی ديگه‌ای نشی
                {"\n"}ولی از همین الان، ارزش‌های غیرقابل مذاکره رابطه بعدیت باید مشخص باشه تا رابطه بعدیت شبیه رابطه قبلیت نشه
                {"\n"}الان فقط انتخاب می‌کنی که چی برای رابطه بعدی «قانون»ه.
                {"\n\n"}حداقل {MIN_VALUES} ارزش رو انتخاب کن.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>یادآوری مهم</Text>
                <Text style={styles.small}>ارزش وقتی ارزشه که بعداً به «مرز رفتاری» تبدیلش کنی. مرحله ۲ همین کاره.</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {VALUES.map((v) => {
                  const on = values.includes(v.key);
                  return (
                    <Pressable
                      key={v.key}
                      onPress={() => toggleValue(v.key)}
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

                      {/* معنی اختیاری */}
                      {on ? (
                        <View style={{ marginTop: 10 }}>
                          <Text style={[styles.small, { marginBottom: 6 }]}>«برای من یعنی...»</Text>
                          <TextInput
                            editable={!isReview}
                            value={String(meanings[v.key] || "")}
                            onChangeText={(t) => updateMeaning(v.key, t)}
                            placeholderTextColor="rgba(231,238,247,.45)"
                            style={[styles.input, isReview && { opacity: 0.7 }]}
                            multiline
                            scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                            underlineColorAndroid="transparent"
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                {/* Custom value */}
                <Pressable
                  onPress={() => toggleValue("v_custom")}
                  disabled={isReview}
                  style={[styles.choiceCard, values.includes("v_custom") && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={values.includes("v_custom") ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={values.includes("v_custom") ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>سایر (ارزش دلخواه)</Text>
                  </View>

                  {values.includes("v_custom") ? (
                    <View style={{ marginTop: 10 }}>
                      <TextInput
                        editable={!isReview}
                        value={customValueTitle}
                        onChangeText={(t) => (isReview ? null : setCustomValueTitle(t))}
                        placeholder="نام ارزش دلخواه"
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        underlineColorAndroid="transparent"
                      />
                      <View style={{ height: 8 }} />
                      <TextInput
                        editable={!isReview}
                        value={String(meanings["v_custom"] || "")}
                        onChangeText={(t) => updateMeaning("v_custom", t)}
                        placeholder="«برای من یعنی...» "
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                        scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  ) : null}
                </Pressable>
              </View>

              <View style={[styles.pairCard, { marginTop: 12 }]}>
                <Text style={styles.pairLabel}>انتخاب‌شده‌ها:</Text>
                {selectedValueTitles.length ? (
                  selectedValueTitles.map((t, idx) => (
                    <Text key={`${t}-${idx}`} style={styles.pairText}>
                      • {t}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.pairText}>—</Text>
                )}
              </View>

              {!step1Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: حداقل {MIN_VALUES} ارزش انتخاب کن{hasCustomValue ? " و نام ارزش دلخواه رو بنویس" : ""}.
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
                <Text style={styles.h1}>مرزهای غیرقابل مذاکره</Text>
                <Text style={styles.p}>
                  ارزش بدون مرز یعنی هیچ.
                  {"\n"}مرز باید «قابل اجرا» باشه.
                  {"\n\n"}فرمول: «اگه ... رخ داد، من ... رو انجام می‌دم.»
                  {"\n"}حداقل {MIN_NN} مرز بنویس.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>مرزها</Text>
                <Text style={styles.small}>کوتاه و قطعی بنویس. مبهم ننویس.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {nonNegotiables.map((x, idx) => (
                    <View key={x.id} style={styles.choiceCard}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.choiceText, { flex: 1 }]}>{`مرز #${idx + 1}`}</Text>
                        {!isReview && nonNegotiables.length > 3 ? (
                          <TouchableOpacity onPress={() => removeNN(x.id)} activeOpacity={0.85} style={styles.iconBtn}>
                            <Ionicons name="trash" size={16} color="rgba(231,238,247,.85)" />
                          </TouchableOpacity>
                        ) : (
                          <View style={{ width: 34, height: 34 }} />
                        )}
                      </View>

                      <View style={{ height: 10 }} />
                      <TextInput
                        editable={!isReview}
                        value={x.text}
                        onChangeText={(t) => updateNN(x.id, t)}
                        placeholder="اگه ... شد، من ..."
                        placeholderTextColor="rgba(231,238,247,.45)"
                        style={[styles.input, isReview && { opacity: 0.7 }]}
                        multiline
                        scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  ))}
                </View>

                {!isReview ? (
                  <TouchableOpacity onPress={addNN} activeOpacity={0.9} style={[styles.secondaryBtn, { marginTop: 12 }]}>
                    <Text style={styles.secondaryBtnText}>افزودن مرز جدید</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>مرزهای کامل‌شده:</Text>
                  {cleanedNonNegotiables.length ? (
                    cleanedNonNegotiables.map((t, idx) => (
                      <Text key={`${t.id}-${idx}`} style={styles.pairText}>
                        • {t.text}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل {MIN_NN} مرزِ قابل اجرا بنویس.</Text> : null}

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
                <Text style={styles.h1}>برنامه لحظه لغزش</Text>
                <Text style={styles.p}>
                  وقتی لغزش میاد، عقل دیر کار می‌کنه.
                  {"\n"}پس باید از قبل برنامه «اگه-آنگاه» داشته باشی.
                  {"\n\n"}حداقل {MIN_IFTHEN} برنامه رو کامل کن.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>برنامه‌ها</Text>
                <Text style={styles.small}>برای هر برنامه: اول «اگه»، بعد «آنگاه» رو دقیق و اجرایی بنویس.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {ifThenPlans.map((x, idx) => {
                    const onCustom = x.triggerKey === "t_custom";
                    return (
                      <View key={x.id} style={styles.choiceCard}>
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={[styles.choiceText, { flex: 1 }]}>{`اگه-آنگاه #${idx + 1}`}</Text>
                          {!isReview && ifThenPlans.length > 2 ? (
                            <TouchableOpacity onPress={() => removeIfThen(x.id)} activeOpacity={0.85} style={styles.iconBtn}>
                              <Ionicons name="trash" size={16} color="rgba(231,238,247,.85)" />
                            </TouchableOpacity>
                          ) : (
                            <View style={{ width: 34, height: 34 }} />
                          )}
                        </View>

                        <View style={{ height: 10 }} />

                        <Text style={[styles.small, { marginBottom: 8 }]}>اگه:</Text>

                        <View style={{ gap: 10 }}>
                          {TRIGGERS.map((t) => {
                            const on = x.triggerKey === t.key;
                            return (
                              <Pressable
                                key={`${x.id}_${t.key}`}
                                onPress={() => updateIfThen(x.id, { triggerKey: t.key })}
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
                                    <Text style={[styles.choiceText, { flexShrink: 1 }]}>{t.title}</Text>
                                    <Text style={[styles.small, { flexShrink: 1 }]}>{t.desc}</Text>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}

                          <Pressable
                            onPress={() => updateIfThen(x.id, { triggerKey: "t_custom" })}
                            disabled={isReview}
                            style={[styles.choiceCard, x.triggerKey === "t_custom" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                          >
                            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                              <Ionicons
                                name={x.triggerKey === "t_custom" ? "checkmark-circle" : "ellipse-outline"}
                                size={18}
                                color={x.triggerKey === "t_custom" ? palette.green : "rgba(231,238,247,.55)"}
                              />
                              <Text style={styles.choiceText}>سایر (موقعیت دلخواه)</Text>
                            </View>
                          </Pressable>

                          {onCustom ? (
                            <View style={{ marginTop: 8 }}>
                              <TextInput
                                editable={!isReview}
                                value={customTriggerTitle}
                                onChangeText={(t) => (isReview ? null : setCustomTriggerTitle(t))}
                                placeholder="موقعیت دلخواه رو بنویس…"
                                placeholderTextColor="rgba(231,238,247,.45)"
                                style={[styles.input, isReview && { opacity: 0.7 }]}
                                underlineColorAndroid="transparent"
                              />
                            </View>
                          ) : null}
                        </View>

                        <View style={{ height: 12 }} />

                        <Text style={[styles.small, { marginBottom: 8 }]}>آنگاه من این کار رو می‌کنم:</Text>
                        <TextInput
                          editable={!isReview}
                          value={x.actionText}
                          onChangeText={(t) => updateIfThen(x.id, { actionText: t })}
                          placeholder="مثلاً: ۱۰ دقیقه پیاده‌روی + پیام به یک دوست + رفتن به تب پناهگاه"
                          placeholderTextColor="rgba(231,238,247,.45)"
                          style={[styles.input, isReview && { opacity: 0.7 }]}
                          multiline
                          scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                          underlineColorAndroid="transparent"
                        />
                      </View>
                    );
                  })}
                </View>

                {!isReview ? (
                  <TouchableOpacity onPress={addIfThen} activeOpacity={0.9} style={[styles.secondaryBtn, { marginTop: 12 }]}>
                    <Text style={styles.secondaryBtnText}>افزودن برنامه جدید</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>برنامه‌های کامل‌شده:</Text>
                  {cleanedIfThen.length ? (
                    cleanedIfThen.map((t, idx) => (
                      <Text key={`${t.id}-${idx}`} style={styles.pairText}>
                        • اگر {triggerTitle(t.triggerKey)} شد → {t.actionText}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.pairText}>—</Text>
                  )}
                </View>
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: حداقل {MIN_IFTHEN} برنامه کامل کن{anyCustomTriggerUsed ? " و نام موقعیت دلخواه را بنویس" : ""}.
                </Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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
                  اینجا همه موارد این چند بخش رو تایید می‌کنی.
                  {"\n\n"}خلاصه انتخاب‌های تو:
                  {"\n"}• ارزش‌ها: {values.length}
                  {"\n"}• مرزها (کامل): {cleanedNonNegotiables.length}
                  {"\n"}• اگه-آنگاه (کامل): {cleanedIfThen.length}
                </Text>

                <View style={[styles.dangerCard, { marginTop: 12 }]}>
                  <Text style={styles.dangerTitle}>قانون شخصی من</Text>
                  <Text style={styles.small}>
                    اگر یکی از مرزهای غیرقابل مذاکره زیر پا گذاشته شد:
                    {"\n"}۱) توجیه نمی‌کنم
                    {"\n"}۲) معامله نمی‌کنم
                    {"\n"}۳) و طبق مرز عمل می‌کنم
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
                    scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                    underlineColorAndroid="transparent"
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
                        قول میدم همه ارزش‌ها و مرزهای خودم پایبند باشم و اون‌ها رو تحت هیچ شرایطی زیر پا نذارم.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {!step4Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: متن تعهد + تیک قفل لازم است.</Text> : null}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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