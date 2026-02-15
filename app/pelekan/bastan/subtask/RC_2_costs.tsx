// app/pelekan/bastan/subtask/RC_2_costs.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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
  if (k === "RC_2_costs") return "ریز‌اقدام دوم";
  return "ریز‌اقدام";
}

/* ----------------------------- Types ----------------------------- */
type CategoryKey =
  | "time_energy"
  | "peace_focus"
  | "sleep_body"
  | "money_work"
  | "self_esteem"
  | "relationships"
  | "freedom"
  | "growth";

type RC2Saved = {
  version: 1;
  savedAt: string; // ISO
  selectedCategories: CategoryKey[];
  itemsByCat: Record<CategoryKey, string[]>; // max 3 each
};

/* ----------------------------- Storage Keys ----------------------------- */
// ✅ فقط بعد از ثبت نهایی ساخته می‌شود (قبلش هیچ ذخیره‌ای نداریم)
const KEY_RC2_FINAL = "pelekan:bastan:subtask:RC_2_costs:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Data ----------------------------- */
const CATEGORIES: { key: CategoryKey; title: string; hint: string; examples: string }[] = [
  {
    key: "time_energy",
    title: "زمان و انرژی",
    hint: "چیزهای ملموس بنویس",
    examples: "مثال: ساعت‌های از دست رفته، انرژی برای کار و خانواده و خستگی دائمی",
  },
  {
    key: "peace_focus",
    title: "آرامش و تمرکز",
    hint: "نشانه‌های روزمره",
    examples: "مثال: فکر مزاحم، اضطراب، کاهش تمرکز، ناتوانی در تصمیم‌گیری",
  },
  {
    key: "sleep_body",
    title: "خواب و بدن",
    hint: "اثرش روی بدنت بگو",
    examples: "مثال: بی‌خوابی، تپش قلب، سردرد، بی‌اشتهایی یا پرخوری",
  },
  {
    key: "money_work",
    title: "پول و شغل یا تحصیل",
    hint: "واقعی و قابل سنجش",
    examples: "مثال: هزینه‌ها، افت عملکرد کاری یا تحصیلی، از دست دادن فرصت‌ها",
  },
  {
    key: "self_esteem",
    title: "اعتمادبه‌نفس و احساس ارزشمندی",
    hint: "اثر روی تصویر از خود",
    examples: "مثال: احساس کم‌ارزشی، شک داشتن به خودت، شرمندگی، احساس مقایسه شدن و احساس جذاب نبودن",
  },
  {
    key: "relationships",
    title: "روابط دیگر",
    hint: "خانواده یا دوست‌ها",
    examples: "مثال: دور شدن از دوستان، تنش با خانواده و انزوا",
  },
  {
    key: "freedom",
    title: "آزادی و انتخاب",
    hint: "محدودیت‌ها",
    examples: "مثال: کنترل، محدودیت رفت‌وآمد، ترس از بیان نظر",
  },
  {
    key: "growth",
    title: "رشد شخصی",
    hint: "توقف رشد",
    examples: "مثال: ترک علایق، عقب افتادن از هدف‌ها، از دست دادن انگیزه",
  },
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

export default function RC2CostsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const subtaskKey = "RC_2_costs";
  const headerNo = subtaskNumberFa(subtaskKey);
  const title = "این رابطه چه چیزهایی از تو گرفت؟";

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>([]);
  const [itemsByCat, setItemsByCat] = useState<Record<CategoryKey, string[]>>({
    time_energy: ["", "", ""],
    peace_focus: ["", "", ""],
    sleep_body: ["", "", ""],
    money_work: ["", "", ""],
    self_esteem: ["", "", ""],
    relationships: ["", "", ""],
    freedom: ["", "", ""],
    growth: ["", "", ""],
  });

  // ✅ ورود/مرور
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  // ✅ قفل submit
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ✅ اسکرول نرم بعد از تغییر step
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

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false, loading: false }));
  }, []);

  const openModal = useCallback((cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
    setModal({ ...cfg, visible: true } as any);
  }, []);

  // ✅ فقط FINAL را می‌خوانیم (نه draft)
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_RC2_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RC2Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    const sc = Array.isArray(j.selectedCategories) ? (j.selectedCategories as CategoryKey[]) : [];
    const ibc = j.itemsByCat && typeof j.itemsByCat === "object" ? (j.itemsByCat as any) : null;

    setSelectedCategories(sc);

    if (ibc) {
      setItemsByCat((prev) => {
        const next = { ...prev };
        (Object.keys(prev) as CategoryKey[]).forEach((k) => {
          const arr = Array.isArray(ibc[k]) ? ibc[k].map((x: any) => String(x || "")) : ["", "", ""];
          const fixed = [...arr, "", "", ""].slice(0, 3);
          next[k] = fixed;
        });
        return next;
      });
    }

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (alive) {
          setIsReview(!!loaded);
          if (loaded) setStep(3); // ✅ در حالت مرور مستقیم برو به مرحله مرور
        }
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

  const selectedSet = useMemo(() => new Set(selectedCategories), [selectedCategories]);

  const toggleCategory = useCallback(
    (k: CategoryKey) => {
      if (isReview) return;

      const next = selectedSet.has(k) ? selectedCategories.filter((x) => x !== k) : [...selectedCategories, k];

      setSelectedCategories(next);
    },
    [isReview, selectedCategories, selectedSet]
  );

  const setItem = useCallback(
    (cat: CategoryKey, idx: 0 | 1 | 2, v: string) => {
      if (isReview) return;

      const txt = String(v || "");
      setItemsByCat((prev) => {
        const arr = [...(prev[cat] || ["", "", ""])];
        const fixed = [...arr, "", "", ""].slice(0, 3);
        fixed[idx] = txt;
        return { ...prev, [cat]: fixed };
      });
    },
    [isReview]
  );

  const totalFilled = useMemo(() => {
    let n = 0;
    for (const cat of selectedCategories) {
      const arr = itemsByCat[cat] || [];
      for (const s of arr) if (String(s || "").trim().length >= 3) n++;
    }
    return n;
  }, [itemsByCat, selectedCategories]);

  const canGoStep2 = selectedCategories.length >= 2;
  const canGoReview = totalFilled >= 5;

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

    const payloadToSend: RC2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selectedCategories,
      itemsByCat,
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
        subtaskKey: "RC_2_costs",
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
  }, [apiBase, closeModal, itemsByCat, openModal, phone, selectedCategories, token]);

  const persistFinalLocal = useCallback(async () => {
    const payload: RC2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      selectedCategories,
      itemsByCat,
    };
    await AsyncStorage.setItem(KEY_RC2_FINAL, JSON.stringify(payload));
  }, [itemsByCat, selectedCategories]);

  const doFinalize = useCallback(async () => {
    if (!canGoReview) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      const r = await completeOnServer();
      if (r === "fail") return;

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
  }, [canGoReview, closeModal, completeOnServer, openModal, persistFinalLocal, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    if (!canGoReview) return;
    setConfirmLockModal(true);
  }, [canGoReview, isReview, router]);

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

      {/* ✅ مثل RC_3 */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top + 12}
      >
        <ScrollView
          ref={scrollRef}
          style={{ backgroundColor: palette.bg }}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Review Banner */}
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewBannerText}>حالت مرور: این ریز‌اقدام قبلاً ثبت شده و قابل تغییر نیست.</Text>
              </View>
            </View>
          ) : null}

          {/* Step indicator */}
          <View style={styles.stepPills}>
            <View style={[styles.stepPill, step === 0 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۰) شروع</Text>
            </View>
            <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۱) دسته‌ها</Text>
            </View>
            <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۲) نوشتن</Text>
            </View>
            <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>۳) مرور</Text>
            </View>
          </View>

          {/* Step 0 */}
          {step === 0 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>این تمرین برای نفرت نیست</Text>
                <Text style={styles.p}>
                  قرار نیست قضاوت کنی یا خودت رو تحقیر کنی.{"\n"}
                  فقط هزینه‌های واقعی این رابطه رو می‌نویسی تا مغزت «واقعیت کامل» رو ببینه.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>
                  قانون: واقعی، ملموس و کوتاه بنویس و دچار شعار و بزرگ‌نمایی نشو.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setStep(isReview ? 3 : 1)}
                style={[styles.primaryBtn, isReview && { opacity: 0.85 }]}
              >
                <Text style={styles.primaryBtnText}>{isReview ? "مشاهده مرور" : "شروع"}</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Step 1 */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}> در چه زمینه‌هایی این رابطه برای تو مشکل ایجاد کرد؟</Text>
                <Text style={styles.p}>حداقل ۲ دسته رو انتخاب کن.</Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {CATEGORIES.map((c) => {
                  const on = selectedSet.has(c.key);
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => toggleCategory(c.key)}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.choiceText}>{c.title}</Text>
                          <Text style={styles.choiceSub}>{c.examples}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>انتخاب‌شده: {selectedCategories.length} دسته</Text>

                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(0)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoStep2}
                    onPress={() => setStep(2)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoStep2 && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGoStep2 ? <Text style={styles.warn}>حداقل ۲ دسته انتخاب کن.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>کوتاه و واقعی بنویس</Text>
                <Text style={styles.p}>
                  در هر دسته حداکثر سه مورد بنویس.{"\n"}
                  هر مورد یک جمله کوتاه و ملموس.
                </Text>
                <Text style={[styles.small, { marginTop: 8 }]}>حداقل پنج مورد در مجموع لازمه تا بتونی به مرحله بعد بری.</Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {selectedCategories.map((cat) => {
                  const meta = CATEGORIES.find((x) => x.key === cat)!;
                  const arr = itemsByCat[cat] || ["", "", ""];
                  const a0 = String(arr[0] || "");
                  const a1 = String(arr[1] || "");
                  const a2 = String(arr[2] || "");

                  return (
                    <View key={cat} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>{meta.title}</Text>
                      <Text style={styles.noteHint}>{meta.examples}</Text>

                      <TextInput
                        value={a0}
                        onChangeText={(t) => setItem(cat, 0, t)}
                        placeholder="مورد ۱…"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <TextInput
                        value={a1}
                        onChangeText={(t) => setItem(cat, 1, t)}
                        placeholder="مورد ۲…"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <TextInput
                        value={a2}
                        onChangeText={(t) => setItem(cat, 2, t)}
                        placeholder="مورد ۳…"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputOne, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />

                      <Text style={styles.small}>حداکثر ۳ مورد</Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Text style={styles.small}>موردهای نوشته‌شده: {totalFilled}</Text>

                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!canGoReview}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !canGoReview && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>مرور</Text>
                  </TouchableOpacity>
                </View>

                {!canGoReview ? <Text style={styles.warn}>برای ادامه باید حداقل ۵ مورد واقعی بنویسی.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 3 */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>مرور واقع‌بینانه</Text>
                <Text style={styles.p}>
                  این‌ها هزینه‌های واقعی این رابطه است.{"\n"}
                  اگر آماده‌ای، ثبت کن و این ریز‌اقدام قفل می‌شود.
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {selectedCategories.map((cat) => {
                  const meta = CATEGORIES.find((x) => x.key === cat)!;
                  const arr = (itemsByCat[cat] || []).map((x) => String(x || "").trim()).filter((x) => x.length >= 3);
                  if (arr.length === 0) return null;

                  return (
                    <View key={cat} style={styles.reviewCard}>
                      <Text style={styles.reviewTitle}>{meta.title}</Text>
                      {arr.map((t, i) => (
                        <View key={i} style={styles.bulletRow}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.bulletText}>{t}</Text>
                        </View>
                      ))}
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
                    disabled={(!isReview && !canGoReview) || saving}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, ((!isReview && !canGoReview) || saving) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canGoReview ? <Text style={styles.warn}>هنوز برای ثبت آماده نیستی.</Text> : null}
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
        message="با زدن «ثبت و پایان»، این ریز‌اقدام قفل میشه و دیگه امکان تغییر نوشته‌ها رو نخواهی داشت."
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
  choiceText: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },
  choiceSub: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right", marginTop: 6, lineHeight: 16 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },
  noteHint: { color: "rgba(231,238,247,.72)", marginTop: 8, fontSize: 11, textAlign: "right", lineHeight: 16 },

  inputOne: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 18,
    textAlign: "right",
  },
  inputReadOnly: {
    backgroundColor: "rgba(0,0,0,.12)",
    borderColor: "rgba(255,255,255,.08)",
  },

  reviewCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  reviewTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", marginBottom: 8 },
  bulletRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  bullet: { color: "rgba(231,238,247,.85)", fontSize: 14, lineHeight: 18 },
  bulletText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", flex: 1, lineHeight: 18 },

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