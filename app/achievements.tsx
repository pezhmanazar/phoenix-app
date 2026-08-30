import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getMyAchievements,
  type AchievementItem,
} from "../api/achievements";
import AchievementCard from "../components/achievements/AchievementCard";

const STAGE_CODES = [
  "BASTAN_COMPLETE",
  "GOSASTAN_COMPLETE",
  "SOOKHTAN_COMPLETE",
  "SERESHTAN_COMPLETE",
  "ZIESTAN_COMPLETE",
  "SAKHTAN_COMPLETE",
  "RASTAN_COMPLETE",
];

const NO_CONTACT_CODES = [
  "NO_CONTACT_10",
  "NO_CONTACT_21",
  "NO_CONTACT_40",
];

const SPECIAL_CODES = [
  "PHOENIX_RESISTANCE",
  "STEEL_CONTINUITY",
];

function toPersianDigits(
  value: string | number,
) {
  return String(value).replace(
    /\d/g,
    (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)],
  );
}

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={17}
            color="#D4AF37"
          />
        </View>

        <View style={styles.sectionTexts}>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<
    AchievementItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const [summary, setSummary] = useState({
    total: 0,
    unlocked: 0,
    locked: 0,
  });

  const loadAchievements = useCallback(
    async ({
      silent = false,
    }: {
      silent?: boolean;
    } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const result =
          await getMyAchievements();

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setItems(
          Array.isArray(
            result.data.achievements,
          )
            ? result.data.achievements
            : [],
        );

        setSummary({
          total: Number(
            result.data.summary?.total ?? 0,
          ),
          unlocked: Number(
            result.data.summary?.unlocked ??
              0,
          ),
          locked: Number(
            result.data.summary?.locked ?? 0,
          ),
        });
      } catch {
        setError("NETWORK_ERROR");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadAchievements();
    }, [loadAchievements]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);

    void loadAchievements({
      silent: true,
    });
  }, [loadAchievements]);

  const stageAchievements = useMemo(
    () =>
      STAGE_CODES.map((code) =>
        items.find(
          (item) => item.code === code,
        ),
      ).filter(
        (
          item,
        ): item is AchievementItem =>
          Boolean(item),
      ),
    [items],
  );

  const noContactAchievements =
    useMemo(
      () =>
        NO_CONTACT_CODES.map((code) =>
          items.find(
            (item) => item.code === code,
          ),
        ).filter(
          (
            item,
          ): item is AchievementItem =>
            Boolean(item),
        ),
      [items],
    );

  const specialAchievements = useMemo(
    () =>
      SPECIAL_CODES.map((code) =>
        items.find(
          (item) => item.code === code,
        ),
      ).filter(
        (
          item,
        ): item is AchievementItem =>
          Boolean(item),
      ),
    [items],
  );

  const goldenPhoenix = useMemo(
    () =>
      items.find(
        (item) =>
          item.code === "GOLDEN_PHOENIX",
      ) || null,
    [items],
  );

  const progressPercent =
    summary.total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (summary.unlocked /
              summary.total) *
              100,
          ),
        )
      : 0;

  return (
    <View style={styles.root}>
      <StatusBar
        style="light"
        backgroundColor="#0b0f14"
      />

      <View
        pointerEvents="none"
        style={styles.glowTop}
      />

      <View
        pointerEvents="none"
        style={styles.glowBottom}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop:
            Math.max(insets.top, 12) + 8,
          paddingHorizontal: 16,
          paddingBottom:
            30 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4AF37"
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color="#F9FAFB"
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              تالار افتخارات
            </Text>

            <Text style={styles.subtitle}>
              ردپای پیشرفت تو در مسیر ققنوس
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator
              size="small"
              color="#D4AF37"
            />

            <Text style={styles.loadingText}>
              در حال آماده‌کردن تالار
              افتخارات…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={26}
              color="#FCA5A5"
            />

            <Text style={styles.errorTitle}>
              دریافت دستاوردها ممکن نشد
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                void loadAchievements()
              }
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                تلاش دوباره
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <View
                pointerEvents="none"
                style={styles.summaryGlow}
              />

              <View
                style={styles.summaryTop}
              >
                <View
                  style={
                    styles.summaryTitleRow
                  }
                >
                  <View
                    style={
                      styles.summaryIcon
                    }
                  >
                    <Ionicons
                      name="trophy"
                      size={22}
                      color="#D4AF37"
                    />
                  </View>

                  <View>
                    <Text
                      style={
                        styles.summaryTitle
                      }
                    >
                      دستاوردهای تو
                    </Text>

                    <Text
                      style={
                        styles.summaryCaption
                      }
                    >
                      هر نشان، بخشی از مسیری
                      است که طی کرده‌ای
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.countBadge}
                >
                  <Text
                    style={styles.countText}
                  >
                    {toPersianDigits(
                      summary.unlocked,
                    )}
                    {" / "}
                    {toPersianDigits(
                      summary.total,
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.progressTrack
                }
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.summaryBottom}>
                <Text
                  style={
                    styles.summaryBottomText
                  }
                >
                  {toPersianDigits(
                    Math.round(
                      progressPercent,
                    ),
                  )}
                  ٪ مسیر افتخارات
                </Text>

                <Text
                  style={
                    styles.summaryBottomText
                  }
                >
                  {toPersianDigits(
                    summary.locked,
                  )}{" "}
                  دستاورد باقی مانده
                </Text>
              </View>
            </View>

            {/* Pelekan stages */}
            <View style={styles.section}>
              <SectionTitle
                title="مسیر ققنوس"
                subtitle="مدال‌های پایان مراحل پلکان"
                icon="medal-outline"
              />

              <View style={styles.grid}>
                {stageAchievements.map(
                  (item) => (
                    <AchievementCard
                      key={item.code}
                      item={item}
                    />
                  ),
                )}
              </View>
            </View>

            {/* No Contact */}
            <View style={styles.section}>
              <SectionTitle
                title="قاعده عدم تماس"
                subtitle="نشان‌های مقاومت در حفظ مرز عاطفی"
                icon="shield-checkmark-outline"
              />

              <View style={styles.grid}>
                {noContactAchievements.map(
                  (item) => (
                    <AchievementCard
                      key={item.code}
                      item={item}
                    />
                  ),
                )}
              </View>
            </View>

            {/* Special */}
            <View style={styles.section}>
              <SectionTitle
                title="نشان‌های ویژه"
                subtitle="افتخاراتی فراتر از پایان یک مرحله"
                icon="diamond-outline"
              />

              <View style={styles.grid}>
                {specialAchievements.map(
                  (item) => (
                    <AchievementCard
                      key={item.code}
                      item={item}
                    />
                  ),
                )}
              </View>
            </View>

            {/* Golden Phoenix */}
            {goldenPhoenix ? (
              <View style={styles.section}>
                <SectionTitle
                  title="بالاترین افتخار"
                  subtitle="نشان پایان مسیر کامل ققنوس"
                  icon="flame-outline"
                />

                <AchievementCard
                  item={goldenPhoenix}
                  featured
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  glowTop: {
    position: "absolute",
    top: -240,
    left: -200,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor:
      "rgba(212,175,55,.12)",
  },

  glowBottom: {
    position: "absolute",
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor:
      "rgba(233,138,21,.07)",
  },

  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerText: {
    flex: 1,
    alignItems: "center",
  },

  title: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 3,
    color: "#8F96A3",
    fontSize: 11,
    fontWeight: "700",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.10)",
    backgroundColor:
      "rgba(255,255,255,.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 40,
  },

  loadingWrap: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  loadingText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
  },

  errorCard: {
    minHeight: 230,
    borderRadius: 22,
    borderWidth: 1,
    borderColor:
      "rgba(248,113,113,.18)",
    backgroundColor:
      "rgba(127,29,29,.10)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  errorTitle: {
    marginTop: 10,
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
  },

  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor:
      "rgba(212,175,55,.14)",
    borderWidth: 1,
    borderColor:
      "rgba(212,175,55,.28)",
  },

  retryText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "900",
  },

  summaryCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor:
      "rgba(212,175,55,.22)",
    backgroundColor:
      "rgba(212,175,55,.065)",
  },

  summaryGlow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 999,
    right: -90,
    top: -130,
    backgroundColor:
      "rgba(212,175,55,.12)",
  },

  summaryTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  summaryTitleRow: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },

  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      "rgba(212,175,55,.24)",
    backgroundColor:
      "rgba(212,175,55,.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },

  summaryCaption: {
    marginTop: 3,
    color: "#8F96A3",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "right",
  },

  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor:
      "rgba(212,175,55,.24)",
    backgroundColor:
      "rgba(212,175,55,.10)",
  },

  countText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "900",
  },

  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor:
      "rgba(255,255,255,.07)",
    overflow: "hidden",
    marginTop: 16,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#D4AF37",
  },

  summaryBottom: {
    marginTop: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryBottomText: {
    color: "#8F96A3",
    fontSize: 9,
    fontWeight: "700",
  },

  section: {
    marginTop: 25,
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor:
      "rgba(212,175,55,.18)",
    backgroundColor:
      "rgba(212,175,55,.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTexts: {
    flex: 1,
    alignItems: "flex-end",
  },

  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },

  sectionSubtitle: {
    marginTop: 2,
    color: "#777E89",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "right",
  },

  grid: {
  flexDirection: "row-reverse",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 10,
},
});