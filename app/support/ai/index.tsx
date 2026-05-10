// app/support/ai/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuidv4 } from "uuid";
import PlanStatusBadge from "../../../components/PlanStatusBadge";
import { BACKEND_URL } from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../../lib/plan";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };

const K_AI_HISTORY = "phoenix.ai.history.v1";
const K_AI_MOOD = "phoenix.ai.mood.v1";
const K_AI_DAILY_LIMIT = "phoenix.ai.dailyLimit.v1";

type PlanView = "free" | "pro" | "expired";

const toFaDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const hhmm = (ts: number) =>
  toFaDigits(
    new Date(ts).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

/* ================= Toast ================= */
type ToastKind = "error" | "info" | "success";
function Toast({
  visible,
  text,
  kind,
  onClose,
}: {
  visible: boolean;
  text: string;
  kind: ToastKind;
  onClose: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!visible) return null;

  const icon =
    kind === "error"
      ? "alert-circle"
      : kind === "success"
      ? "checkmark-circle"
      : "information-circle";

  const border =
    kind === "error"
      ? "rgba(239,68,68,.35)"
      : kind === "success"
      ? "rgba(34,197,94,.30)"
      : "rgba(212,175,55,.28)";

  const bg =
    kind === "error"
      ? "rgba(239,68,68,.10)"
      : kind === "success"
      ? "rgba(34,197,94,.10)"
      : "rgba(212,175,55,.10)";

  const tint =
    kind === "error" ? "#FCA5A5" : kind === "success" ? "#86EFAC" : "#D4AF37";

  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-18, 0],
            }),
          },
        ],
        opacity: anim,
      }}
    >
      <View style={[styles.toastWrap, { borderColor: border, backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={tint} />
        <Text style={styles.toastText} numberOfLines={2}>
          {text}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.toastClose} activeOpacity={0.85}>
          <Ionicons name="close" size={16} color="#E5E7EB" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* تایپینگ داتس */
function TypingDots() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={{ color: "rgba(231,238,247,.70)", fontWeight: "800" }}>
      در حال نوشتن پاسخ{dots}
    </Text>
  );
}

/* امتیاز احساس */
function scoreSentiment(text: string) {
  const pos = ["امید", "بهتر", "خوب", "آرام", "آرامش", "کمک", "بهبود", "قوی", "قدرت", "رشد", "پیشرفت"];
  const neg = ["استرس", "اضطراب", "نگران", "غم", "غمگین", "ترس", "عصبانی", "خشم", "ناامید", "بد"];
  const t = (text || "").toLowerCase();
  let s = 0;
  pos.forEach((w) => (t.includes(w) ? (s += 1) : null));
  neg.forEach((w) => (t.includes(w) ? (s -= 1) : null));
  return Math.max(-2, Math.min(2, s));
}

function MoodMiniChart({ values }: { values: number[] }) {
  const data = values.slice(-8);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 24 }}>
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

function todayId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DailyUsage = { date: string; count: number };

export default function AIChatSupport() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* Toast */
  const [toast, setToast] = useState<{ visible: boolean; text: string; kind: ToastKind }>({
    visible: false,
    text: "",
    kind: "info",
  });

  const showToast = useCallback((text: string, kind: ToastKind = "info") => {
    setToast({ visible: true, text, kind });
    setTimeout(() => setToast((p) => (p.visible ? { ...p, visible: false } : p)), 3000);
  }, []);

  /* id یکتا */
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
      } catch {
        showToast("مشکل در آماده‌سازی شناسه کاربری.", "error");
      }
    })();
  }, [showToast]);

  /* plan */
  const { me } = useUser();
  const [planView, setPlanView] = useState<PlanView>("free");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const isProPlan = planView === "pro";
  const isNearExpire = planView === "pro" && daysLeft != null && daysLeft > 0 && daysLeft <= 7;

  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const status = getPlanStatus(me);
        const flagIsPro = flag === "1";

        let view: PlanView = "free";
        const localDaysLeft: number | null = status.daysLeft ?? null;

        if (status.rawExpiresAt) {
          if (status.isExpired) view = "expired";
          else if (status.isPro || flagIsPro) view = "pro";
          else view = "free";
        } else {
          view = status.isPro || flagIsPro ? "pro" : "free";
        }

        setPlanView(view);
        setDaysLeft(localDaysLeft);
      } catch {
        setPlanView("free");
        setDaysLeft(null);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [me]);

  /* messages */
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "sys-hello",
      role: "assistant",
      content: "سلام 🌿 من پشتیبان هوشمند ققنوس هستم. بنویس چی ذهنت رو درگیر کرده، تا با هم بررسیش کنیم… 💬",
      ts: Date.now(),
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  /* scroll */
  const scrollRef = useRef<ScrollView>(null);
  const [showJump, setShowJump] = useState(false);
  const atBottomRef = useRef(true);

  /* mood */
  const [moodHistory, setMoodHistory] = useState<number[]>([]);

  /* privacy */
  const [showPrivacy, setShowPrivacy] = useState(false);

  /* ✅ confirm clear (جایگزین Alert زشت) */
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  /* daily limit */
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);

  const reachedLimit =
    !isProPlan && dailyUsage != null && dailyUsage.date === todayId() && dailyUsage.count >= 3;

  const canSend = useMemo(
    () => text.trim().length > 0 && !loading && !reachedLimit,
    [text, loading, reachedLimit]
  );

  /* load history / mood / limit */
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

        const fresh = { date: todayId(), count: 0 };

        if (rawLimit) {
          const parsed: DailyUsage | null = JSON.parse(rawLimit);
          if (parsed && parsed.date === todayId()) setDailyUsage(parsed);
          else {
            setDailyUsage(fresh);
            AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(fresh)).catch(() => {});
          }
        } else {
          setDailyUsage(fresh);
          AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(fresh)).catch(() => {});
        }
      } catch {
        // silent
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(K_AI_HISTORY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    AsyncStorage.setItem(K_AI_MOOD, JSON.stringify(moodHistory)).catch(() => {});
  }, [moodHistory]);

  const bumpDailyUsage = () => {
    if (isProPlan) return;
    const today = todayId();
    setDailyUsage((prev) => {
      const next =
        !prev || prev.date !== today ? { date: today, count: 1 } : { date: today, count: prev.count + 1 };
      AsyncStorage.setItem(K_AI_DAILY_LIMIT, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  /* type out */
  const typeOut = (fullText: string) =>
    new Promise<void>((resolve) => {
      const id = uuidv4();
      setMessages((prev) => [...prev, { id, role: "assistant", content: "", ts: Date.now() }]);

      let i = 0;
      const speed = 10;
      const step = Math.max(1, Math.floor(fullText.length / 200));

      const timer = setInterval(() => {
        i += step;
        const slice = fullText.slice(0, i);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: slice } : m)));
        scrollRef.current?.scrollToEnd({ animated: false });
        if (i >= fullText.length) {
          clearInterval(timer);
          resolve();
        }
      }, speed);
    });

  const jumpToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setShowJump(false);
  };

  /* copy/share */
  const onLongPressMsg = (m: Msg) => {
    Alert.alert("پیام", "می‌خواهی با این پیام چه‌کار کنی؟", [
      { text: "کپی متن", onPress: () => Clipboard.setStringAsync(m.content) },
      { text: "اشتراک‌گذاری", onPress: () => Share.share({ message: m.content }).catch(() => {}) },
      { text: "بستن", style: "cancel" },
    ]);
  };

  /* clear history */
  const clearHistory = async () => {
    await AsyncStorage.multiRemove([K_AI_HISTORY, K_AI_MOOD]);
    setMoodHistory([]);
    setMessages([
      {
        id: "sys-hello",
        role: "assistant",
        content: "سلام 🌿 من پشتیبان هوشمند ققنوس هستم. بنویس چی ذهنت رو درگیر کرده، تا با هم بررسیش کنیم… 💬",
        ts: Date.now(),
      },
    ]);
    showToast("تاریخچه پاک شد.", "success");
  };

  /* send */
  const send = async () => {
    const t = text.trim();
    if (!t || loading) return;

    if (reachedLimit) {
      showToast("امروز سقف ۳ پیام رایگان پر شده. فردا دوباره امتحان کن یا با PRO محدودیت برداشته میشه.", "info");
      return;
    }

    Keyboard.dismiss();
    setText("");

    const myMsg: Msg = { id: uuidv4(), role: "user", content: t, ts: Date.now() };
    const nextMessages = [...messages, myMsg];
    setMessages(nextMessages);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const compact = nextMessages.slice(-10).map(({ role, content }) => ({ role, content }));
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
      const reply: string = json?.reply || "متأسفم، الان نمی‌تونم پاسخ بدم. لطفاً دوباره تلاش کن.";

      await typeOut(reply);

      const s = scoreSentiment(reply);
      setMoodHistory((prev) => [...prev, s].slice(-20));
    } catch {
      showToast("ارتباط با سرور مشکل داشت. اینترنت رو چک کن و دوباره بزن.", "error");
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), role: "assistant", content: "مشکل اتصال پیش اومد. یک بار دیگه تلاش کن 🌿", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  /* labels (فقط برای FREE) */
  const limitLabel = "در نسخه رایگان، روزی حداکثر ۳ پیام می‌تونی به پشتیبان هوشمند بفرستی.";
  const limitStateLabel =
    dailyUsage?.count != null ? `پیام‌های امروز: ${toFaDigits(String(Math.min(dailyUsage.count, 3)))} / ۳` : "";

  /* bubbles */
  const bubbleStyle = (mine: boolean) => ({
    alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
    backgroundColor: mine ? "rgba(255,255,255,0.05)" : "rgba(212,175,55,0.10)",
    borderColor: mine ? "rgba(255,255,255,0.10)" : "rgba(212,175,55,0.25)",
  });

  /* keyboard offset (برای مشکل سفید شدن/جدا شدن پایین) */
  const keyboardOffset = Platform.OS === "ios" ? 0 : 0;

  if (loadingPlan) {
    return (
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.centerText}>در حال آماده‌سازی پشتیبان هوشمند…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardOffset}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ✅ فقط TOP safe-area تا پایین سفید نشه */}
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        {/* Toast */}
        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          <Toast
            visible={toast.visible}
            text={toast.text}
            kind={toast.kind}
            onClose={() => setToast((p) => ({ ...p, visible: false }))}
          />
        </View>

        {/* ✅ Header: ترتیب از راست = فلش -> سطل -> سپر | عنوان وسطِ ثابت */}
        <View style={[styles.headerBar, { paddingTop: 10 }]}>
          {/* چپ: بج */}
          <View style={styles.headerLeft}>
            <PlanStatusBadge me={me} showExpiringText={false} />
          </View>

          {/* وسط: عنوان داخل باکس تا تکون نخوره */}
          <View style={styles.headerCenter} pointerEvents="none">
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                پشتیبان هوشمند
              </Text>
            </View>
          </View>

          {/* راست: اکشن‌ها با ترتیب خواسته‌شده */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtnSm} activeOpacity={0.85}>
              <Ionicons name="arrow-forward" size={18} color="#E5E7EB" />
            </TouchableOpacity>

            {/* ✅ به‌جای Alert سیستمی */}
            <TouchableOpacity onPress={() => setShowClearConfirm(true)} style={styles.headerIconBtnSm} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPrivacy(true)} style={styles.headerIconBtnSm} activeOpacity={0.85}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#D4AF37" />
            </TouchableOpacity>
          </View>
        </View>

        {/* زیر هدر: فقط برای FREE */}
        {!isProPlan ? (
          <View style={styles.subHeader}>
            {moodHistory.length > 0 ? (
              <View style={{ alignItems: "center", gap: 4 }}>
                <MoodMiniChart values={moodHistory} />
                <Text style={styles.subHint}>روند احساسی پاسخ‌های اخیر</Text>
              </View>
            ) : null}

            <View style={{ marginTop: moodHistory.length ? 10 : 0 }}>
              <Text style={styles.limitText}>{limitLabel}</Text>
              {!!limitStateLabel ? <Text style={styles.limitStateText}>{limitStateLabel}</Text> : null}
              {isNearExpire ? (
                <Text style={[styles.limitStateText, { color: "#FBBF24" }]}>اشتراک نزدیک به انقضاست.</Text>
              ) : null}
            </View>
          </View>
        ) : moodHistory.length > 0 ? (
          // PRO: فقط نمودار، بدون متن محدودیت
          <View style={[styles.subHeader, { paddingBottom: 6 }]}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <MoodMiniChart values={moodHistory} />
              <Text style={styles.subHint}>روند احساسی پاسخ‌های اخیر</Text>
            </View>
          </View>
        ) : null}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
  paddingHorizontal: 14,
  paddingBottom: insets.bottom + 140,
  gap: 10,
  direction: "ltr",
}}
          onContentSizeChange={() => {
            if (atBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const atBottom = contentOffset.y + layoutMeasurement.height + 24 >= contentSize.height;
            atBottomRef.current = atBottom;
            setShowJump(!atBottom);
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => {
            const mine = m.role === "user";
            const st = bubbleStyle(mine);
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onLongPress={() => onLongPressMsg(m)}
                delayLongPress={250}
                style={[
                  styles.msgBubble,
                  {
                    alignSelf: st.alignSelf,
                    backgroundColor: st.backgroundColor,
                    borderColor: st.borderColor,
                  },
                ]}
              >
                <Text style={[styles.msgText, { textAlign: "right" }]}>{m.content}</Text>
                <Text style={[styles.msgTime, { textAlign: mine ? "left" : "right" }]}>{hhmm(m.ts)}</Text>
              </TouchableOpacity>
            );
          })}

          {loading && (
            <View style={styles.typingBubble}>
              <ActivityIndicator color="#D4AF37" />
              <TypingDots />
            </View>
          )}
        </ScrollView>

        {/* Jump */}
        {showJump && (
          <TouchableOpacity onPress={jumpToBottom} style={styles.jumpBtn} activeOpacity={0.9}>
            <Ionicons name="chevron-down" size={16} color="#E5E7EB" />
            <Text style={styles.jumpText}>رفتن به آخر گفتگو</Text>
          </TouchableOpacity>
        )}

        {/* ✅ Dock پایین: بدون ایجاد فضای سفید */}
        <View style={[styles.composerDock, { paddingBottom: Math.max(10, insets.bottom + 8) }]}>
          {reachedLimit && !isProPlan ? (
            <View style={styles.inlineInfo}>
              <Ionicons name="information-circle" size={16} color="#FBBF24" />
              <Text style={styles.inlineInfoText}>امروز سقف ۳ پیام پر شده. با PRO این محدودیت برداشته میشه.</Text>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, { opacity: reachedLimit ? 0.6 : 1 }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={reachedLimit ? "امروز سقف پیام پر شده…" : "بنویس…"}
                placeholderTextColor={reachedLimit ? "rgba(251,191,36,.85)" : "rgba(231,238,247,.45)"}
                style={styles.input}
                editable={!reachedLimit}
                onSubmitEditing={send}
                returnKeyType="send"
                multiline={false}
              />
            </View>

            <TouchableOpacity
              onPress={send}
              disabled={!canSend}
              style={[styles.sendBtn, { opacity: canSend ? 1 : 0.55 }]}
              activeOpacity={0.9}
            >
              <Ionicons name="send" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            ⚠️ پشتیبان هوشمند ممکنه گاهی اشتباه کنه.{"\n"}برای تصمیم‌های مهم با درمانگر واقعی مشورت کن.
          </Text>
        </View>

        {/* Privacy modal */}
        <Modal visible={showPrivacy} transparent animationType="fade" onRequestClose={() => setShowPrivacy(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="shield-checkmark" size={18} color="#D4AF37" />
                <Text style={styles.modalTitle}>توصیه‌های حریم خصوصی</Text>
              </View>

              <Text style={styles.modalBody}>
                • از وارد کردن اطلاعات شناسایی حساس، خودداری کن (کد ملی، شماره کارت، آدرس دقیق).{"\n"}
                • این بخش جایگزین رواندرمانی یا پشتیبانی واقعی نیست. در شرایط خطر یا خودآسیبی با خدمات اضطراری تماس بگیر.{"\n"}
                • گفتگوها برای تجربه بهتر، روی دستگاه تو ذخیره میشن و هر زمان خواستی می‌تونی پاکشون کنی.{"\n"}
                • برای پاسخ‌دهی، متن پرسش به سرور ققنوس ارسال میشه.{"\n"}
                • از ارسال عکس یا متنی که اطلاعات خصوصی داره خودداری کن.{"\n"}
              </Text>

              <TouchableOpacity onPress={() => setShowPrivacy(false)} style={styles.modalBtn} activeOpacity={0.9}>
                <Text style={styles.modalBtnText}>فهمیدم</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ✅ Clear confirm modal (جایگزین Alert سیستم) */}
        <Modal
          visible={showClearConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowClearConfirm(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text
                style={{
                  color: "#F9FAFB",
                  fontWeight: "900",
                  fontSize: 16,
                  textAlign: "right",
                  marginBottom: 8,
                }}
              >
                حذف تاریخچه؟
              </Text>

              <Text
                style={{
                  color: "rgba(231,238,247,.75)",
                  lineHeight: 22,
                  textAlign: "right",
                  fontWeight: "700",
                }}
              >
                همه پیام‌های این گفتگو پاک می‌شود و قابل بازگشت نیست.
              </Text>

              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setShowClearConfirm(false)}
                  style={[styles.modalBtn, { flex: 1, marginTop: 0 }]}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: "#E5E7EB", fontWeight: "800" }}>انصراف</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowClearConfirm(false);
                    clearHistory();
                  }}
                  style={[
                    styles.modalBtn,
                    {
                      flex: 1,
                      marginTop: 0,
                      backgroundColor: "rgba(239,68,68,.12)",
                      borderColor: "rgba(239,68,68,.35)",
                    },
                  ]}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: "#FCA5A5", fontWeight: "900" }}>پاک کن</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  root: { flex: 1, backgroundColor: "#0b0f14" },

  bgGlowTop: {
    position: "absolute" as const,
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute" as const,
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
  centerText: { marginTop: 8, color: "rgba(231,238,247,.72)", fontSize: 12, fontWeight: "800" as const },

  headerBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#030712",
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },

  headerLeft: {
    minWidth: 120,
    alignItems: "flex-start" as const,
    justifyContent: "flex-end" as const,
  },

  // ✅ عنوان وسطِ واقعی (مستقل از آیکن‌ها)
  headerCenter: {
    position: "absolute" as const,
    left: 120, // برابر minWidth بج
    right: 120, // فضای اکشن‌ها
    top: 10,
    bottom: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitleBox: {
    maxWidth: "92%" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900" as const,
    textAlign: "center" as const,
  },

  // ✅ اکشن‌ها سمت راست
  headerActions: {
    marginLeft: "auto" as any,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 8,
    minWidth: 120,
    justifyContent: "flex-end" as const,
  },

  // ✅ کوچیک‌تر برای جا باز شدن عنوان
  headerIconBtnSm: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },

  subHeader: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  subHint: { color: "rgba(231,238,247,.55)", fontSize: 10, fontWeight: "800" as const },

  limitText: {
    color: "rgba(231,238,247,.65)",
    fontSize: 11,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    lineHeight: 16,
  },
  limitStateText: {
    marginTop: 4,
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "900" as const,
    textAlign: "center" as const,
  },

  msgBubble: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    maxWidth: "85%" as const,
  },
  msgText: { color: "#F9FAFB", lineHeight: 22, fontWeight: "700" as const, fontSize: 13 },
  msgTime: { marginTop: 6, color: "rgba(231,238,247,.60)", fontSize: 11, fontWeight: "800" as const },

  typingBubble: {
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(212,175,55,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: "70%" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },

  jumpBtn: {
    position: "absolute" as const,
    right: 16,
    bottom: 150,
    backgroundColor: "rgba(3,7,18,0.92)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  jumpText: { color: "#E5E7EB", fontSize: 11, fontWeight: "900" as const },

  composerDock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(3,7,18,0.92)",
    paddingHorizontal: 12,
    paddingTop: 10,
  },

  inlineInfo: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,.25)",
    backgroundColor: "rgba(251,191,36,.10)",
    marginBottom: 10,
  },
  inlineInfoText: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800" as const,
    textAlign: "right" as const,
    lineHeight: 18,
  },

  inputRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    height: 46,
    justifyContent: "center" as const,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  input: { color: "#E5E7EB", fontWeight: "700" as const, textAlign: "right" as const },

  sendBtn: {
    width: 52,
    height: 46,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },

  disclaimer: {
    marginTop: 8,
    color: "rgba(231,238,247,.55)",
    fontSize: 11,
    textAlign: "center" as const,
    lineHeight: 16,
    fontWeight: "800" as const,
    paddingBottom: 2,
  },

  toastWrap: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  toastText: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800" as const,
    lineHeight: 18,
    textAlign: "right" as const,
  },
  toastClose: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.55)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 18,
  },
  modalCard: {
    width: "100%" as const,
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: "rgba(3,7,18,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    padding: 16,
    overflow: "hidden" as const,
  },
  modalTitleRow: { flexDirection: "row-reverse" as const, alignItems: "center" as const, gap: 8, marginBottom: 10 },
  modalTitle: { color: "#F9FAFB", fontWeight: "900" as const, fontSize: 16 },
  modalBody: {
    color: "rgba(231,238,247,.75)",
    lineHeight: 22,
    textAlign: "right" as const,
    fontWeight: "700" as const,
  },
  modalBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center" as const,
  },
  modalBtnText: { color: "#E5E7EB", fontWeight: "900" as const },
} as const;