// app/pelekan/bastan/subtask/RC_1_red_flags.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
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
const KEY_RC1 = "pelekan:bastan:subtask:RC_1_red_flags:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const RC1_FLAGS: FlagItem[] = [
  { id: "rc1_01", text: "احساس می‌کردم باید خودم را سانسور کنم تا دعوا نشود." },
  { id: "rc1_02", text: "ناراحتی‌هایم جدی گرفته نمی‌شد یا کوچک شمرده می‌شد." },
  { id: "rc1_03", text: "وقتی اعتراض می‌کردم، متهم می‌شدم که «حساسم» یا «زیادی فکر می‌کنم»." },
  { id: "rc1_04", text: "برای آرام نگه‌داشتن رابطه، از خواسته‌هایم می‌گذشتم." },
  { id: "rc1_05", text: "احساس گناه دائمی بابت ناراحت شدن داشتم." },
  { id: "rc1_06", text: "عذرخواهی‌ها بیشتر از سمت من بود، حتی وقتی مقصر نبودم." },
  { id: "rc1_07", text: "مدام نگران واکنش او به حرف‌ها یا احساساتم بودم." },
  { id: "rc1_08", text: "احساس می‌کردم باید حال او را مدیریت کنم." },
  { id: "rc1_09", text: "بعد از صحبت‌ها، بیشتر گیج می‌شدم تا آرام." },
  { id: "rc1_10", text: "حس می‌کردم «خودِ واقعی‌ام» در رابطه جا ندارد." },
  { id: "rc1_11", text: "تصمیم‌های مهم بیشتر یک‌طرفه گرفته می‌شد." },
  { id: "rc1_12", text: "استقلال من (دوست‌ها، کار، علایق) تهدید تلقی می‌شد." },
  { id: "rc1_13", text: "تماس‌ها یا پیام‌هایم چک می‌شد یا بابتشان بازخواست می‌شدم." },
  { id: "rc1_14", text: "سکوت یا قهر به‌عنوان تنبیه استفاده می‌شد." },
  { id: "rc1_15", text: "احساس می‌کردم باید ثابت کنم «وفادارم»." },
  { id: "rc1_16", text: "تحقیر کلامی، طعنه یا شوخی‌های آزاردهنده وجود داشت." },
  { id: "rc1_17", text: "اختلاف‌ها به تهدید ختم می‌شد (ترک کردن، بی‌محلی، حذف)." },
  { id: "rc1_18", text: "نظر من فقط وقتی پذیرفته می‌شد که مطابق خواست او بود." },
  { id: "rc1_19", text: "احساس می‌کردم قدرت رابطه متوازن نیست." },
  { id: "rc1_20", text: "بیشتر می‌ترسیدم تا احساس امنیت کنم." },
  { id: "rc1_21", text: "خواسته‌ها یا مرزهای جنسی من نادیده گرفته می‌شد." },
  { id: "rc1_22", text: "احساس فشار برای رابطه‌ی جنسی داشتم." },
  { id: "rc1_23", text: "نه گفتن من با دلخوری، قهر یا فاصله پاسخ داده می‌شد." },
  { id: "rc1_24", text: "صمیمیت فقط وقتی بود که او می‌خواست." },
  { id: "rc1_25", text: "بعد از صمیمیت، احساس نزدیکی عاطفی نمی‌کردم." },
  { id: "rc1_26", text: "صمیمیت جای گفت‌وگوهای حل‌نشده را پر می‌کرد." },
  { id: "rc1_27", text: "بدن یا تمایلات من مقایسه می‌شد." },
  { id: "rc1_28", text: "احساس می‌کردم وسیله‌ی حفظ رابطه هستم نه شریک آن." },
  { id: "rc1_29", text: "صمیمیت به ابزار کنترل تبدیل شده بود." },
  { id: "rc1_30", text: "درباره‌ی مسائل جنسی نمی‌توانستم آزادانه حرف بزنم." },
  { id: "rc1_31", text: "مسائل مالی شفاف نبود." },
  { id: "rc1_32", text: "خرج‌ها یا تصمیم‌های مالی پنهان می‌شد." },
  { id: "rc1_33", text: "احساس بدهکاری عاطفی یا مالی داشتم." },
  { id: "rc1_34", text: "قول‌ها داده می‌شد ولی عملی نمی‌شد." },
  { id: "rc1_35", text: "تناقض بین حرف‌ها و رفتارها وجود داشت." },
  { id: "rc1_36", text: "درباره‌ی ارتباط با دیگران شفافیت نبود." },
  { id: "rc1_37", text: "احساس می‌کردم چیزهایی از من پنهان می‌شود." },
  { id: "rc1_38", text: "به حس درونی‌ام اعتماد نداشتم اما آرامش هم نداشتم." },
  { id: "rc1_39", text: "اعتمادم تدریجی فرسوده شد، نه یک‌باره." },
  { id: "rc1_40", text: "بیشتر امیدوار بودم تغییر کند تا اینکه واقعیت را ببینم." },
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
  const params = useLocalSearchParams();
  const subtaskKey = String((params as any)?.key || "").trim();

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

  const openModal = useCallback(
    (cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
      setModal({
        ...cfg,
        visible: true,
      } as any);
    },
    []
  );

  const loadLocal = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_RC1);
    if (!raw) return { loaded: false, savedAt: null as string | null };
    const j = JSON.parse(raw) as RC1Saved;
    if (!j || j.version !== 1) return { loaded: false, savedAt: null as string | null };

    setSelected(Array.isArray(j.selected) ? j.selected : []);
    setTop3(Array.isArray(j.top3) ? j.top3 : []);
    setNotes(j.notes && typeof j.notes === "object" ? j.notes : {});
    return { loaded: true, savedAt: String(j.savedAt || null) };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (subtaskKey !== "RC_1_red_flags") return;

      setBooting(true);
      try {
        const { loaded } = await loadLocal();

        // ✅ اگر داده لوکال هست، ما این رو «مرور» در نظر می‌گیریم
        // (چون بعد از ثبت، داده همیشه روی گوشی هست)
        if (alive) setIsReview(!!loaded);
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
  }, [subtaskKey, loadLocal]);

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
      // @ts-ignore (RN type mismatch in some versions)
      if (typeof task?.cancel === "function") task.cancel();
    };
  }, [step, booting]);

  const persistLocal = useCallback(
    async (next?: Partial<RC1Saved>) => {
      const payload: RC1Saved = {
        version: 1,
        savedAt: new Date().toISOString(),
        selected,
        top3,
        notes,
        ...(next || {}),
      };
      await AsyncStorage.setItem(KEY_RC1, JSON.stringify(payload));
    },
    [notes, selected, top3]
  );

  const toggleSelect = useCallback(
    async (idRaw: string) => {
      if (isReview) return; // ✅ قفل در حالت مرور
      const id = String(idRaw || "").trim();
      if (!id) return;

      const nextSelected = selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id];

      const nextTop3 = top3.filter((x) => nextSelected.includes(x));

      const nextNotes = { ...notes };
      for (const k of top3) {
        if (!nextTop3.includes(k)) delete nextNotes[k];
      }

      setSelected(nextSelected);
      setTop3(nextTop3);
      setNotes(nextNotes);

      await AsyncStorage.setItem(
        KEY_RC1,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          selected: nextSelected,
          top3: nextTop3,
          notes: nextNotes,
        } satisfies RC1Saved)
      );
    },
    [isReview, notes, selected, selectedSet, top3]
  );

  const toggleTop3 = useCallback(
    async (idRaw: string) => {
      if (isReview) return; // ✅ قفل در حالت مرور
      const id = String(idRaw || "").trim();
      if (!id) return;
      if (!selectedSet.has(id)) return;

      let next = [...top3];
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else {
        if (next.length >= 3) return;
        next = [...next, id];
      }

      const nextNotes = { ...notes };
      if (!next.includes(id)) delete nextNotes[id];

      setTop3(next);
      setNotes(nextNotes);
      await persistLocal({ top3: next, notes: nextNotes });
    },
    [isReview, notes, persistLocal, selectedSet, top3]
  );

  const setNote = useCallback(
    async (idRaw: string, v: string) => {
      if (isReview) return; // ✅ قفل در حالت مرور
      const id = String(idRaw || "").trim();
      const txt = String(v || "");
      const next = { ...notes, [id]: txt };
      setNotes(next);
      await persistLocal({ notes: next });
    },
    [isReview, notes, persistLocal]
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
        payload: null,
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
  }, [apiBase, closeModal, openModal, phone, token]);

  const doFinalize = useCallback(async () => {
    if (!notesOk) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) لوکال
      await persistLocal();

      // 2) سرور
      const r = await completeOnServer();
      if (r === "fail") return;

      // ✅ چه ok چه already: نتیجه نهایی یکیه (ثبت شده)
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

      // ok
      openModal({
        kind: "success",
        title: "ثبت شد",
        message: "ثبت انجام شد. از این به بعد امکان تغییر این ریز‌اقدام وجود ندارد.",
        primaryText: "خروج",
        onPrimary: () => {
          closeModal();
          router.back();
        },
      });
    } finally {
      setSaving(false);
      savingRef.current = false;
      // بعد از ثبت، صفحه باید «مرور» شود
      setIsReview(true);
    }
  }, [closeModal, completeOnServer, notesOk, openModal, persistLocal, router]);

  const onFinishPress = useCallback(() => {
    // ✅ در حالت مرور: اصلاً ثبت نکن، فقط خروج
    if (isReview) {
      router.back();
      return;
    }
    // ✅ قبل از ثبت، هشدار غیرقابل‌تغییر شدن
    setConfirmLockModal(true);
  }, [isReview, router]);

  const title = "۴۰ نشانه هشداردهنده رابطه‌ات را تیک بزن";
  const headerNo = subtaskNumberFa(subtaskKey);

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
        contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom }}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.stepPillText}>۲) انتخاب ۳ مورد</Text>
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
              <Text style={styles.h1}>۳ موردی که بیشترین آسیب رو زد</Text>
              <Text style={styles.p}>فقط از میان موارد تیک‌خورده، دقیقاً ۳ مورد رو انتخاب کن.</Text>
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
                برای هر مورد حداقل ۱۶۰ کاراکتر بنویس. تا وقتی هر سه کامل نشه، نمیتونی این اقدام رو ثبت کنی.
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
                      value={val}
                      onChangeText={(t) => setNote(id, t)}
                      placeholder="توضیح بده دقیقاً چه شد، چند بار تکرار شد، و چه اثری روی تو گذاشت…"
                      placeholderTextColor="rgba(231,238,247,.35)"
                      multiline
                      style={[styles.input, isReview && styles.inputReadOnly]}
                      textAlign="right"
                      textAlignVertical="top"
                      editable={!isReview}
                      selectTextOnFocus={!isReview}
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
                  onPress={() => setStep(2)}
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

              {!isReview && !notesOk ? (
                <Text style={styles.warn}>باید برای هر سه مورد حداقل ۱۶۰ کاراکتر بنویسی.</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

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
        message="با زدن «ثبت و پایان»، این ریز‌اقدام قفل میشه و دیگر امکان تغییر انتخاب‌ها و متن‌ها رو نخواهی داشت."
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