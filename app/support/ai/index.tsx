// app/support/ai/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";
import { useRouter } from "expo-router";
import { getPlanStatus } from "../../../lib/plan";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };

const K_AI_HISTORY = "phoenix.ai.history.v1";
const K_AI_MOOD = "phoenix.ai.mood.v1";
const K_AI_DAILY_LIMIT = "phoenix.ai.dailyLimit.v1";
const PRO_FLAG_KEY = "phoenix_is_pro";

type PlanView = "free" | "pro" | "expired";
type DebugState =
  | "real"
  | "force-free"
  | "force-pro"
  | "force-pro-near"
  | "force-expired";

const bubble = (mine: boolean) => ({
  alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
  backgroundColor: mine ? "#FF6B00" : "#1a1a1a",
  borderColor: mine ? "#FF6B00" : "#333",
});

const toFaDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const hhmm = (ts: number) =>
  toFaDigits(
    new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
  );

/* تایپینگ داتس */
function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(t);
  }, []);
  return <Text style={{ color: "#8E8E93" }}>در حال نوشتن پاسخ{dots}</Text>;
}

/* امتیاز احساس */
function scoreSentiment(text: string) {
  const pos = [
    "امید",
    "بهتر",
    "خوب",
    "آرام",
    "آرامش",
    "کمک",
    "بهبود",
    "قوی",
    "قدرت",
    "رشد",
    "پیشرفت",
  ];
  const neg = [
    "استرس",
    "اضطراب",
    "نگران",
    "غم",
    "غمگین",
    "ترس",
    "عصبانی",
    "خشم",
    "ناامید",
    "بد",
  ];
  const t = text.toLowerCase();
  let s = 0;
  pos.forEach((w) => (t.includes(w) ? (s += 1) : null));
  neg.forEach((w) => (t.includes(w) ? (s -= 1) : null));
  if (s > 2) s = 2;
  if (s < -2) s = -2;
  return s;
}

function MoodMiniChart({ values }: { values: number[] }) {
  const data = values.slice(-8);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 3,
        height: 24,
      }}
    >
      {data.map((v, i) => {
        const h = Math.round(((v + 2) / 4) * 18) + 4;
        const color = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
        return (
          <View
            key={i}
            style={{
              width: 8,
              height: h,
              borderRadius: 3,
              backgroundColor: color,
              opacity: 0.9,
            }}
          />
        );
      })}
    </View>
  );
}

/* شناسه امروز */
function todayId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DailyUsage = { date: string; count: number };

export default function AIChatSupport() {
  const rtl = I18nManager.isRTL;
  const router = useRouter();

  // id یکتا
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        let storedId = await AsyncStorage.getItem("phoenix_user_id");
        if (!storedId) {
          storedId = uuidv4();
          await AsyncStorage.setItem("phoenix_user_id", storedId);
        }
        setUserId(storedId);
      } catch (err) {
        console.log("UserID error:", err);
      }
    })();
  }, []);

  // وضعیت پلن (مثل تب‌ها)
  const { me } = useUser();
  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [debugState, setDebugState] = useState<DebugState>("real");
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire =
    planView === "pro" && daysLeft != null && daysLeft > 0 && daysLeft <= 7;

  // محاسبه وضعیت پلن + دیباگ
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";
        let localDaysLeft: number | null = status.daysLeft ?? null;

        if (status.rawExpiresAt) {
          if (status.isExpired) {
            view = "expired";
          } else if (status.isPro || flagIsPro) {
            view = "pro";
          } else {
            view = "free";
          }
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        // دیباگ
        if (debugState === "force-free") {
          view = "free";
          localDaysLeft = null;
        } else if (debugState === "force-pro") {
          view = "pro";
          localDaysLeft = 30;
        } else if (debugState === "force-pro-near") {
          view = "pro";
          localDaysLeft = 4;
        } else if (debugState === "force-expired") {
          view = "expired";
          localDaysLeft = 0;
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft);

        console.log("AI SUPPORT PLAN INIT", {
          rawPlan: status.rawPlan,
          rawExpiresAt: status.rawExpiresAt,
          isExpired: status.isExpired,
          daysLeft: status.daysLeft,
          flag,
          debugState,
          planView: view,
          localDaysLeft,
        });
      } catch (e) {
        console.log("AI SUPPORT PLAN ERR", e);
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me, debugState]);

  // پیام‌ها
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "sys-hello",
      role: "assistant",
      content:
        "سلام 🌿 من پشتیبان هوشمند ققنوس هستم. بنویس چی ذهنت رو درگیر کرده، تا با هم بررسیش کنیم… 💬",
      ts: Date.now(),
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // اسکرول
  const scrollRef = useRef<ScrollView>(null);
  const [showJump, setShowJump] = useState(false);
  const atBottomRef = useRef(true);

  // نمودار احساس
  const [moodHistory, setMoodHistory] = useState<number[]>([]);

  // مودال حریم خصوصی
  const [showPrivacy, setShowPrivacy] = useState(false);

  // محدودیت روزانه
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);

  const reachedLimit =
    !isProPlan &&
    dailyUsage != null &&
    dailyUsage.date === todayId() &&
    dailyUsage.count >= 3;

  const canSend = useMemo(
    () => text.trim().length > 0 && !loading && !reachedLimit,
    [text, loading, reachedLimit]
  );

  // load history / mood / limit
  useEffect(() => {
    (async () => {
      try {
        const [rawHistory, rawMood, rawLimit] = await Promise.all([
          AsyncStorage.getItem(K_AI_HISTORY),
          AsyncStorage.getItem(K_AI_MOOD),
          AsyncStorage.getItem(K_AI_DAILY_LIMIT),
        ]);

        if (rawHistory) {
          const arr = JSON.parse(rawHistory);
          if (Array.isArray(arr) && arr.length) setMessages(arr);
        }

        if (rawMood) {
          const mv = JSON.parse(rawMood);
          if (Array.isArray(mv)) setMoodHistory(mv);
        }

        if (rawLimit) {
          const parsed: DailyUsage | null = JSON.parse(rawLimit);
          if (parsed && parsed.date === todayId()) {
            setDailyUsage(parsed);
          } else {
            const fresh = { date: todayId(), count: 0 };
            setDailyUsage(fresh);
            AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(fresh)).catch(() => {});
          }
        } else {
          const fresh = { date: todayId(), count: 0 };
          setDailyUsage(fresh);
          AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(fresh)).catch(() => {});
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(K_AI_HISTORY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);
  useEffect(() => {
    AsyncStorage.setItem(K_AI_MOOD, JSON.stringify(moodHistory)).catch(() => {});
  }, [moodHistory]);

  // افزایش شمارش روزانه
  const bumpDailyUsage = () => {
    if (isProPlan) return;
    const today = todayId();
    setDailyUsage((prev) => {
      let next: DailyUsage;
      if (!prev || prev.date !== today) {
        next = { date: today, count: 1 };
      } else {
        next = { date: today, count: prev.count + 1 };
      }
      AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // نمایش تدریجی پاسخ
  const typeOut = (fullText: string) =>
    new Promise<void>((resolve) => {
      const id = uuidv4();
      const start: Msg = { id, role: "assistant", content: "", ts: Date.now() };
      setMessages((prev) => [...prev, start]);

      let i = 0;
      const speed = 10;
      const step = Math.max(1, Math.floor(fullText.length / 200));
      const timer = setInterval(() => {
        i += step;
        const slice = fullText.slice(0, i);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: slice } : m))
        );
        scrollRef.current?.scrollToEnd({ animated: false });
        if (i >= fullText.length) {
          clearInterval(timer);
          resolve();
        }
      }, speed);
    });

  // ارسال
  const send = async () => {
    const t = text.trim();
    if (!t || loading) return;

    if (reachedLimit) {
      Alert.alert(
        "محدودیت امروز",
        "امروز حداکثر سه پیام به پشتیبان هوشمند فرستادی.\nفردا دوباره امتحان کن، یا با فعال‌کردن اشتراک PRO این محدودیت برداشته می‌شود."
      );
      return;
    }

    setText("");

    const myMsg: Msg = { id: uuidv4(), role: "user", content: t, ts: Date.now() };
    const nextMessages = [...messages, myMsg];
    setMessages(nextMessages);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const compact = nextMessages
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    const payload = { messages: compact, userId };

    bumpDailyUsage();

    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(`${BACKEND_URL}/api/public/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const json = await res.json().catch(() => ({}));
      const reply: string =
        json?.reply ||
        "متأسفم، الان نمی‌تونم پاسخ بدم. لطفاً دوباره تلاش کن.";

      await typeOut(reply);

      const s = scoreSentiment(reply);
      setMoodHistory((prev) => [...prev, s].slice(-20));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "خطا در اتصال به سرور. دوباره تلاش کن یا اینترنت را بررسی کن.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Scroll helpers
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const paddingToBottom = 24;
    const atBottom =
      contentOffset.y + layoutMeasurement.height + paddingToBottom >=
      contentSize.height;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };
  const jumpToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setShowJump(false);
  };

  // Copy / Share
  const onLongPressMsg = (m: Msg) => {
    Alert.alert("پیام", "می‌خواهی با این پیام چه‌کار کنی؟", [
      { text: "کپی متن", onPress: () => Clipboard.setStringAsync(m.content) },
      {
        text: "اشتراک‌گذاری",
        onPress: () =>
          Share.share({ message: m.content }).catch(() => {}),
      },
      { text: "بستن", style: "cancel" },
    ]);
  };

  // پاک‌کردن تاریخچه
  const clearHistory = async () => {
    await AsyncStorage.multiRemove([K_AI_HISTORY, K_AI_MOOD]);
    setMoodHistory([]);
    setMessages([
      {
        id: "sys-hello",
        role: "assistant",
        content:
          "سلام 🌿 من پشتیبان هوشمند ققنوس هستم. بنویس چی ذهنت رو درگیر کرده، تا با هم بررسیش کنیم… 💬",
        ts: Date.now(),
      },
    ]);
  };
  const confirmClear = () => {
    Alert.alert("حذف تاریخچه؟", "همه پیام‌های گفتگو پاک می‌شود.", [
      { text: "انصراف", style: "cancel" },
      { text: "پاک کن", style: "destructive", onPress: clearHistory },
    ]);
  };

  const limitLabel =
    isProPlan
      ? "اشتراک PRO فعال است؛ محدودیتی برای تعداد پیام‌ها نداری."
      : "در نسخه رایگان، روزی حداکثر ۳ پیام می‌تونی به پشتیبان هوشمند بفرستی.";

  const limitStateLabel =
    !isProPlan && dailyUsage?.count != null
      ? `پیام‌های استفاده‌شده امروز: ${toFaDigits(
          String(Math.min(dailyUsage.count, 3))
        )} / ۳`
      : "";

  const badgeBg =
    planView === "pro"
      ? isNearExpire
        ? "#EA580C"
        : "#F59E0B"
      : planView === "expired"
      ? "#DC2626"
      : "#111827";

  const badgeLabel =
    planView === "pro"
      ? "PRO"
      : planView === "expired"
      ? "EXPIRED"
      : "FREE";

  const badgeTextColor =
    planView === "pro" ? "#111827" : "#F9FAFB";

  if (loadingPlan) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color="#f97316" />
        <Text
          style={{
            color: "#e5e7eb",
            marginTop: 8,
            fontSize: 12,
          }}
        >
          در حال آماده‌سازی پشتیبان هوشمند…
        </Text>
      </SafeAreaView>
    );
  }

  const rtlHeader = rtl; // فقط برای جهت فلش

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* پنل دیباگ پلن (بالای هدر) */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 6,
          }}
        >
          <View
            style={{
              padding: 6,
              borderRadius: 10,
              backgroundColor: "#020617",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 10,
                marginBottom: 4,
                textAlign: "right",
              }}
            >
              حالت نمایش پلن (دیباگ پشتیبان هوشمند):
            </Text>
            <View
              style={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              {(
                [
                  { key: "real", label: "داده واقعی" },
                  { key: "force-free", label: "FREE فیک" },
                  { key: "force-pro", label: "PRO فیک" },
                  { key: "force-pro-near", label: "PRO نزدیک انقضا" },
                  { key: "force-expired", label: "EXPIRED فیک" },
                ] as { key: DebugState; label: string }[]
              ).map((opt) => {
                const active = debugState === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setDebugState(opt.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 4,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#2563EB" : "#4B5563",
                      backgroundColor: active ? "#1D4ED8" : "#020617",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#E5E7EB" : "#9CA3AF",
                        fontSize: 9,
                        textAlign: "center",
                        fontWeight: active ? "800" : "500",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Header */}
        <View
          style={{
            paddingTop: 6,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          {/* ردیف اول: سه ستون برای وسط‌شدن واقعی تیتر */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* ستون چپ: فلش برگشت */}
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 6, borderRadius: 999 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={rtlHeader ? "arrow-forward" : "arrow-back"}
                  size={20}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>

            {/* ستون وسط: عنوان کاملاً وسط */}
            <View style={{ flex: 2, alignItems: "center" }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "900",
                }}
                numberOfLines={1}
              >
                پشتیبان هوشمند
              </Text>
            </View>

            {/* ستون راست: سپر + بج پلن + سطل آشغال */}
            <View
              style={{
                flex: 1,
                alignItems: "flex-end",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  columnGap: 6,
                  justifyContent: "flex-end",
                }}
              >
                {/* سپر حریم خصوصی */}
                <TouchableOpacity
                  onPress={() => setShowPrivacy(true)}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#A3E635"
                  />
                </TouchableOpacity>

                {/* بج پلن با منطق تب‌ها */}
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: badgeBg,
                    borderWidth: planView === "free" ? 1 : 0,
                    borderColor:
                      planView === "free" ? "#4B5563" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: badgeTextColor,
                      fontWeight: "900",
                      fontSize: 10,
                    }}
                  >
                    {badgeLabel}
                  </Text>
                </View>

                {/* سطل آشغال */}
                <TouchableOpacity
                  onPress={confirmClear}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#ff6666"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* نمودار احساسی چسبیده به هدر */}
          {moodHistory.length > 0 && (
            <View
              style={{
                marginTop: 6,
                alignItems: "center",
                gap: 2,
              }}
            >
              <MoodMiniChart values={moodHistory} />
              <Text style={{ color: "#9ca3af", fontSize: 10 }}>
                روند احساسی پاسخ‌های اخیر
              </Text>
            </View>
          )}

          {/* متن محدودیت / وضعیت پرو فقط برای غیرپرو */}
          {!isProPlan && (
            <View style={{ marginTop: 6 }}>
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                {limitLabel}
              </Text>
              {!!limitStateLabel && (
                <Text
                  style={{
                    color: "#e5e7eb",
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {limitStateLabel}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 20,
            gap: 10,
          }}
          onContentSizeChange={() => {
            if (atBottomRef.current)
              scrollRef.current?.scrollToEnd({ animated: true });
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => {
            const mine = m.role === "user";
            const style = bubble(mine);
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.8}
                onLongPress={() => onLongPressMsg(m)}
                delayLongPress={250}
                style={{
                  alignSelf: style.alignSelf,
                  backgroundColor: style.backgroundColor,
                  borderWidth: 1,
                  borderColor: style.borderColor,
                  borderRadius: 14,
                  padding: 10,
                  maxWidth: "85%",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    textAlign: rtl ? "right" : "left",
                    lineHeight: 22,
                  }}
                >
                  {m.content}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,.65)",
                    fontSize: 11,
                    marginTop: 6,
                    textAlign: mine ? "left" : "right",
                  }}
                >
                  {hhmm(m.ts)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {loading && (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#1a1a1a",
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                maxWidth: "70%",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator />
              <TypingDots />
            </View>
          )}
        </ScrollView>

        {/* دکمه رفتن به پایین اگر بالا اسکرول کرده */}
        {showJump && (
          <TouchableOpacity
            onPress={jumpToBottom}
            style={{
              position: "absolute",
              right: 16,
              bottom: 80,
              backgroundColor: "#111827",
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderWidth: 1,
              borderColor: "#4B5563",
            }}
          >
            <Ionicons name="chevron-down" size={16} color="#E5E7EB" />
            <Text style={{ color: "#E5E7EB", fontSize: 11 }}>رفتن به آخر گفتگو</Text>
          </TouchableOpacity>
        )}

        {/* Input area */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: "#222",
            backgroundColor: "#000",
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: reachedLimit ? "#f97316" : "#333",
              borderRadius: 12,
              height: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
              opacity: reachedLimit ? 0.6 : 1,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                reachedLimit
                  ? "امروز به سقف سه پیام رسیدی؛ فردا دوباره امتحان کن."
                  : "بنویس…"
              }
              placeholderTextColor={reachedLimit ? "#f97316" : "#777"}
              style={{
                color: "#fff",
                textAlign: rtl ? "left" : "right",
              }}
              editable={!reachedLimit}
              onSubmitEditing={send}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={{
              width: 52,
              height: 44,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: canSend ? "#FF6B00" : "#333",
            }}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* هشدار ریز زیر باکس ورودی */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 10,
            backgroundColor: "#000",
          }}
        >
          <Text
            style={{
              color: "#6b7280",
              fontSize: 11,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            ⚠️ پشتیبان هوشمند ققنوس ممکنه گاهی اشتباه کنه؛{"\n"} برای
            تصمیم‌های مهم با درمانگر واقعی مشورت کن.
          </Text>
          {reachedLimit && !isProPlan && (
            <Text
              style={{
                color: "#f97316",
                fontSize: 11,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              امروز سقف سه پیام پر شده. برای برداشتن این محدودیت می‌تونی اشتراک
              PRO ققنوس رو از تب پرداخت فعال کنی.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* مودال حریم خصوصی */}
      <Modal
        visible={showPrivacy}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacy(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "90%",
              borderRadius: 16,
              backgroundColor: "#0b0b0b",
              borderWidth: 1,
              borderColor: "#222",
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons name="shield-checkmark" size={18} color="#A3E635" />
              <Text
                style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}
              >
                توصیه‌های حریم خصوصی
              </Text>
            </View>
            <Text
              style={{ color: "#cbd5e1", lineHeight: 22, textAlign: "right" }}
            >
              • از وارد کردن اطلاعات شناسایی حساس، خودداری کن (کد ملی، شماره
              کارت، آدرس دقیق).{"\n"}
              • این بخش جایگزین رواندرمانی یا پشتیبانی واقعی نیست. در شرایط خطر
              يا خودآسیبی، با شماره‌های امدادی تماس بگیر يا به پشتيبان واقعی
              ققنوس پیام بفرست.{"\n"}
              • گفتگوها برای بهبود تجربه کاربری، روی دستگاه تو نگه داشته میشن
              ولی میتونی هر زمان نیاز داشتی از دکمهٔ «سطل زباله» برای پاک‌کردن
              تاریخچه استفاده کنی.{"\n"}
              • برای پاسخ‌گویی، متن پرسش به سرور ققنوس ارسال میشه تا مدل هوش
              مصنوعی پاسخ بسازه.{"\n"}
              • از فرستادن فایل تصویری که اطلاعات خصوصی داره خودداری کن.{"\n"}
              • اگر زیر ۱۸ سالی، حتماً از والدین خودت کمک بگیر.{"\n"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowPrivacy(false)}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: "#333",
                backgroundColor: "#111",
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>فهمیدم</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}