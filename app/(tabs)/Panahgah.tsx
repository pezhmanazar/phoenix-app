// app/(tabs)/Panahgah.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { allScenarios } from "@/lib/panahgah/registry";
import { useUser } from "../../hooks/useUser";

const PRO_FLAG_KEY = "phoenix_is_pro";

export default function Panahgah() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useUser();

  const [q, setQ] = useState("");
  const [isProLocal, setIsProLocal] = useState(false);
  const [loadingPro, setLoadingPro] = useState(true);

  // لود اولیه وضعیت پرو/رایگان
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
        const flagIsPro = flag === "1";
        const serverIsPro = me?.plan === "pro" || me?.plan === "vip";
        const final = flagIsPro || serverIsPro;
        setIsProLocal(final);
        console.log("PANAHGAH INIT plan =", me?.plan, "flag =", flag, "isProLocal =", final);
      } catch (e) {
        console.log("PANAHGAH INIT ERR", e);
        setIsProLocal(false);
      } finally {
        setLoadingPro(false);
      }
    })();
  }, [me?.plan]);

  // هر بار تب پناهگاه فوکوس می‌گیرد، دوباره فلگ را بخوان
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
          const flagIsPro = flag === "1";
          const serverIsPro = me?.plan === "pro" || me?.plan === "vip";
          const final = flagIsPro || serverIsPro;

          if (!cancelled) {
            setIsProLocal(final);
            console.log(
              "PANAHGAH FOCUS plan =",
              me?.plan,
              "flag =",
              flag,
              "isProLocal =",
              final
            );
          }
        } catch (e) {
          console.log("PANAHGAH FOCUS ERR", e);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [me?.plan])
  );

  const data = useMemo(() => {
    const items = allScenarios();
    if (!q.trim()) return items;
    const qq = q.trim();
    return items.filter(
      (s) =>
        s.title.includes(qq) ||
        s.id.includes(qq.replace(/\s+/g, "-"))
    );
  }, [q]);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/panahgah/${item.id}`)}
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.row}>
        <Ionicons name="heart" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Ionicons
          name="chevron-back"
          size={18}
          color={colors.text}
          style={{ transform: [{ scaleX: -1 }], opacity: 0.7 }}
        />
      </View>
    </TouchableOpacity>
  );

  if (loadingPro) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.text, marginTop: 8, fontSize: 12 }}>
            در حال آماده‌سازی پناهگاه…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>پناهگاه</Text>
        <View style={styles.headerBadgeRow}>
          <View
            style={[
              styles.headerBadge,
              { backgroundColor: isProLocal ? "#F59E0B" : "#9CA3AF" },
            ]}
          >
            <Text style={styles.headerBadgeText}>
              {isProLocal ? "PRO" : "FREE"}
            </Text>
          </View>
        </View>
      </View>

      {/* اگر پرو نیست → فقط صفحه معرفی قفل‌شده */}
      {!isProLocal ? (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <View
            style={[
              styles.lockCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 15,
                  textAlign: "right",
                }}
              >
                پناهگاه مخصوص لحظه‌های اورژانسی بعد از جداییه
              </Text>
            </View>

            <Text
              style={{
                color: colors.text,
                opacity: 0.8,
                marginTop: 10,
                fontSize: 13,
                textAlign: "right",
                lineHeight: 20,
              }}
            >
              هر موقع ناگهان وسوسه‌ی پیام دادن، چک کردن، گریه‌های شدید یا حملهٔ
              تنهایی سراغت میاد، اینجا دقیقاً همون‌جاست که باید بیای. سناریوهای
              مختلفی برات آماده شده که قدم‌به‌قدم راهت بندازه.
            </Text>

            <View style={{ marginTop: 14, gap: 6 }}>
              <View style={styles.bulletRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  وقتی می‌خوای بهش پیام بدی
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  وقتی عکس‌ها و خاطره‌ها دوباره خفه‌ات می‌کنن
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.bulletText, { color: colors.text }]}>
                  وقتی حس می‌کنی الان می‌لغزی و همه‌چی رو خراب می‌کنی
                </Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 16,
                padding: 10,
                borderRadius: 10,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
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
                برای باز شدن کامل «پناهگاه» و دسترسی به همه‌ی سناریوها،
                باید پلن PRO را از تب پرداخت فعال کنی.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
            <View
              style={[
                styles.searchBox,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={colors.text}
                style={{ opacity: 0.6 }}
              />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="جست‌وجوی موقعیت…"
                placeholderTextColor={colors.text + "99"}
                style={{ flex: 1, textAlign: "right", color: colors.text }}
              />
            </View>
          </View>
          {/* List */}
          <FlatList
            data={data}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16 + insets.bottom,
              paddingTop: 6,
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerBadgeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerBadgeText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 11,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  title: { flex: 1, textAlign: "right", fontWeight: "900" },

  lockCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flex: 1,
  },
  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  bulletText: {
    fontSize: 13,
    textAlign: "right",
  },
});