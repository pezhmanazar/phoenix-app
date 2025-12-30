// app/pelekan/bastan/subtask/UL_1_letter_write_or_photo.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
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
  if (k === "UL_1_letter_write_or_photo") return "ریز اقدام اول";
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
type LetterPath = "drain" | "closure"; // تخلیه / بستن

type UL1Saved = {
  version: 1;
  savedAt: string;
  agreePrivate: boolean;
  mode: LetterMode;
  path: LetterPath;
  emotionLevel: number; // 0..10
  didRegulate90s: boolean;
  letterText?: string; // local-only
  bitterTruths?: string; // local-only (3 جمله)
  images?: string[]; // local URIs, local-only
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "UL_1_letter_write_or_photo";
const KEY_UL1_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Limits ----------------------------- */
const MAX_IMAGES = 8;
const MIN_TEXT_LEN = 120; // حداقل معنادار
const MIN_TRUTHS_LEN = 40;

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
export default function UL1LetterWriteOrPhotoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "نامه خداحافظی";

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
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // Step 1
  const [agreePrivate, setAgreePrivate] = useState(false);
  const [agreeNoSend, setAgreeNoSend] = useState(false);

  // Step 2
  const [mode, setMode] = useState<LetterMode | null>(null);
  const [path, setPath] = useState<LetterPath | null>(null);
  const [emotionLevel, setEmotionLevel] = useState<number | null>(null);
  const [didRegulate90s, setDidRegulate90s] = useState(false);

  // Step 3
  const [letterText, setLetterText] = useState("");
  const [bitterTruths, setBitterTruths] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const startedAtRef = useRef<number | null>(null);

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
    const raw = await AsyncStorage.getItem(KEY_UL1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as UL1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAgreePrivate(!!j.agreePrivate);
    setAgreeNoSend(true); // اگر ذخیره شده یعنی قبلا تایید کرده
    setMode(j.mode);
    setPath(j.path);
    setEmotionLevel(typeof j.emotionLevel === "number" ? j.emotionLevel : 0);
    setDidRegulate90s(!!j.didRegulate90s);

    setLetterText(String(j.letterText || ""));
    setBitterTruths(String(j.bitterTruths || ""));
    setImages(Array.isArray(j.images) ? j.images : []);

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

  /* ----------------------------- Scroll to input ----------------------------- */
  const scrollToInput = useCallback((id: string, extraOffset = 22) => {
    const input = inputRefs.current[id] as any;
    const scroll = scrollRef.current as any;
    if (!input || !scroll) return;

    const node = findNodeHandle(input);
    if (!node) return;

    const responder = scroll.getScrollResponder?.();
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
  }, []);

  /* ----------------------------- Image Picker ----------------------------- */
  const pickImages = useCallback(async () => {
    if (isReview) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    });

    if (res.canceled) return;

    const uris = res.assets.map((a) => a.uri).filter(Boolean);
    setImages((prev) => {
      const merged = [...prev, ...uris].slice(0, MAX_IMAGES);
      return merged;
    });
  }, [isReview]);

  const removeImage = useCallback(
    (uri: string) => {
      if (isReview) return;
      setImages((prev) => prev.filter((x) => x !== uri));
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = agreePrivate && agreeNoSend;

  const mustRegulate = useMemo(() => {
    const e = typeof emotionLevel === "number" ? emotionLevel : null;
    return e !== null && e >= 8;
  }, [emotionLevel]);

  const canGo3 = !!mode && !!path && emotionLevel !== null && (!mustRegulate || didRegulate90s);

  const textOk = useMemo(() => {
    if (mode !== "text") return true;
    const t = String(letterText || "").trim();
    return t.length >= MIN_TEXT_LEN;
  }, [letterText, mode]);

  const truthsOk = useMemo(() => {
    const t = String(bitterTruths || "").trim();
    return t.length >= MIN_TRUTHS_LEN;
  }, [bitterTruths]);

  const photosOk = useMemo(() => {
    if (mode !== "photo") return true;
    return images.length >= 1 && images.length <= MAX_IMAGES;
  }, [images.length, mode]);

  const step3Ok = useMemo(() => {
    return !!mode && textOk && truthsOk && photosOk;
  }, [mode, photosOk, textOk, truthsOk]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: UL1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      agreePrivate: true,
      mode: mode as LetterMode,
      path: path as LetterPath,
      emotionLevel: Number(emotionLevel || 0),
      didRegulate90s: !!didRegulate90s,
      letterText: mode === "text" ? String(letterText || "") : undefined,
      bitterTruths: String(bitterTruths || ""),
      images: mode === "photo" ? images : undefined,
    };

    await AsyncStorage.setItem(KEY_UL1_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [bitterTruths, didRegulate90s, emotionLevel, images, letterText, mode, path]);

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

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    // ✅ فقط متادیتا، بدون متن و عکس
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        mode,
        path,
        emotionLevel,
        didRegulate90s,
        pages: mode === "photo" ? images.length : 1,
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
  }, [apiBase, closeModal, emotionLevel, images.length, mode, openModal, path, phone, token]);

  const doFinalize = useCallback(async () => {
    if (!step3Ok) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) server
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) local
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
  }, [closeModal, completeOnServer, openModal, persistFinalLocal, router, step3Ok]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  /* ----------------------------- Timer hint ----------------------------- */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (step !== 3) return;
    if (isReview) return;

    if (!startedAtRef.current) startedAtRef.current = Date.now();
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [isReview, step]);

  const elapsedMin = useMemo(() => {
    if (!startedAtRef.current) return 0;
    return Math.floor((Date.now() - startedAtRef.current) / 60000);
  }, [tick]);

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
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>منطق این ریزاقدام</Text>
                <Text style={styles.p}>
                  این نامه برای ارسال کردن نیست.
                  {"\n"}برای بستن حلقه‌ها و پرونده‌های باز ذهن توئه.
                  {"\n"}اگر قرار بود ارسال بشه این تمرین ممنوع بود.
                  {"\n"}
                  {"\n"} متن و عکس‌ها فقط داخل گوشی تو ذخیره میشن.
                  {"\n"} سرور فقط انجام شدن تکنیک رو ثبت میکنه
                  {"\n"} پس بدون سانسور این تکنیک رو انجام بده.
                  {"\n"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreePrivate((x) => !x);
                  }}
                  style={[styles.choiceCard, agreePrivate && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreePrivate ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreePrivate ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>متوجه شدم این نامه فقط برای خودمه</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNoSend((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeNoSend && styles.choiceCardOn, isReview && { opacity: 0.7 }, { marginTop: 10 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNoSend ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNoSend ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قول میدم این نامه رو به کسی نفرستم </Text>
                  </View>
                </Pressable>

                <View style={{ height: 12 }} />

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGo2}
                  onPress={() => setStep(2)}
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
                <Text style={styles.h1}>انتخاب مسیر</Text>
                <Text style={styles.p}>
                  دو مدل نامه داریم:
                  {"\n"}مدل اول: نامه تخلیه 
                  {"\n"} مدل دوم: نامه بستن
                  {"\n"}
                  {"\n"}و دو روش ثبت نامه داریم:
                  {"\n"}نوشتن داخل اپ
                  {"\n"}یا نوشتن روی کاغذ و عکس گرفتن
                  {"\n"}
                  {"\n"}مدل نامه و نوع ثبت رو انتخاب کن
                </Text>
              </View>

              {/* Path */}
              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setPath("drain");
                  }}
                  style={[styles.choiceCard, path === "drain" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={path === "drain" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={path === "drain" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>مدل اول: نامه‌ی تخلیه (در این مدل باید تمام حرف‌های گفته نشده رو بزنی و هیجانات خودت رو خالی کن)</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setPath("closure");
                  }}
                  style={[styles.choiceCard, path === "closure" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={path === "closure" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={path === "closure" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>مدل دوم: نامه بستن(در این مدل باید به واقعیت  رابطه، هزینه‌های که دادی و درس‌هایی که گرفتی اشاره کنی)</Text>
                  </View>
                </Pressable>
              </View>

              {/* Mode */}
              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setMode("text");
                    setImages([]);
                  }}
                  style={[styles.choiceCard, mode === "text" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={mode === "text" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={mode === "text" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>میخوام داخل اپ نامه رو بنویسم</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setMode("photo");
                    setLetterText("");
                  }}
                  style={[styles.choiceCard, mode === "photo" && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={mode === "photo" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={mode === "photo" ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>میخوام داخل کاغذ بنویسم (این مدل از لحاظ تاثیرگذاری پیشنهاد میشه)</Text>
                  </View>
                </Pressable>
              </View>

              {/* Emotion */}
              <View style={[styles.noteCard, { marginTop: 12 }]}>
                <Text style={styles.noteTitle}>شدت هیجانات منفیت  در این لحظه از صفر تا ده چقدره؟</Text>

                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const on = emotionLevel === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => {
                          if (isReview) return;
                          setEmotionLevel(n);
                          if (n < 8) setDidRegulate90s(false);
                        }}
                        style={[styles.pill, on && styles.pillOn, isReview && { opacity: 0.7 }]}
                        disabled={isReview}
                      >
                        <Text style={styles.pillText}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {mustRegulate ? (
                  <>
                    <Text style={[styles.warn, { marginTop: 10 }]}>
                      شدت هیجانت بالاست و نامه خداحافظی تاثیرگذار نخواهد بود برای همین قبل از شروع، ۹۰ ثانیه تنفس عمیق انجام بده:{"\n"}
                     با این روش: سه ثانیه دم، پنج ثانیه مکث و چهار ثانیه بازدم
                    </Text>

                    <Pressable
                      onPress={() => {
                        if (isReview) return;
                        setDidRegulate90s((x) => !x);
                      }}
                      style={[styles.choiceCard, didRegulate90s && styles.choiceCardOn, isReview && { opacity: 0.7 }, { marginTop: 10 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={didRegulate90s ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={didRegulate90s ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}> تنفس نود ثانیه‌ای رو انجام دادم </Text>
                      </View>
                    </Pressable>
                  </>
                ) : (
                  <Text style={[styles.small, { marginTop: 10 }]}>این میزان از هیجان خوبه پس مستقیم برو مرحله بعد.</Text>
                )}
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
                    disabled={!canGo3 || saving}
                    onPress={() => {
                      // reset timer start
                      if (!isReview) startedAtRef.current = Date.now();
                      setStep(3);
                    }}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo3 ? <Text style={styles.warn}>مسیر + روش + شدت هیجان باید کامل باشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نوشتن نامه</Text>
                <Text style={styles.p}>
                  زمان پیشنهادی: ۱۵ تا ۲۵ دقیقه.
                  {"\n"}زمان سپری شده: {elapsedMin} دقیقه
                  {elapsedMin >= 25 ? "\n\n⚠️ داری زیادی ادامه میدی. برای امروز همین‌جا تمومش کن." : ""}
                </Text>
              </View>

              {/* Prompt: bitter truths */}
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>سه جمله درباره واقعیت‌هایی که نمیخواستی داخل رابطه ببینی رو بنویس</Text>
                <TextInput
                  ref={(r) => {
                    inputRefs.current["truths"] = r;
                  }}
                  value={bitterTruths}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setBitterTruths(t);
                  }}
                  onFocus={() => setTimeout(() => scrollToInput("truths", 22), 60)}
                  
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, isReview && styles.inputReadOnly, { minHeight: 110 }]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  blurOnSubmit={false}
                />
                {!isReview ? (
                  <Text style={[styles.small, String(bitterTruths || "").trim().length < MIN_TRUTHS_LEN ? { color: palette.red } : null]}>
                    {String(bitterTruths || "").trim().length}/{MIN_TRUTHS_LEN}
                  </Text>
                ) : (
                  <Text style={styles.small}>ثبت شده</Text>
                )}
              </View>

              <View style={{ height: 12 }} />

              {/* Mode block */}
              {mode === "text" ? (
                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>
                    {path === "drain" ? "نامه تخلیه خودت رو بنویس" : "نامه بستن خودت رو بنویس"}
                  </Text>

                  {path === "closure" ? (
                    <Text style={styles.small}>
                      نامه تو باید چهار بخش داشته باشه: واقعیت‌های رابطه، هزینه‌هایی که دادی، درس‌هایی که گرفتی و از رابطت خداحافظی کن.
                    </Text>
                  ) : (
                    <Text style={styles.small}>
                      هرچی هست بنویس. قشنگش نکن،فقط تهدید و توهین افراطی ممنوع.
                    </Text>
                  )}

                  <TextInput
                    ref={(r) => {
                      inputRefs.current["letter"] = r;
                    }}
                    value={letterText}
                    onChangeText={(t) => {
                      if (isReview) return;
                      setLetterText(t);
                    }}
                    onFocus={() => setTimeout(() => scrollToInput("letter", 22), 60)}
                    placeholder="شروع کن… یادت نره این نامه برای ارسال نیست."
                    placeholderTextColor="rgba(231,238,247,.35)"
                    multiline
                    style={[styles.input, isReview && styles.inputReadOnly, { minHeight: 180 }]}
                    textAlign="right"
                    textAlignVertical="top"
                    editable={!isReview}
                    selectTextOnFocus={!isReview}
                    blurOnSubmit={false}
                  />

                  {!isReview ? (
                    <Text style={[styles.small, String(letterText || "").trim().length < MIN_TEXT_LEN ? { color: palette.red } : null]}>
                      {String(letterText || "").trim().length}/{MIN_TEXT_LEN}
                    </Text>
                  ) : (
                    <Text style={styles.small}>ثبت شده</Text>
                  )}
                </View>
              ) : (
                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>عکسِ صفحات نامه</Text>
                  <Text style={styles.small}>حداقل 1 صفحه، حداکثر {MAX_IMAGES} صفحه</Text>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={pickImages}
                    style={[styles.secondaryBtn, isReview && { opacity: 0.7 }]}
                    disabled={isReview}
                  >
                    <Text style={styles.secondaryBtnText}>انتخاب عکس‌ها</Text>
                  </TouchableOpacity>

                  <Text style={[styles.small, { marginTop: 10 }]}>انتخاب شده: {images.length} صفحه</Text>

                  {images.length > 0 ? (
                    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                      {images.map((uri, idx) => (
                        <View key={uri} style={styles.thumbWrap}>
                          <Image source={{ uri }} style={styles.thumb} />
                          <View style={styles.thumbBadge}>
                            <Text style={styles.thumbBadgeText}>صفحه {idx + 1}</Text>
                          </View>
                          {!isReview ? (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => removeImage(uri)}
                              style={styles.thumbRemove}
                            >
                              <Ionicons name="close" size={16} color={palette.text} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {!photosOk ? <Text style={styles.warn}>حداقل یک عکس لازمه</Text> : null}
                </View>
              )}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(2);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.primaryBtnText}>برای امروز کافیه</Text>
                  </TouchableOpacity>
                </View>

                {!step3Ok ? (
                  <Text style={styles.warn}>
                    {mode === "text" ? `متن نامه باید حداقل ${MIN_TEXT_LEN} کاراکتر باشد و واقعیت‌سنجی هم کامل شود.` : "عکس‌ها و واقعیت‌سنجی باید کامل بشه."}
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  برای کم کردن هیجانات منفی این چند کار رو انجام بده:
                  {"\n"}یک لیوان آب بخور، نود ثانیه نفس عمیق بکش و صورت خودت رو با آب سرد بشور
                  {"\n"}
                  {"\n"}یادت نره نوشتن نامه ممکنه میل به تماس با اکست رو بالا ببره.
                  {"\n"}برای همین قدم بعدی «تعهدنامه عدم ارسال» قرار داده شده
                  {"\n"} پس بعد از کارهای مراقبتی بالا، ریزاقدام بعدی رو انجام بده.
                </Text>
              </View>

              <View style={{ marginTop: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={(!!saving) || (!isReview && !step3Ok)}
                  onPress={onFinishPress}
                  style={[styles.primaryBtn, ((!isReview && !step3Ok) || saving) && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                </TouchableOpacity>

                {!isReview && !step3Ok ? (
                  <Text style={styles.warn}>قبل از ثبت، مرحله سه باید کامل باشه</Text>
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

  input: {
    marginTop: 10,
    minHeight: 100,
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

  pill: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  pillOn: {
    backgroundColor: "rgba(212,175,55,.12)",
    borderColor: "rgba(212,175,55,.28)",
  },
  pillText: { color: "rgba(231,238,247,.88)", fontWeight: "900" },

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
  thumbRemove: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
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