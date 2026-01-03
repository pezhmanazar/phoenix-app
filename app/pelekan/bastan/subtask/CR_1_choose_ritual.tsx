// app/pelekan/bastan/subtask/CR_1_choose_ritual.tsx

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
  if (k === "CR_1_choose_ritual") return "ریز اقدام اول";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type RitualKey =
  | "walk_close"
  | "shower_close"
  | "sunrise_sunset_close"
  | "letter_close"
  | "symbolic_grave_close";

type RitualOption = {
  key: RitualKey;
  title: string;
  subtitle: string;
};

type CR1Saved = {
  version: 1;
  savedAt: string;

  ritualKey: RitualKey;
  ritualTitle: string;
  ritualSubtitle: string;

  plannedWhenText: string; // required
  plannedWhereText: string; // required

  prepText?: string | null; // optional
  commitmentText: string; // required (min len)
  agreeLocked: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CR_1_choose_ritual";
const KEY_CR1_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Options (UI only shows title/subtitle) ----------------------------- */

const RITUALS: RitualOption[] = [
  {
    key: "walk_close",
    title: "برگزاری آیین بستن با قدم زدن",
    subtitle: "چند دقیقه راه میری و در ذهن، آیین بستن رابطه رو انجام میدی.",
  },
  {
    key: "shower_close",
    title: "برگزاری آیین بستن با آب",
    subtitle: "هنگام شست‌وشو، پایان این فصل رو آگاهانه با خودت مرور می‌کنی.",
  },
  {
    key: "sunrise_sunset_close",
    title: "برگزاری آیین بستن با مشاهده طلوع یا غروب آفتاب",
    subtitle: "با دیدن آغاز یا پایان یک روز، پایان رابطه رو در ذهنت ثبت می‌کنی.",
  },
  {
    key: "letter_close",
    title: "برگزاری آیین بستن با نوشتن نامه",
    subtitle: "نامه‌ای می‌نویسی که خاتمه رابطه در درونش اعلام بشه.",
  },
  {
    key: "symbolic_grave_close",
    title: "برگزاری آیین بستن با ساختن قبر نمادین",
    subtitle: "یک نماد کوچیک رو به نشونه‌ی پایان همیشگی رابطه دفن می‌کنی و خداحافظی میکنی.",
  },
];

const RITUALS_NOTE = "مهم نیست کدوم رو انتخاب می‌کنی؛ مهم اینه که انجام بشه.";

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

export default function CR1ChooseRitualScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "انتخاب آیین بستن";

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
  const startedAtRef = useRef<number | null>(null);

  // step2
  const [ritualKey, setRitualKey] = useState<RitualKey | null>(null);

  // step3
  const [plannedWhenText, setPlannedWhenText] = useState("");
  const [plannedWhereText, setPlannedWhereText] = useState("");
  const [prepText, setPrepText] = useState("");

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

  const selectedRitual = useMemo(() => {
    if (!ritualKey) return null;
    return RITUALS.find((x) => x.key === ritualKey) || null;
  }, [ritualKey]);

  const cleanedWhen = useMemo(() => String(plannedWhenText || "").trim(), [plannedWhenText]);
  const cleanedWhere = useMemo(() => String(plannedWhereText || "").trim(), [plannedWhereText]);
  const cleanedPrep = useMemo(() => {
    const s = String(prepText || "").trim();
    return s ? s : "";
  }, [prepText]);

  const step1Ok = true; // فقط توضیح علمی
  const step2Ok = !!ritualKey;
  const step3Ok = cleanedWhen.length >= 4 && cleanedWhere.length >= 3;
  const step4Ok = String(commitmentText || "").trim().length >= 10 && !!agreeLocked;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Load FINAL if any ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as CR1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setRitualKey(j.ritualKey || null);
    setPlannedWhenText(String(j.plannedWhenText || ""));
    setPlannedWhereText(String(j.plannedWhereText || ""));
    setPrepText(String(j.prepText || ""));
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

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    if (!selectedRitual) return;

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: CR1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      ritualKey: selectedRitual.key,
      ritualTitle: selectedRitual.title,
      ritualSubtitle: selectedRitual.subtitle,

      plannedWhenText: cleanedWhen,
      plannedWhereText: cleanedWhere,

      prepText: cleanedPrep ? cleanedPrep : null,
      commitmentText: String(commitmentText || "").trim(),
      agreeLocked: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_CR1_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [selectedRitual, cleanedWhen, cleanedWhere, cleanedPrep, commitmentText]);

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

    if (!selectedRitual) return "fail";

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    // این payload باید برای ریزاقدام بعدی «قابل استخراج» و واضح باشد
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        ritual: {
          key: selectedRitual.key,
          title: selectedRitual.title,
          subtitle: selectedRitual.subtitle,
        },
        plan: {
          whenText: cleanedWhen,
          whereText: cleanedWhere,
          prepText: cleanedPrep ? cleanedPrep : null,
        },
        commitmentLen: String(commitmentText || "").trim().length,
        agreeLocked: agreeLocked,
        summary: {
          ritualTitle: selectedRitual.title,
          when: cleanedWhen,
          where: cleanedWhere,
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
    selectedRitual,
    cleanedWhen,
    cleanedWhere,
    cleanedPrep,
    commitmentText,
    agreeLocked,
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
        <Text style={styles.stepPillText}>۱) چرا</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) انتخاب</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) برنامه</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
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
              <Text style={styles.h1}>چرا باید «آیین بستن» داشته باشی؟</Text>
              <Text style={styles.p}>
                مغز بعد از جدایی، فقط با «فهمیدن» آروم نمیشه، چون بخشی از مغز هنوز منتظر نشونه پایانه.
                {"\n\n"}
                آیین بستن یعنی یک «علامت بیرونی» که به سیستم عصبی میگه: این فصل تموم شد.
                {"\n"}
                این کار کمک میکنه چرخه‌ی امید و وسوسه کمتر بشه و مغز از حالت تعلیق خارج بشه.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>قاعده</Text>
                <Text style={styles.small}>
                  اینجا فقط انتخاب می‌کنی و زمان و مکانش رو مشخص می‌کنی.
                  {"\n"}
                  انجامِ آیین، ریزاقدام بعدیه.
                </Text>
              </View>

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
                <Text style={styles.h1}>انتخاب آیین بستن</Text>
                <Text style={styles.p}>
                  یکی رو انتخاب کن که واقعاً میتونی انجامش بدی.
                  {"\n"}
                  اصلا هم پیچیدش نکن. اجراش مهم‌تر از شیک بودنشه.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>یادآوری</Text>
                <Text style={styles.small}>{RITUALS_NOTE}</Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {RITUALS.map((it) => {
                  const on = ritualKey === it.key;
                  return (
                    <Pressable
                      key={it.key}
                      onPress={() => (isReview ? null : setRitualKey(it.key))}
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
                          <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                          <Text style={[styles.small, { flexShrink: 1, marginTop: 6 }]}>{it.subtitle}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه باید یک آیین رو انتخاب کنی.</Text> : null}

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

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>برنامه‌ریزی آیین</Text>
                <Text style={styles.p}>
                  اگه زمان و مکان رو مشخص نکنی، احتمالاً انجام نمیشه.
                  {"\n"}
                  اینجا «برنامه اجرایی» می‌سازی.
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>آیین انتخاب‌شده</Text>
                <Text style={styles.small}>{selectedRitual ? `${selectedRitual.title}\n${selectedRitual.subtitle}` : "—"}</Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>زمان (اجباری)</Text>
                <Text style={styles.small}>مثال: «شنبه تاریخ ... ساعت ۲۰» یا «جمعه صبح»</Text>
                <View style={{ height: 10 }} />
                <TextInput
                  editable={!isReview}
                  value={plannedWhenText}
                  onChangeText={(t) => (isReview ? null : setPlannedWhenText(t))}
                  placeholder="زمان انجام آیین…"
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, isReview && { opacity: 0.7 }]}
                />
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>مکان (اجباری)</Text>
                <Text style={styles.small}>مثال: «پارک نزدیک خونه» یا «حمام خونه»</Text>
                <View style={{ height: 10 }} />
                <TextInput
                  editable={!isReview}
                  value={plannedWhereText}
                  onChangeText={(t) => (isReview ? null : setPlannedWhereText(t))}
                  placeholder="مکان انجام آیین…"
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, isReview && { opacity: 0.7 }]}
                />
              </View>

              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>آماده‌سازی کوتاه (اختیاری)</Text>
                <Text style={styles.small}>مثال: «یک کاغذ + خودکار» یا «یک سنگ کوچیک»</Text>
                <View style={{ height: 10 }} />
                <TextInput
                  editable={!isReview}
                  value={prepText}
                  onChangeText={(t) => (isReview ? null : setPrepText(t))}
                  placeholder="اگر چیزی لازمه اینجا بنویس"
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, isReview && { opacity: 0.7 }]}
                  multiline
                />
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: زمان و مکان باید پر بشه.</Text>
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
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo4 || saving}
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
                <Text style={styles.h1}>قفل برنامه</Text>
                <Text style={styles.p}>
                  اینجا برنامه رو رسمی می‌کنی تا مغزت نتونه برای انجامش بهونه بیاره.
                </Text>

                <View style={[styles.pairCard, { marginTop: 12 }]}>
                  <Text style={styles.pairLabel}>خلاصه‌ی انتخاب تو:</Text>
                  <Text style={styles.pairText}>
                    • آیین: {selectedRitual?.title || "—"}
                    {"\n"}• زمان: {cleanedWhen || "—"}
                    {"\n"}• مکان: {cleanedWhere || "—"}
                    {cleanedPrep ? `\n• آماده‌سازی: ${cleanedPrep}` : ""}
                  </Text>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>متن تعهد (اجباری)</Text>
                  <Text style={styles.small}>یک جمله قاطعانه بنویس.</Text>
                  <View style={{ height: 10 }} />
                  <TextInput
                    editable={!isReview}
                    value={commitmentText}
                    onChangeText={(t) => (isReview ? null : setCommitmentText(t))}
                    placeholder="مثلاً: من این آیین رو انجام میدم حتی اگر دلم نخواد."
                    placeholderTextColor="rgba(231,238,247,.45)"
                    style={[styles.input, { minHeight: 80 }, isReview && { opacity: 0.7 }]}
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
                       قول میدم در زمان و مکان تعیین شده آیین بستن خودم رو انجام بدم.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {!step4Ok ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: متن تعهد + تیک قفل لازمه.</Text>
                ) : null}
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