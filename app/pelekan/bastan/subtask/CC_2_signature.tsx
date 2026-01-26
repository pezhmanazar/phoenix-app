// app/pelekan/bastan/subtask/CC_2_signature.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  if (k === "CC_1_read_contract") return "ریز اقدام اول";
  if (k === "CC_2_signature") return "ریز اقدام دوم";
  return "ریز اقدام";
}

function todayFaString() {
  try {
    // بهترین حالت
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // fallback
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type SignatureMethod = "paper" | "typed";

type CC2Saved = {
  version: 1;
  savedAt: string;
  signedAt: string;
  method: SignatureMethod;
  todayFa: string;
  fullName: string;
  paperPhotoUri?: string | null;
  finalAcknowledged: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CC_2_signature";
const KEY_CC2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

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

export default function CC2SignatureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "امضای تعهدنامه";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 2 states
  const [method, setMethod] = useState<SignatureMethod>("paper");
  const [todayFa, setTodayFa] = useState<string>(todayFaString());
  const [fullName, setFullName] = useState<string>("");
  const [paperPhotoUri, setPaperPhotoUri] = useState<string | null>(null);

  // Step 3
  const [cooldownDone, setCooldownDone] = useState(false);
  const cooldownTimerRef = useRef<any>(null);
  const [finalAcknowledge, setFinalAcknowledge] = useState(false);

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

  /* ----------------------------- Computed ----------------------------- */

  const fullNameOk = useMemo(() => String(fullName || "").trim().length >= 3, [fullName]);

  const step2Ok = useMemo(() => {
    if (!fullNameOk) return false;
    if (method === "paper") return !!paperPhotoUri;
    return true; // typed
  }, [fullNameOk, method, paperPhotoUri]);

  const canGo2 = true;
  const canGo3 = step2Ok;
  const canFinalize = step2Ok && cooldownDone && finalAcknowledge;

  /* ----------------------------- Load FINAL (review) ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CC2_FINAL);
    if (!raw) return { loaded: false as const };

    let j: CC2Saved | null = null;
    try {
      j = JSON.parse(raw) as CC2Saved;
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return { loaded: false as const };

    setMethod(j.method);
    setTodayFa(String(j.todayFa || todayFaString()));
    setFullName(String(j.fullName || ""));
    setPaperPhotoUri(j.paperPhotoUri ? String(j.paperPhotoUri) : null);

    setCooldownDone(true);
    setFinalAcknowledge(!!j.finalAcknowledged);

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const r = await loadFinalIfAny();
        if (!alive) return;

        if (r.loaded) {
          setIsReview(true);
          setStep(3);
          return;
        }

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

  /* ----------------------------- Step 3 cooldown ----------------------------- */

  useEffect(() => {
    if (isReview) return;

    if (step !== 3) {
      setCooldownDone(false);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
      return;
    }

    setCooldownDone(false);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

    cooldownTimerRef.current = setTimeout(() => {
      setCooldownDone(true);
      cooldownTimerRef.current = null;
    }, 2500);

    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    };
  }, [step, isReview]);

  /* ----------------------------- Image Picker ----------------------------- */

  const takePaperPhoto = useCallback(async () => {
    if (isReview) return;

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        openModal({
          kind: "warn",
          title: "دسترسی لازم است",
          message: "برای گرفتن عکس باید دسترسی دوربین فعال باشد.",
          primaryText: "باشه",
          onPrimary: closeModal,
        });
        return;
      }

      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });

      if (r.canceled) return;

      const uri = r.assets?.[0]?.uri;
      if (uri) setPaperPhotoUri(uri);
    } catch (e: any) {
      openModal({
        kind: "error",
        title: "خطا",
        message: faOnlyTitle(String(e?.message || "مشکلی پیش آمد")),
        primaryText: "باشه",
        onPrimary: closeModal,
      });
    }
  }, [closeModal, isReview, openModal]);

  const pickPaperPhoto = useCallback(async () => {
    if (isReview) return;

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        openModal({
          kind: "warn",
          title: "دسترسی لازم است",
          message: "برای انتخاب عکس باید دسترسی گالری فعال باشد.",
          primaryText: "باشه",
          onPrimary: closeModal,
        });
        return;
      }

      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });

      if (r.canceled) return;

      const uri = r.assets?.[0]?.uri;
      if (uri) setPaperPhotoUri(uri);
    } catch (e: any) {
      openModal({
        kind: "error",
        title: "خطا",
        message: faOnlyTitle(String(e?.message || "مشکلی پیش آمد")),
        primaryText: "باشه",
        onPrimary: closeModal,
      });
    }
  }, [closeModal, isReview, openModal]);

  const removePaperPhoto = useCallback(() => {
    if (isReview) return;
    setPaperPhotoUri(null);
  }, [isReview]);

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const signedAt = new Date().toISOString();

    const payload: CC2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      signedAt,
      method,
      todayFa,
      fullName: String(fullName || "").trim(),
      paperPhotoUri: method === "paper" ? paperPhotoUri : null,
      finalAcknowledged: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CC2_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [fullName, method, paperPhotoUri, todayFa]);

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

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const signedAt = new Date().toISOString();

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        step2: {
          method,
          todayFa,
          fullName: String(fullName || "").trim(),
          paperPhotoUri: method === "paper" ? paperPhotoUri : null,
        },
        step3: {
          cooldownDone,
          finalAcknowledge,
          signedAt,
        },
        summary: {
          signedAt,
          method,
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
    cooldownDone,
    finalAcknowledge,
    fullName,
    method,
    openModal,
    paperPhotoUri,
    phone,
    todayFa,
    token,
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
          title: "قبلاً ثبت شده",
          message: "این ریز اقدام قبلاً ثبت شده و نیازی به ثبت دوباره نیست.",
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
        message: "تعهد تو قفل شد و قابل تغییر نیست.",
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
        <Text style={styles.stepPillText}>۱) معنا</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) ثبت</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) قفل</Text>
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
              <Text style={styles.reviewBannerText}>حالت مرور فعال است: می‌تونی ببینی ولی قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {StepPills}

          {/* Step 1 */}
          {step === 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>تعهد رفتاری</Text>
              <Text style={styles.p}>
                اینجا از «فهمیدن» میای روی «تعهد رفتاری».
                {"\n"}ثبت یعنی: حتی اگه دلم لرزید، رفتارم تغییر نمی‌کنه.
              </Text>

              <View style={{ height: 10 }} />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>چیزهایی که با این تعهد قطع می‌کنی</Text>
                <View style={{ height: 10 }} />
                {[
                  "تماس هیجانی (مثل پیام احساسی، التماس، کنایه و حال‌پرسیدنِ بهونه‌ای)",
                  "چک‌کردن یا سرک کشیدن (مثل دیدن استوری، پروفایل، پرس‌وجو، دنبال‌کردن)",
                  "شروع دوباره با «فقط یک پیام کوچیک»",
                  "بهانه‌سازی ذهنی برای تماس (مثل دلتنگی، اضطراب و حس گناه)",
                ].map((t, i) => (
                  <View key={i} style={{ flexDirection: "row-reverse", gap: 10, marginTop: i ? 8 : 0 }}>
                    <Ionicons name="close-circle" size={18} color={palette.red} />
                    <Text style={[styles.small, { flex: 1 }]}>{t}</Text>
                  </View>
                ))}

                <View style={{ height: 10 }} />
                <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 2 }}>
                  <Ionicons name="information-circle" size={18} color="rgba(231,238,247,.70)" />
                  <Text style={[styles.small, { flex: 1 }]}>
                    اگه ارتباط اجباری داری (یعنی بخاطر کار، فرزند یا تحصیل): فقط خشک، نقش‌محور و محدود باهاش ارتباط برقرار میکنی و هیچ مسیر هیجانی باز نمی‌کنی.
                  </Text>
                </View>
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
                <Text style={styles.primaryBtnText}>رفتن به ثبت</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Step 2 */}
{step === 2 ? (
  <>
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>ثبت تعهد</Text>
      <Text style={styles.p}>
        دو راه داری:
        {"\n"}۱) امضا روی کاغذ + عکسش
        {"\n"}۲) نام + تاریخ داخل اپ
      </Text>
    </View>

    <View style={[styles.noteCard, { marginTop: 12 }]}>
      <Text style={styles.noteTitle}>روش ثبت</Text>
      <View style={{ height: 10 }} />

      <Pressable
        onPress={() => (isReview ? null : setMethod("paper"))}
        disabled={isReview}
        style={[
          styles.choiceCard,
          method === "paper" && styles.choiceCardOn,
          isReview && { opacity: 0.75 },
        ]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={method === "paper" ? "radio-button-on" : "radio-button-off"}
            size={18}
            color={method === "paper" ? palette.green : "rgba(231,238,247,.55)"}
          />
          <Text style={[styles.choiceText, { flexShrink: 1 }]}>امضا روی کاغذ + ثبت عکس</Text>
        </View>
      </Pressable>

      <View style={{ height: 10 }} />

      <Pressable
        onPress={() => (isReview ? null : setMethod("typed"))}
        disabled={isReview}
        style={[
          styles.choiceCard,
          method === "typed" && styles.choiceCardOn,
          isReview && { opacity: 0.75 },
        ]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={method === "typed" ? "radio-button-on" : "radio-button-off"}
            size={18}
            color={method === "typed" ? palette.green : "rgba(231,238,247,.55)"}
          />
          <Text style={[styles.choiceText, { flexShrink: 1 }]}>نوشتن نام + تاریخ داخل اپ</Text>
        </View>
      </Pressable>

      <View style={{ height: 12 }} />

      {/* Name + Persian Date */}
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>نام و تاریخ</Text>

        {/* ✅ تاریخ شمسی */}
        <Text style={styles.small}>
          تاریخ امروز:{" "}
          {(() => {
            try {
              return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date());
            } catch {
              // fallback
              try {
                return new Intl.DateTimeFormat("fa-IR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(new Date());
              } catch {
                return todayFa; // اگر توی پروژه‌ات از قبل داری
              }
            }
          })()}
        </Text>

        <View style={{ height: 10 }} />

        <TextInput
          value={fullName}
          onChangeText={(t) => (isReview ? null : setFullName(t))}
          editable={!isReview}
          placeholder="نام کامل"
          placeholderTextColor="rgba(231,238,247,.35)"
          style={[styles.textInput, isReview && { opacity: 0.7 }]}
        />

        {!fullNameOk ? <Text style={[styles.warn, { marginTop: 10 }]}>نام کامل خودت رو بنویس.</Text> : null}
      </View>

      {/* Paper method */}
      {method === "paper" ? (
        <>
          <View style={{ height: 12 }} />

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>عکس امضا روی کاغذ</Text>
            <Text style={styles.small}>
              روی کاغذ امضا کن و تاریخ امروز رو به شمسی بنویس، بعد عکس واضح اون رو ثبت کن.
            </Text>

            <View style={{ height: 10 }} />

            <View style={styles.photoBox}>
              {paperPhotoUri ? (
                <Image source={{ uri: paperPhotoUri }} style={styles.photoImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image" size={22} color="rgba(231,238,247,.45)" />
                  <Text style={styles.photoPlaceholderText}>هنوز عکسی ثبت نشده</Text>
                </View>
              )}
            </View>

            <View style={{ height: 10 }} />

            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={takePaperPhoto}
                style={[styles.primaryBtn, { flex: 1 }, isReview && { opacity: 0.45 }]}
                disabled={isReview}
              >
                <Text style={styles.primaryBtnText}>گرفتن عکس</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={pickPaperPhoto}
                style={[styles.secondaryBtn, { flex: 1 }, isReview && { opacity: 0.45 }]}
                disabled={isReview}
              >
                <Text style={styles.secondaryBtnText}>آپلود از گالری</Text>
              </TouchableOpacity>
            </View>

            {paperPhotoUri ? (
              <>
                <View style={{ height: 10 }} />
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={removePaperPhoto}
                  style={[styles.secondaryBtn, isReview && { opacity: 0.45 }]}
                  disabled={isReview}
                >
                  <Text style={styles.secondaryBtnText}>حذف عکس</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={{ height: 12 }} />

      {/* status */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Ionicons
          name={step2Ok ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={step2Ok ? palette.green : "rgba(231,238,247,.45)"}
        />
        <Text style={styles.small}>
          {step2Ok
            ? "ثبت مرحله ۲ کامل است."
            : method === "paper"
            ? "برای ادامه: نام کامل + عکس امضا لازم است."
            : "برای ادامه: نام کامل لازم است."}
        </Text>
      </View>

      {!step2Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>تا وقتی کامل نشه، ادامه باز نمی‌شه.</Text> : null}
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
          style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
          disabled={!canGo3 || saving}
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
      <Text style={styles.h1}>قفل تعهد</Text>
      <Text style={styles.p}>
        اینجا «مکث اجباری» داریم.
        {"\n"}دقیقاً همون جایی که مغز می‌خواد از واقعیت فرار کنه.
      </Text>

      <View style={{ height: 12 }} />

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>مکث</Text>

        {/* متن ثابت */}
        <Text style={styles.small}>
          این تصمیم ممکنه سخت‌ترین تصمیم این مرحله باشه.
        </Text>

        <View style={{ height: 6 }} />

        {/* متن وابسته به cooldown */}
        <Text style={styles.small}>
          {cooldownDone
            ? "حالا می‌تونی با آگاهی کامل این تصمیم رو قفل کنی."
            : "چند ثانیه مکث کن و اجازه بده مغزت از حالت فرار خارج بشه."}
        </Text>


                  <View style={{ height: 12 }} />

                  <Pressable
                    onPress={() => (isReview ? null : setFinalAcknowledge((v) => !v))}
                    disabled={isReview || !cooldownDone}
                    style={[
                      styles.choiceCard,
                      finalAcknowledge && styles.choiceCardOn,
                      (isReview || !cooldownDone) && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={finalAcknowledge ? "checkbox" : "square-outline"}
                        size={18}
                        color={finalAcknowledge ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={[styles.choiceText, { flexShrink: 1 }]}>
                        با آگاهی کامل این تعهد رو ثبت می‌کنم و می‌دونم قابل تغییر نیست
                      </Text>
                    </View>
                  </Pressable>

                  {!isReview && !cooldownDone ? <Text style={[styles.small, { marginTop: 10 }]}>چند ثانیه…</Text> : null}

                  {!isReview && cooldownDone && !finalAcknowledge ? (
                    <Text style={[styles.warn, { marginTop: 10 }]}>بدون تأیید نهایی، ثبت فعال نمی‌شه.</Text>
                  ) : null}
                </View>

                <View style={{ height: 12 }} />

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
                    disabled={saving || (!isReview && !canFinalize)}
                    onPress={onFinishPress}
                    style={[
                      styles.primaryBtn,
                      { flex: 1 },
                      (saving || (!isReview && !canFinalize)) && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و قفل کن"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>
                    برای ثبت: تکمیل مرحله دو + مکث هنگام ثبت + تأیید نهایی لازمه.
                  </Text>
                ) : null}

                {isReview ? <Text style={[styles.small, { marginTop: 8 }]}>در حالت مرور، فقط نمایش است.</Text> : null}
              </View>

              {/* preview */}
              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>خلاصه ثبت</Text>
                <View style={{ height: 10 }} />
                <Text style={styles.small}>روش: {method === "paper" ? "کاغذ + عکس" : "نام + تاریخ داخل اپ"}</Text>
                <Text style={styles.small}>نام: {String(fullName || "").trim() || "—"}</Text>
                <Text style={styles.small}>تاریخ: {todayFa}</Text>

                {method === "paper" ? (
                  <>
                    <View style={{ height: 10 }} />
                    <View style={[styles.photoBox, { height: 180 }]}>
                      {paperPhotoUri ? (
                        <Image source={{ uri: paperPhotoUri }} style={styles.photoImg} />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Ionicons name="image" size={22} color="rgba(231,238,247,.45)" />
                          <Text style={styles.photoPlaceholderText}>عکسی ثبت نشده</Text>
                        </View>
                      )}
                    </View>
                  </>
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
        message="با زدن «ثبت و قفل کن»، این تعهد ثبت میشه و دیگه امکان تغییر وجود نداره."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلاً نه"
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

  choiceText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 18,
    flex: 1,
  },

  textInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: palette.text,
    fontWeight: "800",
    textAlign: "right",
  },

  photoBox: {
    height: 210,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    overflow: "hidden",
  },

  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },

  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },

  photoPlaceholderText: {
    color: "rgba(231,238,247,.55)",
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
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