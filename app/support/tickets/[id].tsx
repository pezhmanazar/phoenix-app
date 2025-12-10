// app/support/tickets/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  Stack,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  I18nManager,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ViewStyle } from "react-native";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../../lib/plan";

/* ===== انواع ===== */
type MessageType = "text" | "voice" | "image" | "file";

type Message = {
  id: string;
  ticketId: string;
  sender: "user" | "admin";
  type?: MessageType;
  text?: string | null;
  fileUrl?: string | null;
  mime?: string | null;
  durationSec?: number | null;
  ts?: string;
  createdAt?: string;
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  contact?: string | null;
  status: "open" | "pending" | "closed";
  type: "tech" | "therapy";
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

type PlanView = "free" | "pro" | "expiring" | "expired";

/* برای پاس دادن کاربر به Composer */
type UserIdentity = {
  id?: string;
  phone?: string;
  fullName?: string | null;
};

/* تشخیص نوع پیام بر اساس mime یا url */
function detectType(m?: string | null, url?: string | null): MessageType {
  const mime = (m || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "voice";
  if (mime) return "file";

  const u = (url || "").toLowerCase();
  if (
    u.endsWith(".png") ||
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".webp")
  )
    return "image";
  if (
    u.endsWith(".mp3") ||
    u.endsWith(".wav") ||
    u.endsWith(".m4a") ||
    u.endsWith(".ogg")
  )
    return "voice";
  if (u) return "file";
  return "text";
}

/* گرفتن نام/شناسه کاربر از استوریج (فallback قدیمی) */
async function getUserIdentity() {
  try {
    const keys = ["user_profile", "profile", "me", "phoenix_profile"];
    let raw: string | null = null;
    for (const k of keys) {
      raw = await AsyncStorage.getItem(k);
      if (raw) break;
    }
    const p = raw ? JSON.parse(raw) : {};
    const openedById =
      p?.id || p?.userId || p?.uid || p?.phone || p?.mobile || p?.email || "";
    const openedByName =
      p?.fullName || p?.name || p?.displayName || p?.phone || "کاربر";
    return {
      openedById: String(openedById || ""),
      openedByName: String(openedByName || "کاربر"),
    };
  } catch {
    return { openedById: "", openedByName: "کاربر" };
  }
}

/* ترجیح: استفاده از me؛ در صورت نبود، fallback به getUserIdentity */
async function resolveIdentity(fromUser?: UserIdentity | null) {
  if (fromUser) {
    const openedById = fromUser.phone || fromUser.id || "";
    const openedByName = fromUser.fullName || fromUser.phone || "کاربر";
    return {
      openedById: String(openedById || ""),
      openedByName: String(openedByName || "کاربر"),
    };
  }
  return await getUserIdentity();
}

/* خواندن پیام خطا */
function extractErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

/* ================= Image Lightbox ================= */
function ImageLightbox({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef<number>(0);

  const onDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 250) {
      Animated.timing(scale, {
        // @ts-ignore
        toValue: (scale as any).__getValue?.() > 1 ? 1 : 2,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
    lastTap.current = now;
  };

  useEffect(() => {
    if (!visible) scale.setValue(1);
  }, [visible, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lbBackdrop}>
        <Pressable style={styles.lbClose} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Pressable style={styles.lbArea} onPress={onDoubleTap}>
          <Animated.Image
            source={{ uri }}
            style={[styles.lbImage, { transform: [{ scale }] }]}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </Modal>
  );
}

/* ================= Voice Player ================= */
let currentSound: Audio.Sound | null = null;
let setGlobalPlaying: ((activeId: string | null) => void) | null = null;

function Waveform({
  progress = 0,
  tint = "#fff",
}: {
  progress?: number;
  tint?: string;
}) {
  const bars = 64;
  const arr = Array.from({ length: bars }, (_, i) => {
    return 6 + Math.floor(8 * Math.abs(Math.sin(i * 0.37)));
  });
  const activeCount = Math.floor(arr.length * progress);
  const inactive =
    tint === "#000" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: 28 }}>
      {arr.map((h, i) => {
        const active = i <= activeCount;
        return (
          <View
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              marginHorizontal: 1,
              backgroundColor: active ? tint : inactive,
            }}
          />
        );
      })}
    </View>
  );
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function VoicePlayer({
  id,
  uri,
  durationSec,
  dark = false,
}: {
  id: string;
  uri: string;
  durationSec?: number | null;
  dark?: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState((durationSec ?? 0) * 1000);
  const [rate, setRate] = useState<1 | 1.5 | 2>(1);
  const [finished, setFinished] = useState(false);

  const wfWidth = useRef(1);
  const isDragging = useRef(false);

  useEffect(() => {
    setGlobalPlaying = async (activeId: string | null) => {
      if (activeId !== id && sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {}
        setSound(null);
        setPlaying(false);
        setProgress(0);
        setPos(0);
        setFinished(false);
      }
    };
  }, [id, sound]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
    return () => {
      if (sound) sound.unloadAsync().catch(() => {});
      if (currentSound === sound) currentSound = null;
    };
  }, [sound]);

  const applyRate = async (s: Audio.Sound, r: 1 | 1.5 | 2) => {
    try {
      await s.setRateAsync(r, true);
    } catch {}
  };

  const ensureLoaded = useCallback(
    async (autoplay: boolean) => {
      if (sound) return sound;
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: autoplay }
      );
      setSound(s);
      s.setOnPlaybackStatusUpdate((st: any) => {
        if (!st?.isLoaded) return;
        if (typeof st.durationMillis === "number") setDur(st.durationMillis);
        if (!isDragging.current && typeof st.positionMillis === "number") {
          setPos(st.positionMillis);
          if (st.durationMillis)
            setProgress(st.positionMillis / st.durationMillis);
        }
        if (st.didJustFinish) {
          setPlaying(false);
          setFinished(true);
          setProgress(1);
          setPos(st.durationMillis || 0);
        } else {
          setPlaying(st.isPlaying);
        }
      });
      await applyRate(s, rate);
      return s;
    },
    [sound, uri, rate]
  );

  const onToggle = useCallback(async () => {
    if (!uri) return;
    try {
      if (currentSound && currentSound !== sound) {
        try {
          await currentSound.stopAsync();
          await currentSound.unloadAsync();
        } catch {}
        currentSound = null;
        setGlobalPlaying && setGlobalPlaying(id);
      }
      const s = await ensureLoaded(true);
      currentSound = s;

      if (finished || (dur && pos >= dur - 300)) {
        try {
          await s.setPositionAsync(0);
        } catch {}
        setFinished(false);
        setPos(0);
        setProgress(0);
      }

      const st = await s.getStatusAsync();
      if ("isPlaying" in st && st.isPlaying) {
        await s.pauseAsync();
        setPlaying(false);
      } else {
        await applyRate(s, rate);
        await s.playAsync();
        setPlaying(true);
      }
    } catch {}
  }, [id, uri, sound, finished, pos, dur, ensureLoaded, rate]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const ratio =
          (evt.nativeEvent.locationX ?? 0) / (wfWidth.current || 1);
        seekToRatio(ratio);
      },
      onPanResponderMove: (evt) => {
        const ratio =
          (evt.nativeEvent.locationX ?? 0) / (wfWidth.current || 1);
        seekToRatio(ratio);
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    })
  ).current;

  const seekToRatio = async (ratio: number) => {
    const clamped = Math.min(1, Math.max(0, ratio));
    const newPos = (dur || (durationSec ?? 0) * 1000) * clamped;
    if (sound) {
      try {
        await sound.setPositionAsync(newPos);
      } catch {}
    }
    setPos(newPos);
    if (dur) setProgress(newPos / dur);
    setFinished(false);
  };

  const cycleRate = async () => {
    const next: 1 | 1.5 | 2 = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (sound) await applyRate(sound, next);
  };

  const tint = dark ? "#000" : "#fff";
  const subTint = dark ? "#222" : "#aaa";

  return (
    <View style={{ gap: 10, width: "100%" }}>
      <View
        style={{ width: "100%", overflow: "hidden" }}
        onLayout={(e) => (wfWidth.current = e.nativeEvent.layout.width || 1)}
        {...pan.panHandlers}
      >
        <Waveform progress={progress} tint={tint} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={onToggle}
          style={{
            backgroundColor: dark ? "#fff" : "#111",
            borderWidth: 1,
            borderColor: dark ? "#ddd" : "#333",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={18}
            color={dark ? "#000" : "#fff"}
          />
        </TouchableOpacity>
        {dur ? (
          <Text style={{ color: subTint, fontSize: 12 }}>
            {fmt(pos)} / {fmt(dur)}
          </Text>
        ) : (
          <View />
        )}
        <TouchableOpacity
          onPress={cycleRate}
          activeOpacity={0.8}
          style={styles.speedBtn}
        >
          <Text
            style={{
              color: dark ? "#000" : "#fff",
              fontWeight: "800",
            }}
          >
            {rate}×
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================= Composer ================= */
const MAX_VOICE_MS = 5 * 60 * 1000;

// آیا شناسه در URL در واقع نوع تیکت است؟
const parseTicketType = (idLike?: string): "tech" | "therapy" | null =>
  idLike === "tech" || idLike === "therapy" ? idLike : null;

function Composer({
  ticketId,
  ticketType,
  isPro,
  user,
  onTicketCreated,
  onSent,
  onMeasureHeight,
}: {
  ticketId: string;
  ticketType?: "tech" | "therapy" | null;
  isPro: boolean;
  user?: UserIdentity | null;
  onTicketCreated?: (newId: string) => void;
  onSent: () => void;
  onMeasureHeight?: (h: number) => void;
}) {
  const { colors, dark } = useTheme();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recMs, setRecMs] = useState(0);
  const [recURI, setRecURI] = useState<string | null>(null);
  const [image, setImage] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);

  const hasText = text.trim().length > 0;
  const hasAttachment = !!image || !!recURI;

  const isTherapy = ticketType === "therapy";
  const lockedForPlan = isTherapy && !isPro;

  const planGuard = () => {
    if (!lockedForPlan) return false;
    Alert.alert(
      "نیاز به اشتراک PRO",
      "ارسال پیام به درمانگر ققنوس فقط برای کاربرانی فعاله که اشتراک PRO را از تب «پرداخت» فعال کرده‌اند. اگر مشکل فنی یا سؤال عمومی داری، می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی.",
      [{ text: "باشه" }]
    );
    return true;
  };

  const onLayout = (e: any) =>
    onMeasureHeight?.(Math.max(64, e.nativeEvent.layout.height || 0));

  const pickImage = async () => {
    if (planGuard()) return;
    Keyboard.dismiss();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("اجازه دسترسی به گالری داده نشد.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setImage({
        uri: a.uri,
        type: a.mimeType || "image/jpeg",
        name: a.fileName || `photo_${Date.now()}.jpg`,
      });
    }
  };

  const startRecording = async () => {
    if (planGuard()) return;
    Keyboard.dismiss();
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        alert("دسترسی میکروفون داده نشد.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      rec.setOnRecordingStatusUpdate((st) => {
        if (!st.canRecord) return;
        const ms = st.durationMillis ?? 0;
        setRecMs(ms);
        if (ms >= MAX_VOICE_MS) stopRecording(true).catch(() => {});
      });
      await rec.startAsync();
      setRecording(rec);
      setRecURI(null);
      setRecMs(0);
    } catch {
      alert("شروع ضبط ناموفق بود.");
    }
  };

  const stopRecording = async (auto = false) => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecURI(uri || null);
    } catch {}
    setRecording(null);
    if (!auto) await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  };

  const resetAttachments = () => {
    setImage(null);
    setRecURI(null);
    setRecMs(0);
  };

  const createTicketIfNeeded = async (textFallback: string) => {
    // اگر id واقعی داریم (نه tech/therapy) همون رو استفاده کن
    if (!ticketType) return ticketId;

    const { openedById, openedByName } = await resolveIdentity(user);

    const payload = {
      type: ticketType, // "tech" | "therapy"
      text:
        textFallback && textFallback.trim()
          ? textFallback.trim()
          : "ضمیمه",
      openedById,
      openedByName,
    };

    console.log(
      "[tickets/send] REQUEST",
      `${BACKEND_URL}/api/public/tickets/send`,
      payload
    );

    const res = await fetch(`${BACKEND_URL}/api/public/tickets/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch (e) {
      console.log(
        "[tickets/send] ERROR parsing JSON",
        res.status,
        res.headers.get("content-type")
      );
      throw new Error("پاسخ سرور قابل خواندن نیست (JSON نبود).");
    }

    console.log("[tickets/send] RESPONSE", res.status, json);

    if (!res.ok || !json?.ok) {
      const serverErr =
        typeof json?.error === "string"
          ? json.error
          : undefined;
      const msg =
        serverErr && serverErr.trim().length
          ? serverErr
          : "ساخت تیکت ناموفق بود";
      throw new Error(msg);
    }

    const newId: unknown =
      (json.ticket && json.ticket.id) || json.ticketId || json.id;

    if (!newId || typeof newId !== "string") {
      console.log(
        "[tickets/send] invalid id in response",
        JSON.stringify(json, null, 2)
      );
      throw new Error(
        "ساخت تیکت انجام شد اما شناسهٔ تیکت از سرور برنگشت."
      );
    }

    onTicketCreated?.(newId);
    return newId;
  };

  const sendText = async () => {
    if (!hasText) return;
    if (planGuard()) return;

    try {
      setSending(true);
      const textPayload = text.trim();

      let targetId = ticketId;
      if (ticketType) {
        // اگر صفحه برای نوع تیکت است (tech/therapy)، اول تیکت بساز
        targetId = await createTicketIfNeeded(textPayload);
        setText("");
        onSent();
        return;
      }

      const { openedById, openedByName } = await resolveIdentity(user);
      const res = await fetch(
        `${BACKEND_URL}/api/public/tickets/${targetId}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            text: textPayload,
            openedById,
            openedByName,
          }),
        }
      );

      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (!res.ok || !json?.ok) {
        const msg = extractErrorMessage(json?.error, "ارسال ناموفق");
        throw new Error(msg);
      }

      setText("");
      onSent();
    } catch (e: any) {
      const msg = extractErrorMessage(e, "خطا در ارسال متن");
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const buildForm = async () => {
    const fd = new FormData();

    const { openedById, openedByName } = await resolveIdentity(user);
    fd.append("openedById", String(openedById || ""));
    fd.append("openedByName", String(openedByName || "کاربر"));

    if (hasText) fd.append("text", text.trim());

    if (image) {
      const file: any = {
        uri: image.uri,
        name: image.name,
        type: image.type,
      };
      fd.append("file", file);
      fd.append("attachment", file);
    } else if (recURI) {
      const durationSec = Math.round(recMs / 1000);
      const file: any = {
        uri: recURI,
        name: `voice_${Date.now()}.m4a`,
        type: "audio/m4a",
      };
      fd.append("file", file);
      fd.append("attachment", file);
      fd.append("durationSec", String(durationSec));
    }

    return fd;
  };

  const tryPost = async (url: string, fd: FormData) => {
    const res = await fetch(url, { method: "POST", body: fd });
    let json: any = null;
    try {
      json = await res.json();
    } catch {}
    return { res, json };
  };

  const sendUpload = async () => {
    if (!hasAttachment && !hasText) return;
    if (planGuard()) return;

    try {
      setSending(true);

      let targetId = ticketId;
      if (ticketType) {
        const firstText = hasText ? text.trim() : "ضمیمه";
        targetId = await createTicketIfNeeded(firstText);
      }

      const fd = await buildForm();
      let { res, json } = await tryPost(
        `${BACKEND_URL}/api/public/tickets/${targetId}/reply-upload`,
        fd
      );

      // fallback برای سرور قدیمی
      if (res.status === 404 || json?.error === "not_found") {
        const fd2 = await buildForm();
        ({ res, json } = await tryPost(
          `${BACKEND_URL}/api/public/tickets/${targetId}/reply`,
          fd2
        ));
      }

      if (!res.ok || !json?.ok) {
        const msg = extractErrorMessage(json?.error, "ارسال ناموفق");
        throw new Error(msg);
      }

      setText("");
      resetAttachments();
      onSent();
    } catch (e: any) {
      const msg = extractErrorMessage(e, "خطا در ارسال فایل/ویس");
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.composerWrap} onLayout={onLayout}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="پیام خود را بنویسید…"
        placeholderTextColor={dark ? "#8E8E93" : "#6b7280"}
        style={[
          styles.composerInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        multiline
        textAlignVertical="top"
        scrollEnabled={true}
      />

      {image || recURI ? (
        <View
          style={[
            styles.previewRow,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {image ? (
            <Image
              source={{ uri: image.uri }}
              style={{ width: 64, height: 64, borderRadius: 8 }}
            />
          ) : null}
          {recURI ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="mic" size={18} color={colors.text} />
              <Text style={{ color: colors.text }}>
                {Math.min(300, Math.round(recMs / 1000))}s
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={resetAttachments}
            style={styles.trashBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.composerActions}>
        <TouchableOpacity
          onPress={pickImage}
          style={[
            styles.iconBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: lockedForPlan ? 0.5 : 1,
            },
          ]}
          activeOpacity={0.8}
          disabled={lockedForPlan}
        >
          <Ionicons name="attach" size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {recording ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                fontVariant: ["tabular-nums"],
              }}
            >
              {fmt(recMs)}
            </Text>
            <TouchableOpacity
              onPress={() => stopRecording(false)}
              style={[
                styles.roundBtn,
                { backgroundColor: "#ef4444", borderColor: "#991b1b" },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="stop" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : hasAttachment ? (
          <TouchableOpacity
            onPress={sendUpload}
            style={[
              styles.sendBtn,
              { backgroundColor: "#10b981", opacity: lockedForPlan ? 0.5 : 1 },
            ]}
            disabled={sending || lockedForPlan}
          >
            {sending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: "#000", fontWeight: "800" }}>
                ارسال ضمیمه
              </Text>
            )}
          </TouchableOpacity>
        ) : hasText ? (
          <TouchableOpacity
            onPress={sendText}
            style={[
              styles.roundBtn,
              {
                backgroundColor: "#fbbf24",
                borderColor: "#d97706",
                opacity: lockedForPlan ? 0.5 : 1,
              },
            ]}
            disabled={sending || lockedForPlan}
          >
            {sending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Ionicons name="send" size={18} color="#000" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={startRecording}
            style={[
              styles.roundBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: lockedForPlan ? 0.5 : 1,
              },
            ]}
            activeOpacity={0.85}
            disabled={lockedForPlan}
          >
            <Ionicons name="mic" size={18} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ================= Pin (پین کردن پیام‌ها در کلاینت) ================= */
const pinKey = (ticketId: string) => `pins:${ticketId}`;

async function loadPins(ticketId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(pinKey(ticketId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function savePins(ticketId: string, ids: string[]) {
  try {
    await AsyncStorage.setItem(pinKey(ticketId), JSON.stringify(ids));
  } catch {}
}

/* تاریخ جلالی */
function prettyTsJalali(input?: string) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString("fa-IR-u-ca-persian", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return d.toISOString();
  }
}

/* ================= صفحه تیکت ================= */
export default function TicketDetail() {
  const { colors, dark: isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const rtl = I18nManager.isRTL;
  const insets = useSafeAreaInsets();

  const { me } = useUser();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [planLoaded, setPlanLoaded] = useState(false);

  const typeFromParam = parseTicketType(id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const didInitialScroll = useRef(false);
  const msgPositions = useRef<Record<string, number>>({});
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {}
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {}
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /* سنک وضعیت پلن از روی me (با استفاده از getPlanStatus + PRO_FLAG_KEY) */
  const syncPlanView = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";

      if (status.rawExpiresAt) {
        // پلن تاریخ انقضا دارد
        if (
          status.isExpired &&
          (status.rawPlan === "pro" || status.rawPlan === "vip")
        ) {
          view = "expired";
        } else if (status.isPro || flagIsPro) {
          const d =
            typeof status.daysLeft === "number" ? status.daysLeft : null;
          if (d != null && d > 0 && d <= 7) {
            view = "expiring";
          } else {
            view = "pro";
          }
        } else {
          view = "free";
        }
      } else {
        // بدون تاریخ انقضا → فقط بر اساس isPro یا فلگ لوکال
        view = status.isPro || flagIsPro ? "pro" : "free";
      }

      setPlanView(view);
    } catch (e) {
      setPlanView("free");
    } finally {
      setPlanLoaded(true);
    }
  }, [me]);

  useEffect(() => {
    syncPlanView();
  }, [syncPlanView]);

  useFocusEffect(
    useCallback(() => {
      syncPlanView();
    }, [syncPlanView])
  );

  const fetchTicket = useCallback(
    async (silent: boolean = false) => {
      // اگر id=tech/therapy باشه، یعنی هنوز تیکت واقعی نداریم
      if (typeFromParam) {
        if (!silent) setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        const res = await fetch(`${BACKEND_URL}/api/tickets/${id}`);
        const json = await res.json();
        if (json?.ok) {
          setTicket(json.ticket);
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 0);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, typeFromParam]
  );

  useEffect(() => {
    fetchTicket(false);
  }, [fetchTicket]);

  /* ⬇️ جدید: اگر id = tech/therapy باشد، سعی می‌کنیم تیکت باز کاربر را پیدا کنیم */
  const tryOpenExisting = useCallback(async () => {
    if (!typeFromParam) return;
    try {
      setCheckingExisting(true);

      const { openedById } = await resolveIdentity(me);
      const qs: string[] = [];
      qs.push(`type=${encodeURIComponent(typeFromParam)}`);
      if (openedById) {
        qs.push(`openedById=${encodeURIComponent(openedById)}`);
      }
      const url =
        `${BACKEND_URL}/api/public/tickets/open` +
        (qs.length ? `?${qs.join("&")}` : "");

      console.log("[tickets/open] GET", url);
      const res = await fetch(url);
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      console.log("[tickets/open] RES", res.status, json);

      if (res.ok && json?.ok && json.ticket && json.ticket.id) {
        const t: Ticket = json.ticket;
        setTicket(t);
        loadPins(t.id).then(setPins).catch(() => {});
        router.replace(`/support/tickets/${t.id}`);
      }
    } catch (e) {
      console.log("[tickets/open] error", e);
    } finally {
      setCheckingExisting(false);
    }
  }, [typeFromParam, me, router]);

  useEffect(() => {
    if (typeFromParam) {
      tryOpenExisting();
    }
  }, [typeFromParam, tryOpenExisting]);

  useLayoutEffect(() => {
    const titleType = (ticket?.type || typeFromParam) as
      | "tech"
      | "therapy"
      | null;
    if (!titleType) return;
    const title =
      titleType === "therapy"
        ? "چت با درمانگر ققنوس"
        : "چت با پشتیبانی فنی ققنوس";
    // @ts-ignore
    (navigation as any)?.setOptions?.({ title });
  }, [ticket, navigation, typeFromParam]);

  useEffect(() => {
    if (!ticket?.messages?.length) return;
    let tries = 0;
    let rafId: number;
    const scrollSmoothToEnd = () => {
      scrollRef.current?.scrollToEnd({ animated: true });
      if (++tries < 8) rafId = requestAnimationFrame(scrollSmoothToEnd);
    };
    rafId = requestAnimationFrame(scrollSmoothToEnd);
    didInitialScroll.current = true;
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ticket?.messages?.length]);

  useEffect(() => {
    if (!typeFromParam && id) loadPins(id).then(setPins);
  }, [id, typeFromParam]);

  const togglePin = async (mid: string) => {
    if (typeFromParam || !id) return;
    const exist = pins.includes(mid);
    const next = exist ? pins.filter((x) => x !== mid) : [...pins, mid];
    setPins(next);
    await savePins(id, next);
  };

  const jumpToMessage = (mid: string) => {
    const y = msgPositions.current[mid];
    if (typeof y !== "number" || !scrollRef.current) return;
    scrollRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
  };

  const pinnedList = useMemo(() => {
    if (!ticket) return [];
    const byId = new Map(ticket.messages.map((m) => [m.id, m]));
    return pins
      .map((pid) => byId.get(pid))
      .filter(Boolean) as Message[];
  }, [pins, ticket]);

  const statusChip = useMemo(() => {
    if (!ticket) return null;
    const statusColor =
      ticket.status === "closed"
        ? "#22C55E"
        : ticket.status === "pending"
        ? "#F59E0B"
        : colors.primary;
    const statusLabel =
      ticket.status === "open"
        ? "باز"
        : ticket.status === "pending"
        ? "در انتظار"
        : "بسته";
    return (
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: statusColor + "22",
        }}
      >
        <Text
          style={{
            color: statusColor,
            fontSize: 11,
            fontWeight: "800",
          }}
        >
          {statusLabel}
        </Text>
      </View>
    );
  }, [ticket, colors.primary]);

  const typeChip = useMemo(() => {
    const t = ticket?.type || typeFromParam;
    if (!t) return null;
    const typeColor = t === "therapy" ? "#A855F7" : "#3B82F6";
    const typeLabel = t === "therapy" ? "درمانگر" : "فنی";
    return (
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: typeColor + "22",
        }}
      >
        <Text
          style={{
            color: typeColor,
            fontSize: 11,
            fontWeight: "800",
          }}
        >
          {typeLabel}
        </Text>
      </View>
    );
  }, [ticket, typeFromParam]);

  const chatType = (ticket?.type || typeFromParam) as
    | "tech"
    | "therapy"
    | null;
  const isTherapyChat = chatType === "therapy";

  const isProPlan = planView === "pro" || planView === "expiring";

  // رنگ و متن بج پلن، هماهنگ با تب Subscription
  let badgeBg = "#111827";
  let badgeTextColor = "#E5E7EB";
  let badgeLabel: "FREE" | "PRO" | "EXPIRED" = "FREE";

  if (planView === "pro") {
    badgeBg = "#064E3B"; // سبز تیره
    badgeTextColor = "#4ADE80"; // سبز روشن
    badgeLabel = "PRO";
  } else if (planView === "expiring") {
    badgeBg = "#451A03"; // کهربایی تیره
    badgeTextColor = "#FBBF24"; // زرد
    badgeLabel = "PRO";
  } else if (planView === "expired") {
    badgeBg = "#7F1D1D"; // قرمز تیره
    badgeTextColor = "#FCA5A5"; // قرمز روشن
    badgeLabel = "EXPIRED";
  }

  const headerTitle =
    chatType === "therapy"
      ? "چت با درمانگر ققنوس"
      : "چت با پشتیبانی فنی ققنوس";

  /* حالت قفلِ چت درمانگر وقتی پلن PRO نیست */
  if (planLoaded && isTherapyChat && !isProPlan) {
    const isExpiredView = planView === "expired";
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -1}
      >
        <Stack.Screen options={{ headerShown: false }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header: عنوان راست، بج چپ عنوان */}
          <View
            style={[styles.customHeader, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBack}
              activeOpacity={0.7}
            >
              <Ionicons
                name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>

            <View
              style={{
                flex: 1,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "flex-start",
                columnGap: 8,
              }}
            >
              <Text
                style={[styles.headerText, { color: colors.text }]}
                numberOfLines={1}
              >
                چت با درمانگر ققنوس
              </Text>
              <View style={[styles.planBadge, { backgroundColor: badgeBg }]}>
                <Text
                  style={[
                    styles.planBadgeText,
                    { color: badgeTextColor },
                  ]}
                >
                  {badgeLabel}
                </Text>
              </View>
            </View>

            <View style={{ width: 32 }} />
          </View>

          <View
            style={{
              flex: 1,
              padding: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: 16,
              }}
            >
              {isExpiredView
                ? "اشتراک PRO ققنوس منقضی شده و فعلاً دسترسی به چت مستقیم با درمانگر برایت قفله.\n\nبرای باز شدن دوباره این بخش، اشتراک را از تب «پرداخت» تمدید کن. در این فاصله می‌توانی از «پشتیبان هوشمند» یا «پشتیبانی فنی» استفاده کنی."
                : "دسترسی به چت مستقیم با درمانگر ققنوس فقط برای کاربرانی فعاله که اشتراک PRO را از تب «پرداخت» فعال کرده‌اند.\n\nاگر فعلاً اشتراک نداری، می‌تونی از «پشتیبان هوشمند» یا «پشتیبانی فنی» کمک بگیری."}
            </Text>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginTop: 8,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                برگشت
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  if (!planLoaded || checkingExisting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#8E8E93" }}>در حال آماده‌سازی…</Text>
        </SafeAreaView>
      </>
    );
  }

  if ((loading && !typeFromParam) || (!ticket && !typeFromParam && loading)) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#8E8E93" }}>در حال بارگذاری</Text>
        </SafeAreaView>
      </>
    );
  }

  const renderMessage = (m: Message) => {
    const mine = m.sender === "admin";
    const alignSelf: ViewStyle["alignSelf"] = mine
      ? rtl
        ? "flex-start"
        : "flex-end"
      : rtl
      ? "flex-end"
      : "flex-start";

    const bubbleStyle: ViewStyle[] = [
      styles.msg,
      {
        borderColor: colors.border,
        backgroundColor: mine ? colors.primary : colors.background,
        alignSelf,
      },
    ];
    const textColor = { color: mine ? "#fff" : colors.text };
    const darkBubble = mine;
    const fullURL = m.fileUrl ? `${BACKEND_URL}${m.fileUrl}` : undefined;
    const type: MessageType = m.type || detectType(m.mime, m.fileUrl);
    const isPinned = pins.includes(m.id);
    const stamp = prettyTsJalali(m.ts || m.createdAt);
    const voiceDark = !mine && !isDark ? true : false;

    return (
      <View
        key={m.id}
        style={bubbleStyle}
        onLayout={(e) => {
          msgPositions.current[m.id] = e.nativeEvent.layout.y;
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text style={[{ fontWeight: "800" }, textColor]}>
            {mine ? "پاسخ پشتیبانی" : "شما"}
          </Text>
          <TouchableOpacity
            onPress={() => togglePin(m.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isPinned ? "star" : "star-outline"}
              size={16}
              color={mine ? "#fff" : colors.text}
            />
          </TouchableOpacity>
        </View>

        {type === "image" && fullURL ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setViewerUri(fullURL);
              setViewerVisible(true);
            }}
            style={{ marginTop: 6 }}
          >
            <Image
              source={{ uri: fullURL }}
              style={{ width: 220, height: 220, borderRadius: 10 }}
              resizeMode="cover"
            />
            <Text
              style={{
                color: darkBubble ? "#000" : "#aaa",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              برای بزرگ‌نمایی لمس کنید
            </Text>
          </TouchableOpacity>
        ) : null}

        {type === "voice" && fullURL ? (
          <View style={{ marginTop: 6 }}>
            <VoicePlayer
              id={m.id}
              uri={fullURL}
              durationSec={m.durationSec ?? undefined}
              dark={voiceDark || darkBubble}
            />
          </View>
        ) : null}

        {type === "file" && fullURL ? (
          <TouchableOpacity
            onPress={async () => {
              const ok = await Linking.canOpenURL(fullURL);
              if (ok) Linking.openURL(fullURL);
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: mine
                ? "rgba(0,0,0,0.15)"
                : isDark
                ? "#111"
                : "#eee",
              padding: 10,
              borderRadius: 10,
              marginTop: 6,
            }}
          >
            <Ionicons
              name="document-attach"
              size={18}
              color={mine ? "#fff" : colors.text}
            />
            <Text style={textColor}>دانلود فایل</Text>
          </TouchableOpacity>
        ) : null}

        {!!m.text && (
          <Text style={[{ marginTop: 6 }, textColor]}>{m.text}</Text>
        )}

        {stamp ? (
          <Text
            style={[
              styles.stamp,
              {
                color: mine ? "rgba(255,255,255,0.75)" : "#8E8E93",
                alignSelf: "flex-end",
              },
            ]}
          >
            {stamp}
          </Text>
        ) : null}
      </View>
    );
  };

  const hasMessages = !!ticket?.messages?.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -1}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header مشترک: عنوان راست، بج چپ عنوان */}
        <View
          style={[styles.customHeader, { borderBottomColor: colors.border }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBack}
            activeOpacity={0.7}
          >
            <Ionicons
              name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "flex-start",
              columnGap: 8,
            }}
          >
            <Text
              style={[styles.headerText, { color: colors.text }]}
              numberOfLines={1}
            >
              {headerTitle}
            </Text>

            {isTherapyChat && (
              <View style={[styles.planBadge, { backgroundColor: badgeBg }]}>
                <Text
                  style={[
                    styles.planBadgeText,
                    { color: badgeTextColor },
                  ]}
                >
                  {badgeLabel}
                </Text>
              </View>
            )}
          </View>

          <View style={{ width: 32 }} />
        </View>

        {pinnedList.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
              styles.pinBar,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              columnGap: 8,
            }}
          >
            {pinnedList.map((pm) => {
              const type = detectType(pm.mime, pm.fileUrl);
              const t = pm.text?.trim();
              const label =
                (t && (t.length > 24 ? t.slice(0, 24) + "…" : t)) ||
                (type === "voice"
                  ? "ویس"
                  : type === "image"
                  ? "عکس"
                  : type === "file"
                  ? "فایل"
                  : "پیام");
              return (
                <TouchableOpacity
                  key={pm.id}
                  onPress={() => jumpToMessage(pm.id)}
                  style={[
                    styles.pinChip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text
                    style={[styles.pinText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            rowGap: 12,
            direction: I18nManager.isRTL ? "rtl" : "ltr",
            paddingBottom: insets.bottom + 160,
          }}
          onContentSizeChange={() => {
            if (!didInitialScroll.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
              didInitialScroll.current = true;
            }
          }}
        >
          {hasMessages ? ticket!.messages.map(renderMessage) : <View />}
        </ScrollView>

        <View
          style={[
            styles.composerDock,
            {
              paddingBottom: insets.bottom + 5,
              bottom: 0,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
          pointerEvents="box-none"
        >
          {chatType === "therapy" && !isProPlan && (
            <View
              style={{
                marginBottom: 8,
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 12,
                  textAlign: "right",
                  lineHeight: 18,
                }}
              >
                ارسال پیام به درمانگر ققنوس فقط برای کاربرانی فعاله که اشتراک
                PRO را از تب «پرداخت» فعال کرده‌اند. اگر فعلاً اشتراک نداری،
                می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی.
              </Text>
            </View>
          )}

          <Composer
            ticketId={String(id)}
            ticketType={typeFromParam}
            isPro={isProPlan}
            user={me}
            onTicketCreated={(newId) => {
              router.replace(`/support/tickets/${newId}`);
              loadPins(newId).then(setPins);
            }}
            onSent={() => {
              fetchTicket(true);
              requestAnimationFrame(() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              );
            }}
          />
        </View>

        {viewerUri ? (
          <ImageLightbox
            uri={viewerUri}
            visible={viewerVisible}
            onClose={() => setViewerVisible(false)}
          />
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  headerText: {
    fontSize: 17,
    fontWeight: "900",
  },

  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgeText: {
    fontWeight: "900",
    fontSize: 10,
  },

  pinBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  pinText: { fontSize: 12, fontWeight: "700" },

  msg: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginVertical: 6,
    maxWidth: "88%",
    gap: 6,
  },

  stamp: {
    fontSize: 10,
    marginTop: 4,
  },

  lbBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  lbImage: { width: "100%", height: "100%" },
  lbArea: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  lbClose: { position: "absolute", top: 40, right: 20, zIndex: 2, padding: 10 },

  speedBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "transparent",
  },

  /* Composer */
  composerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    borderTopWidth: 1,
    zIndex: 100,
    elevation: 100,
  },
  composerWrap: { gap: 8 },
  composerInput: {
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  composerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sendBtn: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewRow: {
    alignSelf: "flex-start",
    marginTop: -2,
    marginBottom: -2,
    borderWidth: 1,
    padding: 6,
    borderRadius: 10,
    position: "relative",
  },
  trashBtn: {
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#991b1b",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
});