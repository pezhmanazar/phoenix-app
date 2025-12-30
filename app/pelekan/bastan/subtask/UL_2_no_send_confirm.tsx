// app/pelekan/bastan/subtask/UL_2_no_send_confirm.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  if (k === "UL_2_no_send_confirm") return "ریز اقدام دوم";
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
type LockHours = 24 | 48 | 72;

type SafeguardId =
  | "sg_no_send_anywhere"
  | "sg_no_screenshot_share"
  | "sg_no_copy_paste"
  | "sg_no_contact_72h"
  | "sg_remove_drafts"
  | "sg_archive_media"
  | "sg_mute_notifications"
  | "sg_put_phone_away";

type UL2Saved = {
  version: 1;
  savedAt: string;

  lockHours: LockHours;
  agreeNotSend: boolean; // اصل تعهد
  agreeNotManipulate: boolean; // دور زدن = ارسال غیرمستقیم
  selectedSafeguards: SafeguardId[];

  urgePlan: string; // اگر میل به ارسال آمد، چه کار می‌کنم؟
  emergencyLine: string; // اگر کنترل از دست رفت، به کی/کجا رجوع کنم؟ (متن آزاد)

  finalConfirm: boolean;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "UL_2_no_send_confirm";
const KEY_UL2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Constants ----------------------------- */
const MIN_PLAN_LEN = 80;
const MIN_EMERGENCY_LEN = 25;

/* ----------------------------- Data ----------------------------- */
const SAFEGUARDS: { id: SafeguardId; label: string }[] = [
  { id: "sg_no_send_anywhere", label: "متعهد می‌شم نامه یا حرف‌هایی که داخلش زدم رو در هیچ جایی ارسال نکنم (پیام، ایمیل، دایرکت، یا با واسطه)" },
  { id: "sg_no_screenshot_share", label: "متعهد می‌شم اسکرین‌شات یاعکس از نامه برای هیچ کسی نفرستم" },
  { id: "sg_no_copy_paste", label: "متعهد می‌شم متن نامه رو به شکل کپی پیست به کسی ارسال نکنم" },
  { id: "sg_no_contact_72h", label: "متعهد می‌شم حداقل تا پایان قفل، هیچ تماسی با اکسم نگیرم" },
  { id: "sg_remove_drafts", label: " پیام‌هایی که قبلا نوشتم تا براش بفرستم رو پاک می‌کنم تا وسوسه نشم براش بفرستم" },
  { id: "sg_archive_media", label: "عکس‌ها و چت‌های مشترک با اون رو فعلاً آرشیو می‌کنم (نه برای همیشه)" },
  { id: "sg_mute_notifications", label: "نوتیفیکیشن‌هاو یادآورها رو موقتاً خاموش می‌کنم" },
  { id: "sg_put_phone_away", label: "وقتی میل برای پیام دادن یا تماس گرفتن شدید شد، گوشیم رو ۱۰ دقیقه خاموش میکنم" },
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
export default function UL2NoSendConfirmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "تعهدنامه عدم ارسال";

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

  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [lockHours, setLockHours] = useState<LockHours>(72);
  const [agreeNotSend, setAgreeNotSend] = useState(false);
  const [agreeNotManipulate, setAgreeNotManipulate] = useState(false);

  // Step 2
  const [selectedSafeguards, setSelectedSafeguards] = useState<SafeguardId[]>([]);

  // Step 3
  const [urgePlan, setUrgePlan] = useState("");
  const [emergencyLine, setEmergencyLine] = useState("");

  // Step 4
  const [finalConfirm, setFinalConfirm] = useState(false);

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
    const raw = await AsyncStorage.getItem(KEY_UL2_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as UL2Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setLockHours(j.lockHours);
    setAgreeNotSend(!!j.agreeNotSend);
    setAgreeNotManipulate(!!j.agreeNotManipulate);
    setSelectedSafeguards(Array.isArray(j.selectedSafeguards) ? j.selectedSafeguards : []);
    setUrgePlan(String(j.urgePlan || ""));
    setEmergencyLine(String(j.emergencyLine || ""));
    setFinalConfirm(!!j.finalConfirm);

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

  /* ----------------------------- Helpers ----------------------------- */
  const selectedSet = useMemo(() => new Set(selectedSafeguards), [selectedSafeguards]);

  const toggleSafeguard = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim() as SafeguardId;
      if (!id) return;

      setSelectedSafeguards((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        return next;
      });
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = agreeNotSend && agreeNotManipulate;

  const canGo3 = useMemo(() => {
    if (!canGo2) return false;
    // حداقل 2 safeguard تا فقط «قول» نباشه
    return selectedSafeguards.length >= 2;
  }, [canGo2, selectedSafeguards.length]);

  const planOk = useMemo(() => String(urgePlan || "").trim().length >= MIN_PLAN_LEN, [urgePlan]);
  const emergencyOk = useMemo(() => String(emergencyLine || "").trim().length >= MIN_EMERGENCY_LEN, [emergencyLine]);

  const canGo4 = canGo3 && planOk && emergencyOk;

  const step4Ok = useMemo(() => canGo4 && !!finalConfirm, [canGo4, finalConfirm]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: UL2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      lockHours,
      agreeNotSend: true,
      agreeNotManipulate: true,
      selectedSafeguards,
      urgePlan: String(urgePlan || ""),
      emergencyLine: String(emergencyLine || ""),
      finalConfirm: !!finalConfirm,
    };

    await AsyncStorage.setItem(KEY_UL2_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [emergencyLine, finalConfirm, lockHours, selectedSafeguards, urgePlan]);

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

    // ✅ فقط متادیتا، بدون متنِ تعهد
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        lockHours,
        selectedSafeguardsCount: selectedSafeguards.length,
        durationSec,
        finalConfirm: true,
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
  }, [apiBase, closeModal, lockHours, openModal, phone, selectedSafeguards.length, token]);

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
        message: "این تعهدنامه قفل شد و قابل تغییر نیست",
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

  /* ----------------------------- Start timer ----------------------------- */
  useEffect(() => {
    if (isReview) return;
    if (step !== 1) return;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
  }, [isReview, step]);

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
                <Text style={styles.h1}>قرارداد «نَفرستادن»</Text>
                <Text style={styles.p}>
                  بعد از نوشتن نامه، مغز دنبال «تخلیه فوری» می‌گرده و خطر ارسال نامه یا تماس گرفتن بالا می‌ره.
                  {"\n"}این ریزاقدام قرار نیست میل رو نابود کنه؛ فقط تصمیم رو  به «تعویق» می‌اندازه.
                  {"\n"}
                  {"\n"}نکته مهم: اگه با اکست به دلایل مختلف مجبوری ارتباط داشته باشی مثلا همکار یا همکلاسی هستید
                  {"\n"}در این حالت هم باید این تعهدنامه اجرا بشه به این شکل که کاملا سرد و خشک و رسمی باهاش رفتار میکنی
                  {"\n"}
                  {"\n"}این تعهدنامه داخل گوشی تو ذخیره میشه.
                  {"\n"}سرور فقط انجام شدن ریزاقدام رو ثبت میکنه.
                  {"\n"}
                </Text>

                <View style={[styles.noteCard, { marginTop: 10 }]}>
  <Text style={styles.noteTitle}>مدت قفل تعهد</Text>
  <Text style={styles.small}>پیشنهاد پیش‌فرض: ۷۲ ساعت (استاندارد درمانی برای عبور از موج وسوسه)</Text>

  <View
    style={{
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      width: "100%",
    }}
  >
    {[24, 48, 72].map((n) => {
      const on = lockHours === n;
      return (
        <Pressable
          key={n}
          onPress={() => {
            if (isReview) return;
            setLockHours(n as LockHours);
          }}
          style={[styles.pill, on && styles.pillOn, isReview && { opacity: 0.7 }]}
          disabled={isReview}
        >
          <Text style={styles.pillText}>{n} ساعت</Text>
        </Pressable>
      );
    })}
  </View>
</View>

                <View style={{ height: 10 }} />

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNotSend((x) => !x);
                  }}
                  style={[styles.choiceCard, agreeNotSend && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNotSend ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNotSend ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>متعهد می‌شم تا پایان قفل، نامه رو به هیچ شکلی ارسال نکنم</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNotManipulate((x) => !x);
                  }}
                  style={[
                    styles.choiceCard,
                    agreeNotManipulate && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                    { marginTop: 10 },
                  ]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNotManipulate ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNotManipulate ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>متعهد می‌شم « خودم رو دور نزنم» (یعنی به شکل واسطه، کنایه، استوری و پیام غیرمستقیم هم به اکسم پیامی ندم)</Text>
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
                <Text style={styles.h1}>تعهد به  انجام ندادن تمام حالت‌های ممکن</Text>
                <Text style={styles.p}>
                  فقط «قول» کافی نیست.
                  {"\n"}تعهد بده هیچ کدوم از حالت‌های پایین رو انجام نمیدی.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {SAFEGUARDS.map((it) => {
                  const on = selectedSet.has(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleSafeguard(it.id)}
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
                <Text style={styles.small}>انتخاب شده: {selectedSafeguards.length}</Text>

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

                {!canGo3 ? <Text style={styles.warn}>حداقل دو مورد لازم است</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نقشه زمان وسوسه</Text>
                <Text style={styles.p}>
                  اینجا بجای  احساس، تصمیم می‌سازیم.
                  {"\n"}اگر میلت برای تماس شدید شد، دقیق بنویس چه کار می‌کنی.
                </Text>
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>اگر میل به ارسال یا تماس آمد، من این کارها رو انجام میدم:</Text>
                <TextInput
                  ref={(r) => {
                    inputRefs.current["urgePlan"] = r;
                  }}
                  value={urgePlan}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setUrgePlan(t);
                  }}
                  onFocus={() => setTimeout(() => scrollToInput("urgePlan", 22), 60)}
                  placeholder="مثال: ۹۰ ثانیه نفس عمیق میکشم، ۱۰ دقیقه گوشی رو خاموش میکنم، دوش آب سرد میگیرم، پیاده‌روی میکنم، ۱۰ خط روی کاغذ مینویسم که چرا نباید بهش پیام بدم..."
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, isReview && styles.inputReadOnly, { minHeight: 140 }]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  blurOnSubmit={false}
                />
                {!isReview ? (
                  <Text style={[styles.small, String(urgePlan || "").trim().length < MIN_PLAN_LEN ? { color: palette.red } : null]}>
                    {String(urgePlan || "").trim().length}/{MIN_PLAN_LEN}
                  </Text>
                ) : (
                  <Text style={styles.small}>ثبت شده</Text>
                )}
              </View>

              <View style={{ height: 12 }} />

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>اگر کنترل از دست رفت، «خط اضطراری من» اینه:</Text>
                <Text style={styles.small}>اسم یک نفر قابل اعتماد یا یک اقدام فوری (مثلاً «تماس با درمانگر یادوستم»)</Text>

                <TextInput
                  ref={(r) => {
                    inputRefs.current["emergency"] = r;
                  }}
                  value={emergencyLine}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setEmergencyLine(t);
                  }}
                  onFocus={() => setTimeout(() => scrollToInput("emergency", 22), 60)}
                  placeholder="مثال: تماس با ... ، رفتن به ... ، ترک موقعیت و حضور در جمع"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, isReview && styles.inputReadOnly, { minHeight: 100 }]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  blurOnSubmit={false}
                />

                {!isReview ? (
                  <Text
                    style={[
                      styles.small,
                      String(emergencyLine || "").trim().length < MIN_EMERGENCY_LEN ? { color: palette.red } : null,
                    ]}
                  >
                    {String(emergencyLine || "").trim().length}/{MIN_EMERGENCY_LEN}
                  </Text>
                ) : (
                  <Text style={styles.small}>ثبت شده</Text>
                )}
              </View>

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
                    disabled={!canGo4 || saving}
                    onPress={() => setStep(4)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo4 ? <Text style={styles.warn}>نقشه زمان وسوسه و خط اضطراری باید کامل باشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>امضا و قفل</Text>
                <Text style={styles.p}>
                  اینجا وجه «بالغ» تو تصمیم می‌گیره، نه  وجه هیجانی تو.
                  {"\n"}بعد از ثبت، امکان تغییر وجود نداره و باید پای حرفت وایسی.
                  {"\n"}
                  {"\n"}مدت قفل: {lockHours} ساعت
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setFinalConfirm((x) => !x);
                }}
                style={[styles.choiceCard, finalConfirm && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={finalConfirm ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={finalConfirm ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>
                    من مسئول «نفرستادن و عدم تماس» هستم و تا پایان قفل، تصمیمم رو اجرا می‌کنم
                  </Text>
                </View>
              </Pressable>

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

                {!isReview && !step4Ok ? (
                  <Text style={styles.warn}>تایید نهایی باید زده بشه و مرحله ۳ کامل باشه</Text>
                ) : null}

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