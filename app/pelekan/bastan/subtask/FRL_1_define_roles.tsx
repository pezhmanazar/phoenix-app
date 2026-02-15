// app/pelekan/bastan/subtask/FRL_1_define_roles.tsx
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
  if (k === "FRL_1_define_roles") return "ریز اقدام دوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type ContactObligation =
  | "shared_child"
  | "coworker"
  | "classmates"
  | "neighbor_or_shared_asset"
  | "legal_or_admin"
  | "none_of_above";

type ContactChannel =
  | "sms"
  | "messenger"
  | "call_only_urgent"
  | "in_person_only_if_required"
  | "third_party";

// v2: obligation -> obligations[]
type FRL1SavedV2 = {
  version: 2;
  savedAt: string;

  acceptedTruth: boolean;

  obligations: ContactObligation[]; // step2 (multi-select). last option is exclusive

  // role definitions (step 3)
  myRoleTitle: string;
  theirRoleTitle: string;
  channel: ContactChannel | null;

  allowedTopics: string;
  forbiddenTopics: string;

  // commitments (step 4)
  agreeNoEmotionalContact: boolean;
  agreeKeepDryOfficial: boolean;
  agreeNoEscapeRearrangeLife: boolean;

  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "FRL_1_define_roles";
const KEY_FRL1_FINAL_V2 = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v2`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Presets ----------------------------- */
const OBLIGATION_OPTIONS: { key: ContactObligation; title: string; desc: string; danger?: boolean }[] = [
  {
    key: "shared_child",
    title: "فرزند مشترک داریم",
    desc: "تماس فقط به‌دلیل مسئولیت والدگری اجتناب‌ناپذیره.",
  },
  {
    key: "coworker",
    title: "همکار هستیم (محیط کاری مشترک)",
    desc: "تماس فقط در چارچوب وظایف کاری یا پروژه‌ی مشخصه.",
  },
  {
    key: "classmates",
    title: "هم‌کلاس یا هم‌گروه آموزشی هستیم",
    desc: "تماس فقط به‌دلیل حضور در یک کلاس، دوره یا پروژه‌ی آموزشی مشترکه.",
  },
  {
    key: "neighbor_or_shared_asset",
    title: "همسایه یا مالکیت مشترک داریم",
    desc: "تماس فقط برای مسائل اجرایی مثل ساختمان، قرارداد، یا امور مشترک ضروریه.",
  },
  {
    key: "legal_or_admin",
    title: "مسئله‌ی حقوقی یا اداری مشترک داریم",
    desc: "تماس فقط برای پیگیری یک پرونده، قرارداد، یا موضوع اداری مشخصه.",
  },
  {
    key: "none_of_above",
    title: "هیچ‌کدوم از موارد بالا نیست",
    desc:
      "⚠️ این یعنی «اجبار واقعی» نداری. این ریزاقدام برای تو نیست. باید برگردی و مسیر «مجبور نیستم» رو انتخاب کنی.",
    danger: true,
  },
];

const CHANNEL_OPTIONS: { key: ContactChannel; title: string; desc: string }[] = [
  { key: "sms", title: "پیامک (خشک و کوتاه)", desc: "فقط جمله‌های اجرایی. بدون بحث." },
  { key: "messenger", title: "پیام‌رسان (فقط متن)", desc: "بدون ویس، بدون استیکر، بدون جمله‌ی احساسی." },
  { key: "call_only_urgent", title: "تماس فقط برای موارد فوری", desc: "مکالمه طولانی ممنوع. فقط کار فوری." },
  { key: "in_person_only_if_required", title: "حضوری فقط اگه اجبار عملی باشه", desc: "در حداقلی‌ترین زمان ممکن با حداقل کلمات." },
  { key: "third_party", title: "با واسطه (ترجیحی)", desc: "اگه شد، واسطه امن، بهترین گزینه‌ست." },
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
export default function FRL1DefineRolesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "تعریف نقش تماس";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..5
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // ✅ keyboard height (for extra bottom padding while keyboard is open)
  const [keyboardH, setKeyboardH] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardH(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardH(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Step 1
  const [acceptedTruth, setAcceptedTruth] = useState(false);

  // Step 2 (multi)
  const [obligations, setObligations] = useState<ContactObligation[]>([]);

  // Step 3
  const [myRoleTitle, setMyRoleTitle] = useState("");
  const [theirRoleTitle, setTheirRoleTitle] = useState("");
  const [channel, setChannel] = useState<ContactChannel | null>(null);

  const [allowedTopics, setAllowedTopics] = useState("");
  const [forbiddenTopics, setForbiddenTopics] = useState("");

  // Step 4 commitments
  const [agreeNoEmotionalContact, setAgreeNoEmotionalContact] = useState(false);
  const [agreeKeepDryOfficial, setAgreeKeepDryOfficial] = useState(false);
  const [agreeNoEscapeRearrangeLife, setAgreeNoEscapeRearrangeLife] = useState(false);

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

  const trimLen = (s: string) => String(s || "").trim().length;

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_FRL1_FINAL_V2);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as FRL1SavedV2;
    if (!j || j.version !== 2) return { loaded: false as const };

    setAcceptedTruth(!!j.acceptedTruth);

    const obs = Array.isArray(j.obligations) ? (j.obligations as any[]) : [];
    setObligations(obs.filter(Boolean) as ContactObligation[]);

    setMyRoleTitle(String(j.myRoleTitle || ""));
    setTheirRoleTitle(String(j.theirRoleTitle || ""));

    const ch = (String(j.channel || "") as ContactChannel) || null;
    setChannel(ch);

    setAllowedTopics(String(j.allowedTopics || ""));
    setForbiddenTopics(String(j.forbiddenTopics || ""));

    setAgreeNoEmotionalContact(!!j.agreeNoEmotionalContact);
    setAgreeKeepDryOfficial(!!j.agreeKeepDryOfficial);
    setAgreeNoEscapeRearrangeLife(!!j.agreeNoEscapeRearrangeLife);

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
        if (loaded) setStep(5);
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

  /* ----------------------------- Step 2 multi-select logic ----------------------------- */
  const noneSelected = useMemo(() => obligations.includes("none_of_above"), [obligations]);
  const hasAnyValidObligation = useMemo(() => obligations.some((x) => x !== "none_of_above"), [obligations]);

  const toggleObligation = useCallback(
    (k: ContactObligation) => {
      if (isReview) return;

      setObligations((prev) => {
        const has = prev.includes(k);

        // last option is exclusive
        if (k === "none_of_above") {
          if (has) return [];
          return ["none_of_above"];
        }

        // selecting any valid option must disable none_of_above
        const withoutNone = prev.filter((x) => x !== "none_of_above");
        if (has) return withoutNone.filter((x) => x !== k);

        return [...withoutNone, k];
      });

      // if they hit none_of_above, reset dependent fields
      if (k === "none_of_above") {
        setMyRoleTitle("");
        setTheirRoleTitle("");
        setChannel(null);
        setAllowedTopics("");
        setForbiddenTopics("");
        setAgreeNoEmotionalContact(false);
        setAgreeKeepDryOfficial(false);
        setAgreeNoEscapeRearrangeLife(false);
      }
    },
    [isReview]
  );

  const onPickChannel = useCallback(
    (k: ContactChannel) => {
      if (isReview) return;
      setChannel(k);
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const step1Ok = acceptedTruth;

  // Step2: at least one selection OR none_of_above selected (but that blocks going forward)
  const step2PickedAnything = obligations.length > 0;
  const step2InvalidForThisFlow = noneSelected;

  const roleOk = useMemo(() => {
    if (!step2PickedAnything || step2InvalidForThisFlow) return false;
    return trimLen(myRoleTitle) >= 2 && trimLen(theirRoleTitle) >= 2 && !!channel;
  }, [channel, myRoleTitle, step2PickedAnything, step2InvalidForThisFlow, theirRoleTitle]);

  const topicsOk = useMemo(() => {
    if (!roleOk) return false;
    return trimLen(allowedTopics) >= 3 && trimLen(forbiddenTopics) >= 3;
  }, [allowedTopics, forbiddenTopics, roleOk]);

  const commitOk = useMemo(() => {
    if (!topicsOk) return false;
    return agreeNoEmotionalContact && agreeKeepDryOfficial && agreeNoEscapeRearrangeLife;
  }, [agreeKeepDryOfficial, agreeNoEmotionalContact, agreeNoEscapeRearrangeLife, topicsOk]);

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2PickedAnything && !step2InvalidForThisFlow && hasAnyValidObligation;
  const canGo4 = canGo3 && roleOk && topicsOk;
  const canGo5 = canGo4 && commitOk;

  const canFinalize = canGo5;

  /* ----------------------------- Derived titles ----------------------------- */
  const selectedObligationsTitles = useMemo(() => {
    const set = new Set(obligations);
    return OBLIGATION_OPTIONS.filter((x) => set.has(x.key)).map((x) => x.title);
  }, [obligations]);

  const channelTitle = useMemo(() => CHANNEL_OPTIONS.find((x) => x.key === channel)?.title || "—", [channel]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: FRL1SavedV2 = {
      version: 2,
      savedAt: new Date().toISOString(),

      acceptedTruth: true,
      obligations: obligations,

      myRoleTitle: String(myRoleTitle || "").trim(),
      theirRoleTitle: String(theirRoleTitle || "").trim(),
      channel: channel || "sms",

      allowedTopics: String(allowedTopics || "").trim(),
      forbiddenTopics: String(forbiddenTopics || "").trim(),

      agreeNoEmotionalContact: true,
      agreeKeepDryOfficial: true,
      agreeNoEscapeRearrangeLife: true,

      durationSec,
    };

    await AsyncStorage.setItem(KEY_FRL1_FINAL_V2, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [allowedTopics, channel, forbiddenTopics, myRoleTitle, obligations, theirRoleTitle]);

  /* ----------------------------- Server submit (ONLY completion) ----------------------------- */
  const completeOnServer = useCallback(
    async (): Promise<"ok" | "already" | "fail"> => {
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
        version: 2,
        savedAt: new Date().toISOString(),
        answer: {
          acceptedTruth: true,

          obligations: obligations,
          obligationsCount: obligations.length,
          hasNoneOfAbove: noneSelected,

          myRoleTitle: String(myRoleTitle || "").trim(),
          theirRoleTitle: String(theirRoleTitle || "").trim(),
          channel: channel,

          hasAllowedTopics: trimLen(allowedTopics) >= 3,
          hasForbiddenTopics: trimLen(forbiddenTopics) >= 3,
          committed: commitOk,

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
    },
    [
      apiBase,
      closeModal,
      commitOk,
      openModal,
      phone,
      token,
      obligations,
      noneSelected,
      myRoleTitle,
      theirRoleTitle,
      channel,
      allowedTopics,
      forbiddenTopics,
    ]
  );

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
      setStep(5);
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
        <Text style={styles.stepPillText}>۱) تفکیک</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) اجبار</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) نقش‌ها</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
      </View>
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵) پایان</Text>
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
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 18 + insets.bottom + 24 + keyboardH, // ✅ keyboard-aware bottom space
          }}
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
              <Text style={styles.h1}>اول حقیقت رو روشن کنیم</Text>
              <Text style={styles.p}>
                این ریزاقدام فقط زمانی معنی داره که «اجبار واقعی» وجود داشته باشه.
                {"\n\n"}
                «دوستی»، «دلتنگی»، «گاهی حرف زدن» و «بسته نشدن پرونده رابطه داخل ذهن» اجبار نیست.
                {"\n\n"}
                اینجا داریم یک «نقش خشک و رسمی» طراحی می‌کنیم که ارتباط رو از عشق و احساس جدا کنه.
              </Text>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>هدف درمانی</Text>
                <Text style={styles.small}>
                  ۱) کاهش محرک‌ها و امید پنهان{"\n"}
                  ۲) جلوگیری از کش‌دار شدن گفت‌وگو{"\n"}
                  ۳) تبدیل رابطه به یک «کانال اجرایی»
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (isReview) return;
                  setAcceptedTruth((x) => !x);
                }}
                style={[
                  styles.choiceCard,
                  { marginTop: 14 }, // ← این خط رو اضافه کن
                  acceptedTruth && styles.choiceCardOn,
                  isReview && { opacity: 0.7 },
                ]}
                disabled={isReview}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={acceptedTruth ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={acceptedTruth ? palette.green : "rgba(231,238,247,.55)"}
                  />
                  <Text style={styles.choiceText}>قبول دارم: فقط «اجبار واقعی» من رو وارد این مسیر می‌کنه</Text>
                </View>
              </Pressable>

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

          {/* ----------------------------- Step 2 (MULTI) ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نوع اجبار تو کدومه؟</Text>
                <Text style={styles.p}>
                  می‌تونی چند مورد رو انتخاب کنی (مثلاً هم همکار باشی هم فرزند مشترک داشته باشی).
                  {"\n"}
                  فقط گزینه‌ی آخر «هیچ‌کدوم…» انحصاریه.
                </Text>

                <View style={[styles.noteCard, { marginTop: 10, borderColor: "rgba(252,165,165,.28)" }]}>
                  <Text style={[styles.noteTitle, { color: "rgba(252,165,165,.95)" }]}>هــــشدار</Text>
                  <Text style={styles.small}>
                    «بهونه‌های احساسی» رو با «اجبار واقعی» قاطی نکن.
                    {"\n"}اگه اینجا اشتباه انتخاب کنی، داری عملاً راه برگشت اون رو باز می‌کنی.
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {OBLIGATION_OPTIONS.map((s) => {
                  const on = obligations.includes(s.key);
                  const danger = !!s.danger;

                  const isNone = s.key === "none_of_above";
                  const iconName = isNone ? (on ? "checkmark-circle" : "ellipse-outline") : on ? "checkbox" : "square-outline";

                  const iconColor = on ? (danger ? "rgba(252,165,165,.95)" : palette.green) : "rgba(231,238,247,.55)";

                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => toggleObligation(s.key)}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        on && (danger ? styles.choiceCardDangerOn : styles.choiceCardOn),
                        danger && styles.choiceCardDanger,
                        isReview && { opacity: 0.7 },
                      ]}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                        <Ionicons name={iconName as any} size={18} color={iconColor} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.choiceText, danger && { color: "rgba(252,165,165,.95)" }]}>{s.title}</Text>
                          <Text style={styles.small}>{s.desc}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {noneSelected ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  این انتخاب یعنی «اجبار واقعی نداری». باید برگردی و مسیر «مجبور نیستم» رو انتخاب کنی.
                </Text>
              ) : null}

              {!step2PickedAnything ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، حداقل یک گزینه رو انتخاب کن.</Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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
                <Text style={styles.h1}>نقش‌ها و کانال ارتباط</Text>
                <Text style={styles.p}>
                  اینجا قرار نیست «رابطه» تعریف کنیم. قراره «فرایند اجرایی» تعریف کنیم:
                  {"\n"}چرا تماس می‌گیریم؟ از چه کانالی؟ درباره‌ی چه چیزهایی؟ و درباره‌ی چه چیزهایی نه؟
                </Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>نقش خودت</Text>
                <TextInput
                  value={myRoleTitle}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setMyRoleTitle(String(t || ""));
                  }}
                  placeholder="مثلاً: والد، همکار، هم‌کلاسی یا مالک مشترک"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputOneLine, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  returnKeyType="done"
                />
                <Text style={styles.small}>{isReview ? "ثبت شده" : "حداقل ۲ حرف"}</Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>نقش او</Text>
                <TextInput
                  value={theirRoleTitle}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setTheirRoleTitle(String(t || ""));
                  }}
                  placeholder="مثلاً: والد، همکار، هم‌کلاسی یا شریک قرارداد"
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputOneLine, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  returnKeyType="done"
                />
                <Text style={styles.small}>{isReview ? "ثبت شده" : "حداقل ۲ حرف"}</Text>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>کانال مجاز ارتباطی</Text>
                <Text style={styles.small}>«کانال غیر احساسی» انتخاب کن. ویس و تماس طولانی، خطرناک‌ترین‌ها هستند.</Text>

                <View style={{ gap: 10, marginTop: 10 }}>
                  {CHANNEL_OPTIONS.map((c) => {
                    const on = channel === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => onPickChannel(c.key)}
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
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{c.title}</Text>
                            <Text style={[styles.small, { flexShrink: 1 }]}>{c.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.noteCard, { marginTop: 10 }]}>
                <Text style={styles.noteTitle}>موضوعات مجاز (خیلی مشخص)</Text>
                <Text style={styles.small}>۳ تا ۵ مورد کوتاه. هر مورد یک خط.</Text>

                <View style={styles.exampleBox}>
                  <Text style={styles.small}>مثال:</Text>
                  <Text style={styles.exampleText}>{"• زمان تحویل بچه\n• هزینه مدرسه\n• زمان جلسه کاری"}</Text>
                </View>

                <TextInput
                  value={allowedTopics}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setAllowedTopics(String(t || ""));
                  }}
                  placeholder={"۳ تا ۵ مورد کوتاه بنویس. هر مورد یک خط."}
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  multiline
                  scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                  underlineColorAndroid="transparent"
                />
              </View>

              <View style={[styles.noteCard, { marginTop: 10, borderColor: "rgba(252,165,165,.18)" }]}>
                <Text style={[styles.noteTitle, { color: "rgba(252,165,165,.95)" }]}>موضوعات ممنوع (خط قرمز)</Text>
                <Text style={styles.small}>اگر این‌ها شروع شد: مکالمه تمام.</Text>

                <View style={[styles.exampleBox, { borderColor: "rgba(252,165,165,.18)" }]}>
                  <Text style={[styles.small, { color: "rgba(252,165,165,.85)" }]}>مثال:</Text>
                  <Text style={[styles.exampleText, { color: "rgba(252,165,165,.90)" }]}>
                    {"• رابطه و گذشته\n• دلتنگی و احساسات\n• مقایسه و سرزنش"}
                  </Text>
                </View>

                <TextInput
                  value={forbiddenTopics}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setForbiddenTopics(String(t || ""));
                  }}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
                    });
                  }}
                  placeholder={"۳ تا ۵ خط قرمز کوتاه بنویس. هر مورد یک خط."}
                  placeholderTextColor="rgba(231,238,247,.35)"
                  style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                  multiline
                  scrollEnabled={Platform.OS === "ios"} // Android jitter fix
                  underlineColorAndroid="transparent"
                />
              </View>

              {!roleOk ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: نقش خودت + نقش او + کانال مجاز باید مشخص شود.</Text>
              ) : !topicsOk ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: موضوعات مجاز و ممنوع را حداقل به شکل کوتاه بنویس.</Text>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(2)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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
                <Text style={styles.h1}>قفل تصمیم</Text>
                <Text style={styles.p}>
                  اگه این سه تعهد قفل نشه، ذهن دلتنگ، توی اولین موج احساسی همه‌چیز رو خراب می‌کنه.
                  {"\n\n"}این تعهدها برای «آدم منطقی امروز»ه، نه «آدم دلتنگ فردا».
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNoEmotionalContact((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, agreeNoEmotionalContact && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNoEmotionalContact ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNoEmotionalContact ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>تعهد می‌دم هیچ تماس احساسی (ویس، دلتنگی، احوالپرسی) وارد این کانال نکنم</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeKeepDryOfficial((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, agreeKeepDryOfficial && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeKeepDryOfficial ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeKeepDryOfficial ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>تعهد می‌دم رابطه «خشک، رسمی و محدود» بمونه حتی اگه اون خواست صمیمی بشه</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setAgreeNoEscapeRearrangeLife((x) => !x);
                  }}
                  disabled={isReview}
                  style={[styles.choiceCard, agreeNoEscapeRearrangeLife && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={agreeNoEscapeRearrangeLife ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={agreeNoEscapeRearrangeLife ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>تعهد می‌دم از «فرار» استفاده نکنم (مثل عوض کردن کار، محله، کلاس اون هم صرفاً برای ندیدنش)</Text>
                  </View>
                </Pressable>

                <View style={[styles.pairCard, { marginTop: 4 }]}>
                  <Text style={styles.pairLabel}>جمع‌بندی:</Text>
                  <Text style={styles.pairText}>
                    • اجبارها: {selectedObligationsTitles.length ? selectedObligationsTitles.join(" + ") : "—"}
                  </Text>
                  <Text style={styles.pairText}>• نقش من: {trimLen(myRoleTitle) ? String(myRoleTitle).trim() : "—"}</Text>
                  <Text style={styles.pairText}>• نقش او: {trimLen(theirRoleTitle) ? String(theirRoleTitle).trim() : "—"}</Text>
                  <Text style={styles.pairText}>• کانال مجاز: {channelTitle}</Text>
                </View>
              </View>

              {!commitOk ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه، هر سه تعهد باید تیک بخوره.</Text> : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!commitOk || saving) && { opacity: 0.45 }]}
                    disabled={!commitOk || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  اینجا «رابطه» تعریف نشد؛ فقط یک «کانال اجرایی» ساخته شد.
                  {"\n\n"}خلاصه:
                  {"\n"}• اجبارها: {selectedObligationsTitles.length ? selectedObligationsTitles.join(" + ") : "—"}
                  {"\n"}• نقش من: {trimLen(myRoleTitle) ? String(myRoleTitle).trim() : "—"}
                  {"\n"}• نقش او: {trimLen(theirRoleTitle) ? String(theirRoleTitle).trim() : "—"}
                  {"\n"}• کانال مجاز: {channelTitle}
                  {"\n\n"}قانون طلایی:
                  {"\n"}حداقلی + رسمی + اجرایی.
                  {"\n"}هر وقت صحبت رفت سمت احساس/گذشته/سرزنش یعنی مکالمه فوری تمام.
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(4)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
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
  reviewBannerText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", flex: 1 },

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

  choiceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  choiceCardOn: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },

  choiceCardDanger: { borderColor: "rgba(252,165,165,.18)", backgroundColor: "rgba(252,165,165,.04)" },
  choiceCardDangerOn: { borderColor: "rgba(252,165,165,.42)", backgroundColor: "rgba(252,165,165,.08)" },

  choiceText: { color: palette.text, fontWeight: "800", fontSize: 13, textAlign: "right", lineHeight: 18, flex: 1 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

  inputOneLine: {
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 20,
    textAlign: "right",
  },

  inputFinal: {
    marginTop: 10,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
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

  exampleBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    alignSelf: "stretch",
  },
  exampleText: {
    marginTop: 8,
    color: "rgba(231,238,247,.82)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    flexShrink: 1,
  },

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