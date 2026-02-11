// app/pelekan/bastan/subtask/RC_1_red_flags.tsx
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
  if (k === "RC_1_red_flags") return "ریز‌اقدام اول";
  return "ریز‌اقدام";
}

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

/* ----------------------------- Types ----------------------------- */
type RC1Saved = {
  version: 1;
  savedAt: string; // ISO
  selected: string[];
  top3: string[];
  notes: Record<string, string>;
};

type FlagItem = { id: string; text: string };

/* ----------------------------- Storage Keys ----------------------------- */
// ✅ فقط بعد از ثبت نهایی ساخته می‌شود (قبلش هیچ ذخیره‌ای نداریم)
const KEY_RC1_FINAL = "pelekan:bastan:subtask:RC_1_red_flags:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const RC1_FLAGS: FlagItem[] = [
  { id: "rc1_01", text: "احساس می‌کردم باید خودم رو سانسور کنم تا دعوا نشه." },
  { id: "rc1_02", text: "ناراحتی‌هام جدی گرفته نمی‌شد یا کوچیک شمرده می‌شد." },
  { id: "rc1_03", text: "وقتی اعتراض می‌کردم، متهم می‌شدم که «حساسم» یا «زیادی فکر می‌کنم»." },
  { id: "rc1_04", text: "برای آروم نگه‌داشتن رابطه، از خواسته‌هام می‌گذشتم." },
  { id: "rc1_05", text: "احساس گناه دائمی بابت ناراحت شدن داشتم." },
  { id: "rc1_06", text: "عذرخواهی‌ها بیشتر از سمت من بود، حتی وقتی مقصر نبودم." },
  { id: "rc1_07", text: "مدام نگران واکنش اون به حرف‌ها یا احساساتم بودم." },
  { id: "rc1_08", text: "احساس می‌کردم باید حالش رو مدیریت کنم." },
  { id: "rc1_09", text: "بعد از صحبت‌ کردن باهاش، بیشتر گیج می‌شدم تا آروم." },
  { id: "rc1_10", text: "حس می‌کردم «خودِ واقعیم» توو رابطه جا نداره." },
  { id: "rc1_11", text: "تصمیم‌های مهم بیشتر یک‌طرفه گرفته می‌شد." },
  { id: "rc1_12", text: "استقلال من (مثل دوست‌هام، کارم و علایقم) تهدید تلقی می‌شد." },
  { id: "rc1_13", text: "تماس‌ها یا پیام‌هام چک می‌شد یا بابتشون بازخواست می‌شدم." },
  { id: "rc1_14", text: "سکوت یا قهر به‌عنوان تنبیه استفاده می‌شد." },
  { id: "rc1_15", text: "احساس می‌کردم باید ثابت کنم «وفادارم»." },
  { id: "rc1_16", text: "تحقیر کلامی، طعنه یا شوخی‌های آزاردهنده وجود داشت." },
  { id: "rc1_17", text: "اختلاف‌ها به تهدید ختم می‌شد (مثل ترک کردن، بی‌محلی و حذف)." },
  { id: "rc1_18", text: "نظر من فقط وقتی پذیرفته می‌شد که مطابق خواستش بود." },
  { id: "rc1_19", text: "احساس می‌کردم قدرت رابطه متوازن نیست." },
  { id: "rc1_20", text: "داخل رابطه بیشتر می‌ترسیدم تا احساس امنیت کنم." },
  { id: "rc1_21", text: "خواسته‌ها یا مرزهای جنسی من نادیده گرفته می‌شد." },
  { id: "rc1_22", text: "احساس فشار برای رابطه‌ی جنسی داشتم." },
  { id: "rc1_23", text: "نه گفتن من با دلخوری، قهر یا فاصله پاسخ داده می‌شد." },
  { id: "rc1_24", text: "صمیمیت فقط وقتی بود که اون می‌خواست." },
  { id: "rc1_25", text: "بعد از رابطه جنسی و صمیمیت زیاد، احساس نزدیکی عاطفی نمی‌کردم." },
  { id: "rc1_26", text: "رابطه جنسی جای گفت‌وگوهای حل‌نشده رو پر می‌کرد." },
  { id: "rc1_27", text: "بدن یا تمایلات من با دیگران مقایسه می‌شد." },
  { id: "rc1_28", text: "احساس می‌کردم وسیله‌ی حفظ رابطه هستم نه شریکش." },
  { id: "rc1_29", text: "صمیمیت به ابزار کنترل تبدیل شده بود." },
  { id: "rc1_30", text: "درباره‌ی مسائل جنسی نمی‌تونستم آزادانه حرف بزنم." },
  { id: "rc1_31", text: "مسائل مالی شفاف نبود." },
  { id: "rc1_32", text: "خرج‌ها یا تصمیم‌های مالی پنهون می‌شد." },
  { id: "rc1_33", text: "احساس بدهکاری عاطفی یا مالی بهش داشتم." },
  { id: "rc1_34", text: "قول‌های زیادی داده می‌شد ولی عملی نمی‌شد." },
  { id: "rc1_35", text: "تناقض بین حرف‌ها و رفتارها وجود داشت." },
  { id: "rc1_36", text: "درباره‌ی ارتباط با دیگران شفافیت نداشت." },
  { id: "rc1_37", text: "احساس می‌کردم چیزهایی از من پنهون میشه." },
  { id: "rc1_38", text: "به حس درونیم اعتماد نداشتم اما آرامش هم نداشتم." },
  { id: "rc1_39", text: "اعتمادم تدریجی فرسوده شد، نه یک‌باره." },
  { id: "rc1_40", text: "بیشتر امیدوار بودم تغییر کنه تا اینکه واقعیت رو ببینم." },
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

export default function RC1RedFlagsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams(); // فقط برای اینکه اگر جایی route params عوض شد، رندر پایدار باشد

  const subtaskKey = "RC_1_red_flags";
  const headerNo = subtaskNumberFa(subtaskKey);

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selected, setSelected] = useState<string[]>([]);
  const [top3, setTop3] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // ✅ ورود/مرور
  const [booting, setBooting] = useState(false);

  // ✅ حالت مرور (وقتی قبلاً ثبت شده)
  const [isReview, setIsReview] = useState(false);

  // ✅ قفل submit
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ✅ اسکرول نرم بعد از تغییر step (بیس استاندارد)
  const scrollRef = useRef<ScrollView>(null);

  // ✅ برای جلوگیری از رفتن باکس زیر کیبورد: اسکرول به ورودی فعال (ref نیتیو)
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  // ✅ مودال‌ها
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

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false, loading: false }));
  }, []);

  const openModal = useCallback((cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
    setModal({ ...cfg, visible: true } as any);
  }, []);

  // ✅ فقط FINAL را می‌خوانیم
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_RC1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RC1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setSelected(Array.isArray(j.selected) ? j.selected : []);
    setTop3(Array.isArray(j.top3) ? j.top3 : []);
    setNotes(j.notes && typeof j.notes === "object" ? j.notes : {});
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
        // ✅ اگر مرور است، برو مرحله 3 تا متن‌ها جلوی چشم باشد
        if (loaded) setStep(3);
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

  // ✅ اسکرول نرم و بدون پرش بعد از تغییر step
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

  // ✅ وقتی یک input فوکوس شد، بدون measureLayout ببریمش بالا که زیر کیبورد نره
  const scrollToInput = useCallback(
    (id: string, extraOffset = 22) => {
      const input = inputRefs.current[id] as any;
      const scroll = scrollRef.current as any;
      if (!input || !scroll) return;

      const node = findNodeHandle(input);
      if (!node) return;

      const responder = scroll.getScrollResponder?.();
      responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
    },
    []
  );

  /* ----------------------------- Helpers ----------------------------- */
  const toggleSelect = useCallback(
    (idRaw: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      if (!id) return;

      const nextSelected = selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id];

      // top3 باید زیرمجموعه selected بماند
      const nextTop3 = top3.filter((x) => nextSelected.includes(x));

      // notes فقط برای top3 نگه داشته شود
      const nextNotes: Record<string, string> = {};
      for (const k of Object.keys(notes || {})) {
        if (nextTop3.includes(k)) nextNotes[k] = String((notes as any)[k] || "");
      }

      setSelected(nextSelected);
      setTop3(nextTop3);
      setNotes(nextNotes);
      // ❌ هیچ ذخیره‌ای تا مرحله آخر
    },
    [isReview, notes, selected, selectedSet, top3]
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

      const nextNotes = { ...(notes || {}) };
      if (!next.includes(id)) delete nextNotes[id];

      setTop3(next);
      setNotes(nextNotes);
      // ❌ هیچ ذخیره‌ای تا مرحله آخر
    },
    [isReview, notes, selectedSet, top3]
  );

  const setNote = useCallback(
    (idRaw: string, v: string) => {
      if (isReview) return;
      const id = String(idRaw || "").trim();
      const txt = String(v || "");
      setNotes((prev) => ({ ...(prev || {}), [id]: txt }));
      // ❌ هیچ ذخیره‌ای تا مرحله آخر
    },
    [isReview]
  );

  const canGoStep2 = selected.length >= 3;
  const canGoStep3 = top3.length === 3;

  const notesOk = useMemo(() => {
    if (top3.length !== 3) return false;
    for (const id of top3) {
      const n = String(notes[id] || "").trim();
      if (n.length < 160) return false;
    }
    return true;
  }, [notes, top3]);

  const persistFinalLocal = useCallback(async () => {
    const payload: RC1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selected,
      top3,
      notes,
    };
    await AsyncStorage.setItem(KEY_RC1_FINAL, JSON.stringify(payload));
  }, [notes, selected, top3]);

  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام‌شدن باید وارد حساب باشی.",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    // ✅ فقط در ثبت نهایی، payload واقعی بفرست
    const payloadToSend: RC1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selected,
      top3,
      notes,
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
        subtaskKey: "RC_1_red_flags",
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
      message: faOnlyTitle(err || "مشکلی پیش آمد. دوباره تلاش کن."),
      primaryText: "باشه",
      onPrimary: closeModal,
    });
    return "fail";
  }, [apiBase, closeModal, notes, openModal, phone, selected, token, top3]);

  const doFinalize = useCallback(async () => {
    if (!notesOk) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) سرور
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) لوکال (فقط بعد از ok/already) — مشکل «سیو نشدن روی گوشی» همینجا حل میشه
      await persistFinalLocal();

      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلاً ثبت شده",
          message: "این ریز‌اقدام قبلاً ثبت شده و نیازی به ثبت دوباره نیست.",
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
        message: "ثبت انجام شد. از این به بعد امکان تغییر این ریز‌اقدام وجود نداره.",
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
  }, [closeModal, completeOnServer, notesOk, openModal, persistFinalLocal, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  const title = " نشونه‌های هشداردهنده رابطت رو تیک بزن";

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
          {/* Review Banner */}
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور: این ریز‌اقدام قبلاً ثبت شده و قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {/* Step indicator */}
          <View style={styles.stepPills}>
            <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۱) انتخاب</Text>
            </View>
            <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۲) انتخاب سه مورد</Text>
            </View>
            <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۳) نوشتن</Text>
            </View>
          </View>

          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>اون چیزی که دیدی رو انکار نکن</Text>
                <Text style={styles.p}>
                  هر موردی که در رابطت بوده رو تیک بزن.{"\n"}این‌ها فقط داخل گوشی خودت ذخیره میشن.{"\n"}
                  برای رفتن به مرحله بعد، حداقل ۳ مورد رو انتخاب کن.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {RC1_FLAGS.map((it) => {
                  const on = selectedSet.has(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleSelect(it.id)}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{it.text}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب‌شده: {selected.length} مورد</Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGoStep2}
                  onPress={() => setStep(2)}
                  style={[styles.primaryBtn, !canGoStep2 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>ادامه</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>سه موردی که بیشترین آسیب رو زد</Text>
                <Text style={styles.p}> از میان موارد تیک‌خورده، سه مورد رو انتخاب کن.</Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {selected.map((id) => {
                  const it = RC1_FLAGS.find((x) => x.id === id);
                  if (!it) return null;
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
                        <Text style={styles.choiceText}>{it.text}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب‌شده برای مرحله بعد: {top3.length}/3</Text>

                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoStep3}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoStep3 && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>هر سه رو به شکل واقعی بررسی کن</Text>
                <Text style={styles.p}>
                  هر مورد رو در چند جمله توضیح بده.{"\n"} تا وقتی هر سه کامل نشه، نمیتونی این اقدام رو ثبت کنی.
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {top3.map((id, idx) => {
                  const it = RC1_FLAGS.find((x) => x.id === id);
                  const val = String(notes[id] || "");
                  const len = val.trim().length;

                  return (
                    <View key={id} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>
                        {idx + 1}) {it?.text || id}
                      </Text>

                      <TextInput
                        ref={(r) => {
                          inputRefs.current[id] = r;
                        }}
                        value={val}
                        onChangeText={(t) => setNote(id, t)}
                        onFocus={() => {
                          // کمی تأخیر تا کیبورد بالا بیاید بعد اسکرول کنیم
                          setTimeout(() => scrollToInput(id, 22), 60);
                        }}
                        placeholder="توضیح بده دقیقاً چه شد، چند بار تکرار شد، و چه اثری روی تو گذاشت…"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        blurOnSubmit={false}
                      />

                      <Text style={[styles.small, !isReview && len < 160 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${len}/160`}
                      </Text>
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
                    disabled={(!isReview && !notesOk) || saving}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, ((!isReview && !notesOk) || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !notesOk ? <Text style={styles.warn}>باید برای هر سه مورد حداقل ۱۶۰ کاراکتر بنویسی.</Text> : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ لودینگ ورود */}
      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال بارگذاری اطلاعات ذخیره‌شده…</Text>
          </View>
        </View>
      ) : null}

      {/* ✅ مودال هشدار قبل از قفل شدن */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت، این رو بدون"
        message="با زدن «ثبت و پایان»، این ریز‌اقدام قفل میشه و دیگه امکان تغییر انتخاب‌ها و متن‌ها رو نخواهی داشت."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلاً نه"
        loading={saving}
        onPrimary={() => {
          setConfirmLockModal(false);
          doFinalize();
        }}
        onSecondary={() => setConfirmLockModal(false)}
      />

      {/* ✅ مودال‌های تم برای خطا/موفقیت/اطلاع */}
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
    minHeight: 110,
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