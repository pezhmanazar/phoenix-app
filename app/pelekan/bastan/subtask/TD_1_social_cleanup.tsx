// app/pelekan/bastan/subtask/TD_1_social_cleanup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, InteractionManager, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  if (k === "TD_1_social_cleanup") return "ریز اقدام اول";
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
type ModalKind = "info" | "warn" | "error" | "success";

type TD1Saved = {
  version: 1;
  savedAt: string;
  acceptedWhy: boolean;
  checkedIds: string[];
  total: number;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "TD_1_social_cleanup";
const KEY_TD1_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Checklist ----------------------------- */
const CHECKS: { id: string; title: string }[] = [
  { id: "cut_direct_access", title: "اکسم رو توو همه شبکه‌های اجتماعی و پیام‌رسان‌ها بی‌صدا کردم جوری که پست، استوری‌ها و پیام‌هاش برام نیاد و همینطور داخل اینستا و تیک تاک آنفالوش کردم" },
  { id: "stop_status_checks", title: "چک‌کردن زمان آنلاین شدن، دیدن آخرین بازدید و دیدن عکس پروفایل رو متوقف کردم و اگه این بار تحریک شدم از تکنیک تب پناهگاه کمک می‌گیرم" },
  { id: "no_indirect_spy", title: "از هیچ‌کس نمی‌خوام وضعیت پیج اون رو چک کنه و برام خبر بیاره" },
  { id: "no_fake_account", title: "پیج فیک برای دید زدنش ندارم و اگه دارم حذفش میکنم" },
  { id: "no_private_counting", title: "دید زدن پیج خصوصیش، برای چک کردن تعداد پست‌هاش، فالوئرهاش و فالووینگاش  رو کنار گذاشتم" },
  { id: "mute_common_people", title: " اکانت افرادی که به شکل مستقیم به اون مربوط هستند رو فعلا میوت کردم " },
  { id: "remove_trigger_content", title: "پیج‌ها یا کانال‌های تحریک‌کننده (مثل بازگشت، فال، محتواهای وابسته‌کننده، کلیپ شکست عشقی و آهنگ غمگین) روآنفالو کردم" },
  { id: "telegram_cleanup", title: "کانال‌ها یا گروه‌های تلگرامی و واتس‌اپی رو که بهم استرس می‌داد و منو هل می‌داد به سمت اکسم رو بی‌صدا یا ترک کردم" },
  { id: "reduce_following", title: "حداقل ۵ پیجی که احساس مقایسه و اضطراب رو در درون من زیاد میکنه رو حذف یا میوت کردم" },
  { id: "notif_off", title: "نوتیفیکیشن‌های گوشیم رو خاموش کردم یا فقط ضروری‌ها رو نگه داشتم" },
  { id: "number_off", title: "شماره اکسم رو داخل گوشیم پاک کردم یا اسمش رو به یک اسم خنثی تبدیل کردم مثل نام و نام خانوادگیش" },
  { id: "story_off", title: "از امروز به بعد هیچ استوری غمگین و مربوط به جدایی، بی وفایی و شکست عشقی نمیذارم " },
  { id: "save_off", title: "از امروز به بعد هیچ پست واستوری مرتبط با شکست عشقی، جدایی و خیانت رو لایک و سیو نمی‌کنم و سیوشده‌های قبلی رو پاک می‌کنم" },
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
    kind === "success" ? "checkmark-circle" : kind === "warn" ? "warning" : kind === "info" ? "information-circle" : "alert-circle";

  const iconColor =
    kind === "success" ? palette.green : kind === "warn" ? palette.orange : kind === "info" ? "rgba(231,238,247,.85)" : palette.red;

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
export default function TD1SocialCleanupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "پاکسازی شبکه‌های اجتماعی";

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
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedWhy, setAcceptedWhy] = useState(false);

  // Step 2
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

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
    const raw = await AsyncStorage.getItem(KEY_TD1_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as TD1Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedWhy(!!j.acceptedWhy);
    setCheckedIds(Array.isArray(j.checkedIds) ? j.checkedIds : []);

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

  /* ----------------------------- Checklist helpers ----------------------------- */
  const toggleCheck = useCallback(
    (id: string) => {
      if (isReview) return;
      setCheckedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    },
    [isReview]
  );

  const total = CHECKS.length;
  const doneCount = checkedIds.length;

  const canGo2 = acceptedWhy;
  const canFinishChecklist = useMemo(() => {
    if (!acceptedWhy) return false;
    if (doneCount < total) return false;
    return true;
  }, [acceptedWhy, doneCount, total]);

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const payload: TD1Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      acceptedWhy: true,
      checkedIds: [...checkedIds],
      total,
    };

    await AsyncStorage.setItem(KEY_TD1_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [checkedIds, total]);

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

    // ✅ فقط متادیتا، بدون اطلاعات حساس
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedWhy: true,
        checkedCount: doneCount,
        totalCount: total,
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
  }, [apiBase, closeModal, doneCount, openModal, phone, token, total]);

  const doFinalize = useCallback(async () => {
    if (!canFinishChecklist) return;
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
      setStep(3);
    }
  }, [canFinishChecklist, closeModal, completeOnServer, openModal, persistFinalLocal, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  /* ----------------------------- Step pills ----------------------------- */
  const StepPills = (
    <View style={styles.stepPills}>
      {[1, 2, 3].map((n) => {
        const on = step === (n as any);
        const canNav = isReview && n !== 1; // در مرور فقط ۲ و ۳
        return (
          <Pressable
            key={n}
            onPress={() => {
              if (!canNav) return;
              setStep(n as any);
            }}
            style={[styles.stepPill, on && styles.stepPillOn, isReview && !canNav && { opacity: 0.55 }]}
          >
            <Text style={styles.stepPillText}>{n === 1 ? "۱" : n === 2 ? "۲" : "۳"}</Text>
          </Pressable>
        );
      })}
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
          <View style={styles.sectionCard}>
            <Text style={styles.h1}>چرا باید فاصله بگیری؟</Text>
            <Text style={styles.p}>
              بعد از جدایی، مغز دنبال «اطمینان فوری» می‌گرده.
              {"\n"}چک‌کردن اینکه آنلاینه یا نه، بلاک آن‌بلاک کردن ، چک کردن تعداد فالوئرها یا حتی دید زدن از پیج فیک،
              {"\n"}باعث میشه یک احساس آرامش لحظه‌ای در فرد ایجاد بشه… اما بعدش اضطراب رو بیشتر می‌کنه.
              {"\n\n"}این ریزاقدام قرار نیست احساسات تو  رو سرکوب کنه؛
              {"\n"}قراره منابع تحریک رو ازت دور کنه تا تصمیم‌گیری درست برگرده به سمت بخش بالغ ذهنت.
            </Text>

            <Pressable
              onPress={() => {
                if (isReview) return;
                setAcceptedWhy((x) => !x);
              }}
              style={[styles.choiceCard, acceptedWhy && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
              disabled={isReview}
            >
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={acceptedWhy ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={acceptedWhy ? palette.green : "rgba(231,238,247,.55)"}
                />
                <Text style={styles.choiceText}>قبول دارم «چک کردن»، آرامش نیست؛ بلکه وابستگیِ بیشتره</Text>
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

        {/* ----------------------------- Step 2 ----------------------------- */}
        {step === 2 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>چک‌لیست پاکسازی</Text>
              <Text style={styles.p}>
                این‌ها «کارهای اجرایی» هستند که باعث میشن حالت بهتر بشه .
                {"\n"}به احتمال زیاد ذهنت با دیدن این کارها کلی دلیل برات میاره که انجامشون ندی
                {"\n"}ولی بدون تنها راه آرامش عبور از این مسیر و انجام دادن این موارده
                {"\n"}هر کدوم رو که انجام دادی داخل این لیست، اون رو تیک بزن
                {"\n"}انجامشون یعنی واقعاً داری محرک‌ها رو قطع می‌کنی.
                {"\n\n"}وضعیت: {doneCount}/{total}
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              {CHECKS.map((c) => {
                const on = checkedIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleCheck(c.id)}
                    style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                    disabled={isReview}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={on ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={styles.choiceText}>{c.title}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setStep(3)}
                  style={[styles.primaryBtn, { flex: 1 }, (!canFinishChecklist || saving) && { opacity: 0.45 }]}
                  disabled={!canFinishChecklist || saving}
                >
                  <Text style={styles.primaryBtnText}>ادامه</Text>
                </TouchableOpacity>
              </View>

              {!canFinishChecklist ? <Text style={styles.warn}>برای رفتن مرحله بعد، همه موارد چک‌لیست باید تیک بخورد</Text> : null}
            </View>
          </>
        ) : null}

        {/* ----------------------------- Step 3 ----------------------------- */}
        {step === 3 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>پایان</Text>
              <Text style={styles.p}>
                یادت باشه:
                {"\n"}مغز با چک کردن آروم نمی‌شه؛ فقط معتادتر می‌شه.
                {"\n\n"}اگر این کارها رو انجام دادی، عملاً احتمال وسوسه و برگشت به چک کردن پایین می‌آد.
                {"\n"}میدونم چک نکردن کار سختیه برای همین داخل تب "پناه" یه تکنیک خوب گذاشتیم، پس هر وقت تحریک شدی برو اونجا و اون راهکار رو انجام بده
                {"\n"}
                {"\n"}همچنین قدم بعدی کمک می‌کنه محرک‌ها رو بهتر بشناسی و براشون برنامه داشته باشی.
              </Text>
            </View>

            <View style={{ marginTop: 10, gap: 10 }}>
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
                  disabled={saving || (!isReview && !canFinishChecklist)}
                  onPress={onFinishPress}
                  style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinishChecklist)) && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? "در حال انجام" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                </TouchableOpacity>
              </View>

              {!isReview && !canFinishChecklist ? <Text style={styles.warn}>قبل از ثبت، همه موارد چک‌لیست باید کامل شود</Text> : null}
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