// app/(auth)/profile-wizard.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../../hooks/useAuth";
import { upsertUserByPhone, getMeByPhone } from "../../api/user";
import JalaliSelect from "../../components/JalaliSelect";
import { usePhoenix } from "../../hooks/PhoenixContext";
import type { UserRecord } from "../../api/user";
import { useUser } from "../../hooks/useUser";
import { SECURE_KEYS } from "@/constants/storage";

type Gender = "male" | "female" | "other";

/* ---------------- Colors / Tokens ---------------- */
const P = {
  pageBg: "#0b0f14",
  cardBg: "rgba(255,255,255,.03)",
  cardBg2: "rgba(255,255,255,.02)",
  text: "#e8eef7",
  muted: "rgba(231,238,247,.72)",
  muted2: "rgba(231,238,247,.55)",
  line: "rgba(255,255,255,.10)",
  inputBg: "rgba(255,255,255,.04)",
  gold: "#D4AF37",
  goldBorder: "rgba(212,175,55,.35)",
  goldSoft: "rgba(212,175,55,.16)",
  ok: "#22c55e",
  okSoft: "rgba(34,197,94,.16)",
  danger: "rgba(248,113,113,1)",
  dangerSoft: "rgba(248,113,113,.14)",
  infoSoft: "rgba(59,130,246,.14)",
  info: "#60a5fa",
};

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 8 },
});

/* ---------------- Avatar presets ---------------- */
const PRESET_AVATARS: { id: string; src: any }[] = [
  { id: "avatar:phoenix", src: require("../../assets/avatars/phoenix.png") },
  { id: "avatar:1", src: require("../../assets/avatars/man1.png") },
  { id: "avatar:2", src: require("../../assets/avatars/woman1.png") },
  { id: "avatar:3", src: require("../../assets/avatars/man2.png") },
  { id: "avatar:4", src: require("../../assets/avatars/woman2.png") },
  { id: "avatar:5", src: require("../../assets/avatars/neutral1.png") },
  { id: "avatar:6", src: require("../../assets/avatars/neutral2.png") },
];

const getPresetAvatarSource = (id: string | null) => {
  if (!id) return null;
  const found = PRESET_AVATARS.find((a) => a.id === id);
  return found?.src ?? null;
};

// YYYY-MM-DD نگه داریم (بدون ساعت و TZ)
function normalizeIsoDateOnly(value?: string | null): string | undefined {
  const v = String(value || "").trim();
  if (!v) return undefined;
  if (v.includes("T")) return v.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (v.length >= 10) return v.slice(0, 10);
  return undefined;
}

/* -------- Pretty in-app banner (بدل Alert) -------- */
type BannerType = "error" | "info" | "success";
function bannerStyle(type: BannerType) {
  if (type === "success") {
    return {
      bg: "rgba(34,197,94,.14)",
      border: "rgba(34,197,94,.28)",
      icon: "checkmark-circle-outline" as const,
      iconColor: P.ok,
      titleColor: P.text,
      msgColor: P.muted,
    };
  }
  if (type === "info") {
    return {
      bg: P.infoSoft,
      border: "rgba(96,165,250,.28)",
      icon: "information-circle-outline" as const,
      iconColor: P.info,
      titleColor: P.text,
      msgColor: P.muted,
    };
  }
  return {
    bg: P.dangerSoft,
    border: "rgba(248,113,113,.30)",
    icon: "alert-circle-outline" as const,
    iconColor: P.danger,
    titleColor: P.text,
    msgColor: P.muted,
  };
}

export default function ProfileWizard() {
  const { phone, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { setProfileName, setAvatarUrl } = usePhoenix();
  const { refresh } = useUser() as any;

  const [resolvedPhone, setResolvedPhone] = useState<string | null>(phone ?? null);

  const [fullName, setFullName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrlState] = useState<string>("avatar:phoenix");
  const [saving, setSaving] = useState(false);

  // بوت‌چک
  const [bootChecking, setBootChecking] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // Banner
  const [banner, setBanner] = useState<{ type: BannerType; title: string; message?: string } | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  const showBanner = useCallback(
    (type: BannerType, title: string, message?: string, autoHideMs = 3500) => {
      setBanner({ type, title, message });
      Animated.timing(bannerAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (autoHideMs > 0) {
        setTimeout(() => {
          Animated.timing(bannerAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setBanner(null));
        }, autoHideMs);
      }
    },
    [bannerAnim]
  );

  const hideBanner = useCallback(() => {
    Animated.timing(bannerAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setBanner(null));
  }, [bannerAnim]);

  const mounted = useRef(true);
  const submittingRef = useRef(false);
  const redirectedRef = useRef(false);

  // ✅ NEW: جلوگیری از نمایش بنر عدم شماره در ورود صفحه
  const initialMountRef = useRef(true);
  useEffect(() => {
    initialMountRef.current = false;
  }, []);

  // اسکرول امن
  const scrollRef = useRef<ScrollView>(null);
  const nameBlockYRef = useRef(0);

  // ارتفاع کیبورد
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKbH(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKbH(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToName = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, nameBlockYRef.current - 40), animated: true });
    }, 80);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* ------- resolve phone: Context → SecureStore → AsyncStorage ------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (phone) {
          if (alive) setResolvedPhone(phone);
          return;
        }
        const ss = await SecureStore.getItemAsync(SECURE_KEYS.OTP_PHONE);
        if (ss) {
          if (alive) setResolvedPhone(ss);
          return;
        }
        const as = await AsyncStorage.getItem(SECURE_KEYS.OTP_PHONE);
        if (alive) setResolvedPhone(as || null);
        if (__DEV__)
          console.log("[profile-wizard] resolvePhone", {
            ctx: phone ?? null,
            ss: ss ?? null,
            as: as ?? null,
            key: SECURE_KEYS.OTP_PHONE,
          });
      } catch (e) {
        if (__DEV__) console.log("[profile-wizard] resolvePhone error:", e);
        if (alive) setResolvedPhone(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [phone]);

  // پیش‌پر از سرور
  useEffect(() => {
    if (redirectedRef.current) return;
    if (authLoading) return;

    // ✅ اینجا فقط ساکت برگرد؛ هیچ بنری برای "شماره نیست" در ورود صفحه نمایش نده
    if (!resolvedPhone) {
      setBootChecking(false);
      setBootError(null);
      return;
    }

    (async () => {
      try {
        setBootChecking(true);
        setBootError(null);
        const r = await getMeByPhone(resolvedPhone);

        if (!r.ok) {
          if (r.error === "USER_NOT_FOUND") {
            await AsyncStorage.removeItem("profile_completed_flag");
            await AsyncStorage.removeItem("phoenix_profile");
            showBanner("info", "خوش اومدی", "لطفاً اطلاعاتت رو تکمیل کن.");
            return;
          }
          setBootError(r.error || "NETWORK_ERROR");
          showBanner("error", "خطا در ارتباط با سرور", r.error || "NETWORK_ERROR", 4500);
          return;
        }

        if (!r.data) {
          await AsyncStorage.removeItem("profile_completed_flag");
          await AsyncStorage.removeItem("phoenix_profile");
          return;
        }

        const d = r.data as any;

        if (d.profileCompleted === true && !redirectedRef.current) {
          await AsyncStorage.setItem("profile_completed_flag", "1");
          redirectedRef.current = true;
          router.replace("/(tabs)");
          return;
        }

        if (d.fullName) setFullName(String(d.fullName));
        if (d.gender) setGender(d.gender as Gender);
        if (d.birthDate) setBirthDate(normalizeIsoDateOnly(String(d.birthDate)));

        let safeAvatar: string | null = (d.avatarUrl as string | undefined) ?? (avatarUrl || undefined) ?? null;

        if (!safeAvatar && d.gender) {
          safeAvatar = d.gender === "male" ? "icon:male" : d.gender === "female" ? "icon:female" : "avatar:phoenix";
        }
        if (!safeAvatar) safeAvatar = "avatar:phoenix";
        setAvatarUrlState(safeAvatar);

        const safeName = (d.fullName as string) || "کاربر";
        setProfileName(safeName);
        setAvatarUrl(safeAvatar);

        await AsyncStorage.setItem(
          "phoenix_profile",
          JSON.stringify({
            id: d.id ?? "",
            fullName: safeName,
            avatarUrl: safeAvatar ?? null,
            gender: d.gender ?? null,
            birthDate: normalizeIsoDateOnly(d.birthDate) ?? null,
          })
        );
      } catch (e: any) {
        setBootError(e?.message || "NETWORK_ERROR");
        showBanner("error", "مشکل شبکه", e?.message || "NETWORK_ERROR", 4500);
      } finally {
        setBootChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPhone, authLoading, router, setAvatarUrl, setProfileName]);

  /* ---------------- Image Pickers ---------------- */
  async function ensureMediaPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showBanner("error", "اجازه لازم است", "برای انتخاب عکس، دسترسی گالری را فعال کن.", 4500);
      return false;
    }
    return true;
  }
  async function ensureCameraPermission() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showBanner("error", "اجازه لازم است", "برای عکس‌برداری، دسترسی دوربین را فعال کن.", 4500);
      return false;
    }
    return true;
  }

  const pickFromGallery = async () => {
    try {
      const ok = await ensureMediaPermission();
      if (!ok) return;
      const mediaField =
        (ImagePicker as any).MediaType
          ? { mediaTypes: [(ImagePicker as any).MediaType.Image] }
          : { mediaTypes: (ImagePicker as any).MediaTypeOptions.Images };
      const res = await ImagePicker.launchImageLibraryAsync({
        ...mediaField,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        selectionLimit: 1,
      });
      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) setAvatarUrlState(uri);
      }
    } catch (e) {
      showBanner("error", "خطا", "در باز کردن گالری مشکلی پیش آمد.", 4500);
    }
  };

  const pickFromCamera = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;
      const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) setAvatarUrlState(uri);
      }
    } catch (e) {
      showBanner("error", "خطا", "در باز کردن دوربین مشکلی پیش آمد.", 4500);
    }
  };

  /* ---------------- Avatar (نمایش) ---------------- */
  const Avatar = () => {
    const current =
      (typeof avatarUrl === "string" && avatarUrl.trim().length > 0 ? avatarUrl : null) || "avatar:phoenix";

    const shell = {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: P.cardBg2,
      borderWidth: 3,
      borderColor: "rgba(212,175,55,.28)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    };

    if (current.startsWith("avatar:")) {
      const src = getPresetAvatarSource(current);
      if (src) {
        return (
          <View style={shell}>
            <Image source={src} style={{ width: 84, height: 84, borderRadius: 42 }} resizeMode="cover" />
          </View>
        );
      }
    }

    if (typeof current === "string" && current.startsWith("icon:")) {
      const which = current.split(":")[1];
      const color = which === "female" ? "#A855F7" : which === "male" ? "#3B82F6" : P.gold;
      const IconName = which === "other" ? "account" : (which as "female" | "male");
      return (
        <View style={shell}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: P.goldSoft,
              alignItems: "center",
              justifyContent: "center",
              borderColor: P.goldBorder,
              borderWidth: 1,
            }}
          >
            {IconName === "account" ? (
              <MaterialCommunityIcons name="account" size={46} color={color} />
            ) : (
              <Ionicons name={IconName as any} size={46} color={color} />
            )}
          </View>
        </View>
      );
    }

    const valid = typeof current === "string" && /^(file:|content:|https?:)/.test(current);
    if (valid) {
      return (
        <View style={shell}>
          <Image source={{ uri: current }} style={{ width: 84, height: 84, borderRadius: 42 }} />
        </View>
      );
    }

    const phoenixSrc = getPresetAvatarSource("avatar:phoenix");
    if (phoenixSrc) {
      return (
        <View style={shell}>
          <Image source={phoenixSrc} style={{ width: 84, height: 84, borderRadius: 42 }} resizeMode="cover" />
        </View>
      );
    }
    return (
      <View style={shell}>
        <Ionicons name="person" size={46} color={P.muted} />
      </View>
    );
  };

  /* ---------------- Validation ---------------- */
  const validate = () => {
    const n = (fullName || "").trim();
    if (n.length < 2) {
      showBanner("error", "نام معتبر نیست", "نام و نام خانوادگی را کامل وارد کن.", 4500);
      return false;
    }
    if (!gender) {
      showBanner("error", "جنسیت انتخاب نشده", "لطفاً جنسیت را انتخاب کن.", 4500);
      return false;
    }
    return true;
  };

  /* ---------------- Submit ---------------- */
  const onSubmit = async () => {
    if (bootChecking) {
      showBanner("info", "لطفاً کمی صبر کن", "در حال بررسی وضعیت پروفایل از سرور…", 2500);
      return;
    }

    // ✅ بنر "عدم شماره" فقط هنگام کلیک کاربر
    if (!resolvedPhone) {
      showBanner("error", "شماره یافت نشد", "لطفاً یک‌بار خارج شو و دوباره وارد شو.", 4500);
      return;
    }

    if (submittingRef.current) return;
    if (!validate()) return;

    const safeName = (fullName || "").trim();
    const safeAvatar = avatarUrl || "avatar:phoenix";
    const safeBirth = birthDate ? normalizeIsoDateOnly(birthDate) : undefined;

    const body: Partial<UserRecord> = {
      fullName: safeName,
      gender: gender ?? null,
      birthDate: safeBirth || null,
      avatarUrl: safeAvatar,
      plan: "free",
      profileCompleted: true,
      lastLoginAt: new Date().toISOString(),
    };

    try {
      submittingRef.current = true;
      setSaving(true);
      const r = await upsertUserByPhone(resolvedPhone, body);
      if (!r.ok) {
        showBanner("error", "ذخیره ناموفق بود", r.error || "HTTP_400", 4500);
        return;
      }

      await AsyncStorage.setItem("profile_completed_flag", "1");

      const finalMe = await getMeByPhone(resolvedPhone).catch(() => ({ ok: false } as any));
      if (!finalMe.ok || !finalMe.data || (finalMe.data as any).profileCompleted !== true) {
        await AsyncStorage.removeItem("profile_completed_flag");
        showBanner("error", "تایید سرور انجام نشد", "ذخیره روی سرور تایید نشد. دوباره تلاش کن.", 4500);
        return;
      }

      const d = finalMe.data as any;
      const finalName = (d.fullName as string) || safeName || "کاربر";
      const finalAvatar: string = (d.avatarUrl as string | undefined) || safeAvatar || "avatar:phoenix";

      setProfileName(finalName);
      setAvatarUrl(finalAvatar);

      await AsyncStorage.setItem(
        "phoenix_profile",
        JSON.stringify({
          id: d.id ?? "",
          fullName: finalName,
          avatarUrl: finalAvatar,
          gender: d.gender ?? gender ?? null,
          birthDate: normalizeIsoDateOnly(d.birthDate) ?? safeBirth ?? null,
        })
      );

      await refresh({ force: true }).catch(() => {});
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      showBanner("error", "مشکل شبکه", e?.message || "NETWORK_ERROR", 4500);
    } finally {
      if (mounted.current) setSaving(false);
      submittingRef.current = false;
    }
  };

  const confirmName = () => {
    Keyboard.dismiss();
    if ((fullName || "").trim().length > 0) setNameConfirmed(true);
  };

  /* ---------------- UI ---------------- */
  const bannerUI = (() => {
    if (!banner) return null;
    const S = bannerStyle(banner.type);
    return (
      <Animated.View
        style={{
          transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          opacity: bannerAnim,
          marginTop: 12,
          width: "92%",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: S.border,
          backgroundColor: S.bg,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Ionicons name={S.icon} size={18} color={S.iconColor} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: S.titleColor, fontWeight: "900", fontSize: 12, textAlign: "right" }}>{banner.title}</Text>
          {!!banner.message ? (
            <Text style={{ color: S.msgColor, fontWeight: "700", fontSize: 11, marginTop: 2, textAlign: "right" }}>
              {banner.message}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={hideBanner}
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.10)",
          }}
        >
          <Ionicons name="close" size={16} color={P.text} />
        </TouchableOpacity>
      </Animated.View>
    );
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.pageBg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={{ flex: 1 }}>
          {/* گلوها */}
          <View style={{ position: "absolute", top: -220, left: -220, width: 420, height: 420, borderRadius: 999, backgroundColor: "rgba(212,175,55,.16)" }} />
          <View style={{ position: "absolute", bottom: -240, right: -240, width: 480, height: 480, borderRadius: 999, backgroundColor: "rgba(233,138,21,.12)" }} />

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 24 + (kbH ? kbH + 24 : 0),
              alignItems: "center",
            }}
            keyboardShouldPersistTaps="handled"
          >
            {bannerUI}

            <View
              style={{
                width: "92%",
                marginTop: banner ? 10 : 16,
                borderRadius: 28,
                backgroundColor: P.cardBg,
                borderWidth: 1,
                borderColor: P.line,
                ...shadow,
                overflow: "hidden",
              }}
            >
              {/* Header (bigger padding so icon not clipped) */}
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,.02)",
                  borderBottomWidth: 1,
                  borderBottomColor: P.line,
                  height: 160,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 18,
                  paddingBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(212,175,55,.10)",
                    borderWidth: 1,
                    borderColor: "rgba(212,175,55,.28)",
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name="person-outline" size={26} color={P.gold} />
                </View>

                <Text style={{ color: P.text, fontWeight: "900", fontSize: 18 }}>تکمیل پروفایل</Text>
                <Text style={{ color: P.muted, marginTop: 4, fontSize: 12 }}>فقط چند قدم تا شروع ققنوس فاصله داری</Text>

                <View style={{ marginTop: 10, height: 18 }}>
                  {bootChecking ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator />
                      <Text style={{ color: P.muted2, fontSize: 11 }}>در حال بررسی وضعیت پروفایل از سرور…</Text>
                    </View>
                  ) : bootError ? (
                    <Text style={{ color: P.danger, fontSize: 11 }}>خطا در ارتباط با سرور: {bootError}</Text>
                  ) : null}
                </View>
              </View>

              {/* Avatar & actions */}
              <View style={{ alignItems: "center" }}>
                <View style={{ marginTop: 10 }}>
                  <Avatar />
                </View>

                {/* آواتارهای آماده – یک ردیف افقی کم‌جا */}
                <View style={{ marginTop: 10, paddingHorizontal: 12, width: "100%" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 6 }}>
                    <Ionicons name="sparkles-outline" size={16} color={P.muted} />
                    <Text style={{ color: P.muted, fontSize: 12, fontWeight: "800", textAlign: "right" }}>
                      انتخاب آواتار آماده
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 2, gap: 10 }}>
                    {PRESET_AVATARS.map((av) => {
                      const selected = (avatarUrl || "avatar:phoenix") === av.id;
                      return (
                        <TouchableOpacity key={av.id} onPress={() => setAvatarUrlState(av.id)} activeOpacity={0.9}>
                          <View
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              overflow: "hidden",
                              borderWidth: selected ? 2 : 1,
                              borderColor: selected ? P.gold : P.line,
                              backgroundColor: P.cardBg2,
                            }}
                          >
                            <Image source={av.src} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* گالری / دوربین / ریست */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 8,
                    marginBottom: 6,
                    paddingHorizontal: 18,
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={pickFromGallery}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: P.goldSoft,
                      borderWidth: 1,
                      borderColor: P.goldBorder,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="images-outline" size={16} color={P.text} />
                    <Text style={{ color: P.text, fontWeight: "900", fontSize: 12 }}>از گالری</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={pickFromCamera}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: P.cardBg2,
                      borderWidth: 1,
                      borderColor: P.line,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="camera-outline" size={16} color={P.text} />
                    <Text style={{ color: P.text, fontWeight: "800", fontSize: 12 }}>دوربین</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setAvatarUrlState("avatar:phoenix")}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: P.inputBg,
                      borderWidth: 1,
                      borderColor: P.line,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="refresh-outline" size={16} color={P.muted} />
                    <Text style={{ color: P.muted, fontWeight: "800", fontSize: 12 }}>ققنوس پیش‌فرض</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Form */}
              <View style={{ paddingHorizontal: 18, paddingBottom: 18, paddingTop: 8, direction: "rtl" }}>
                {/* Phone */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginTop: 8, marginBottom: 4, gap: 6 }}>
                  <Ionicons name="call-outline" size={14} color={P.muted} />
                  <Text style={{ color: P.muted, fontSize: 12, fontWeight: "800", textAlign: "right" }}>شماره موبایل</Text>
                </View>
                <View style={{ height: 48, borderRadius: 14, backgroundColor: P.inputBg, borderColor: P.line, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14 }}>
                  <Text style={{ color: P.text, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }}>
                    {resolvedPhone || "-"}
                  </Text>
                </View>

                {/* Name block */}
                <View onLayout={(e) => { nameBlockYRef.current = e.nativeEvent.layout.y; }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginTop: 12, marginBottom: 6, gap: 6 }}>
                    <Ionicons name="person-outline" size={14} color={P.muted} />
                    <Text style={{ color: P.muted, fontSize: 12, fontWeight: "800", textAlign: "right" }}>نام</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TextInput
                      value={fullName}
                      onChangeText={(t) => { setFullName(t); if (nameConfirmed) setNameConfirmed(false); }}
                      onFocus={scrollToName}
                      placeholder="نام و نام خانوادگی"
                      placeholderTextColor="rgba(231,238,247,.45)"
                      style={{
                        flex: 1,
                        height: 50,
                        borderRadius: 14,
                        backgroundColor: P.inputBg,
                        borderColor: P.line,
                        borderWidth: 1,
                        paddingHorizontal: 14,
                        color: P.text,
                        fontWeight: "700",
                        textAlign: "right",
                        writingDirection: "rtl",
                      }}
                      returnKeyType="done"
                      onSubmitEditing={confirmName}
                    />
                    <TouchableOpacity
                      onPress={confirmName}
                      activeOpacity={0.9}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: nameConfirmed ? P.okSoft : P.goldSoft,
                        borderWidth: 1,
                        borderColor: nameConfirmed ? "rgba(34,197,94,.40)" : P.goldBorder,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="checkmark" size={22} color={nameConfirmed ? P.ok : P.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Gender */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginTop: 14, marginBottom: 6, gap: 6 }}>
                  <Ionicons name="male-female-outline" size={14} color={P.muted} />
                  <Text style={{ color: P.muted, fontSize: 12, fontWeight: "800", textAlign: "right" }}>جنسیت</Text>
                </View>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  {([
                    { key: "male", label: "مرد", icon: "male" },
                    { key: "female", label: "زن", icon: "female" },
                    { key: "other", label: "سایر", icon: "gender-non-binary" },
                  ] as const).map((g) => {
                    const selected = gender === (g.key as Gender);
                    const IconComp = g.key === "other" ? MaterialCommunityIcons : Ionicons;
                    const iconName = g.key === "other" ? ("gender-non-binary" as any) : (g.icon as any);
                    return (
                      <Pressable
                        key={g.key}
                        onPress={() => { Keyboard.dismiss(); setGender(g.key as Gender); }}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 12,
                          backgroundColor: selected ? P.goldSoft : P.inputBg,
                          borderWidth: 2,
                          borderColor: selected ? P.gold : P.line,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        <IconComp name={iconName} size={18} color={selected ? P.gold : P.muted} />
                        <Text style={{ color: P.text, fontWeight: "800" }}>{g.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Birthdate */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginTop: 14, marginBottom: 6, gap: 6 }}>
                  <Ionicons name="calendar-outline" size={14} color={P.muted} />
                  <Text style={{ color: P.muted, fontSize: 12, fontWeight: "800", textAlign: "right" }}>تاریخ تولد (اختیاری)</Text>
                </View>

                <JalaliSelect
                  key={birthDate || "no-birth"}
                  initial={birthDate}
                  onChange={(iso) => { Keyboard.dismiss(); setBirthDate(normalizeIsoDateOnly(iso)); }}
                  minYear={1330}
                  maxYear={1390}
                  styleContainer={{ borderColor: P.line, backgroundColor: P.inputBg }}
                  stylePicker={{ backgroundColor: "#0b0f14", borderColor: P.line }}
                  textColor={P.text}
                  accentColor={P.gold}
                  dark
                  grid
                />

                {!!birthDate && (
                  <Text style={{ color: P.muted, fontSize: 12, marginTop: 6, textAlign: "left" }}>
                    تاریخ انتخابی (میلادی): <Text style={{ color: P.text, fontWeight: "800" }}>{birthDate}</Text>
                  </Text>
                )}

                {/* Submit */}
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); onSubmit(); }}
                  disabled={saving || bootChecking}
                  activeOpacity={0.9}
                  style={{
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: saving ? "rgba(255,255,255,.06)" : P.goldSoft,
                    borderWidth: 1,
                    borderColor: saving ? P.line : P.goldBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 16,
                    opacity: saving || bootChecking ? 0.65 : 1,
                  }}
                >
                  <Text style={{ color: P.text, fontSize: 14, fontWeight: "900" }}>
                    {saving ? "در حال ذخیره…" : bootChecking ? "در حال بررسی…" : "ذخیره و شروع"}
                  </Text>
                </TouchableOpacity>

                {bootChecking ? (
                  <Text style={{ color: P.muted2, fontSize: 11, marginTop: 10, textAlign: "center" }}>
                    لطفاً چند ثانیه صبر کن تا وضعیت از سرور بررسی شود.
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}