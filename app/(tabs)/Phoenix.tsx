// app/(tabs)/Phoenix.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  I18nManager,
  Image,
  Text,
  TouchableOpacity,
  View,
  Linking,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import Screen from "../../components/Screen";
import { usePhoenix } from "../../hooks/PhoenixContext";
import { useRouter } from "expo-router";
import { useUser } from "../../hooks/useUser";
import EditProfileModal from "../../components/EditProfileModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ اضافه شد: منبع واحد وضعیت پلن
import { getPlanStatus } from "../../lib/plan";

// اگر PlanStatusBadge تو پروژه‌ات named export بود، این رو به { PlanStatusBadge } تغییر بده.
import PlanStatusBadge from "../../components/PlanStatusBadge";

/* ---------- avatar helpers ---------- */
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

const toPersianDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/* ----------------- UI helpers ----------------- */
function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

function PrimarySplitButton({
  leftText,
  leftIcon,
  onLeftPress,
  rightText,
  rightIcon,
  onRightPress,
  rightVariant = "gold",
}: {
  leftText: string;
  leftIcon: keyof typeof Ionicons.glyphMap;
  onLeftPress: () => void;
  rightText: string;
  rightIcon: keyof typeof Ionicons.glyphMap;
  onRightPress: () => void;
  rightVariant?: "gold" | "danger";
}) {
  return (
    <View style={styles.splitRow}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onRightPress}
        style={[
          styles.splitBtn,
          rightVariant === "danger" ? styles.splitBtnRightDanger : styles.splitBtnRight,
        ]}
      >
        <Ionicons
          name={rightIcon as any}
          size={16}
          color={rightVariant === "danger" ? "#FCA5A5" : "#D4AF37"}
        />
        <Text style={styles.splitBtnText}>{rightText}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onLeftPress}
        style={[styles.splitBtn, styles.splitBtnLeft]}
      >
        <Ionicons name={leftIcon as any} size={16} color="#60A5FA" />
        <Text style={styles.splitBtnText}>{leftText}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FullWidthStatCard({
  title,
  icon,
  value,
  valueSuffix,
  iconColor = "#D4AF37",
  rightIconOverlay,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  valueSuffix?: string;
  iconColor?: string;
  rightIconOverlay?: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.fullCard}>
      <View style={styles.fullCardTopRow}>
        <View style={styles.fullCardTitleRow}>
          <View style={styles.fullCardIconWrap}>
            <Ionicons name={icon as any} size={18} color={iconColor} />
            {!!rightIconOverlay && (
              <View style={styles.iconOverlay}>{rightIconOverlay}</View>
            )}
          </View>
          <Text style={styles.fullCardTitle}>{title}</Text>
        </View>
      </View>

      <Text style={styles.fullCardValue}>
        {toPersianDigits(value)}
        {!!valueSuffix ? (
          <Text style={styles.fullCardValueUnit}> {valueSuffix}</Text>
        ) : null}
      </Text>
    </GlassCard>
  );
}

/* ================== Phoenix Screen ================== */
export default function Phoenix() {
  const rtl = I18nManager.isRTL;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, refresh } = useUser() as any;

  const {
    profileName,
    avatarUrl,
    points,
    isDark,
    setProfileName,
    setAvatarUrl,
  } = usePhoenix();

  const [editVisible, setEditVisible] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    refresh?.().catch(() => {});
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh?.().catch(() => {});
      return () => {};
    }, [refresh])
  );

  // سینک نام/آواتار با سرور
  useEffect(() => {
    if (me?.fullName && me.fullName !== profileName)
      setProfileName(me.fullName as string);
    if (me?.avatarUrl && me.avatarUrl !== avatarUrl)
      setAvatarUrl(me.avatarUrl as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.fullName, me?.avatarUrl]);

  const renderProfileAvatar = () => {
    const current =
      (typeof avatarUrl === "string" && avatarUrl.trim().length > 0
        ? avatarUrl
        : null) || "avatar:phoenix";

    if (current.startsWith("avatar:")) {
      const src = getPresetAvatarSource(current);
      if (src) {
        return (
          <Image source={src} style={styles.avatarImg} resizeMode="cover" />
        );
      }
    }

    if (typeof current === "string" && current.startsWith("icon:")) {
      const which = current.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View
          style={[
            styles.avatarFallback,
            { borderColor: color, backgroundColor: color + "22" },
          ]}
        >
          <Ionicons name={iconName as any} size={44} color={color} />
        </View>
      );
    }

    const isValidUri =
      typeof current === "string" && /^(file:|content:|https?:)/.test(current);
    if (isValidUri) {
      return <Image source={{ uri: current }} style={styles.avatarImg} />;
    }

    const phoenixSrc = getPresetAvatarSource("avatar:phoenix");
    if (phoenixSrc) {
      return (
        <Image
          source={phoenixSrc}
          style={styles.avatarImg}
          resizeMode="cover"
        />
      );
    }

    return (
      <View
        style={[
          styles.avatarFallback,
          { borderColor: "#3B82F6", backgroundColor: "#3B82F622" },
        ]}
      >
        <Ionicons name="person" size={44} color="#3B82F6" />
      </View>
    );
  };

  const openTerms = () => Linking.openURL("https://qoqnoos.app/terms.html");
  const openSite = () => Linking.openURL("https://qoqnoos.app/");

  const version = useMemo(() => {
    return (
      (Constants?.expoConfig as any)?.version ||
      (Constants?.manifest as any)?.version ||
      "1.0.0"
    );
  }, []);

  // ✅ وضعیت پلن (منبع واحد)
  const status = getPlanStatus(me);
  const isProActive = status.isPro;

  // فعلاً طبق درخواست: صفر
  const techniqueStreakDays = 0;
  const noContactDays = 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0f14" }}>
      <StatusBar style="light" backgroundColor="#0b0f14" animated />

      {/* گلو مثل بقیه تب‌ها */}
      <View pointerEvents="none" style={styles.bgGlow1} />
      <View pointerEvents="none" style={styles.bgGlow2} />

      <Screen
        backgroundColor="#0b0f14"
        contentContainerStyle={{
          rowGap: 12,
          direction: rtl ? "rtl" : "ltr",
          paddingBottom: 18,
        }}
      >
        {/* کارت پروفایل */}
        <View style={styles.profileCard}>
          {/* ✅ بج دقیقاً سمت چپ کارت و هم‌تراز با اسم */}
          <View style={styles.planBadgeLeftAligned}>
            <PlanStatusBadge me={me} showExpiringText={false} />
          </View>

          <View style={styles.profileRow}>
            {/* آواتار راست */}
            {renderProfileAvatar()}

            {/* اسم */}
            <View style={styles.profileNameWrap}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName || "کاربر"}
              </Text>
            </View>
          </View>
        </View>

        {/* دو دکمه زیر کارت پروفایل */}
        <PrimarySplitButton
          rightText={isProActive ? "اشتراک" : "ارتقا به پرو"}
          rightIcon="card"
          onRightPress={() => router.push("/(tabs)/Subscription")}
          leftText="ویرایش پروفایل"
          leftIcon="create"
          onLeftPress={() => setEditVisible(true)}
          rightVariant={isProActive ? "gold" : "danger"}
        />

        {/* استمرار روزها */}
        <FullWidthStatCard
          title="استمرار روزها"
          icon="flame"
          iconColor="#E98A15"
          value={techniqueStreakDays}
          valueSuffix="روز"
        />

        {/* رکورد قطع تماس */}
        <FullWidthStatCard
          title="رکورد قطع تماس"
          icon="call-outline"
          iconColor="#FBBF24"
          value={noContactDays}
          valueSuffix="روز"
          rightIconOverlay={<Ionicons name="close" size={16} color="#FBBF24" />}
        />

        {/* امتیازها و مدال‌ها */}
        <GlassCard style={styles.fullCard}>
          <View style={styles.fullCardTopRow}>
            <View style={styles.fullCardTitleRow}>
              <View style={styles.fullCardIconWrap}>
                <Ionicons name="trophy" size={18} color="#D4AF37" />
              </View>
              <Text style={styles.fullCardTitle}>امتیازها و مدال‌ها</Text>
            </View>

            <Text style={styles.pointsLeft}>{toPersianDigits(points ?? 0)}</Text>
          </View>

          <View style={styles.medalsRow}>
            <View style={styles.medalItem}>
              <View
                style={[
                  styles.medalCircle,
                  { borderColor: "rgba(205,127,50,.55)" },
                ]}
              >
                <Ionicons name="medal" size={18} color="#CD7F32" />
              </View>
              <Text style={styles.medalText}>برنز</Text>
            </View>

            <View style={styles.medalItem}>
              <View
                style={[
                  styles.medalCircle,
                  { borderColor: "rgba(192,192,192,.55)" },
                ]}
              >
                <Ionicons name="medal" size={18} color="#C0C0C0" />
              </View>
              <Text style={styles.medalText}>نقره</Text>
            </View>

            <View style={styles.medalItem}>
              <View
                style={[
                  styles.medalCircle,
                  { borderColor: "rgba(212,175,55,.55)" },
                ]}
              >
                <Ionicons name="medal" size={18} color="#D4AF37" />
              </View>
              <Text style={styles.medalText}>طلا</Text>
            </View>
          </View>
        </GlassCard>

        {/* قوانین و مقررات */}
        <TouchableOpacity activeOpacity={0.9} onPress={openTerms}>
          <GlassCard>
            <View style={styles.linkRow}>
              <View style={styles.linkRight}>
                <Ionicons name="document-text" size={18} color="#E5E7EB" />
                <Text style={styles.linkTitle}>قوانین و مقررات</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.7, transform: [{ scaleX: -1 }] }}
              />
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* درباره ققنوس */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setAboutOpen(true)}>
          <GlassCard>
            <View style={styles.linkRow}>
              <View style={styles.linkRight}>
                <Ionicons name="information-circle" size={18} color="#E5E7EB" />
                <Text style={styles.linkTitle}>درباره ققنوس</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.7, transform: [{ scaleX: -1 }] }}
              />
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Screen>

      {/* Bottom Sheet: درباره ققنوس */}
      <Modal
        visible={aboutOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAboutOpen(false)}
        />

        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>درباره ققنوس</Text>
            <TouchableOpacity
              onPress={() => setAboutOpen(false)}
              activeOpacity={0.85}
              style={styles.sheetClose}
            >
              <Ionicons name="close" size={20} color="#E5E7EB" />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetCard}>
            <View style={styles.sheetRow}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#E5E7EB"
              />
              <Text style={styles.sheetRowText}>نسخه اپ</Text>
              <Text style={styles.sheetRowRight}>
                {toPersianDigits(version)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openSite}
              style={styles.sheetRowBtn}
            >
              <Ionicons name="globe-outline" size={18} color="#60A5FA" />
              <Text style={styles.sheetRowText}>وب‌سایت</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.7, transform: [{ scaleX: -1 }] }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openSite}
              style={styles.sheetRowBtn}
            >
              <Ionicons name="call-outline" size={18} color="#FBBF24" />
              <Text style={styles.sheetRowText}>تماس با ما</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.7, transform: [{ scaleX: -1 }] }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openSite}
              style={styles.sheetRowBtn}
            >
              <Ionicons
                name="cloud-download-outline"
                size={18}
                color="#D4AF37"
              />
              <Text style={styles.sheetRowText}>به‌روزرسانی اپ</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#E5E7EB"
                style={{ opacity: 0.7, transform: [{ scaleX: -1 }] }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {editVisible && <EditProfileModal onClose={() => setEditVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  /* background */
  bgGlow1: {
    position: "absolute",
    top: -240,
    left: -220,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlow2: {
    position: "absolute",
    bottom: -260,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  /* generic glass */
  glassCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    overflow: "hidden",
  },

  /* profile */
  profileCard: {
    borderRadius: 22,
    padding: 16,
    minHeight: 104,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(3,7,18,.92)",
    overflow: "hidden",
  },

  // ✅ بج در سمت چپ و هم‌تراز با اسم
  // اگر 44 دقیق نبود فقط همین top را 2-3 تا بالا/پایین کن.
  planBadgeLeftAligned: {
    position: "absolute",
    left: 12,
    top: 30,
    zIndex: 5,
  },

  profileRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },

  profileNameWrap: {
    flex: 1,
    justifyContent: "center",
    // برای اینکه اسم وسط کارت خوب بنشینه
    paddingLeft: 72, // فضای سمت چپ برای بج (تا زیرش نره)
  },

  profileName: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },

  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  /* split buttons under profile */
  splitRow: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  splitBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  splitBtnRight: {
    backgroundColor: "rgba(212,175,55,.18)",
    borderColor: "rgba(212,175,55,.30)",
  },
  // ✅ اضافه شد: حالت قرمز برای ارتقا به پرو
  splitBtnRightDanger: {
    backgroundColor: "rgba(239,68,68,.18)",
    borderColor: "rgba(239,68,68,.35)",
  },
  splitBtnLeft: {
    backgroundColor: "rgba(96,165,250,.14)",
    borderColor: "rgba(96,165,250,.28)",
  },
  splitBtnText: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
  },

  /* full width cards */
  fullCard: {
    borderRadius: 20,
    padding: 16,
  },
  fullCardTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullCardTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  fullCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  iconOverlay: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,7,18,.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  fullCardTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "right",
  },
  fullCardValue: {
    marginTop: 14,
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 34,
    textAlign: "left",
  },
  fullCardValueUnit: {
    fontSize: 18,
    color: "rgba(231,238,247,.80)",
    fontWeight: "900",
  },

  /* points */
  pointsLeft: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 22,
    textAlign: "left",
  },
  medalsRow: {
    marginTop: 14,
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    gap: 12,
  },
  medalItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  medalCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  medalText: {
    color: "rgba(231,238,247,.85)",
    fontWeight: "900",
    fontSize: 12,
  },

  /* links */
  linkRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  linkTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "right",
  },

  /* bottom sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "rgba(3,7,18,.96)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.18)",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 15,
    textAlign: "right",
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  sheetCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    overflow: "hidden",
  },
  sheetRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    gap: 10,
  },
  sheetRowBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
    gap: 10,
  },
  sheetRowText: {
    flex: 1,
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "right",
  },
  sheetRowRight: {
    color: "rgba(231,238,247,.80)",
    fontWeight: "900",
    fontSize: 12,
    textAlign: "left",
  },
});