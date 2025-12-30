// app/pelekan/bastan/subtask/UL_3_72h_lock_confirm.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
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

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "UL_1_letter_write_or_photo") return "ریز اقدام اول";
  if (k === "UL_2_no_send_confirm") return "ریز اقدام دوم";
  if (k === "UL_3_72h_lock_confirm") return "ریز اقدام سوم";
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
type TriggerId =
  | "tr_night_lonely"
  | "tr_old_chat_photo"
  | "tr_after_cry_or_anger"
  | "tr_after_fantasizing"
  | "tr_story_seen"
  | "tr_song_place_memory"
  | "tr_social_pressure"
  | "tr_dont_know";

type SymptomId =
  | "sy_heart_race"
  | "sy_chest_heavy"
  | "sy_restless"
  | "sy_one_message_thought"
  | "sy_urgency"
  | "sy_shaky_hands"
  | "sy_throat_tight"
  | "sy_dont_know";

type UL3Saved = {
  version: 1;
  savedAt: string;
  selectedTriggers: TriggerId[];
  selectedSymptoms: SymptomId[];
  insightConfirmed: boolean; // جمله آگاهی‌بخش
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "UL_3_72h_lock_confirm";
const KEY_UL3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const TRIGGERS: { id: TriggerId; label: string }[] = [
  { id: "tr_night_lonely", label: "تنهایی شب" },
  { id: "tr_old_chat_photo", label: "دیدن عکس یا چت قدیمی" },
  { id: "tr_after_cry_or_anger", label: "بعد از گریه یا خشم" },
  { id: "tr_after_fantasizing", label: "بعد از خیال‌پردازی و فکر کردن بهش" },
  { id: "tr_story_seen", label: "بعد از دیدن استوریش یا آنلاین شدنش" },
  { id: "tr_song_place_memory", label: "شنیدن آهنگ یا بودن در مکان مشترک" },
  { id: "tr_social_pressure", label: "حرف مردم یا فشار اطرافیان" },
  { id: "tr_dont_know", label: "نمی‌دونم (فعلاً واضح نیست)" },
];

const SYMPTOMS: { id: SymptomId; label: string }[] = [
  { id: "sy_heart_race", label: "تپش قلب" },
  { id: "sy_chest_heavy", label: "سنگینی سینه" },
  { id: "sy_restless", label: "بی‌قراری" },
  { id: "sy_one_message_thought", label: "فکر اینکه «فقط یه پیام» بهش بدم" },
  { id: "sy_urgency", label: "حس اضطرار یعنی بگی الان باید یکاری بکنم" },
  { id: "sy_shaky_hands", label: "لرزش دست" },
  { id: "sy_throat_tight", label: "گرفتگی گلو" },
  { id: "sy_dont_know", label: "نمی‌دونم (فعلاً واضح نیست)" },
];

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
export default function UL3UrgeWaveControlScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "کنترل موج‌های وسوسه‌کننده";

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

  // Step 2
  const [selectedTriggers, setSelectedTriggers] = useState<TriggerId[]>([]);
  // Step 3
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomId[]>([]);
  // Step 4
  const [insightConfirmed, setInsightConfirmed] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_UL3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as UL3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setSelectedTriggers(Array.isArray(j.selectedTriggers) ? j.selectedTriggers : []);
    setSelectedSymptoms(Array.isArray(j.selectedSymptoms) ? j.selectedSymptoms : []);
    setInsightConfirmed(!!j.insightConfirmed);

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

  /* ----------------------------- Start timer ----------------------------- */
  useEffect(() => {
    if (isReview) return;
    if (step !== 1) return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
  }, [isReview, step]);

  /* ----------------------------- Helpers (exclusive "dont know") ----------------------------- */
  const triggerSet = useMemo(() => new Set(selectedTriggers), [selectedTriggers]);
  const symptomSet = useMemo(() => new Set(selectedSymptoms), [selectedSymptoms]);

  const toggleTrigger = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim() as TriggerId;
      if (!id) return;

      setSelectedTriggers((prev) => {
        const has = prev.includes(id);

        // اگر "نمی‌دونم" انتخاب شد، بقیه پاک
        if (id === "tr_dont_know") return has ? [] : ["tr_dont_know"];

        // اگر قبلاً "نمی‌دونم" بوده، حذفش کن
        let next = prev.filter((x) => x !== "tr_dont_know");

        if (has) next = next.filter((x) => x !== id);
        else next = [...next, id];

        return next;
      });
    },
    [isReview]
  );

  const toggleSymptom = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim() as SymptomId;
      if (!id) return;

      setSelectedSymptoms((prev) => {
        const has = prev.includes(id);

        if (id === "sy_dont_know") return has ? [] : ["sy_dont_know"];

        let next = prev.filter((x) => x !== "sy_dont_know");

        if (has) next = next.filter((x) => x !== id);
        else next = [...next, id];

        return next;
      });
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = true;

  const canGo3 = useMemo(() => {
    // حداقل ۱ مورد (یا "نمی‌دونم")
    return selectedTriggers.length >= 1;
  }, [selectedTriggers.length]);

  const canGo4 = useMemo(() => {
    return canGo3 && selectedSymptoms.length >= 1;
  }, [canGo3, selectedSymptoms.length]);

  const step4Ok = useMemo(() => {
    return canGo4 && !!insightConfirmed;
  }, [canGo4, insightConfirmed]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: UL3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selectedTriggers,
      selectedSymptoms,
      insightConfirmed: true,
    };

    await AsyncStorage.setItem(KEY_UL3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [selectedSymptoms, selectedTriggers]);

  /* ----------------------------- Server submit (ONLY completion) ----------------------------- */
  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام شدن باید وارد حساب بشی",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    // ✅ فقط متادیتا، بدون دیتای حساس
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        triggersCount: selectedTriggers.length,
        symptomsCount: selectedSymptoms.length,
        hasDontKnowTrigger: selectedTriggers.includes("tr_dont_know"),
        hasDontKnowSymptom: selectedSymptoms.includes("sy_dont_know"),
        durationSec,
        insightConfirmed: true,
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
  }, [apiBase, closeModal, openModal, phone, selectedSymptoms, selectedTriggers, token]);

  const doFinalize = useCallback(async () => {
    if (!step4Ok) return;
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
  }, [closeModal, completeOnServer, openModal, persistFinalLocal, router, step4Ok]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

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
                <Text style={styles.h1}>شناخت موج هیجانی</Text>
                <Text style={styles.p}>
                  بعد از نوشتن نامه، بالا رفتن میل به تماس طبیعیه.
                  {"\n"}این میل نشونه ضعف نیست، نشونه فعال شدن «موج هیجانی»ه.
                  {"\n"}
                  {"\n"}نکته مهم: لغزش از تصمیم نمیاد؛ از نشناختن موج میاد.
                  {"\n"}اینجا قرار نیست با موج بجنگی فقط باید بشناسیش.
                </Text>

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
                <Text style={styles.h1}>محرک موج</Text>
                <Text style={styles.p}>
                  معمولاً موج وسوسه از کجا شروع می‌شه؟
                  {"\n"}چند مورد رو می‌تونی انتخاب کنی.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {TRIGGERS.map((it) => {
                  const on = triggerSet.has(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleTrigger(it.id)}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{it.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب شده: {selectedTriggers.length}</Text>

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

                {!canGo3 ? <Text style={styles.warn}>حداقل یک مورد لازم است</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نشانه‌های موج</Text>
                <Text style={styles.p}>
                  وقتی موج وسوسه میاد، تو بدنت یا ذهنت چی تغییر می‌کنه؟
                  {"\n"}چند مورد رو می‌تونی انتخاب کنی.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {SYMPTOMS.map((it) => {
                  const on = symptomSet.has(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleSymptom(it.id)}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{it.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب شده: {selectedSymptoms.length}</Text>

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

                {!canGo4 ? <Text style={styles.warn}>حداقل یک نشانه لازم است</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>جمله آگاهی‌بخش</Text>
                <Text style={styles.p}>
                  این جمله جای «تعهد» رو می‌گیره:
                  {"\n"}
                  {"\n"}«وقتی این نشونه‌ها رو دیدم، یعنی وارد موج وسوسه شدم،
                 این یعنی نباید هیچ کار هیجانی انجام بدم و باید صبور باشم تا این موج تموم بشه.
                  {"\n"}
                  {"\n"}بهترین کار اینه در این لحظه نود ثانیه با تمرکز، نفس عمیق بکشم
                ده دقیقه گوشیم رو خاموش کنم و  ده دقیقه در هوای آزاد یا جلوی پنجره قدم بزنم
                  {"\n"}
                  {"\n"}موج میاد و می‌ره.
                  {"\n"}تو لازم نیست باهاش بجنگی، فقط بشناسش و کار اشتباه نکن.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setInsightConfirmed((x) => !x);
                }}
                style={[styles.choiceCard, insightConfirmed && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={insightConfirmed ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={insightConfirmed ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>این یه موج زودگذره پس نباید بخاطر آروم شدن موج  به سمت اون آدم برم</Text>
                </View>
              </Pressable>

              <View style={{ marginTop: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={(!!saving) || (!isReview && !step4Ok)}
                  onPress={onFinishPress}
                  style={[styles.primaryBtn, ((!isReview && !step4Ok) || saving) && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? "در حال انجام" : isReview ? "خروج" : "متوجه شدم"}</Text>
                </TouchableOpacity>

                {!isReview && !step4Ok ? <Text style={styles.warn}>برای پایان، تایید جمله لازمه.</Text> : null}

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
        primaryText="ثبت و پایان"
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