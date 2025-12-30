// app/pelekan/bastan/subtask/UL_4_store_ritual.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    InteractionManager,
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

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "UL_4_store_ritual") return "ریز اقدام چهارم";
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
type LetterMode = "text" | "photo";
type LetterPath = "drain" | "closure";

type UL1Saved = {
  version: 1;
  savedAt: string;
  agreePrivate: boolean;
  mode: LetterMode;
  path: LetterPath;
  emotionLevel: number;
  didRegulate90s: boolean;
  letterText?: string; // local-only
  bitterTruths?: string; // local-only
  images?: string[]; // local-only URIs
  // (ممکنه فیلدهای اضافه هم داشته باشه؛ مهم نیست)
};

type RitualChoice = "release" | "store";

type UL4Saved = {
  version: 1;
  savedAt: string;

  // state
  sawLetter: boolean; // کاربر یک بار دید/خواند
  acceptNoReturn: boolean; // می‌پذیرم برنگردم
  choice: RitualChoice; // رها کردن / نگه‌داری

  // derived meta
  letterMode: LetterMode | null;
  letterPath: LetterPath | null;
  pages: number; // 1 یا تعداد صفحات عکس
  durationSec: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "UL_4_store_ritual";
const KEY_UL4_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

// UL_1 key (برای خواندن و در صورت انتخابِ رها کردن، خنثی‌سازی)
const UL1_KEY = "UL_1_letter_write_or_photo";
const KEY_UL1_FINAL = `pelekan:bastan:subtask:${UL1_KEY}:final:v1`;

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
export default function UL4StoreRitualScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "آیین رها کردن نامه";

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

  // UL_1 loaded letter
  const [ul1, setUl1] = useState<UL1Saved | null>(null);

  // Steps states
  const [sawLetter, setSawLetter] = useState(false);
  const [acceptNoReturn, setAcceptNoReturn] = useState(false);
  const [choice, setChoice] = useState<RitualChoice>("release");

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

  /* ----------------------------- Load UL_1 letter ----------------------------- */
  const loadUL1 = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_UL1_FINAL);
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as UL1Saved;
      if (!j || j.version !== 1) return null;
      return j;
    } catch {
      return null;
    }
  }, []);

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_UL4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as UL4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setSawLetter(!!j.sawLetter);
    setAcceptNoReturn(!!j.acceptNoReturn);
    setChoice(j.choice === "store" ? "store" : "release");

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        const [letter, final] = await Promise.all([loadUL1(), loadFinalIfAny()]);
        if (!alive) return;

        setUl1(letter);

        setIsReview(!!final.loaded);
        if (final.loaded) setStep(4);

        // اگر UL_1 وجود ندارد، این ریزاقدام معنی ندارد
        if (!letter && !final.loaded) {
          openModal({
            kind: "warn",
            title: "نامه پیدا نشد",
            message: "اول باید ریزاقدام اول (نامه خداحافظی) انجام شده باشد.",
            primaryText: "بازگشت",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
        }
      } catch {
        if (!alive) return;
        setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [closeModal, loadFinalIfAny, loadUL1, openModal, router]);

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

  /* ----------------------------- Derived meta ----------------------------- */
  const pages = useMemo(() => {
    if (!ul1) return 0;
    if (ul1.mode === "photo") return Array.isArray(ul1.images) ? ul1.images.length : 0;
    return 1;
  }, [ul1]);

  const canGo2 = !!ul1;
  const canGo3 = !!ul1 && !!sawLetter;
  const canGo4 = !!ul1 && sawLetter && acceptNoReturn;
  const step4Ok = !!ul1 && sawLetter && acceptNoReturn && !!choice;

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async (durationSec: number | null) => {
    const payload: UL4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      sawLetter: !!sawLetter,
      acceptNoReturn: !!acceptNoReturn,
      choice,
      letterMode: ul1?.mode || null,
      letterPath: ul1?.path || null,
      pages: pages || 0,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_UL4_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [acceptNoReturn, choice, pages, sawLetter, ul1?.mode, ul1?.path]);

  /* ----------------------------- “Release” effect: neutralize UL_1 local content ----------------------------- */
  const neutralizeUL1LocalIfRelease = useCallback(async () => {
    if (choice !== "release") return;
    const raw = await AsyncStorage.getItem(KEY_UL1_FINAL);
    if (!raw) return;

    let j: any = null;
    try {
      j = JSON.parse(raw);
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return;

    // ✅ نامه/عکس‌ها خنثی می‌شوند ولی رکورد باقی می‌ماند تا UL_1 دوباره editable نشود
    const patched = {
      ...j,
      letterText: "",
      bitterTruths: "",
      images: [],
      letterReleased: true,
      letterReleasedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(KEY_UL1_FINAL, JSON.stringify(patched));
  }, [choice]);

  /* ----------------------------- Server submit (ONLY completion) ----------------------------- */
  const completeOnServer = useCallback(async (durationSec: number | null): Promise<"ok" | "already" | "fail"> => {
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

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        sawLetter: true,
        acceptNoReturn: true,
        choice,
        letterMode: ul1?.mode || null,
        letterPath: ul1?.path || null,
        pages,
        durationSec,
      },
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
  }, [apiBase, choice, closeModal, openModal, pages, phone, token, ul1?.mode, ul1?.path]);

  const doFinalize = useCallback(async () => {
    if (!step4Ok) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      const startedAt = startedAtRef.current;
      const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

      // 1) server
      const r = await completeOnServer(durationSec);
      if (r === "fail") return;

      // 2) local: اثر آیین + ذخیره final
      await neutralizeUL1LocalIfRelease();
      await persistFinalLocal(durationSec);

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
        message: choice === "release" ? "نامه رها شد و دیگر داخل اپ قابل خوندن نیست" : "نامه به عنوان سند بسته‌شدن نگه‌داری شد",
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
  }, [closeModal, completeOnServer, neutralizeUL1LocalIfRelease, openModal, persistFinalLocal, router, step4Ok, choice]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  /* ----------------------------- Start timer ----------------------------- */
  useEffect(() => {
    if (isReview) return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
  }, [isReview]);

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

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.h1}>منطق این ریزاقدام</Text>
              <Text style={styles.p}>
                این نامه یک‌بار برای تخلیه ساخته شد.
                {"\n"}اما اگر چندبار برگردی و بخونیش، مغز ازش «محرک موج» می‌سازه.
                {"\n"}
                {"\n"}الان هدف اینه که یک بار به شکل کنترل‌شده دوباره نامه رو ببینی بعدش آیین رها کردن نامه رو انجام بدی.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>قبل از ادامه</Text>
                <Text style={styles.small}>
                  این ریزاقدام فقط وقتی معنا داره که «نامه ریزاقدام اول» روی گوشی ذخیره شده باشه.
                </Text>
              </View>

              <View style={{ height: 12 }} />

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!canGo2 || saving}
                onPress={() => setStep(2)}
                style={[styles.primaryBtn, (!canGo2 || saving) && { opacity: 0.45 }]}
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
              <Text style={styles.h1}>یک‌بار نگاه و یک‌بار خواندن</Text>
              <Text style={styles.p}>
                این مرحله برای «تخلیه نهایی»ه پس سعی کن حین خوندن هیجانات خودت رو خالی کنی.
                {"\n"}یادت نره این کار قرار نیست تبدیل به عادت بشه.
                {"\n"}بعد از این مرحله، مسیر برگشت رو می‌بندیم.
              </Text>
            </View>

            {/* Letter preview */}
            {ul1 ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>نامه تو</Text>

                {/* bitterTruths */}
                {!!String(ul1.bitterTruths || "").trim() ? (
                  <View style={[styles.previewBox, { marginTop: 10 }]}>
                    <Text style={styles.previewTitle}>واقعیت‌هایی که نمی‌خواستم ببینم</Text>
                    <Text style={styles.previewText}>{String(ul1.bitterTruths || "").trim()}</Text>
                  </View>
                ) : null}

                {/* text mode */}
                {ul1.mode === "text" ? (
                  <View style={[styles.previewBox, { marginTop: 10 }]}>
                    <Text style={styles.previewTitle}>{ul1.path === "drain" ? "نامه تخلیه" : "نامه بستن"}</Text>
                    <Text style={styles.previewText}>
                      {String(ul1.letterText || "").trim() || "—"}
                    </Text>
                  </View>
                ) : null}

                {/* photo mode */}
                {ul1.mode === "photo" ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.small}>صفحات نامه: {pages}</Text>

                    {Array.isArray(ul1.images) && ul1.images.length > 0 ? (
                      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                        {ul1.images.map((uri, idx) => (
                          <View key={`${uri}-${idx}`} style={styles.thumbWrap}>
                            <Image source={{ uri }} style={styles.thumb} />
                            <View style={styles.thumbBadge}>
                              <Text style={styles.thumbBadgeText}>صفحه {idx + 1}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.warn}>عکسی پیدا نشد.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ height: 12 }} />

            <Pressable
              onPress={() => {
                if (isReview) return;
                setSawLetter((x) => !x);
              }}
              style={[styles.choiceCard, sawLetter && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
              disabled={isReview}
            >
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={sawLetter ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={sawLetter ? palette.green : "rgba(231,238,247,.55)"}
                />
                <Text style={styles.choiceText}>یک بار نامه رو دیدم و خوندم و تخلیم انجام شد</Text>
              </View>
            </Pressable>

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

              {!canGo3 ? <Text style={styles.warn}>برای ادامه باید تأیید کنی که یک‌بار نامه رو دیدی و خوندی</Text> : null}
            </View>
          </>
        ) : null}

        {/* ----------------------------- Step 3 ----------------------------- */}
        {step === 3 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>چرا نباید برگردم و دوباره نامه رو بخونم؟</Text>
              <Text style={styles.p}>
                هر بار برگشتن به نامه، مغز رو دوباره وارد مدار تحریک - ایجاد موج وسوسه - اقدام اشتباه  می‌کنه.
                {"\n"}این برگشت‌ها درمان نیس و وفقط درد رو فعال میکنه.
                {"\n"}
                {"\n"}پس اینجا بالغانه انتخاب کن که «دیگه برنمی‌گردی».
              </Text>
            </View>

            <Pressable
              onPress={() => {
                if (isReview) return;
                setAcceptNoReturn((x) => !x);
              }}
              style={[styles.choiceCard, acceptNoReturn && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
              disabled={isReview}
            >
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={acceptNoReturn ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={acceptNoReturn ? palette.green : "rgba(231,238,247,.55)"}
                />
                <Text style={styles.choiceText}>
                  می‌پذیرم که برگشتن به این نامه، موج وسوسه رو تقویت میکنه؛ بنابراین از این به بعد به اون برنمی‌گردم.
                </Text>
              </View>
            </Pressable>

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

              {!canGo4 ? <Text style={styles.warn}>برای ادامه باید این پذیرش رو تایید کنی</Text> : null}
            </View>
          </>
        ) : null}

        {/* ----------------------------- Step 4 ----------------------------- */}
        {step === 4 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>آیین نهایی</Text>
              <Text style={styles.p}>
                حالا انتخاب کن این نامه چه جایگاهی داشته باشه:
                {"\n"}
                {"\n"}۱) رها کردن:دیگه نمیتونی از داخل اپ نامه رو بخونی و اگه ازش عکس گرفتی باید اونو پاک کنی و اگه به شکل کاغذی اون رو هنوز داری باید پارش کنی.
                {"\n"}
                {"\n"}۲) نگه‌داری: نامه به عنوان «سند بسته‌شدن» نگه داشته میشه ولی دیگه نباید اون رو بخونی.
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setChoice("release");
                }}
                style={[styles.choiceCard, choice === "release" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={choice === "release" ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={choice === "release" ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>رهاش می‌کنم</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setChoice("store");
                }}
                style={[styles.choiceCard, choice === "store" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={choice === "store" ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={choice === "store" ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>نگه می‌دارم</Text>
                </View>
              </Pressable>
            </View>

            <View style={{ marginTop: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={(!!saving) || (!isReview && !step4Ok)}
                onPress={onFinishPress}
                style={[styles.primaryBtn, ((!isReview && !step4Ok) || saving) && { opacity: 0.45 }]}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}
                </Text>
              </TouchableOpacity>

              {!isReview && !step4Ok ? <Text style={styles.warn}>برای ثبت باید مراحل قبل کامل باشد</Text> : null}

              {!isReview ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setStep(3)}
                  style={[styles.secondaryBtn, { marginTop: 10 }]}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>بازگشت به مرحله قبل</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

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
        message={choice === "release" ? "اگر رها کنی، نامه داخل اپ از دسترس خارج میشه." : "بعد از ثبت، انتخابت قابل تغییر نیست."}
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

  previewBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.16)",
    borderRadius: 14,
    padding: 12,
  },
  previewTitle: { color: "rgba(231,238,247,.88)", fontWeight: "900", fontSize: 12, textAlign: "right" },
  previewText: { color: "rgba(231,238,247,.78)", marginTop: 8, fontSize: 12, lineHeight: 20, textAlign: "right" },

  thumbWrap: {
    width: 108,
    height: 108,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
  },
  thumb: { width: "100%", height: "100%" },
  thumbBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  thumbBadgeText: { color: "rgba(231,238,247,.88)", fontSize: 10, fontWeight: "900" },

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