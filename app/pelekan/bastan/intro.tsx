// app/pelekan/bastan/intro.tsx
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../hooks/useUser";

type BastanStateResponse = {
  ok: boolean;
  data?: {
    user: { planStatus: "free" | "pro" | "expiring" | "expired"; daysLeft: number };
    intro: { completedAt: string | null; paywallNeededAfterIntro: boolean };
    start?: { completedAt: string | null; locked: boolean; paywallNeededAfterIntro: boolean };
  };
  error?: string;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function BastanIntroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();
  const phone = String(me?.phone || "").trim();

  const apiBase = "https://api.qoqnoos.app";

  // ✅ این URL ویس را خودت ست کن (از CDN/Storage خودت)
  const AUDIO_URL = useMemo(() => {
    // مثال:
    // return "https://cdn.qoqnoos.app/audio/bastan-intro.mp3";
    return "https://api.qoqnoos.app/static/audio/bastan-intro.mp3";
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [introDone, setIntroDone] = useState(false);
  const [paywallAfterIntro, setPaywallAfterIntro] = useState(false);

  // Player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);

  const canContinue = introDone; // ✅ فقط وقتی کامل گوش کرد فعال

  const fetchIntroState = useCallback(async () => {
    if (!phone) {
      setErr("NO_PHONE");
      setLoading(false);
      return;
    }

    try {
      setErr(null);
      setLoading(true);

      const url = `${apiBase}/api/pelekan/bastan/state?phone=${encodeURIComponent(phone)}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });

      let json: BastanStateResponse | null = null;
      try {
        json = (await res.json()) as BastanStateResponse;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok || !json.data) {
        setErr(json?.error || `HTTP_${res.status}`);
        return;
      }

      const completedAt = json.data.start?.completedAt ?? json.data.intro?.completedAt ?? null;

      const paywall =
        json.data.start?.paywallNeededAfterIntro ??
        json.data.intro?.paywallNeededAfterIntro ??
        false;

      setIntroDone(!!completedAt);
      setPaywallAfterIntro(!!paywall);

      console.log("[bastan-intro] completedAt=", completedAt, "paywallAfterIntro=", !!paywall);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const markIntroComplete = useCallback(async () => {
    if (!phone) return;

    // ✅ اینجا فقط یک endpoint می‌زنیم تا introAudioCompletedAt ثبت شود
    const url = `${apiBase}/api/pelekan/bastan/intro/complete`;
    console.log("[bastan-intro] POST complete ->", url);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ phone }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || `HTTP_${res.status}`);
    }

    setIntroDone(true);
  }, [phone]);

  const unload = useCallback(async () => {
    try {
      const s = soundRef.current;
      if (s) {
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
    soundRef.current = null;
    setIsLoaded(false);
    setIsPlaying(false);
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (soundRef.current) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: AUDIO_URL },
      { shouldPlay: false },
      async (st) => {
        if (!st.isLoaded) return;

        setIsLoaded(true);
        setIsPlaying(st.isPlaying);
        setPosMs(st.positionMillis ?? 0);
        setDurMs(st.durationMillis ?? 1);

        // ✅ وقتی ویس تموم شد
        if (st.didJustFinish) {
          setIsPlaying(false);
          try {
            await markIntroComplete();
          } catch (e: any) {
            setErr(String(e?.message || e));
          }
        }
      }
    );

    soundRef.current = sound;
  }, [AUDIO_URL, markIntroComplete]);

  const togglePlay = useCallback(async () => {
    try {
      await loadIfNeeded();
      const s = soundRef.current;
      if (!s) return;

      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;

      if (st.isPlaying) {
        await s.pauseAsync();
      } else {
        await s.playAsync();
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, [loadIfNeeded]);

  useEffect(() => {
    fetchIntroState();
    return () => {
      unload();
    };
  }, [fetchIntroState, unload]);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.muted}>در حال بارگذاری…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={["top", "left", "right"]}>
      {/* Glow ها */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>خطا: {err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchIntroState}>
            <Text style={styles.retryText}>تلاش مجدد</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        {/* ✅ پلی بزرگ */}
        <TouchableOpacity activeOpacity={0.9} onPress={togglePlay} style={styles.bigPlayWrap}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={72}
            color="#0b0f14"
            style={{ marginLeft: isPlaying ? 0 : 6 }}
          />
        </TouchableOpacity>

        <Text style={styles.title}>شروع درمان</Text>
        <Text style={styles.desc}>ویس را کامل گوش کن تا دکمه «ادامه» فعال شود.</Text>

        {/* ✅ Progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
        </View>
        <Text style={styles.timeText}>
          {fmt(posMs)} / {fmt(durMs)}
        </Text>

        {/* ✅ ادامه */}
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!canContinue}
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={() => {
            if (!introDone) return;

            if (paywallAfterIntro) {
              router.push("/(tabs)/Subscription" as any);
              return;
            }

            router.replace("/pelekan/bastan" as any);
          }}
        >
          <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>ادامه</Text>
        </TouchableOpacity>

        {!canContinue ? (
          <Text style={styles.warningText}>تا ویس رو کامل گوش نکردی، دکمه ادامه فعال نمی‌شه.</Text>
        ) : paywallAfterIntro ? (
          <Text style={styles.warningText}>برای ادامه‌ی مسیر، باید پرو داشته باشی.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "rgba(231,238,247,.75)", marginTop: 10, fontSize: 12, textAlign: "center" },

  glowTop: {
    position: "absolute",
    top: -10,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -40,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)"},
  errBox: { padding: 16 },
  errText: { color: "#FCA5A5", fontWeight: "700", textAlign: "right" },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
  retryText: { color: "#F9FAFB", fontWeight: "800" },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  bigPlayWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  title: { color: "#F9FAFB", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 6 },
  desc: { color: "rgba(231,238,247,.75)", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 6 },

  progressTrack: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.10)",
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E98A15",
  },
  timeText: { color: "rgba(231,238,247,.65)", fontSize: 12, marginBottom: 14 },

  continueBtn: {
    width: "100%",
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#E98A15",
    alignItems: "center",
    marginTop: 4,
  },
  continueBtnDisabled: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  continueText: { color: "#0b0f14", fontWeight: "900", fontSize: 15 },
  continueTextDisabled: { color: "rgba(231,238,247,.55)" },

  warningText: {
    marginTop: 10,
    color: "rgba(252,165,165,.90)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});