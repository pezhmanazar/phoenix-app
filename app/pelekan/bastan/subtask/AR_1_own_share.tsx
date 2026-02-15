// app/pelekan/bastan/subtask/AR_1_own_share.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
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
  UIManager,
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
  if (k === "AR_1_own_share") return "ریز اقدام اول";
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
type ShareItemDraft = {
  id: string;
  label: string;
  intent: string;
  result: string;
};

type ShareItemFinal = {
  id: string;
  label: string;
  intent: string;
  result: string;
  nextTime: string;
};

type RCAr1Saved = {
  version: 1;
  savedAt: string;
  selectedBehaviors: string[]; // ids
  details: Record<string, { intent: string; result: string }>;
  top3: string[]; // ids
  nextTime: Record<string, string>; // id -> text
  finalConfirm: boolean;
};

/* ----------------------------- Storage Keys ----------------------------- */
const KEY_AR1_FINAL = "pelekan:bastan:subtask:AR_1_own_share:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const BEHAVIORS: { id: string; label: string }[] = [
  { id: "ar1_b1", label: "موندم وقتی باید می رفتم" },
  { id: "ar1_b2", label: "حرف نزدم وقتی باید مرز می‌ذاشتم" },
  { id: "ar1_b3", label: "واقعیت رو توجیه کردم وقتی باید اونو می‌دیدم" },
  { id: "ar1_b4", label: "نیازم رو نگفتم و انتظار داشتم خودش بفهمه" },
  { id: "ar1_b5", label: "از ترس دعوا، کوتاه اومدم" },
  { id: "ar1_b6", label: "حد و مرز رو چند بار شکستم" },
  { id: "ar1_b7", label: "با امید تغییرش فرصت های زیادی بهش دادم" },
  { id: "ar1_b8", label: "نشونه‌ها رو کوچیک کردم تا آروم بشم" },
  { id: "ar1_b9", label: "وقتی ناراحت بودم واکنش تند نشون دادم" },
  { id: "ar1_b10", label: "وقتی دیدم اذیت میشم باز هم ادامه دادم" },
  { id: "ar1_b11", label: "مرز گذاشتم ولی پای مرزم نایستادم" },
  { id: "ar1_b12", label: "برای حفظ رابطه، خودم رو نادیده گرفتم" },
  { id: "ar1_b13", label: "به جای دیدن واقعیت، به خاطره‌های خوب چسبیدم" },
  { id: "ar1_b14", label: "مشکل رو گردن شرایط انداختم نه انتخاب‌هام" },
  { id: "ar1_b15", label: "هشدار دیگران رو جدی نگرفتم" },
  { id: "ar1_b16", label: "فکر کردم عشق یعنی تحمل" },
  { id: "ar1_b17", label: "ترس از تنها شدن تصمیم‌هام رو کنترل کرد" },
  { id: "ar1_b18", label: "وقتی ناراحت بودم، احساساتم رو قورت دادم" },
  { id: "ar1_b19", label: "مسئله‌ها رو عقب انداختم به امید اینکه خودبه‌خود حل بشن" },
  { id: "ar1_b20", label: "وقتی باید تصمیم می‌گرفتم، صبر بی‌جا کردم" },
  { id: "ar1_b21", label: "فکر می‌کردم عشق واقعی بالاخره مشکلاتش تموم میشه" },
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
export default function AR1OwnShareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const subtaskKey = "AR_1_own_share";
  const headerNo = subtaskNumberFa(subtaskKey);

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // مرحله 1
  const [agreeNoTrial, setAgreeNoTrial] = useState(false);

  // مرحله 2
  const [selected, setSelected] = useState<string[]>([]);

  // مرحله 3
  const [details, setDetails] = useState<Record<string, { intent: string; result: string }>>({});

  // مرحله 4
  const [top3, setTop3] = useState<string[]>([]);

  // مرحله 5
  const [nextTime, setNextTime] = useState<Record<string, string>>({});
  const [finalConfirm, setFinalConfirm] = useState(false);

  // مودال ها
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

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_AR1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RCAr1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAgreeNoTrial(true);
    setSelected(Array.isArray(j.selectedBehaviors) ? j.selectedBehaviors : []);
    setDetails(j.details && typeof j.details === "object" ? j.details : {});
    setTop3(Array.isArray(j.top3) ? j.top3 : []);
    setNextTime(j.nextTime && typeof j.nextTime === "object" ? j.nextTime : {});
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

 /* ----------------------------- Scroll to input (keyboard safe) ----------------------------- */
const scrollToInput = useCallback((id: string, extraOffset = 22) => {
  const input = inputRefs.current[id] as any;
  const scroll = scrollRef.current as any;
  if (!input || !scroll) return;

  const doScroll = () => {
    const responder = scroll.getScrollResponder?.();

    const innerMaybe =
      responder?.getInnerViewNode?.() ??
      responder?.getScrollableNode?.() ??
      findNodeHandle(scroll);

    const innerNode = typeof innerMaybe === "number" ? innerMaybe : findNodeHandle(innerMaybe);
    const inputNode = findNodeHandle(input);

    if (!innerNode || !inputNode) return;

    UIManager.measureLayout(
      inputNode,
      innerNode,
      () => {},
      (_x, y) => {
        const targetY = Math.max(0, y - extraOffset);
        scroll.scrollTo?.({ y: targetY, animated: true });
      }
    );
  };

  // 1) فوری (اگر کیبورد از قبل بازه)
  requestAnimationFrame(doScroll);

  // 2) دوباره بعد از بالا آمدن کیبورد (اندروید)
  setTimeout(doScroll, 220);
}, []);

  /* ----------------------------- Helpers ----------------------------- */
  const toggleBehavior = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      if (!id) return;

      const nextSelected = selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id];

      // details فقط برای موارد انتخاب شده بماند
      const nextDetails: Record<string, { intent: string; result: string }> = {};
      for (const k of Object.keys(details || {})) {
        if (nextSelected.includes(k)) nextDetails[k] = details[k];
      }

      // top3 باید زیر مجموعه selected بماند
      const nextTop3 = top3.filter((x) => nextSelected.includes(x));

      // nextTime فقط برای top3 بماند
      const nextNT: Record<string, string> = {};
      for (const k of Object.keys(nextTime || {})) {
        if (nextTop3.includes(k)) nextNT[k] = String(nextTime[k] || "");
      }

      setSelected(nextSelected);
      setDetails(nextDetails);
      setTop3(nextTop3);
      setNextTime(nextNT);
    },
    [details, isReview, nextTime, selected, selectedSet, top3]
  );

  const setIntent = useCallback(
    (idRaw: string, v: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      setDetails((prev) => ({
        ...(prev || {}),
        [id]: { intent: String(v || ""), result: String(prev?.[id]?.result || "") },
      }));
    },
    [isReview]
  );

  const setResult = useCallback(
    (idRaw: string, v: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      setDetails((prev) => ({
        ...(prev || {}),
        [id]: { intent: String(prev?.[id]?.intent || ""), result: String(v || "") },
      }));
    },
    [isReview]
  );

  const toggleTop3 = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      if (!id) return;
      if (!selectedSet.has(id)) return;

      let next = [...top3];
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else {
        if (next.length >= 3) return;
        next = [...next, id];
      }

      const nt: Record<string, string> = { ...(nextTime || {}) };
      for (const k of Object.keys(nt)) {
        if (!next.includes(k)) delete nt[k];
      }

      setTop3(next);
      setNextTime(nt);
    },
    [isReview, nextTime, selectedSet, top3]
  );

  const setNextTimeText = useCallback(
    (idRaw: string, v: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      setNextTime((prev) => ({ ...(prev || {}), [id]: String(v || "") }));
    },
    [isReview]
  );

  /* ----------------------------- Validation ----------------------------- */
  const canGo2 = agreeNoTrial;

  const canGo3 = selected.length >= 3; // برای جلوگیری از گیر دادن ذهن روی یکی دو مورد

  const detailsOk = useMemo(() => {
    if (selected.length < 3) return false;
    for (const id of selected) {
      const d = details[id];
      const a = String(d?.intent || "").trim();
      const b = String(d?.result || "").trim();
      if (a.length < 40) return false;
      if (b.length < 40) return false;
    }
    return true;
  }, [details, selected]);

  const canGo4 = detailsOk;

  const top3Ok = top3.length === 3;

  const step5Ok = useMemo(() => {
    if (!top3Ok) return false;
    for (const id of top3) {
      const txt = String(nextTime[id] || "").trim();
      if (txt.length < 70) return false;
    }
    if (!finalConfirm) return false;
    return true;
  }, [finalConfirm, nextTime, top3, top3Ok]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: RCAr1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selectedBehaviors: selected,
      details,
      top3,
      nextTime,
      finalConfirm,
    };
    await AsyncStorage.setItem(KEY_AR1_FINAL, JSON.stringify(payload));
  }, [details, finalConfirm, nextTime, selected, top3]);

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

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    // payload نهایی
    const finalItems: ShareItemFinal[] = top3.map((id) => {
      const label = BEHAVIORS.find((x) => x.id === id)?.label || id;
      const intent = String(details[id]?.intent || "");
      const result = String(details[id]?.result || "");
      const nt = String(nextTime[id] || "");
      return { id, label, intent, result, nextTime: nt };
    });

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        victimToAgent: true,
        top3Count: 3,
      },
      items: finalItems,
      selectedCount: selected.length,
      finalConfirm,
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
        subtaskKey: "AR_1_own_share",
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
  }, [apiBase, closeModal, details, finalConfirm, nextTime, openModal, phone, selected.length, token, top3]);

  const doFinalize = useCallback(async () => {
    if (!step5Ok) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) server
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) local
      await persistFinalLocal();
      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

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
  }, [closeModal, completeOnServer, openModal, persistFinalLocal, router, step5Ok]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  const title = "سهم من";

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
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵</Text>
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
      <Text style={styles.h1}>خروج از حالت دفاعی</Text>
      <Text style={styles.p}>
        اینجا قرار نیست محاکمه بشی
        {"\n"}قرار نیست بگی من بد بودم
        {"\n"}قرار نیست بگی همه تقصیرها برای من بود
        {"\n"}
        {"\n"}این ریز اقدام برای اینه که از نقش قربانی بیرون بیایی
        {"\n"}و سهم‌های قابل کنترل خودت رو ببینی
        {"\n"}نه برای زدن خودت بلکه برای شناختن خودت
        {"\n"}
      </Text>

      <Pressable
        onPress={() => {
          if (isReview) return;
          setAgreeNoTrial((x) => !x);
        }}
        style={[
          styles.choiceCard,
          agreeNoTrial && styles.choiceCardOn,
          isReview && { opacity: 0.7 },
        ]}
        disabled={isReview}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons
            name={agreeNoTrial ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={agreeNoTrial ? palette.green : "rgba(231,238,247,.55)"}
          />
          <Text style={styles.choiceText}>قول میدم خودم رو سرزنش نکنم</Text>
        </View>
      </Pressable>

      {/* ✅ فاصله ثابت بین چک و دکمه */}
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
                <Text style={styles.h1}>رفتارهای قابل کنترل من</Text>
                <Text style={styles.p}>
                  از بین رفتارهای پایین انتخاب کن
                  {"\n"} کدوم رو داخل رابطه انجام دادی
                  {"\n"} خودت رو تخریب و قضاوت نکن
                  {"\n"} چون اون لحظه فکر میکردی کار درست رو انجام میدی
                  {"\n"}
                  {"\n"}حداقل سه مورد رو انتخاب کن
                  
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {BEHAVIORS.map((it) => {
                  const on = selectedSet.has(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleBehavior(it.id)}
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
                <Text style={styles.small}>انتخاب شده: {selected.length}</Text>

                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(1)}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGo3}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGo3 && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo3 ? <Text style={styles.warn}>حداقل سه مورد لازم است</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>نیت رو از نتیجه جدا کن</Text>
                <Text style={styles.p}>
                  این مرحله جلوی خودزنی رو می‌گیره
                  {"\n"}نیتت میتونه سالم باشه
                  {"\n"}ولی نتیجه میتونه آسیب زا باشه
                  {"\n"}
                  {"\n"}برای هر مورد دو بخش بنویس
                  
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {selected.map((id) => {
                  const label = BEHAVIORS.find((x) => x.id === id)?.label || id;
                  const intent = String(details[id]?.intent || "");
                  const result = String(details[id]?.result || "");
                  const lenA = intent.trim().length;
                  const lenB = result.trim().length;

                  const keyIntent = `${id}:intent`;
                  const keyResult = `${id}:result`;

                  return (
                    <View key={id} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>{label}</Text>

                      <Text style={styles.small}>نیت من چی بود؟</Text>
                      <TextInput
                        ref={(r) => {
                          inputRefs.current[keyIntent] = r;
                        }}
                        value={intent}
                        onChangeText={(t) => setIntent(id, t)}
                        onFocus={() => setTimeout(() => scrollToInput(keyIntent, 22), 60)}
                        placeholder="مثلا می خواستم رابطه رو نگه دارم یا اینکه میخواستم دعوا نشه"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        blurOnSubmit={false}
                      />
                      {!isReview ? (
                        <Text style={[styles.small, lenA < 40 ? { color: palette.red } : null]}>{lenA}/40</Text>
                      ) : (
                        <Text style={styles.small}>ثبت شده</Text>
                      )}

                      <View style={{ height: 10 }} />

                      <Text style={styles.small}>نتیجه چی شد؟</Text>
                      <TextInput
                        ref={(r) => {
                          inputRefs.current[keyResult] = r;
                        }}
                        value={result}
                        onChangeText={(t) => setResult(id, t)}
                        onFocus={() => setTimeout(() => scrollToInput(keyResult, 22), 60)}
                        placeholder="مثلا هیچ اتفاقی نیفتاد و شرایط بدتر شد"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        blurOnSubmit={false}
                      />
                      {!isReview ? (
                        <Text style={[styles.small, lenB < 40 ? { color: palette.red } : null]}>{lenB}/40</Text>
                      ) : (
                        <Text style={styles.small}>ثبت شده</Text>
                      )}
                    </View>
                  );
                })}
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

                {!canGo4 ? <Text style={styles.warn}>برای همه موارد نیت و نتیجه رو کامل بنویس</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>انتخاب سه مورد</Text>
                <Text style={styles.p}>
                  اینجا باید ذهن رو محدود کنیم
                  {"\n"}سه موردی رو انتخاب کن که اگر تغییر کنه
                  {"\n"}آیندت عوض میشه
                  {"\n"}اگه کلا سه مورده همون‌ سه مورد رو انتخاب کن
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {selected.map((id) => {
                  const label = BEHAVIORS.find((x) => x.id === id)?.label || id;
                  const on = top3.includes(id);

                  return (
                    <Pressable
                      key={id}
                      onPress={() => toggleTop3(id)}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب شده: {top3.length}/3</Text>

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
                    disabled={!top3Ok || saving}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!top3Ok || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!top3Ok ? <Text style={styles.warn}>باید دقیقا سه مورد انتخاب بشه</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}> تبدیل سهم به آگاهی</Text>
                <Text style={styles.p}>
                  اینجا سهم تو، یعنی اطلاعات ارزشمند برای آینده
                  {"\n"}نه چوب برای زدن خودت
                  {"\n"}
                  {"\n"}برای هر سه مورد بنویس دفعه بعد چیکار می‌کنی؟
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {top3.map((id, idx) => {
                  const label = BEHAVIORS.find((x) => x.id === id)?.label || id;
                  const nt = String(nextTime[id] || "");
                  const len = nt.trim().length;
                  const keyNT = `${id}:next`;

                  return (
                    <View key={id} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>
                        {idx + 1}) {label}
                      </Text>

                      <TextInput
                        ref={(r) => {
                          inputRefs.current[keyNT] = r;
                        }}
                        value={nt}
                        onChangeText={(t) => setNextTimeText(id, t)}
                        onFocus={() => setTimeout(() => scrollToInput(keyNT, 22), 60)}
                        placeholder="مثلا اگر دوباره همون حس اومد مرز میذارم و از ترس کوتاه نمیام"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        blurOnSubmit={false}
                      />

                      <Text style={[styles.small, !isReview && len < 70 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/70`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    if (isReview) return;
                    setFinalConfirm((x) => !x);
                  }}
                  style={[
                    styles.choiceCard,
                    finalConfirm && styles.choiceCardOn,
                    isReview && { opacity: 0.7 },
                  ]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={finalConfirm ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={finalConfirm ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>سهم خودم رو داخل این رابطه می‌پذیرم و از اون برای آینده درس می‌گیرم</Text>
                  </View>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(4);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={(!isReview && !step5Ok) || saving}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, ((!isReview && !step5Ok) || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !step5Ok ? (
                  <Text style={styles.warn}>سه متن باید کامل باشد و تایید آخر هم باید زده شود</Text>
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
        title="قبل از ثبت این را بدان"
        message="بعد از ثبت دیگر امکان تغییر وجود ندارد"
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