// app/pelekan/bastan/subtask/CR_4_close_confirm_with_date.tsx

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
  if (k === "CR_4_close_confirm_with_date") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

// convert Persian/Arabic digits to English digits (prevents NaN)
function toEnDigits(input: string) {
  const map: Record<string, string> = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  return String(input || "").replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
}

function toFaDigits(input: string | number) {
  const s = String(input ?? "");
  const map: Record<string, string> = {
    "0": "۰",
    "1": "۱",
    "2": "۲",
    "3": "۳",
    "4": "۴",
    "5": "۵",
    "6": "۶",
    "7": "۷",
    "8": "۸",
    "9": "۹",
  };
  return s.replace(/[0-9]/g, (d) => map[d] ?? d);
}

/* ----------------------------- Jalali helpers (no deps) ----------------------------- */

function div(a: number, b: number) {
  return ~~(a / b);
}
function mod(a: number, b: number) {
  return a - ~~(a / b) * b;
}

const breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

function jalCal(jy: number) {
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;

  if (jy < jp || jy >= breaks[bl - 1]) {
    return { leap: 0, gy, march: 0 };
  }

  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn: number) {
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm = 0;
  let jd = 0;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function gregorianToJalali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd));
}

function isJalaliLeapYear(jy: number) {
  const r = jalCal(jy);
  return r.leap === 0; // in this algorithm leap==0 means leap year
}

function isValidJalaliDate(jy: number, jm: number, jd: number) {
  if (!Number.isFinite(jy) || !Number.isFinite(jm) || !Number.isFinite(jd)) return false;
  if (jy < 1200 || jy > 1600) return false;
  if (jm < 1 || jm > 12) return false;
  if (jd < 1) return false;

  if (jm <= 6) return jd <= 31;
  if (jm <= 11) return jd <= 30;

  const maxEsfand = isJalaliLeapYear(jy) ? 30 : 29;
  return jd <= maxEsfand;
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";
type ChecklistItem = { id: string; text: string; help?: string | null };

type CR3SavedAny = {
  version: 1;
  savedAt: string;
  ritual?: any;
  plan?: any;
  durationSec?: number | null;
};

type CR4Saved = {
  version: 1;
  savedAt: string;
  closeDate: { jy: number; jm: number; jd: number; textFa: string };
  confirmDoneIds: string[];
  agreeLocked: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CR_4_close_confirm_with_date";
const KEY_CR3_FINAL = "pelekan:bastan:subtask:CR_3_after_feeling:final:v1";
const KEY_CR4_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`; // ✅ fix: template literal
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Lists ----------------------------- */

const CONFIRM_CHECKLIST: ChecklistItem[] = [
  { id: "c1", text: "قبول دارم از این تاریخ به بعد، رابطه به‌صورت رسمی تموم شده" },
  { id: "c2", text: "می‌دونم ذهنم ممکنه بعداً دنبال «امید» یا «توجیه» بگرده و این طبیعیه" },
  { id: "c3", text: " تصمیم رسمی من تغییر نمی‌کنه و اون رو دوباره مذاکره نمی‌کنم" },
  { id: "c4", text: "اگه وسوسه برگشت یا چک‌کردن سراغم اومد، اول یک اقدام امن و مفید انجام میدم" },
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

export default function CR4CloseConfirmWithDate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "پذیرش نهایی پایان این فصل";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  // اگر تو پروژه‌ت apiBase چیز دیگه‌ست، همین‌جا عوضش کن
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  const [cr3, setCr3] = useState<CR3SavedAny | null>(null);

  // Step 2: date inputs (Jalali)
  const [jyText, setJyText] = useState("");
  const [jmText, setJmText] = useState("");
  const [jdText, setJdText] = useState("");

  // Step 3: checklist
  const [confirmDoneIds, setConfirmDoneIds] = useState<string[]>([]);

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

  const jy = useMemo(() => parseInt(toEnDigits(String(jyText || "").trim()), 10), [jyText]);
  const jm = useMemo(() => parseInt(toEnDigits(String(jmText || "").trim()), 10), [jmText]);
  const jd = useMemo(() => parseInt(toEnDigits(String(jdText || "").trim()), 10), [jdText]);

  const dateOk = useMemo(() => isValidJalaliDate(jy, jm, jd), [jy, jm, jd]);

  const dateFaText = useMemo(() => {
    if (!dateOk) return "";
    const s = `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
    return toFaDigits(s);
  }, [dateOk, jd, jm, jy]);

  const toggleConfirm = useCallback(
    (id: string) => {
      if (isReview) return;
      setConfirmDoneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [isReview]
  );

  const step1Ok = !!cr3;
  const step2Ok = dateOk;
  const step3Ok = confirmDoneIds.length === CONFIRM_CHECKLIST.length;
  const canGo2 = step1Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok;

  /* ----------------------------- Load prerequisite + FINAL ----------------------------- */

  const loadCR3IfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR3_FINAL);
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as CR3SavedAny;
      if (!j || j.version !== 1) return null;
      return j;
    } catch {
      return null;
    }
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR4_FINAL);
    if (!raw) return { loaded: false as const };

    let j: CR4Saved | null = null;
    try {
      j = JSON.parse(raw) as CR4Saved;
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return { loaded: false as const };

    const c3 = await loadCR3IfAny();
    setCr3(c3);

    setJyText(String(j.closeDate?.jy ?? ""));
    setJmText(String(j.closeDate?.jm ?? ""));
    setJdText(String(j.closeDate?.jd ?? ""));
    setConfirmDoneIds(Array.isArray(j.confirmDoneIds) ? j.confirmDoneIds : []);

    return { loaded: true as const };
  }, [loadCR3IfAny]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
          setIsReview(true);
          setStep(4);
          return;
        }

        const c3 = await loadCR3IfAny();
        if (!alive) return;

        if (!c3) {
          setCr3(null);
          openModal({
            kind: "warn",
            title: "اول باید ریز اقدام قبلی ثبت شده باشه",
            message: "برای این ریزاقدام، لازمه ابتدا «CR_3_after_feeling» رو روی همین دستگاه ثبت کرده باشی.",
            primaryText: "برگرد",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
          return;
        }

        setCr3(c3);
        setIsReview(false);
        setStep(1);
      } catch {
        setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [closeModal, loadCR3IfAny, loadFinalIfAny, openModal, router]);

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

  /* ----------------------------- Today (Jalali) ----------------------------- */

  const fillTodayJalali = useCallback(() => {
    if (isReview) return;
    const now = new Date();
    const g = { gy: now.getFullYear(), gm: now.getMonth() + 1, gd: now.getDate() };
    const j = gregorianToJalali(g.gy, g.gm, g.gd);
    setJyText(String(j.jy));
    setJmText(String(j.jm));
    setJdText(String(j.jd));
  }, [isReview]);

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;
    if (!dateOk) return;

    const payload: CR4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      closeDate: { jy, jm, jd, textFa: dateFaText },
      confirmDoneIds: confirmDoneIds || [],
      agreeLocked: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CR4_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [confirmDoneIds, dateFaText, dateOk, jd, jm, jy]);

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

    if (!cr3) return "fail";
    if (!dateOk) return "fail";

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        step2: { closeDate: { jy, jm, jd, textFa: dateFaText } },
        step3: {
          checklistTotal: CONFIRM_CHECKLIST.length,
          checklistDone: confirmDoneIds.length,
          doneIds: confirmDoneIds,
        },
        summary: {
          closeDateFa: dateFaText,
          checklistDone: confirmDoneIds.length,
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
    closeModal,
    cr3,
    dateFaText,
    dateOk,
    jd,
    jm,
    jy,
    openModal,
    phone,
    token,
    confirmDoneIds,
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

  /* ----------------------------- Step Pills ----------------------------- */

  const StepPills = (
    <View style={styles.stepPills}>
      <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۱) شروع</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) تاریخ</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) پذیرش</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) ثبت</Text>
      </View>
    </View>
  );

  /* ----------------------------- Render ----------------------------- */

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
          <Text style={styles.headerTitle}>{subtaskNumberFa(SUBTASK_KEY)}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: 16 + insets.bottom,
            },
          ]}
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

          {/* Step 1 */}
          {step === 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>پذیرش نهایی پایان این فصل</Text>
              <Text style={styles.p}>
                این مرحله «ثبت رسمی»ه.
                {"\n"}
                یعنی از یک تاریخ مشخص، رابطه برای تو تموم شده و این تصمیم رو وارد مسیر درمان می‌کنی.
              </Text>

              {!step1Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه، باید ریز اقدام قبلی (CR_3_after_feeling) روی همین دستگاه ثبت شده باشه.
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
                <Text style={styles.primaryBtnText}>شروع می‌کنم</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Step 2 */}
{step === 2 ? (
  <>
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>ثبت تاریخ دقیق شمسی</Text>
      <Text style={styles.p}>
        تاریخ رو دقیق وارد کن.
        {"\n"}
        مثال: ۱۴۰۴/۰۵/۲۱
      </Text>
    </View>

    <View style={[styles.noteCard, { marginTop: 12 }]}>
      <Text style={styles.noteTitle}>تاریخ پایان رسمی</Text>
      <Text style={styles.small}>روز | ماه | سال</Text>

      <View style={{ height: 10 }} />

      {/* --- helpers for UI logic --- */}
      {(() => {
        const hasAnyInput =
          String(jyText || "").trim().length > 0 ||
          String(jmText || "").trim().length > 0 ||
          String(jdText || "").trim().length > 0;

        // کاربر وقتی "تاریخ رو لمس کرده" حساب میشه که حداقل یکی از فیلدها چیزی داشته باشه
        // (یا امروز زده باشه که اونم فیلدها رو پر می‌کنه)
        const dateTouched = hasAnyInput;

        // فقط وقتی خطا نشون بده که کاربر چیزی وارد کرده باشه و تاریخ invalid باشه
        const showDateError = dateTouched && !dateOk;

        // فقط وقتی تایید نشون بده که تاریخ ok باشه
        const showDateOk = dateOk;

        return (
          <>
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
  {/* روز (سمت راست) */}
  <TextInput
    editable={!isReview}
    value={jdText}
    onChangeText={(t) => (isReview ? null : setJdText(t))}
    keyboardType="number-pad"
    placeholder="روز"
    placeholderTextColor="rgba(231,238,247,.45)"
    style={[styles.dateInput, { flex: 1 }, isReview && { opacity: 0.7 }]}
  />

  {/* ماه (وسط) */}
  <TextInput
    editable={!isReview}
    value={jmText}
    onChangeText={(t) => (isReview ? null : setJmText(t))}
    keyboardType="number-pad"
    placeholder="ماه"
    placeholderTextColor="rgba(231,238,247,.45)"
    style={[styles.dateInput, { flex: 1 }, isReview && { opacity: 0.7 }]}
  />

  {/* سال (سمت چپ) */}
  <TextInput
    editable={!isReview}
    value={jyText}
    onChangeText={(t) => (isReview ? null : setJyText(t))}
    keyboardType="number-pad"
    placeholder="سال"
    placeholderTextColor="rgba(231,238,247,.45)"
    style={[styles.dateInput, { flex: 1 }, isReview && { opacity: 0.7 }]}
  />
</View>

            <View style={{ height: 12 }} />

            {/* امروز - وسط‌چین */}
            <View style={{ alignItems: "center" }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={fillTodayJalali}
                disabled={isReview}
                style={[
                  styles.secondaryBtn,
                  { paddingHorizontal: 26, minWidth: 150 },
                  isReview && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.secondaryBtnText}>انتخاب تاریخ امروز</Text>
              </TouchableOpacity>

              {/* تایید تاریخ - زیر دکمه و وسط‌چین */}
              {showDateOk ? (
                <Text style={[styles.dateOkText, { marginTop: 10 }]}>تأیید: {dateFaText}</Text>
              ) : null}
            </View>

            {/* خطا - متن، نه دکمه */}
            {showDateError ? (
              <Text style={[styles.dateErrorText, { marginTop: 10 }]}>
                برای ادامه، تاریخ شمسی باید معتبر باشه.
              </Text>
            ) : null}
          </>
        );
      })()}
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

          {/* Step 3 */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پذیرش</Text>
                <Text style={styles.p}>
                  این چک‌لیست باید کامل تیک بخوره.
                  {"\n"}
                  تاریخ ثبت‌شده: {dateOk ? dateFaText : "—"}
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {CONFIRM_CHECKLIST.map((it) => {
                  const on = confirmDoneIds.includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleConfirm(it.id)}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        on && styles.choiceCardOn,
                        isReview && { opacity: 0.7 },
                        it.id === "c1" && styles.choiceCardImportant,
                      ]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkbox" : "square-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.text}</Text>
                          {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: همه‌ی موارد باید تیک بخوره.</Text>
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

          {/* Step 4 */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>ثبت نهایی</Text>
                <Text style={styles.p}>
                  بعد از «ثبت و پایان»، این ریز اقدام قفل میشه و قابل تغییر نیست.
                  {"\n"}
                  تاریخ رسمی: {dateOk ? dateFaText : "—"}
                </Text>
              </View>

              {!isReview ? (
                <View style={[styles.noteCard, styles.lockWarnCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>هشدار</Text>
                  <Text style={styles.small}>
                    این ثبت یعنی از این تاریخ، «پایان» برای تو رسمیه.
                    {"\n"}
                    بعد از ثبت، امکان تغییر وجود نداره.
                  </Text>
                </View>
              ) : null}

              {!isReview && !canFinalize ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>قبل از ثبت، تاریخ معتبر + چک‌لیست کامل لازمه.</Text>
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
                    onPress={() => {
                      if (isReview) {
                        router.back();
                        return;
                      }
                      setConfirmLockModal(true);
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {isReview ? <Text style={styles.small}>در حالت مرور، فقط نمایش است و امکان ویرایش نداری.</Text> : null}
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

  kav: { flex: 1, backgroundColor: "transparent" }, // ✅ مهم: بک‌گراند نده که گلو دفن نشه
  scroll: { flex: 1, backgroundColor: "transparent" },
  scrollContent: { flexGrow: 1, padding: 16 },

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

  stepPills: {
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },

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

  choiceCardImportant: {
    backgroundColor: "rgba(252,165,165,.04)",
    borderColor: "rgba(252,165,165,.18)",
  },

  choiceText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 18,
    flex: 1,
  },

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

  dateInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    color: palette.text,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
  },

  dateStatusCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dateStatusOk: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },
  dateStatusBad: { borderColor: "rgba(252,165,165,.18)", backgroundColor: "rgba(252,165,165,.04)" },
  dateStatusText: { color: palette.text, fontWeight: "900", fontSize: 12, textAlign: "center" },

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

  lockWarnCard: {
    backgroundColor: "rgba(252,165,165,.04)",
    borderColor: "rgba(252,165,165,.18)",
  },

  dateOkText: {
  color: "rgba(34,197,94,.95)",
  fontWeight: "900",
  fontSize: 12,
  textAlign: "center",
},

dateErrorText: {
  color: "rgba(252,165,165,.95)",
  fontWeight: "900",
  fontSize: 12,
  textAlign: "center",
},

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