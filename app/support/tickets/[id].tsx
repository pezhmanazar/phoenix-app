//phoenix-app\app\support\tickets\[id].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ViewStyle } from "react-native";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createTicket,
  sendTicketReply,
  uploadTicketReply,
} from "../../../api/tickets";
import { BACKEND_URL } from "../../../constants/backend";
import { useAuth } from "../../../hooks/useAuth";
import { useUser } from "../../../hooks/useUser";
import { getPlanStatus, PRO_FLAG_KEY } from "../../../lib/plan";
import {
  detectType,
  extractErrorMessage,
} from "../../../utils/tickets/helpers";
// ✅ مسیر را اگر متفاوت است فقط همین خط را اصلاح کن
import PlanStatusBadge from "../../../components/PlanStatusBadge";
import AppBannerModal from "@/components/ui/AppBannerModal";

/* ===== انواع ===== */
type MessageType = "text" | "voice" | "image" | "file";

type Message = {
  id: string;
  ticketId: string;
  sender: "user" | "admin";
  type?: MessageType;
  text?: string | null;
  fileUrl?: string | null;
  fileViewUrl?: string | null;
  fileKey?: string | null;
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

/* ===== پاک کردن تاریخچه فقط سمت کلاینت (برای هر تیکت جدا) ===== */
const clearKey = (ticketId: string) => `chat_cleared_at:${ticketId}`;

async function loadClearedAt(ticketId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(clearKey(ticketId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function saveClearedAt(ticketId: string, ts: number) {
  try {
    await AsyncStorage.setItem(clearKey(ticketId), String(ts));
  } catch {}
}

function msgTimeMs(m: Message): number {
  const s = m.ts || m.createdAt || "";
  if (!s) return 0;
  const d = new Date(s);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

/* ================= Image Lightbox ================= */
function ImageLightbox({
  uri,
  visible,
  onClose,
  authHeaders,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
  authHeaders?: Record<string, string>;
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
  source={{ uri, headers: authHeaders }}
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
  authHeaders,
}: {
  id: string;
  uri: string;
  durationSec?: number | null;
  dark?: boolean;
  authHeaders?: Record<string, string>;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState((durationSec ?? 0) * 1000);
  const [rate, setRate] = useState<1 | 1.5 | 2>(1);
  const [finished, setFinished] = useState(false);

  const wfWidth = useRef(1);
  const isDragging = useRef(false);
  const toggleLockRef = useRef(false);
  const replayGraceUntilRef = useRef(0);

  useEffect(() => {
    Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
}).catch((e) => {
  console.log("AUDIO_MODE_ERR", e);
});
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

const ensureLoaded = useCallback(async () => {
  if (sound) {
    try {
      const existingStatus = await sound.getStatusAsync();

      if (existingStatus.isLoaded) {
        return sound;
      }

      console.log("VOICE_EXISTING_NOT_LOADED_RECREATE", id, existingStatus);

      try {
        await sound.unloadAsync();
      } catch {}

      setSound(null);

      if (currentSound === sound) {
        currentSound = null;
      }
    } catch (e) {
      console.log("VOICE_EXISTING_STATUS_ERR", id, e);

      try {
        await sound.unloadAsync();
      } catch {}

      setSound(null);

      if (currentSound === sound) {
        currentSound = null;
      }
    }
  }

  setBuffering(true);
  setPlaying(false);

  console.log("VOICE_CREATE_START", id, uri, {
    hasAuth: !!authHeaders?.Authorization,
  });

  const absoluteUri = uri.startsWith("http") ? uri : `${BACKEND_URL}${uri}`;

  const { sound: s, status } = await Audio.Sound.createAsync(
    {
      uri: absoluteUri,
      headers: {
        ...(authHeaders || {}),
        Connection: "keep-alive",
      },
    },
    {
      shouldPlay: false,
      progressUpdateIntervalMillis: 250,
    }
  );

  console.log("VOICE_CREATE_OK", id, status);

  setSound(s);

  s.setOnPlaybackStatusUpdate((st: any) => {
    if (!st?.isLoaded) {
      if (st?.error) {
        console.log("VOICE_STATUS_ERROR", id, st.error);
      }

      setBuffering(false);
      setPlaying(false);
      return;
    }

    if (typeof st.durationMillis === "number") {
      setDur(st.durationMillis);
    }

    if (!isDragging.current && typeof st.positionMillis === "number") {
      setPos(st.positionMillis);

      if (st.durationMillis) {
        setProgress(st.positionMillis / st.durationMillis);
      }
    }

    if (st.didJustFinish) {
      setBuffering(false);
      setPlaying(false);
      setFinished(true);
      setProgress(1);
      setPos(st.durationMillis || 0);
      return;
    }

        if (st.isPlaying) {
      setBuffering(false);
      setPlaying(true);
      setPlayError(false);
      return;
    }

    if (st.isBuffering && st.shouldPlay) {
        if (Date.now() < replayGraceUntilRef.current) {
          setBuffering(false);
          setPlaying(true);
          return;
        }
          setBuffering(true);
          setPlaying(false);
          return;
        }

    setPlaying(false);

    if (!st.shouldPlay) {
      setBuffering(false);
    }
  });

  await applyRate(s, rate);

  return s;
}, [sound, uri, rate, id, authHeaders]);


  const onToggle = useCallback(async () => {
  if (!uri) return;

  if (toggleLockRef.current) {
    console.log("VOICE_TOGGLE_LOCKED", id);
    return;
  }

  toggleLockRef.current = true;

  try {
    console.log("VOICE_TOGGLE", id, uri);
    setPlayError(false);

    if (currentSound && currentSound !== sound) {
  try {
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
  } catch {}
  currentSound = null;
}

    const s = await ensureLoaded();
    currentSound = s;

        const st = await s.getStatusAsync();

    console.log("VOICE_STATUS_BEFORE_PLAY", id, st);

    if (!st.isLoaded) {
      console.log("VOICE_NOT_LOADED", id, st);
      setBuffering(false);
      setPlaying(false);
      return;
    }

    if (st.isPlaying) {
      await s.pauseAsync();
      setBuffering(false);
      setPlaying(false);
      console.log("VOICE_PAUSED", id);
      return;
    }

          if (finished || st.didJustFinish || (dur && pos >= dur - 300)) {
      console.log("VOICE_SEEK_TO_START_FOR_REPLAY", id);

      setBuffering(true);
      setPlaying(false);

      setFinished(false);
      setPos(0);
      setProgress(0);

      replayGraceUntilRef.current = Date.now() + 1200;
      setBuffering(false);
      setPlaying(true);

      await applyRate(s, rate);

      await s.setVolumeAsync(1);

      await s.playFromPositionAsync(0);

      const replayStatus = await s.getStatusAsync();

      console.log("VOICE_REPLAY_STATUS_AFTER_SEEK", id, replayStatus);

      if (replayStatus.isLoaded && replayStatus.isPlaying) {
        setBuffering(false);
        setPlaying(true);
      } else if (replayStatus.isLoaded && replayStatus.isBuffering) {
        setBuffering(true);
        setPlaying(false);
      } else {
        setBuffering(false);
        setPlaying(false);
      }

      return;
    }

    setBuffering(true);
    setPlaying(false);

    await applyRate(s, rate);
    await s.setVolumeAsync(1);
    await s.playAsync();

    const afterPlay = await s.getStatusAsync();

    if (afterPlay.isLoaded && afterPlay.isPlaying) {
      setBuffering(false);
      setPlaying(true);
    } else if (afterPlay.isLoaded && afterPlay.isBuffering) {
      setBuffering(true);
      setPlaying(false);
    }

    console.log("VOICE_PLAY_REQUESTED", id);
      } catch (e) {
    setBuffering(false);
    setPlaying(false);
    setPlayError(true);
    console.log("VOICE_TOGGLE_ERR", id, uri, e);
  } finally {
    toggleLockRef.current = false;
  }
}, [
  id,
  uri,
  sound,
  finished,
  pos,
  dur,
  ensureLoaded,
  rate,
]);

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
    minWidth: 38,
    alignItems: "center",
    justifyContent: "center",
  }}
  activeOpacity={0.85}
  disabled={buffering}
>
  {buffering ? (
    <ActivityIndicator size="small" color={dark ? "#000" : "#fff"} />
  ) : (
    <Ionicons
      name={playing ? "pause" : "play"}
      size={16}
      color={dark ? "#000" : "#fff"}
    />
  )}
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
            {(buffering || playError) ? (
        <View style={{ alignItems: "flex-end", marginTop: 2 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              color: playError ? "#ef4444" : subTint,
            }}
          >
            {playError ? "پخش نشد" : "در حال آماده‌سازی…"}
          </Text>
        </View>
      ) : null}
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
  onTicketCreated,
  onSent,
  onMeasureHeight,
  onError,
  onLocalImageUploaded,
  onUploadingChange,
}: {
  ticketId: string;
  ticketType?: "tech" | "therapy" | null;
  isPro: boolean;
  onTicketCreated?: (newId: string, fullTicket?: Ticket | null) => void;
  onSent: (updatedTicket?: Ticket | null) => void;
  onMeasureHeight?: (h: number) => void;
  onError: (msg: string) => void;
  onLocalImageUploaded?: (messageId: string, localUri: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const { token, isAuthenticated } = useAuth();
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
  const isUploadingAttachment = sending && hasAttachment;

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
  mediaTypes: ["images"],
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

  const stopRecording = useCallback(
    async (auto = false) => {
      if (!recording) return;
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecURI(uri || null);
      } catch {}
      setRecording(null);

      // اگر به سقف رسید، به کاربر واضح بگو
      if (auto) {
        onError("ضبط به سقف مجاز رسید: محدودیت ویس در هر بار ضبط، ۵ دقیقه‌ست؛ روی ارسال ضمیمه بزن تا ویسی که ضبط کردی ارسال بشه");
      }

      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
    },
    [recording, onError]
  );

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

            rec.setOnRecordingStatusUpdate(async (st) => {
        if (!st.canRecord) return;
        const ms = st.durationMillis ?? 0;
        setRecMs(ms);

        if (ms >= MAX_VOICE_MS) {
          try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            setRecURI(uri || null);
          } catch {}

          setRecording(null);
          setRecMs(MAX_VOICE_MS);

          onError("ضبط به سقف مجاز رسید: محدودیت ویس در هر بار ضبط، ۵ دقیقه‌ست.");

          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          } catch {}
        }
      });

      await rec.startAsync();
      setRecording(rec);
      setRecURI(null);
      setRecMs(0);
    } catch {
      onError("شروع ضبط ناموفق بود.");
    }
  };

  const resetAttachments = () => {
    setImage(null);
    setRecURI(null);
    setRecMs(0);
  };

 const createTicketIfNeeded = async (textFallback: string) => {
  if (!ticketType) return ticketId;

  if (!isAuthenticated || !token) {
    throw new Error("برای ارسال پیام باید دوباره وارد حساب کاربری بشی.");
  }

  const result = await createTicket({
    token,
    ticketType,
    text: textFallback,
  });

  onTicketCreated?.(result.ticketId, result.ticket);
  return result.ticketId;
};

  const sendText = async () => {
  if (!hasText) return;
  if (planGuard()) return;

  try {
    setSending(true);
    const textPayload = text.trim();

    if (!isAuthenticated || !token) {
      throw new Error("برای ارسال پیام باید دوباره وارد حساب کاربری بشی.");
    }

    let targetId = ticketId;
    if (ticketType) {
      targetId = await createTicketIfNeeded(textPayload);
      setText("");
      onSent();
      return;
    }

    const updatedTicket = await sendTicketReply({
      token,
      ticketId: targetId,
      text: textPayload,
    });

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

  if (text?.trim()) {
    fd.append("text", text.trim());
  }

  if (image) {
    fd.append("attachment", {
      uri: image.uri,
      name: image.name,
      type: image.type,
    } as any);
  } else if (recURI) {
    const durationSec = Math.min(300, Math.round(recMs / 1000));

    fd.append("attachment", {
      uri: recURI,
      name: `voice_${Date.now()}.m4a`,
      type: "audio/m4a",
    } as any);

    fd.append("durationSec", String(durationSec));
  }

  return fd;
};


  const sendUpload = async () => {
  if (!hasAttachment && !hasText) return;
  if (planGuard()) return;

  try {
  setSending(true);
  onUploadingChange?.(true);


    if (!isAuthenticated || !token) {
      throw new Error("برای ارسال پیام باید دوباره وارد حساب کاربری بشی.");
    }

    const localImageUri = image?.uri || null;

    let targetId = ticketId;
    if (ticketType) {
      const firstText = hasText ? text.trim() : "ضمیمه";
      targetId = await createTicketIfNeeded(firstText);
    }

    const fd = await buildForm();

    const updatedTicket = await uploadTicketReply({
      token,
      ticketId: targetId,
      formData: fd,
    });

    if (localImageUri && updatedTicket?.messages?.length) {
      const lastImageMessage = [...updatedTicket.messages]
        .reverse()
        .find((m) => m.sender === "user" && (m.type || detectType(m.mime, m.fileUrl)) === "image");

      if (lastImageMessage?.id) {
        onLocalImageUploaded?.(lastImageMessage.id, localImageUri);
      }
    }

    setText("");
    resetAttachments();
    onSent(updatedTicket);
  } catch (e: any) {
  resetAttachments();
  onError(extractErrorMessage(e, "خطا در ارسال فایل یا ویس"));
} finally {
  setSending(false);
  onUploadingChange?.(false);
}
};

  return (
    <View style={styles.composerWrap} onLayout={onLayout}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="پیام خودت رو بفرست؛ در اسرع وقت بهت جواب می‌دیم…"
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
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="mic" size={16} color="#E5E7EB" />
              <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
                {Math.min(300, Math.round(recMs / 1000))}s
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
  onPress={resetAttachments}
  style={[styles.trashBtn, { opacity: sending ? 0.5 : 1 }]}
  activeOpacity={0.85}
  disabled={sending}
>
  <Ionicons name="trash" size={16} color="#fff" />
</TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.composerActions}>
        <TouchableOpacity
  onPress={pickImage}
  style={[styles.iconBtn, { opacity: lockedForPlan || sending ? 0.5 : 1 }]}
  activeOpacity={0.8}
  disabled={lockedForPlan || sending}
>
          <Ionicons name="attach" size={18} color="#E5E7EB" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {recording ? (
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* ✅ هنگام ضبط هم یادآوری کوتاه */}
            <Text style={styles.recHint}>حداکثر ۵:۰۰</Text>

            <Text style={styles.recTimer}>{fmt(recMs)}</Text>
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
  <View
  style={{
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  }}
>
    {isUploadingAttachment ? (
      <Text
  style={{
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "900",
    position: "absolute",
    left: -190,
    width: 180,
    textAlign: "right",
  }}
        numberOfLines={2}
      >
        صبور باش، پیامت در حال بارگذاریه…
      </Text>
    ) : null}

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
  </View>
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
  style={[styles.roundBtn, { opacity: lockedForPlan || sending ? 0.5 : 1 }]}
  activeOpacity={0.85}
  disabled={lockedForPlan || sending}
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

function toBackendFileUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  return `${BACKEND_URL}${path}`;
}

function isSameTicketSnapshot(prev: Ticket | null, next: Ticket | null): boolean {
  if (!prev || !next) return false;

  if (prev.id !== next.id) return false;
  if (prev.status !== next.status) return false;
  if (prev.type !== next.type) return false;
  if (prev.title !== next.title) return false;
  if ((prev.contact || null) !== (next.contact || null)) return false;

  const prevMessages = prev.messages || [];
  const nextMessages = next.messages || [];

  if (prevMessages.length !== nextMessages.length) return false;

  for (let i = 0; i < prevMessages.length; i++) {
    const a = prevMessages[i];
    const b = nextMessages[i];

    if (a.id !== b.id) return false;
    if (a.sender !== b.sender) return false;
    if ((a.type || null) !== (b.type || null)) return false;
    if ((a.text || null) !== (b.text || null)) return false;
    if ((a.fileUrl || null) !== (b.fileUrl || null)) return false;
    if ((a.fileViewUrl || null) !== (b.fileViewUrl || null)) return false;
    if ((a.fileKey || null) !== (b.fileKey || null)) return false;
    if ((a.mime || null) !== (b.mime || null)) return false;
    if ((a.durationSec || null) !== (b.durationSec || null)) return false;
    if ((a.ts || null) !== (b.ts || null)) return false;
    if ((a.createdAt || null) !== (b.createdAt || null)) return false;
  }

  return true;
}

/* ================= صفحه تیکت ================= */
export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { me } = useUser();
  const { token } = useAuth();

  const [planView, setPlanView] = useState<PlanView>("free");
  const [planLoaded, setPlanLoaded] = useState(false);

  const typeFromParam = parseTicketType(id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(!!typeFromParam);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [composerHeight, setComposerHeight] = useState(88);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [localImagePreviews, setLocalImagePreviews] = useState<Record<string, string>>({});
  const [isUploadingReply, setIsUploadingReply] = useState(false);
  

  const [banner, setBanner] = useState<string>("");
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const exitActionRef = useRef<(() => void) | null>(null);

  const scrollRef = useRef<FlatList<Message> | null>(null);
  const didInitialScroll = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const msgPositions = useRef<Record<string, number>>({});

  const mediaUrlMapRef = useRef<Record<string, string>>({});
  const [pins, setPins] = useState<string[]>([]);

  // ✅ پاکسازی محلی هر تیکت
  const [clearedAtMs, setClearedAtMs] = useState<number>(0);
  const [clearModal, setClearModal] = useState(false);
  

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }, [token]);

  useEffect(() => {
  const show = Keyboard.addListener(
    Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
    (e) => {
      if (Platform.OS === "android") {
        setKeyboardHeight(e.endCoordinates?.height || 0);
      }
    }
  );

  const hide = Keyboard.addListener(
    Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
    () => {
      if (Platform.OS === "android") {
        setKeyboardHeight(0);
      }
    }
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

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!isUploadingReply) return false;

        exitActionRef.current = () => {
          setIsUploadingReply(false);
          router.back();
        };

        setExitModalVisible(true);
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () => sub.remove();
    }, [isUploadingReply, router])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!isUploadingReply) return;

      e.preventDefault();

      exitActionRef.current = () => {
        setIsUploadingReply(false);
        navigation.dispatch(e.data.action);
      };

      setExitModalVisible(true);
    });

    return unsubscribe;
  }, [navigation, isUploadingReply]);

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
        } else {
          view = "free";
        }
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

  // ✅ load clearedAt for THIS ticket (هر تیکت جدا: فنی/درمانگر جدا)
  useEffect(() => {
    if (!id) return;
    loadClearedAt(String(id)).then(setClearedAtMs).catch(() => setClearedAtMs(0));
  }, [id]);

  const fetchTicket = useCallback(
    async (silent: boolean = false) => {
      if (!id) return;

      if (typeFromParam) {
        if (!silent) setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);

        const url = `${BACKEND_URL}/api/public/tickets/${id}?ts=${Date.now()}`;

        const res = await fetch(url, {
          headers: authHeaders,
        });

        let json: any = null;

        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (res.ok && json?.ok && json.ticket) {
          setTicket((prev) => {
            if (isSameTicketSnapshot(prev, json.ticket)) {
              return prev;
            }

            return json.ticket;
          });
        }
      } catch (e: any) {
        pushError(extractErrorMessage(e, "خطا در دریافت گفتگو"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, typeFromParam, pushError, authHeaders]
  );

  useEffect(() => {
    fetchTicket(false);
  }, [fetchTicket]);

  useFocusEffect(
    useCallback(() => {
      if (typeFromParam) return;
      if (!id) return;

      fetchTicket(true);

      const interval = setInterval(() => {
        fetchTicket(true);
      }, 8000);

      return () => clearInterval(interval);
    }, [id, typeFromParam, fetchTicket])
  );

  const tryOpenExisting = useCallback(async () => {
    if (!typeFromParam) return;

    try {
      setCheckingExisting(true);

      const qs: string[] = [];
      qs.push(`type=${encodeURIComponent(typeFromParam)}`);
      qs.push(`ts=${Date.now()}`);

      const url = `${BACKEND_URL}/api/public/tickets/open?${qs.join("&")}`;

      const res = await fetch(url, {
        headers: authHeaders,
      });

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json?.ok && json.ticket && json.ticket.id) {
        const t: Ticket = json.ticket;

        setTicket((prev) => {
          if (isSameTicketSnapshot(prev, t)) {
            return prev;
          }

          return t;
        });

        loadPins(String(t.id))
          .then(setPins)
          .catch(() => {});

        router.replace(`/support/tickets/${t.id}`);

        loadClearedAt(String(t.id))
          .then(setClearedAtMs)
          .catch(() => setClearedAtMs(0));
      }
    } catch (e: any) {
      pushError(extractErrorMessage(e, "خطا در آماده‌سازی گفتگو"));
    } finally {
      setCheckingExisting(false);
    }
  }, [typeFromParam, router, pushError, authHeaders]);

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
        ? "درمانگر ققنوس"
        : "پشتیبان فنی";

    // @ts-ignore
    (navigation as any)?.setOptions?.({ title });
  }, [ticket, navigation, typeFromParam]);

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
  const index = visibleMessages.findIndex((m) => m.id === mid);

  if (index < 0 || !scrollRef.current) return;

  scrollRef.current.scrollToIndex({
    index,
    animated: true,
    viewPosition: 0.25,
  });
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
      ? "درمانگر ققنوس"
      : "پشتیبانی فنی ققنوس";

  const doClearLocal = useCallback(async () => {
    if (!id) return;

    const now = Date.now();

    await saveClearedAt(String(id), now);
    setClearedAtMs(now);
    setClearModal(false);

    // پین‌ها هم محلی‌اند؛ بعد از پاکسازی بهتره پاک شوند تا حسِ “تاریخچه پاک شد” واقعی باشد
    try {
      await AsyncStorage.removeItem(pinKey(String(id)));
      setPins([]);
    } catch {}

    pushError("تاریخچه این گفتگو در گوشیت پاک شد.");
  }, [id, pushError]);

  const renderMessage = useCallback((m: Message) => {
    const isAdmin = m.sender === "admin";
    const alignSelf: ViewStyle["alignSelf"] = isAdmin ? "flex-start" : "flex-end";

    const bubbleStyle: ViewStyle[] = [
      styles.msg,
      isAdmin ? styles.msgAdmin : styles.msgUser,
      { alignSelf },
    ];

    const textColor = isAdmin ? "#F9FAFB" : "#E5E7EB";
    const subColor = isAdmin ? "rgba(249,250,251,.72)" : "rgba(231,238,247,.62)";

    const rawIncomingURL = m.fileViewUrl || m.fileUrl || undefined;
    const incomingURL = toBackendFileUrl(rawIncomingURL);

    const fullURL = incomingURL;
    const type: MessageType = m.type || detectType(m.mime, m.fileUrl);

    const localPreviewUri =
      type === "image" ? localImagePreviews[m.id] : undefined;

    const imageUriToRender = localPreviewUri || fullURL;

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

          <TouchableOpacity
            onPress={() => togglePin(m.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isPinned ? "star" : "star-outline"}
              size={15}
              color={isAdmin ? "#FBBF24" : "#D4AF37"}
            />
          </TouchableOpacity>
        </View>

        {type === "image" && imageUriToRender ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setViewerUri(imageUriToRender);
              setViewerVisible(true);
            }}
            style={{ marginTop: 6 }}
          >
            <Image
              source={
                localPreviewUri
                  ? { uri: localPreviewUri }
                  : imageUriToRender
                  ? { uri: imageUriToRender, headers: authHeaders }
                  : undefined
              }
              style={styles.msgImage}
              resizeMode="cover"
              onLoadStart={() =>
                console.log("IMAGE_LOAD_START", m.id, imageUriToRender, {
                  local: !!localPreviewUri,
                })
              }
              onLoad={() =>
                console.log("IMAGE_LOAD_OK", m.id, imageUriToRender, {
                  local: !!localPreviewUri,
                })
              }
              onError={(e) =>
                console.log("IMAGE_LOAD_ERR", m.id, imageUriToRender, e.nativeEvent)
              }
            />

            <Text style={[styles.msgHint, { color: subColor }]}>
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
              authHeaders={authHeaders}
            />
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

            <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
              دانلود فایل
            </Text>
          </TouchableOpacity>
        ) : null}

        {!!m.text && (
          <Text
            style={{
              marginTop: 6,
              color: textColor,
              lineHeight: 18,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {m.text}
          </Text>
        )}

        {stamp ? (
          <Text style={[styles.stamp, { color: subColor }]}>
            {stamp}
          </Text>
        ) : null}
      </View>
    );
  }, [pins, localImagePreviews, authHeaders, pushError]);

  const renderItem = useCallback(
  ({ item }: { item: Message }) => renderMessage(item),
  [renderMessage]
);

useEffect(() => {
  const allMessages = ticket?.messages || [];

  const currentVisibleMessages =
    !clearedAtMs
      ? allMessages
      : allMessages.filter((m) => msgTimeMs(m) >= clearedAtMs);

  if (!currentVisibleMessages.length) {
    lastMessageIdRef.current = null;
    return;
  }

  const lastMessage = currentVisibleMessages[currentVisibleMessages.length - 1];
  const previousLastId = lastMessageIdRef.current;

  // بار اول فقط ثبت کن، اسکرول اولیه جدا با onContentSizeChange انجام می‌شود
  if (!previousLastId) {
    lastMessageIdRef.current = lastMessage.id;
    return;
  }

  // اگر پیام آخر عوض نشده، کاری نکن
  if (previousLastId === lastMessage.id) return;

  lastMessageIdRef.current = lastMessage.id;

  // فقط وقتی پیام جدید از ادمین آمده، اسکرول کن پایین
  if (lastMessage.sender === "admin") {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 180);
    });
  }
}, [ticket?.messages, clearedAtMs]);


  /* حالت قفلِ چت درمانگر وقتی پلن PRO نیست */
  if (planLoaded && isTherapyChat && !isProPlan) {
    const isExpiredView = planView === "expired";

    return (
      <KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: "#0b0f14" }}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}
>
        <Stack.Screen options={{ headerShown: false }} />

        <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
          <View pointerEvents="none" style={styles.bgGlowTop} />
          <View pointerEvents="none" style={styles.bgGlowBottom} />

          {/* ✅ Header مثل index: back + title + badge + trash */}
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
                درمانگر ققنوس
              </Text>
            </View>

            <View style={styles.headerLeft}>
              <View style={styles.headerLeftRow}>
                <PlanStatusBadge me={me} showExpiringText />

                <TouchableOpacity
                  onPress={() => setClearModal(true)}
                  activeOpacity={0.85}
                  style={styles.clearBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#E5E7EB" />
                </TouchableOpacity>
              </View>
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
                  ? "برای باز شدن دوباره‌ی چت درمانگر، اشتراک پرو رو تمدید کن. تا اون‌موقع می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی."
                  : "برای ارسال پیام به درمانگر، باید اشتراک PRO را از تب «پرداخت» فعال کنی. در این فاصله می‌تونی از پشتیبانی فنی یا پشتیبان هوشمند استفاده کنی."}
              </Text>

              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.9}
                style={styles.lockBtn}
              >
                <Text style={styles.lockBtnText}>برگشت</Text>
                <Ionicons name="chevron-forward" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ✅ مودال پاکسازی */}
          <Modal
            visible={clearModal}
            transparent
            animationType="fade"
            onRequestClose={() => setClearModal(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setClearModal(false)}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalIcon}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </View>

                <Text style={styles.modalTitle}>پاک کردن تاریخچه گفتگو</Text>

                <Text style={styles.modalBody}>
                  این کار پیام‌ها رو در گوشی تو پاک میکنه.
                </Text>

                <View style={styles.modalRow}>
                  <TouchableOpacity
                    onPress={() => setClearModal(false)}
                    activeOpacity={0.9}
                    style={styles.modalBtnGhost}
                  >
                    <Text style={styles.modalBtnGhostText}>انصراف</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={doClearLocal}
                    activeOpacity={0.9}
                    style={styles.modalBtnDanger}
                  >
                    <Text style={styles.modalBtnDangerText}>پاک کن</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  if (typeFromParam && checkingExisting) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#0b0f14" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}
      >
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
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#0b0f14" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}
      >
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

  // ✅ پیام‌ها بعد از clearedAt فقط نمایش داده شوند
  const visibleMessages =
    !clearedAtMs
      ? (ticket?.messages || [])
      : (ticket?.messages || []).filter((m) => msgTimeMs(m) >= clearedAtMs);

  const hasMessages = visibleMessages.length > 0;

  return (
    <KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: "#0b0f14" }}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : undefined}
>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
        <View pointerEvents="none" style={styles.bgGlowTop} />
        <View pointerEvents="none" style={styles.bgGlowBottom} />

        {/* ✅ Header مثل index: back + title + badge + trash */}
        <View style={[styles.headerBar, { paddingTop: 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { opacity: isUploadingReply ? 0.5 : 1 }]}
            activeOpacity={0.7}
            onPress={() => {
              if (isUploadingReply) return;
              router.back();
            }}
            disabled={isUploadingReply}
          >
            <Ionicons name="arrow-forward" size={22} color="#E5E7EB" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>

          <View style={styles.headerLeft}>
            <View style={styles.headerLeftRow}>
              <PlanStatusBadge me={me} showExpiringText />

              <TouchableOpacity
                onPress={() => setClearModal(true)}
                activeOpacity={0.85}
                style={styles.clearBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
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
                  (typ === "voice"
                    ? "ویس"
                    : typ === "image"
                    ? "عکس"
                    : typ === "file"
                    ? "فایل"
                    : "پیام");

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

        <View style={{ flex: 1 }}>
    <FlatList
    ref={scrollRef}
    data={visibleMessages}
    renderItem={renderItem}
    keyExtractor={(item) => item.id}
    style={{ flex: 1, backgroundColor: "#0b0f14" }}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="interactive"
    showsVerticalScrollIndicator={false}
    initialNumToRender={Math.max(20, visibleMessages.length)}
    maxToRenderPerBatch={20}
    windowSize={15}
    removeClippedSubviews={false}
    onScrollToIndexFailed={(info) => {
  setTimeout(() => {
    scrollRef.current?.scrollToIndex({
      index: info.index,
      animated: true,
      viewPosition: 0.25,
    });
  }, 250);
}}
    onContentSizeChange={() => {
      if (!didInitialScroll.current && visibleMessages.length > 0) {
        scrollRef.current?.scrollToEnd({ animated: false });

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
          didInitialScroll.current = true;
        }, 120);
      }
    }}
    contentContainerStyle={{
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      rowGap: 8,
      direction: "ltr",
      flexGrow: 1,
    }}
    ListEmptyComponent={
      <View style={styles.emptyWrap}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={18}
          color="rgba(231,238,247,.65)"
        />

        <Text style={styles.emptyText}>
          {clearedAtMs
            ? "تاریخچه این گفتگو در گوشی شما پاک شده. پیام‌های جدید از اینجا به بعد نمایش داده می‌شن."
            : "هنوز پیامی در این گفتگو ثبت نشده."}
        </Text>
      </View>
    }
  />

  <View
  style={[
    styles.composerDock,
    {
      paddingBottom: Math.max(10, insets.bottom + 8),
      marginBottom: Platform.OS === "android" ? keyboardHeight : 0,
    },
  ]}
  pointerEvents="box-none"
>
          {chatType === "therapy" && !isProPlan && (
            <View style={styles.inlineLock}>
              <Ionicons name="lock-closed" size={16} color="#D4AF37" />

              <Text style={styles.inlineLockText}>
                ارسال پیام به درمانگر فقط برای اعضای PRO فعاله.
              </Text>
            </View>
          )}

          <Composer
            ticketId={String(id)}
            ticketType={typeFromParam}
            isPro={isProPlan}
            onMeasureHeight={setComposerHeight}
            onError={pushError}
            onUploadingChange={setIsUploadingReply}
            onLocalImageUploaded={(messageId, localUri) => {
              setLocalImagePreviews((prev) => ({
                ...prev,
                [messageId]: localUri,
              }));
            }}
            onTicketCreated={(newId, fullTicket) => {
              router.replace(`/support/tickets/${newId}`);

              if (fullTicket) {
                setTicket((prev) => {
                  if (isSameTicketSnapshot(prev, fullTicket)) {
                    return prev;
                  }

                  return fullTicket;
                });
              } else {
                fetchTicket(true);
              }

              loadPins(newId).then(setPins);

              // ✅ برای تیکت تازه ساخته‌شده clearedAt جدا را صفر کن
              saveClearedAt(String(newId), 0).catch(() => {});
              setClearedAtMs(0);
            }}
            onSent={(updatedTicket) => {
              if (updatedTicket) {
                setTicket((prev) => {
                  if (isSameTicketSnapshot(prev, updatedTicket)) {
                    return prev;
                  }

                  return updatedTicket;
                });
              } else {
                fetchTicket(true);
              }

              requestAnimationFrame(() => {
  scrollRef.current?.scrollToEnd({ animated: true });
});
            }}
          />
        </View>
        </View>

        {viewerUri ? (
          <ImageLightbox
            uri={viewerUri || ""}
            visible={viewerVisible}
            onClose={() => setViewerVisible(false)}
            authHeaders={authHeaders}
          />
        ) : null}

        {/* ✅ مودال پاکسازی (سمت کاربر) */}
        <Modal
          visible={clearModal}
          transparent
          animationType="fade"
          onRequestClose={() => setClearModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setClearModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalIcon}>
                <Ionicons name="trash" size={20} color="#ef4444" />
              </View>

              <Text style={styles.modalTitle}>پاک کردن تاریخچه گفتگو</Text>

              <Text style={styles.modalBody}>
                با این کار پیام‌های ارسالی و دریافتی در گوشیت پاک میشه .
              </Text>

              <View style={styles.modalRow}>
                <TouchableOpacity
                  onPress={() => setClearModal(false)}
                  activeOpacity={0.9}
                  style={styles.modalBtnGhost}
                >
                  <Text style={styles.modalBtnGhostText}>انصراف</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={doClearLocal}
                  activeOpacity={0.9}
                  style={styles.modalBtnDanger}
                >
                  <Text style={styles.modalBtnDangerText}>پاک کن</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <AppBannerModal
          visible={exitModalVisible}
          kind="warning"
          title="ارسال پیام در حال انجامه"
          message="پیام هنوز در حال بارگذاریه. اگه خارج بشی ممکنه ارسال کامل نشه."
          closeText="می‌مونم"
          onClose={() => setExitModalVisible(false)}
        />
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
    width: 160, // کمی بیشتر تا دکمه سطل جا شود
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  headerLeftRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
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

  /* empty */
  emptyWrap: {
    marginTop: 8,
    alignSelf: "center",
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.03)",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    flex: 1,
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
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
  backgroundColor: "#0b0f14",
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,.06)",
  paddingTop: 8,
  paddingHorizontal: 10,
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
  voiceLimitRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  voiceLimitText: {
    flex: 1,
    color: "rgba(231,238,247,.72)",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 16,
  },
  recHint: {
    color: "rgba(231,238,247,.70)",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
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

  /* modal (clear history) */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(3,7,18,0.96)",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    marginBottom: 10,
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  modalBody: {
    marginTop: 8,
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  modalRow: {
    marginTop: 14,
    flexDirection: "row-reverse",
    gap: 10,
    justifyContent: "center",
  },
  modalBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(255,255,255,.04)",
    minWidth: 120,
    alignItems: "center",
  },
  modalBtnGhostText: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },
  modalBtnDanger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.16)",
    minWidth: 120,
    alignItems: "center",
  },
  modalBtnDangerText: { color: "#FECACA", fontWeight: "900", fontSize: 12 },
});