// app/pelekan/bastan/subtask/CC_1_read_contract.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  if (k === "CC_1_read_contract") return "ریز اقدام اول";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type CC1Saved = {
  version: 1;
  savedAt: string;
  readCompleted: boolean;
  reachedEnd: boolean;
  agreeLocked: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CC_1_read_contract";
const KEY_CC1_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Contract Text ----------------------------- */

const CONTRACT_TEXT = `
من، با آگاهی کامل و بدون اجبار، این تعهدنامه رو مطالعه می‌کنم و می‌پذیرم:

از تاریخ ثبت‌شده در این مسیر درمانی، این رابطه برای من به‌طور رسمی پایان‌یافته محسوب میشه.

من می‌پذیرم که:
- پایان رابطه به معنای پایان تماس هیجانیه، نه صرفاً پایان حضور فیزیکی.
- هرگونه تماس، پیام، چک‌کردن، دنبال‌کردن، یا پیگیری با انگیزه‌ی هیجانی، برخلاف این تعهدنامه‌ست.

من می‌دونم که:
- ذهن من ممکنه  بعد از این تصمیم، دچار تردید، دلتنگی، امید و خیال بازگشت بشه.
- این حالات طبیعی هستند، اما مبنای تصمیم‌گیری من نمیشن.

من متعهد میشم که:
- در این تصمیم شک نکنم.
- برای کاهش درد، به رفتارهای موقتی و مخرب پناه نبرم.
- مسئولیت هیجان‌های خودم رو بپذیرم و اون‌ها رو بهونه‌ی نقض این تعهد نکنم.

اگه به دلایلی مانند کار مشترک، همسایگی، فرزند مشترک،تحصیل یا الزام اجتماعی ناچار به ارتباط باشم، متعهد میشم که:
- ارتباط صرفاً خشک، رسمی، محدود و نقش‌محور باشه.
- از صمیمیت، درد‌دل، شوخی، کنایه، یا باز کردن مسیر هیجانی پرهیز کنم.
- برای فرار از مواجهه، زندگی یا مسیر حرفه‌ای خودم رو تخریب نکنم.

تعهد ادامه درمان:
من آگاهم که «بستن رابطه» فقط مرحله‌ی اول این مسیر درمانیه و بدون طی‌کردن مراحل بعدی، احتمال رسیدن به آرامش پایدار و رهایی واقعی بسیار پایینه.

من متعهد میشم که:
- درمان خودم رو در مراحل باقی‌مانده‌ی این مسیر ادامه بدم.
- اگه در میانه‌ی راه دچار خستگی، شک یا بی‌انگیزگی شدم، مسیر درمان رو رها نکنم.
- بدونم توقف درمان، به معنی بازگشت تدریجی درده، نه پایان اون.

من می‌پذیرم که:
- این تعهد، تضمینِ بی‌دردی نیست.
- این تعهد، انتخاب مسیر درمان تدریجیه، نه انتظار حالِ خوبِ فوری.

این متن رو نه برای طرف مقابل،
بلکه برای خودم می‌خونم و می‌پذیرم.
`.trim();

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

export default function CC1ReadContractScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "مطالعه تعهدنامه";

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
  const contractScrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 2
  const [reachedEnd, setReachedEnd] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);

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

  const step1Ok = true;
  const step2Ok = reachedEnd && readConfirmed;
  const step3Ok = true;

  const canGo2 = step1Ok;
  const canGo3 = step2Ok;
  const canFinalize = step2Ok;

  /* ----------------------------- Load FINAL (review) ----------------------------- */

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CC1_FINAL);
    if (!raw) return { loaded: false as const };

    let j: CC1Saved | null = null;
    try {
      j = JSON.parse(raw) as CC1Saved;
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return { loaded: false as const };

    setReachedEnd(!!j.reachedEnd);
    setReadConfirmed(!!j.readCompleted);
    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
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

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: CC1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      readCompleted: true,
      reachedEnd: true,
      agreeLocked: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CC1_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, []);

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

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        step2: {
          reachedEnd,
          readConfirmed,
        },
        summary: {
          reachedEnd,
          readConfirmed,
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
  }, [apiBase, closeModal, openModal, phone, reachedEnd, readConfirmed, token]);

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
        message: "این ریز اقدام قفل شد و قابل تغییر نیست.",
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
        <Text style={styles.stepPillText}>۱) شروع</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) مطالعه</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) قفل</Text>
      </View>
    </View>
  );

  const onContractScroll = useCallback((e: any) => {
    if (isReview) return;
    const { layoutMeasurement, contentOffset, contentSize } = e?.nativeEvent || {};
    if (!layoutMeasurement || !contentOffset || !contentSize) return;
    const paddingToBottom = 24;
    const reached =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (reached) setReachedEnd(true);
  }, [isReview]);

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
              <Text style={styles.h1}>ورود به تعهد</Text>
              <Text style={styles.p}>
                این متن قرار نیست «حالت رو خوب کنه».
                {"\n"}
                فقط قراره یک مرز روشن بسازه: بعد از این، مغز حق نداره با «یک پیام کوچیک» مسیرتو خراب کنه.
              </Text>

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
                <Text style={styles.primaryBtnText}>شروع مطالعه</Text>
              </TouchableOpacity>
            </View>
          ) : null}

         {/* Step 2 */}
{step === 2 ? (
  <>
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>مطالعه تعهدنامه</Text>
      <Text style={styles.p}>
        تا وقتی متن رو تا انتها نخونی و تأیید نکنی، ادامه فعال نمی‌شه.
      </Text>
    </View>

    <View style={[styles.noteCard, { marginTop: 12 }]}>
      <Text style={styles.noteTitle}>متن تعهدنامه</Text>
      <View style={{ height: 10 }} />

      {/* ✅ Wrapper fixes scrolling */}
      <View style={styles.contractBox}>
        <ScrollView
          ref={contractScrollRef}
          onScroll={onContractScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          contentContainerStyle={{ padding: 12, paddingBottom: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.contractText}>{CONTRACT_TEXT}</Text>
        </ScrollView>
      </View>

      <View style={{ height: 12 }} />

      {/* reached end status */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
        <Ionicons
          name={reachedEnd ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={reachedEnd ? palette.green : "rgba(231,238,247,.45)"}
        />
        <Text style={styles.small}>
          {reachedEnd ? "به انتهای متن رسیدی." : "برای فعال شدن ادامه، تا انتهای متن رو بخون."}
        </Text>
      </View>

      <View style={{ height: 10 }} />

      <Pressable
        onPress={() => (isReview ? null : setReadConfirmed((v) => !v))}
        disabled={isReview || !reachedEnd}
        style={[
          styles.choiceCard,
          readConfirmed && styles.choiceCardOn,
          (isReview || !reachedEnd) && { opacity: 0.7 },
        ]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={readConfirmed ? "checkbox" : "square-outline"}
            size={18}
            color={readConfirmed ? palette.green : "rgba(231,238,247,.55)"}
          />
          <Text style={[styles.choiceText, { flexShrink: 1 }]}>متن تعهدنامه رو کامل خوندم</Text>
        </View>
      </Pressable>

      {!step2Ok ? (
        <Text style={[styles.warn, { marginTop: 10 }]}>
          برای ادامه: رفتن تا انتها + تأیید لازمه.
        </Text>
      ) : null}
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
                  وقتی ثبت شد، قابل تغییر نیست.
                  {"\n"}
                  این یعنی از این لحظه به بعد، «بهونه» تبدیل به تصمیم نمی‌شه.
                </Text>

                <View style={{ height: 12 }} />

                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>وضعیت</Text>
                  <Text style={styles.small}>
                    • رسیدن به انتهای متن: {reachedEnd ? "بله" : "خیر"}
                    {"\n"}• تأیید خوندن: {readConfirmed ? "بله" : "خیر"}
                  </Text>
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
                      {saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>قبل از ثبت، مرحله مطالعه باید کامل بشه.</Text>
                ) : null}

                {isReview ? <Text style={[styles.small, { marginTop: 8 }]}>در حالت مرور، فقط نمایش است.</Text> : null}
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

  contractBox: {
  maxHeight: 320,              // قابل تنظیم
  borderWidth: 1,
  borderColor: "rgba(255,255,255,.10)",
  backgroundColor: "rgba(0,0,0,.14)",
  borderRadius: 14,
  padding: 12,
  overflow: "hidden",
},

contractText: {
  color: "rgba(231,238,247,.88)",
  fontWeight: "700",
  fontSize: 12,
  lineHeight: 20,
  textAlign: "right",
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