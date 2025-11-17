// app/(auth)/profile-wizard.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage"; // ✅ اضافه شد

import { useAuth } from "../../hooks/useAuth";
import { upsertUserByPhone, getMeByPhone } from "../../api/user";
import JalaliSelect from "../../components/JalaliSelect";

type Gender = "male" | "female" | "other";

/* ---------------- Colors / Tokens (Orange theme) ---------------- */
const P = {
  pageBg: "#0B0C10",
  cardBg: "#121418",
  textDark: "#FFFFFF",
  textMuted: "#9AA0A6",
  border: "#262B33",
  inputBg: "#161A20",
  primary: "#FF6A00",
  primaryDark: "#CC5600",
  primarySoft: "#FFE6D5",
};
const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 6 },
});

/* ---------------- Small UI helpers ---------------- */
const Label = ({ children }: { children: React.ReactNode }) => (
  <Text
    style={{
      color: P.textMuted,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 14,
      marginBottom: 6,
      textAlign: "left",
      alignSelf: "flex-end",
      width: "100%",
      writingDirection: "rtl",
    }}
  >
    {children}
  </Text>
);

export default function ProfileWizard() {
  const { phone } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined); // yyyy-mm-dd
  const [avatarUrl, setAvatarUrl] = useState<string>("icon:female");
  const [saving, setSaving] = useState(false);

  const mounted = useRef(true);
  const submittingRef = useRef(false);
  const redirectedRef = useRef(false); // ✅ جلوی ریدایرکت دوباره

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ✅ اگر قبلاً پروفایل تکمیل شده (فلگ محلی)، همین ابتدا برو تب‌ها
  useEffect(() => {
    (async () => {
      const flag = await AsyncStorage.getItem("profile_completed_flag");
      //if (flag === "1" && !redirectedRef.current) {
        //redirectedRef.current = true;
        //router.replace("/(tabs)");
      //}
    })();
  }, [router]);

  // پیش‌پر کردن فیلدها از سرور (بر اساس شماره) + اگر completed بود، برو تب‌ها
  useEffect(() => {
    if (!phone || redirectedRef.current) return;
    (async () => {
      try {
        const r = await getMeByPhone(phone);
        if (r.ok && r.data) {
          const d = r.data as any;

          // اگر سرور می‌گه کامل است، بدون نمایش فرم برو تب‌ها
          //if (d.profileCompleted === true && !redirectedRef.current) {
            //await AsyncStorage.setItem("profile_completed_flag", "1"); // همسان‌سازی فلگ
            //redirectedRef.current = true;
           // router.replace("/(tabs)");
           // return;
         // }

          if (d.fullName) setFullName(String(d.fullName));
          if (d.gender) setGender(d.gender as Gender);
          if (d.birthDate) setBirthDate(String(d.birthDate));
          if (d.avatarUrl) setAvatarUrl(String(d.avatarUrl));
          if (!d.avatarUrl && d.gender) {
            setAvatarUrl(d.gender === "male" ? "icon:male" : d.gender === "female" ? "icon:female" : "icon:female");
          }
        }
      } catch {}
    })();
  }, [phone, router]);

  /* ---------------- Image Pickers (compat with old/new APIs) ---------------- */
  async function ensureMediaPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("اجازه لازم است", "برای انتخاب عکس، دسترسی گالری را فعال کن.");
      return false;
    }
    return true;
  }
  async function ensureCameraPermission() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("اجازه لازم است", "برای عکس‌برداری، دسترسی دوربین را فعال کن.");
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
        if (uri) setAvatarUrl(uri);
      }
    } catch (e) {
      if (__DEV__) console.log("pickFromGallery error:", e);
      Alert.alert("خطا", "در باز کردن گالری مشکلی پیش آمد.");
    }
  };

  const pickFromCamera = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) setAvatarUrl(uri);
      }
    } catch (e) {
      if (__DEV__) console.log("pickFromCamera error:", e);
      Alert.alert("خطا", "در باز کردن دوربین مشکلی پیش آمد.");
    }
  };

  /* ---------------- Avatar ---------------- */
  const Avatar = () => {
    if (avatarUrl.startsWith("icon:")) {
      const which = avatarUrl.split(":")[1];
      const color = which === "female" ? "#A855F7" : which === "male" ? "#3B82F6" : P.primary;
      const IconName = which === "other" ? "account" : (which as "female" | "male");
      return (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: P.cardBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: P.primarySoft,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: P.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              borderColor: P.primary,
              borderWidth: 2,
            }}
          >
            {IconName === "account" ? (
              <MaterialCommunityIcons name="account" size={52} color={color} />
            ) : (
              <Ionicons name={IconName as any} size={52} color={color} />
            )}
          </View>
        </View>
      );
    }
    const valid = /^(file:|content:|https?:)/.test(avatarUrl);
    return (
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: P.cardBg,
          borderWidth: 3,
          borderColor: P.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {valid ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
        ) : (
          <Ionicons name="person" size={52} color={P.textMuted} />
        )}
      </View>
    );
  };

  /* ---------------- Validation ---------------- */
  const validate = () => {
    const n = (fullName || "").trim();
    if (n.length < 2) return Alert.alert("خطا", "نام و نام خانوادگی را کامل وارد کن."), false;
    if (!gender) return Alert.alert("خطا", "جنسیت را انتخاب کن."), false;
    return true;
  };

  /* ---------------- Submit ---------------- */
  const onSubmit = async () => {
    if (!phone) return Alert.alert("خطا", "شماره یافت نشد؛ دوباره وارد شو.");
    if (submittingRef.current) return;
    if (!validate()) return;

    const body = {
      fullName: (fullName || "").trim(),
      gender: gender as string,
      birthDate: birthDate || null,
      avatarUrl: avatarUrl || null,
      plan: "free",
      profileCompleted: true,
      lastLoginAt: new Date().toISOString(),
    };

    try {
      submittingRef.current = true;
      setSaving(true);
      if (__DEV__) console.log("[profile-wizard] upsert by phone →", phone, body);

      let r = await upsertUserByPhone(phone, body);
      if (!r.ok && /NOT_FOUND|404/i.test(String(r.error))) {
        r = await upsertUserByPhone(phone, body);
      }
      if (!r.ok) {
        submittingRef.current = false;
        setSaving(false);
        return Alert.alert("خطا", r.error || "HTTP_400");
      }

      // ✅ فلگ محلی را ست کن تا دفعات بعد ویزارد باز نشود
      await AsyncStorage.setItem("profile_completed_flag", "1");

      // سرور را هم می‌خوانیم؛ اگر به هر دلیل false بود، با فلگ محلی عبور می‌کنیم
      const me = await getMeByPhone(phone).catch(() => ({ ok: false } as any));
      let completed = (me as any)?.ok ? !!(me as any).data?.profileCompleted : false;
      if (!completed) {
        const flag = await AsyncStorage.getItem("profile_completed_flag");
        if (flag === "1") completed = true;
      }

      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace(completed ? "/(tabs)" : "/(tabs)"); // ✅ در هر صورت به تب‌ها برو
      }
    } catch (e: any) {
      Alert.alert("خطا", e?.message || "مشکل شبکه");
    } finally {
      if (mounted.current) setSaving(false);
      submittingRef.current = false;
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.pageBg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, alignItems: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "92%",
              marginTop: 16,
              borderRadius: 28,
              backgroundColor: P.cardBg,
              ...shadow,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <View style={{ backgroundColor: P.primary, height: 150, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFF8F2", fontWeight: "900", fontSize: 18 }}>تکمیل پروفایل</Text>
              <Text style={{ color: "#FFE6D5", marginTop: 4, fontSize: 12 }}>برای ادامه چند فیلد ساده را پُر کن</Text>
            </View>

            {/* Floating Avatar & Actions */}
            <View style={{ alignItems: "center" }}>
              <View style={{ marginTop: -35 }}>
                <Avatar />
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 6 }}>
                <TouchableOpacity
                  onPress={() => setAvatarUrl("icon:female")}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: P.primarySoft,
                    borderWidth: 1,
                    borderColor: P.primary,
                  }}
                >
                  <Text style={{ color: P.primaryDark, fontWeight: "800" }}>آیکن زن</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAvatarUrl("icon:male")}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: P.primarySoft,
                    borderWidth: 1,
                    borderColor: P.primary,
                  }}
                >
                  <Text style={{ color: P.primaryDark, fontWeight: "800" }}>آیکن مرد</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromGallery}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: P.primary }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>انتخاب عکس</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromCamera}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#0F172A10",
                    borderWidth: 1,
                    borderColor: P.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="camera" size={18} color={P.textDark} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Form */}
            <View
              style={{
                paddingHorizontal: 18,
                paddingBottom: 18,
                paddingTop: 8,
                direction: "rtl",
                writingDirection: "rtl",
              }}
            >
              {/* Phone (read-only) */}
              <Label>شماره موبایل</Label>
              <View
                style={{
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: P.inputBg,
                  borderColor: P.border,
                  borderWidth: 1,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                }}
              >
                <Text style={{ color: P.textDark, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }}>
                  {phone || "-"}
                </Text>
              </View>

              {/* Name */}
              <Label>نام</Label>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثلاً: پژمان"
                placeholderTextColor={P.textMuted}
                style={{
                  height: 50,
                  borderRadius: 14,
                  backgroundColor: P.inputBg,
                  borderColor: P.border,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  color: P.textDark,
                  fontWeight: "700",
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
                returnKeyType="done"
              />

              {/* Gender */}
              <Label>جنسیت</Label>
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
                      onPress={() => setGender(g.key as Gender)}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: selected ? P.primarySoft : P.inputBg,
                        borderWidth: 2,
                        borderColor: selected ? P.primary : P.border,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <IconComp name={iconName} size={18} color={selected ? P.primaryDark : P.textMuted} />
                      <Text style={{ color: selected ? P.primaryDark : P.textDark, fontWeight: "800" }}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Birthdate */}
              <Label>تاریخ تولد (اختیاری)</Label>
              <JalaliSelect
                initial={birthDate}
                onChange={(iso) => setBirthDate(iso)}
                minYear={1330}
                maxYear={1390}
                styleContainer={{ borderColor: P.border, backgroundColor: P.inputBg }}
                stylePicker={{ backgroundColor: P.cardBg, borderColor: P.border }}
                textColor={P.textDark}
                accentColor={P.primary}
                dark
                grid
              />
              {!!birthDate && (
                <Text style={{ color: P.textMuted, fontSize: 12, marginTop: 6, textAlign: "left" }}>
                  تاریخ انتخابی (میلادی): <Text style={{ color: P.textDark, fontWeight: "800" }}>{birthDate}</Text>
                </Text>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={onSubmit}
                disabled={saving}
                activeOpacity={0.9}
                style={{
                  height: 54,
                  borderRadius: 16,
                  backgroundColor: saving ? P.primaryDark : P.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 18,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>
                  {saving ? "در حال ذخیره…" : "ذخیره و شروع"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}