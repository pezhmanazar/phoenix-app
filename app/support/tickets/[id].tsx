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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ViewStyle } from "react-native";
import BACKEND_URL from "../../../constants/backend";
import { useUser } from "../../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../../lib/plan";

// ✅ مسیر را اگر متفاوت است فقط همین خط را اصلاح کن
import PlanStatusBadge from "../../../components/PlanStatusBadge";

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
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
    <View style={{ flexDirection: "row", alignItems: "center", height: 26 }}>
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
  const subTint = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.70)";

  return (
    <View style={{ gap: 8, width: "100%" }}>
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
            backgroundColor: dark ? "#fff" : "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: dark ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.18)",
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
          }}
          activeOpacity={0.85}
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={16}
            color={dark ? "#000" : "#fff"}
          />
        </TouchableOpacity>

        {dur ? (
          <Text style={{ color: subTint, fontSize: 11, fontWeight: "800" }}>
            {fmt(pos)} / {fmt(dur)}
          </Text>
        ) : (
          <View />
        )}

        <TouchableOpacity
          onPress={cycleRate}
          activeOpacity={0.85}
          style={styles.speedBtn}
        >
          <Text style={{ color: dark ? "#000" : "#fff", fontWeight: "900" }}>
            {rate}×
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================= Banner ================= */
function Banner({ text, onClose }: { text: string; onClose: () => void }) {
  if (!text) return null;
  return (
    <View style={styles.bannerWrap}>
      <View style={styles.banner}>
        <Ionicons name="alert-circle" size={18} color="#FDBA74" />
        <Text style={styles.bannerText} numberOfLines={3}>
          {text}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.85}
          style={styles.bannerClose}
        >
          <Ionicons name="close" size={18} color="#E5E7EB" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================= Composer ================= */
const MAX_VOICE_MS = 5 * 60 * 1000;
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
  onError,
}: {
  ticketId: string;
  ticketType?: "tech" | "therapy" | null;
  isPro: boolean;
  user?: UserIdentity | null;
  onTicketCreated?: (newId: string, fullTicket?: Ticket | null) => void;
  onSent: (updatedTicket?: Ticket | null) => void;
  onMeasureHeight?: (h: number) => void;
  onError: (msg: string) => void;
}) {
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
    onError(
      "ارسال پیام به درمانگر فقط برای اعضای PRO فعاله. برای فعال‌سازی از تب «پرداخت» اقدام کن یا فعلاً از پشتیبانی فنی/هوشمند استفاده کن."
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
      onError("اجازه دسترسی به گالری داده نشد.");
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
        onError("دسترسی میکروفون داده نشد.");
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
      onError("شروع ضبط ناموفق بود.");
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
    if (!ticketType) return ticketId;

    const { openedById, openedByName } = await resolveIdentity(user);

    const payload = {
      type: ticketType,
      text:
        textFallback && textFallback.trim()
          ? textFallback.trim()
          : "ضمیمه",
      openedById,
      openedByName,
    };

    const res = await fetch(`${BACKEND_URL}/api/public/tickets/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      throw new Error("پاسخ سرور قابل خواندن نیست (JSON نبود).");
    }

    if (!res.ok || !json?.ok) {
      const serverErr = typeof json?.error === "string" ? json.error : undefined;
      const msg =
        serverErr && serverErr.trim().length ? serverErr : "ساخت تیکت ناموفق بود";
      throw new Error(msg);
    }

    const newId: unknown =
      (json.ticket && json.ticket.id) || json.ticketId || json.id;
    if (!newId || typeof newId !== "string") {
      throw new Error("ساخت تیکت انجام شد اما شناسهٔ تیکت از سرور برنگشت.");
    }

    const fullTicket: Ticket | null = json.ticket ?? null;
    onTicketCreated?.(newId, fullTicket);
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
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text: textPayload, openedById, openedByName }),
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

      const updatedTicket: Ticket | null = json.ticket ?? null;
      setText("");
      onSent(updatedTicket);
    } catch (e: any) {
      onError(extractErrorMessage(e, "خطا در ارسال متن"));
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
      const file: any = { uri: image.uri, name: image.name, type: image.type };
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
    let rawText = "";
    try {
      rawText = await res.text();
    } catch {}
    let json: any = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      json = null;
    }
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

      if (!res.ok || !json?.ok) {
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

      const updatedTicket: Ticket | null = json.ticket ?? null;
      setText("");
      resetAttachments();
      onSent(updatedTicket);
    } catch (e: any) {
      onError(extractErrorMessage(e, "خطا در ارسال فایل/ویس"));
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
        placeholderTextColor="rgba(231,238,247,.55)"
        style={styles.composerInput}
        multiline
        textAlignVertical="top"
        scrollEnabled
      />

      {image || recURI ? (
        <View style={styles.previewRow}>
          {image ? (
            <Image
              source={{ uri: image.uri }}
              style={{ width: 56, height: 56, borderRadius: 10 }}
            />
          ) : null}
          {recURI ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <Ionicons name="mic" size={16} color="#E5E7EB" />
              <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
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
          style={[styles.iconBtn, { opacity: lockedForPlan ? 0.5 : 1 }]}
          activeOpacity={0.8}
          disabled={lockedForPlan}
        >
          <Ionicons name="attach" size={18} color="#E5E7EB" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {recording ? (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
            <Text style={styles.recTimer}>{fmt(recMs)}</Text>
            <TouchableOpacity
              onPress={() => stopRecording(false)}
              style={[styles.roundBtn, { backgroundColor: "#ef4444", borderColor: "#991b1b" }]}
              activeOpacity={0.85}
            >
              <Ionicons name="stop" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : hasAttachment ? (
          <TouchableOpacity
            onPress={sendUpload}
            style={[styles.sendBtn, { opacity: lockedForPlan ? 0.5 : 1 }]}
            disabled={sending || lockedForPlan}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.sendBtnText}>ارسال ضمیمه</Text>
            )}
          </TouchableOpacity>
        ) : hasText ? (
          <TouchableOpacity
            onPress={sendText}
            style={[
              styles.roundBtn,
              {
                backgroundColor: "rgba(212,175,55,.18)",
                borderColor: "rgba(212,175,55,.32)",
              },
            ]}
            disabled={sending || lockedForPlan}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color="#D4AF37" />
            ) : (
              <Ionicons name="send" size={18} color="#D4AF37" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={startRecording}
            style={styles.roundBtn}
            activeOpacity={0.85}
            disabled={lockedForPlan}
          >
            <Ionicons name="mic" size={18} color="#E5E7EB" />
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
  const [checkingExisting, setCheckingExisting] = useState(!!typeFromParam);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const [banner, setBanner] = useState<string>("");

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

  const pushError = useCallback((msg: string) => {
    const clean = (msg || "").trim();
    if (!clean) return;
    setBanner(clean);
  }, []);

  /* سنک وضعیت پلن از روی me */
  const syncPlanView = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";

      if (status.rawExpiresAt) {
        if (
          status.isExpired &&
          (status.rawPlan === "pro" || status.rawPlan === "vip")
        ) {
          view = "expired";
        } else if (status.isPro || flagIsPro) {
          const d = typeof status.daysLeft === "number" ? status.daysLeft : null;
          if (d != null && d > 0 && d <= 7) view = "expiring";
          else view = "pro";
        } else view = "free";
      } else {
        view = status.isPro || flagIsPro ? "pro" : "free";
      }

      setPlanView(view);
    } catch {
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
      if (typeFromParam) {
        if (!silent) setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        const url = `${BACKEND_URL}/api/public/tickets/${id}?ts=${Date.now()}`;
        const res = await fetch(url);
        let json: any = null;
        try {
          json = await res.json();
        } catch {}
        if (json?.ok && json.ticket) setTicket(json.ticket);
      } catch (e: any) {
        pushError(extractErrorMessage(e, "خطا در دریافت گفتگو"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, typeFromParam, pushError]
  );

  useEffect(() => {
    fetchTicket(false);
  }, [fetchTicket]);

  useFocusEffect(
    useCallback(() => {
      if (typeFromParam) return;
      if (!id) return;

      fetchTicket(true);
      const interval = setInterval(() => fetchTicket(true), 8000);
      return () => clearInterval(interval);
    }, [id, typeFromParam, fetchTicket])
  );

  const tryOpenExisting = useCallback(async () => {
    if (!typeFromParam) return;
    try {
      setCheckingExisting(true);

      const { openedById } = await resolveIdentity(me);
      const qs: string[] = [];
      qs.push(`type=${encodeURIComponent(typeFromParam)}`);
      if (openedById) qs.push(`openedById=${encodeURIComponent(openedById)}`);
      qs.push(`ts=${Date.now()}`);

      const url = `${BACKEND_URL}/api/public/tickets/open?${qs.join("&")}`;
      const res = await fetch(url);

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json?.ok && json.ticket && json.ticket.id) {
        const t: Ticket = json.ticket;
        setTicket(t);
        loadPins(t.id).then(setPins).catch(() => {});
        router.replace(`/support/tickets/${t.id}`);
      }
    } catch (e: any) {
      pushError(extractErrorMessage(e, "خطا در آماده‌سازی گفتگو"));
    } finally {
      setCheckingExisting(false);
    }
  }, [typeFromParam, me, router, pushError]);

  useEffect(() => {
    if (typeFromParam) tryOpenExisting();
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
    scrollRef.current.scrollTo({ y: Math.max(0, y - 72), animated: true });
  };

  const pinnedList = useMemo(() => {
    if (!ticket) return [];
    const byId = new Map(ticket.messages.map((m) => [m.id, m]));
    return pins.map((pid) => byId.get(pid)).filter(Boolean) as Message[];
  }, [pins, ticket]);

  const chatType = (ticket?.type || typeFromParam) as "tech" | "therapy" | null;
  const isTherapyChat = chatType === "therapy";
  const isProPlan = planView === "pro" || planView === "expiring";
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
      >
        <Stack.Screen options={{ headerShown: false }} />

        <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
          <View pointerEvents="none" style={styles.bgGlowTop} />
          <View pointerEvents="none" style={styles.bgGlowBottom} />

          {/* ✅ Header مثل index: back + title + badge */}
          <View style={[styles.headerBar, { paddingTop: 10 }]}>
            <TouchableOpacity
              style={styles.backBtn}
              activeOpacity={0.7}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-forward" size={22} color="#E5E7EB" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                چت با درمانگر ققنوس
              </Text>
            </View>

            <View style={styles.headerLeft}>
              <PlanStatusBadge me={me} showExpiringText />
            </View>
          </View>

          <Banner text={banner} onClose={() => setBanner("")} />

          <View style={styles.lockWrap}>
            <View style={styles.lockCard}>
              <View pointerEvents="none" style={styles.lockCardGlow} />
              <View style={styles.lockIcon}>
                <Ionicons name="lock-closed" size={22} color="#D4AF37" />
              </View>
              <Text style={styles.lockTitle}>
                {isExpiredView ? "اشتراکت منقضی شده" : "این بخش مخصوص اعضای PRO است"}
              </Text>
              <Text style={styles.lockBody}>
                {isExpiredView
                  ? "برای باز شدن دوباره‌ی چت درمانگر، اشتراک PRO را تمدید کن. تا آن زمان می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی."
                  : "برای ارسال پیام به درمانگر، باید اشتراک PRO را از تب «پرداخت» فعال کنی. در این فاصله می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی."}
              </Text>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.9} style={styles.lockBtn}>
                <Text style={styles.lockBtnText}>برگشت</Text>
                <Ionicons name="chevron-back" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  if (typeFromParam && checkingExisting) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
          <View pointerEvents="none" style={styles.bgGlowTop} />
          <View pointerEvents="none" style={styles.bgGlowBottom} />
          <View style={styles.center}>
            <ActivityIndicator color="#D4AF37" />
            <Text style={styles.centerText}>در حال آماده‌سازی گفتگو…</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  if (!typeFromParam && loading && !ticket) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
          <View pointerEvents="none" style={styles.bgGlowTop} />
          <View pointerEvents="none" style={styles.bgGlowBottom} />
          <View style={styles.center}>
            <ActivityIndicator color="#D4AF37" />
            <Text style={styles.centerText}>در حال بارگذاری گفتگو…</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  const renderMessage = (m: Message) => {
    const isAdmin = m.sender === "admin";
    const alignSelf: ViewStyle["alignSelf"] = isAdmin ? "flex-start" : "flex-end";

    const bubbleStyle: ViewStyle[] = [
      styles.msg,
      isAdmin ? styles.msgAdmin : styles.msgUser,
      { alignSelf },
    ];

    const textColor = isAdmin ? "#F9FAFB" : "#E5E7EB";
    const subColor = isAdmin ? "rgba(249,250,251,.72)" : "rgba(231,238,247,.62)";

    const fullURL = m.fileUrl ? `${BACKEND_URL}${m.fileUrl}` : undefined;
    const type: MessageType = m.type || detectType(m.mime, m.fileUrl);
    const isPinned = pins.includes(m.id);
    const stamp = prettyTsJalali(m.ts || m.createdAt);

    return (
      <View
        key={m.id}
        style={bubbleStyle}
        onLayout={(e) => {
          msgPositions.current[m.id] = e.nativeEvent.layout.y;
        }}
      >
        <View style={styles.msgTopRow}>
          <Text style={[styles.msgWho, { color: textColor }]}>
            {isAdmin ? "پاسخ پشتیبانی" : "شما"}
          </Text>
          <TouchableOpacity onPress={() => togglePin(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isPinned ? "star" : "star-outline"}
              size={15}
              color={isAdmin ? "#FBBF24" : "#D4AF37"}
            />
          </TouchableOpacity>
        </View>

        {type === "image" && fullURL ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setViewerUri(fullURL);
              setViewerVisible(true);
            }}
            style={{ marginTop: 6 }}
          >
            <Image source={{ uri: fullURL }} style={styles.msgImage} resizeMode="cover" />
            <Text style={[styles.msgHint, { color: subColor }]}>برای بزرگ‌نمایی لمس کنید</Text>
          </TouchableOpacity>
        ) : null}

        {type === "voice" && fullURL ? (
          <View style={{ marginTop: 6 }}>
            <VoicePlayer id={m.id} uri={fullURL} durationSec={m.durationSec ?? undefined} />
          </View>
        ) : null}

        {type === "file" && fullURL ? (
          <TouchableOpacity
            onPress={async () => {
              const ok = await Linking.canOpenURL(fullURL);
              if (ok) Linking.openURL(fullURL);
              else pushError("لینک فایل قابل باز شدن نیست.");
            }}
            activeOpacity={0.9}
            style={styles.filePill}
          >
            <Ionicons name="document-attach" size={18} color="#E5E7EB" />
            <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>دانلود فایل</Text>
          </TouchableOpacity>
        ) : null}

        {!!m.text && (
          <Text style={{ marginTop: 6, color: textColor, lineHeight: 18, fontWeight: "700", fontSize: 12 }}>
            {m.text}
          </Text>
        )}

        {stamp ? <Text style={[styles.stamp, { color: subColor }]}>{stamp}</Text> : null}
      </View>
    );
  };

  const hasMessages = !!ticket?.messages?.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        {/* ✅ Header مثل index: back + title + badge */}
        <View style={[styles.headerBar, { paddingTop: 10 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-forward" size={22} color="#E5E7EB" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>

          <View style={styles.headerLeft}>
            <PlanStatusBadge me={me} showExpiringText />
          </View>
        </View>

        <Banner text={banner} onClose={() => setBanner("")} />

        {/* ✅ pin bar باریک‌تر */}
        {pinnedList.length ? (
          <View style={styles.pinBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pinBarContent}
            >
              {pinnedList.map((pm) => {
                const t = pm.text?.trim();
                const typ = detectType(pm.mime, pm.fileUrl);
                const label =
                  (t && (t.length > 24 ? t.slice(0, 24) + "…" : t)) ||
                  (typ === "voice" ? "ویس" : typ === "image" ? "عکس" : typ === "file" ? "فایل" : "پیام");

                return (
                  <TouchableOpacity
                    key={pm.id}
                    onPress={() => jumpToMessage(pm.id)}
                    style={styles.pinChip}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="star" size={13} color="#D4AF37" />
                    <Text style={styles.pinText} numberOfLines={1}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 12,
            rowGap: 8,
            direction: rtl ? "rtl" : "ltr",
            paddingBottom: insets.bottom + 160,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (!didInitialScroll.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
              didInitialScroll.current = true;
            }
          }}
        >
          {hasMessages ? ticket!.messages.map(renderMessage) : <View />}
        </ScrollView>

        <View style={[styles.composerDock, { paddingBottom: Math.max(10, insets.bottom + 8) }]} pointerEvents="box-none">
          {chatType === "therapy" && !isProPlan && (
            <View style={styles.inlineLock}>
              <Ionicons name="lock-closed" size={16} color="#D4AF37" />
              <Text style={styles.inlineLockText}>ارسال پیام به درمانگر فقط برای اعضای PRO فعاله.</Text>
            </View>
          )}

          <Composer
            ticketId={String(id)}
            ticketType={typeFromParam}
            isPro={isProPlan}
            user={me}
            onError={pushError}
            onTicketCreated={(newId, fullTicket) => {
              router.replace(`/support/tickets/${newId}`);
              if (fullTicket) setTicket(fullTicket);
              else fetchTicket(true);
              loadPins(newId).then(setPins);
            }}
            onSent={(updatedTicket) => {
              if (updatedTicket) setTicket(updatedTicket);
              else fetchTicket(true);
              requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
            }}
          />
        </View>

        {viewerUri ? (
          <ImageLightbox uri={viewerUri} visible={viewerVisible} onClose={() => setViewerVisible(false)} />
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },

  bgGlowTop: {
    position: "absolute",
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: {
    marginTop: 8,
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ✅ Header دقیقاً مثل index */
  headerBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#030712",
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    alignSelf: "stretch",
  },
  headerLeft: {
    width: 140,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },

  /* banner */
  bannerWrap: { paddingHorizontal: 12, paddingTop: 10 },
  banner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,.28)",
    backgroundColor: "rgba(249,115,22,.12)",
  },
  bannerText: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
  bannerClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  /* ✅ pinned: نوار باریک */
  pinBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    backgroundColor: "#0b0f14",
    paddingVertical: 4,
  },
  pinBarContent: {
    paddingHorizontal: 10,
    columnGap: 8,
    alignItems: "center",
  },
  pinChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    maxWidth: 220,
  },
  pinText: { color: "#E5E7EB", fontSize: 11, fontWeight: "900" },

  /* ✅ messages */
  msg: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "82%",
    overflow: "hidden",
  },
  msgAdmin: {
    borderColor: "rgba(212,175,55,.25)",
    backgroundColor: "rgba(212,175,55,.10)",
  },
  msgUser: {
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  msgTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  msgWho: { fontWeight: "900", fontSize: 11 },
  msgImage: { width: 210, height: 210, borderRadius: 12 },
  msgHint: { fontSize: 10, marginTop: 5, fontWeight: "800" },
  filePill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  stamp: {
    fontSize: 9,
    marginTop: 6,
    fontWeight: "800",
    alignSelf: "flex-start",
  },

  /* lightbox */
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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  /* composer dock */
  composerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(3,7,18,0.92)",
  },
  inlineLock: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.25)",
    backgroundColor: "rgba(212,175,55,.10)",
    marginBottom: 10,
  },
  inlineLockText: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },

  /* Composer */
  composerWrap: { gap: 10 },
  composerInput: {
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.10)",
    color: "#E5E7EB",
  },
  composerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  sendBtn: {
    backgroundColor: "rgba(212,175,55,.22)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.38)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendBtnText: { color: "#E5E7EB", fontWeight: "900" },
  previewRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8,
    borderRadius: 14,
  },
  trashBtn: {
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#991b1b",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  recTimer: {
    color: "#E5E7EB",
    fontWeight: "900",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    fontVariant: ["tabular-nums"],
  },

  /* lock */
  lockWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  lockCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.03)",
    overflow: "hidden",
  },
  lockCardGlow: {
    position: "absolute",
    top: -110,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.12)",
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.24)",
    alignSelf: "center",
    marginBottom: 12,
  },
  lockTitle: { color: "#F9FAFB", fontSize: 16, fontWeight: "900", textAlign: "center" },
  lockBody: {
    marginTop: 10,
    color: "rgba(231,238,247,.70)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "800",
  },
  lockBtn: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.30)",
  },
  lockBtnText: { color: "#E5E7EB", fontSize: 12, fontWeight: "900" },
});