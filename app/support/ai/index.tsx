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
  Modal, // ⬅️ اضافه شد
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ SafeAreaView درست
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import BACKEND_URL from "../../../constants/backend";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };
const K_AI_HISTORY = "phoenix.ai.history.v1";

const bubble = (mine: boolean) => ({
  alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
  backgroundColor: mine ? "#FF6B00" : "#1a1a1a",
  borderColor: mine ? "#FF6B00" : "#333",
});

const toFaDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const hhmm = (ts: number) =>
  toFaDigits(new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));

/* ────────────── تایپینگ داتس (سه‌نقطه متحرک) ────────────── */
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

/* ────────────── امتیاز احساس (خیلی ساده) ────────────── */
function scoreSentiment(text: string) {
  const pos = ["امید", "بهتر", "خوب", "آرام", "آرامش", "کمک", "بهبود", "قوی", "قدرت", "رشد", "پیشرفت"];
  const neg = ["استرس", "اضطراب", "نگران", "غم", "غمگین", "ترس", "عصبانی", "خشم", "ناامید", "بد"];
  const t = text.toLowerCase();
  let s = 0;
  pos.forEach((w) => (t.includes(w) ? (s += 1) : null));
  neg.forEach((w) => (t.includes(w) ? (s -= 1) : null));
  if (s > 2) s = 2;
  if (s < -2) s = -2;
  return s;
}

/* نمودار ستونی کوچک (بدون کتابخانه) برای آخرین 8 امتیاز */
function MoodMiniChart({ values }: { values: number[] }) {
  const data = values.slice(-8);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 36 }}>
      {data.map((v, i) => {
        const h = Math.round(((v + 2) / 4) * 32) + 4; // map -2..+2 → 4..36
        const color = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
        return <View key={i} style={{ width: 10, height: h, borderRadius: 4, backgroundColor: color, opacity: 0.9 }} />;
      })}
    </View>
  );
}

export default function AIChatSupport() {
  const rtl = I18nManager.isRTL;

  // 🆔 شناسه یکتا برای کاربر
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

  // state
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

  // اسکرول
  const scrollRef = useRef<ScrollView>(null);
  const [showJump, setShowJump] = useState(false);
  const atBottomRef = useRef(true);

  // نمودار احساس
  const [moodHistory, setMoodHistory] = useState<number[]>([]);

  // 🔐 نمایش مودال حریم خصوصی
  const [showPrivacy, setShowPrivacy] = useState(false);

  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);

  // ---------- Persist: load on mount ----------
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(K_AI_HISTORY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length) setMessages(arr);
        }
        const rawMood = await AsyncStorage.getItem("phoenix.ai.mood.v1");
        if (rawMood) {
          const mv = JSON.parse(rawMood);
          if (Array.isArray(mv)) setMoodHistory(mv);
        }
      } catch {}
    })();
  }, []);

  // Save history whenever messages or mood change
  useEffect(() => {
    AsyncStorage.setItem(K_AI_HISTORY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);
  useEffect(() => {
    AsyncStorage.setItem("phoenix.ai.mood.v1", JSON.stringify(moodHistory)).catch(() => {});
  }, [moodHistory]);

  // ---------- نمایش تدریجی پاسخ (pseudo-stream) ----------
  const typeOut = (fullText: string) =>
    new Promise<void>((resolve) => {
      const id = uuidv4();
      const start: Msg = { id, role: "assistant", content: "", ts: Date.now() };
      setMessages((prev) => [...prev, start]);

      let i = 0;
      const speed = 10; // ms per tick
      const step = Math.max(1, Math.floor(fullText.length / 200)); // سرعت تطبیقی
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

  // ---------- Networking ----------
  const send = async () => {
    const t = text.trim();
    if (!t || loading) return;
    setText("");

    const myMsg: Msg = { id: uuidv4(), role: "user", content: t, ts: Date.now() };
    const nextMessages = [...messages, myMsg];
    setMessages(nextMessages);
    setLoading(true);

    // auto scroll
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const compact = nextMessages.slice(-10).map(({ role, content }) => ({ role, content }));
    const payload = { messages: compact, userId }; // ⬅️ ارسال userId

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

      // ⬅️ نمایش تدریجی پاسخ
      await typeOut(reply);

      // پس از تکمیل پاسخ، امتیاز احساس را به نمودار اضافه کن
      const s = scoreSentiment(reply);
      setMoodHistory((prev) => [...prev, s].slice(-20));
    } catch {
      // در حالت خطا، پیام خطا را به‌صورت عادی اضافه کن (بدون تایپ تدریجی)
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content: "خطا در اتصال به سرور. دوباره تلاش کن یا اینترنت را بررسی کن.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ---------- Scroll helpers ----------
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const paddingToBottom = 24;
    const atBottom =
      contentOffset.y + layoutMeasurement.height + paddingToBottom >= contentSize.height;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };
  const jumpToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setShowJump(false);
  };

  // ---------- Copy / Share ----------
  const onLongPressMsg = (m: Msg) => {
    Alert.alert("پیام", "می‌خواهی با این پیام چه‌کار کنی؟", [
      { text: "کپی متن", onPress: () => Clipboard.setStringAsync(m.content) },
      { text: "اشتراک‌گذاری", onPress: () => Share.share({ message: m.content }).catch(() => {}) },
      { text: "بستن", style: "cancel" },
    ]);
  };

  /* ✅ دکمه پاک‌کردن تاریخچه + تأیید */
  const clearHistory = async () => {
    await AsyncStorage.multiRemove([K_AI_HISTORY, "phoenix.ai.mood.v1"]);
    setMoodHistory([]);
    setMessages([
      {
        id: "sys-hello",
        role: "assistant",
        content: "سلام 🌿 من پشتیبان هوشمند ققنوس هستم. بنویس چی ذهنت رو درگیر کرده، تا با هم بررسیش کنیم… 💬",
        ts: Date.now(),
      },
    ]);
  };
  const confirmClear = () => {
    Alert.alert(
      "حذف تاریخچه؟",
      "همه پیام‌های گفتگو پاک می‌شود.",
      [
        { text: "انصراف", style: "cancel" },
        { text: "پاک کن", style: "destructive", onPress: clearHistory },
      ]
    );
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#000" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          {/* 🗑️ دکمه پاک‌کردن تاریخچه (گوشه راست بالا) */}
          <TouchableOpacity
            onPress={confirmClear}
            style={{ position: "absolute", right: 16, top: 8, padding: 6, zIndex: 10 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color="#ff6666" />
          </TouchableOpacity>

          {/* 🛡️ دکمه حریم خصوصی (گوشه چپ بالا) */}
          <TouchableOpacity
            onPress={() => setShowPrivacy(true)}
            style={{ position: "absolute", left: 16, top: 8, padding: 6, zIndex: 10 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#A3E635" />
          </TouchableOpacity>

          <Text
            style={{ color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center", marginTop: 6 }}
          >
            پشتیبان هوشمند
          </Text>
          <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 6, textAlign: "center" }}>
            ✨ بنویس تا مثل یه درمانگرِ واقعی راهنماییت کنم
          </Text>

          {/* ✅ نمودار احساسی کوچک */}
          {moodHistory.length > 0 && (
            <View style={{ marginTop: 10, alignItems: "center", gap: 6 }}>
              <MoodMiniChart values={moodHistory} />
              <Text style={{ color: "#9ca3af", fontSize: 11 }}>روند احساسی پاسخ‌های اخیر</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
          onContentSizeChange={() => {
            if (atBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
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
                <Text style={{ color: "#fff", textAlign: rtl ? "right" : "left", lineHeight: 22 }}>
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

          {/* typing indicator (زمانی که منتظریم) */}
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
              borderColor: "#333",
              borderRadius: 12,
              height: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="بنويس"
              placeholderTextColor="#777"
              style={{ color: "#fff", textAlign: rtl ? "left" : "right" }}
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
            {/* جهت نوک فلش به سمت راست */}
            <Ionicons name="send" size={20} color="#fff" style={{ transform: [{ scaleX: 1 }] }} />
          </TouchableOpacity>
        </View>

        {/* ⬇️⬇️⬇️  فقط این بخش جدید اضافه شد: متن ریز هشدار زیر باکس ورودی */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, backgroundColor: "#000" }}>
          <Text style={{ color: "#6b7280", fontSize: 11, textAlign: "center", lineHeight: 16 }}>
            ⚠️ پشتیبان هوشمند ققنوس ممکنه گاهی اشتباه کنه؛{"\n"} برای تصمیم‌های مهم با درمانگر واقعی مشورت کن.
          </Text>
        </View>
        {/* ⬆️⬆️⬆️  پایان بخش جدید */}
      </KeyboardAvoidingView>

      {/* 🔐 مودال راهنمای حریم خصوصی */}
      <Modal
        visible={showPrivacy}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacy(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "center", alignItems: "center" }}>
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
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color="#A3E635" />
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>توصیه‌های حریم خصوصی</Text>
            </View>
            <Text style={{ color: "#cbd5e1", lineHeight: 22, textAlign: "right" }}>
               • از وارد کردن اطلاعات شناسایی حساس، خودداری کن (کد ملی، شماره کارت، آدرس دقیق).{"\n"}
              • این بخش جایگزین رواندرمانی یا پشتیبانی واقعی نیست. در شرایط خطر ياخودآسیبی، با شماره‌های امدادی تماس بگیر يا به پشتيبان واقعی ققنوس پیام بفرست.{"\n"}
              • گفتگوها برای بهبود تجربه کاربری، روی دستگاه تو نگه داشته میشن ولی میتونی هر زمان نیاز داشتی از دکمهٔ
              «سطل زباله» برای پاک‌کردن تاریخچه استفاده کنی.{"\n"}
              • برای پاسخ‌گویی، متن پرسش به سرور ققنوس ارسال میشه تا مدل هوش مصنوعی پاسخ بسازه.{"\n"}
              • از فرستادن فایل تصویری که اطلاعات خصوصی داره خودداری کن.{"\n"}
              • اگر  زیر ۱۸ سالی، حتماً از والدین خودت کمک بگیر.{"\n"}
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