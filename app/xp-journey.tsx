import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { XP_JOURNEY_IMAGES } from "../lib/xpJourneyImages";

import {
  formatXp,
  getXpJourneyState,
  toPersianDigits,
  XP_JOURNEY_LEVELS,
} from "../lib/xpJourney";

import {
  setLastSeenXpLevel,
  setXpJourneyIntroduced,
} from "../lib/xpJourneyState";

const API_BASE = "https://api.qoqnoos.app";

export default function XpJourneyScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [arrowAnim]);

  const [xpTotal, setXpTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  const journey = useMemo(() => getXpJourneyState(xpTotal), [xpTotal]);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    setError(false);

    try {
      const sessionToken = await AsyncStorage.getItem("session_v1");

      const res = await fetch(`${API_BASE}/api/pelekan/stats`, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          ...(sessionToken
            ? {
                Authorization: `Bearer ${sessionToken}`,
                "x-session-token": sessionToken,
              }
            : {}),
        },
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error("XP_LOAD_FAILED");
      }

      const nextXpTotal = Number(json?.data?.xpTotal ?? 0);

      setXpTotal(nextXpTotal);

      if (nextXpTotal > 0) {
        const nextJourney = getXpJourneyState(nextXpTotal);

        await Promise.all([
          setXpJourneyIntroduced(true),
          setLastSeenXpLevel(nextJourney.current.level),
        ]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />

        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.infoButton}
          onPress={() => setInfoVisible(true)}
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#A9ADB5"
          />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>سفر ققنوس من</Text>

          <Text style={styles.headerSubtitle}>مسیر تکامل با XP</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={styles.backButton}
        >
          <Ionicons name="chevron-forward" size={23} color="#F4F4F5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({
            animated: false,
          });
        }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4AF37"
          />
        }
      >
        {error ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void load()}
            style={styles.errorCard}
          >
            <Text style={styles.errorText}>
              دریافت XP انجام نشد؛ برای تلاش دوباره بزن.
            </Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.timeline}>
          {[...XP_JOURNEY_LEVELS].reverse().map((level, reverseIndex) => {
            const originalIndex = XP_JOURNEY_LEVELS.length - 1 - reverseIndex;

            const passed = originalIndex < journey.currentIndex;

            const current = originalIndex === journey.currentIndex;

            const future = originalIndex > journey.currentIndex;

            return (
              <View key={level.level} style={styles.timelineRow}>
                <View style={styles.timelineTextSide}>
                  <Text
                    style={[
                      styles.nodeTitle,
                      current && styles.nodeTitleCurrent,
                      future && styles.nodeTitleFuture,
                    ]}
                  >
                    {level.titleFa}
                  </Text>

                  <Text
                    style={[styles.nodeXp, future && styles.nodeTextFuture]}
                  >
                    {formatXp(level.minXp)} امتیاز
                  </Text>

                  {current ? (
                    <View style={styles.youAreHere}>
                      <Ionicons name="location" size={12} color="#111318" />

                      <Text style={styles.youAreHereText}>تو اینجایی</Text>
                    </View>
                  ) : passed ? (
                    <View style={styles.passedRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#34D399"
                      />

                      <Text style={styles.passedText}>طی‌شده</Text>
                    </View>
                  ) : (
                    <Text style={styles.futureStatus}>مسیر پیش رو</Text>
                  )}
                </View>

                <View style={styles.axisSide}>
                  {reverseIndex > 0 ? (
                    <View
                      style={[styles.lineTop, future && styles.lineFuture]}
                    />
                  ) : null}

                  <View
                    style={[
                      styles.node,
                      current && styles.nodeCurrent,
                      future && styles.nodeFuture,
                    ]}
                  >
                    <View style={styles.nodeImageClip}>
                      <Image
                        source={
                          XP_JOURNEY_IMAGES[
                            level.level as keyof typeof XP_JOURNEY_IMAGES
                          ]
                        }
                        style={[
                          styles.nodeImage,
                          future && styles.nodeImageFuture,
                        ]}
                        resizeMode="contain"
                      />
                    </View>
                  </View>

                  {reverseIndex < XP_JOURNEY_LEVELS.length - 1 ? (
                    <View
                      style={[
                        styles.lineBottom,
                        originalIndex > journey.currentIndex &&
                          styles.lineFuture,
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.scrollHint,
            {
              transform: [
                {
                  translateY: arrowAnim,
                },
              ],
            },
          ]}
        >
          {[1, 2, 3].map((item) => (
            <Ionicons
              key={item}
              name="chevron-up"
              size={40}
              color="#D4AF37"
              style={{ marginTop: -14 }}
            />
          ))}
        </Animated.View>

        <View style={styles.timelineIntro}>
          <Text style={styles.timelineTitle}>مسیر دوباره برخاستن</Text>

          <Text style={styles.timelineSubtitle}>
            هر امتیاز بخشی از ققنوس تو رو دوباره زنده می‌کنه.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.levelVisual}>
            <View style={styles.levelVisualInner}>
              <Image
                source={
                  XP_JOURNEY_IMAGES[
                    journey.current.level as keyof typeof XP_JOURNEY_IMAGES
                  ]
                }
                style={styles.levelImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.levelNumberBadge}>
              <Text style={styles.levelNumberText}>
                {toPersianDigits(journey.current.level)}
              </Text>
            </View>
          </View>

          <Text style={styles.currentEyebrow}>سطح فعلی ققنوس</Text>

          <Text style={styles.currentTitle}>{journey.current.titleFa}</Text>

          <Text style={styles.currentDescription}>
            {journey.current.shortFa}
          </Text>

          <View style={styles.xpTotalRow}>
            <Ionicons name="flash" size={18} color="#D4AF37" />

            <Text style={styles.xpTotalText}>
              {formatXp(journey.xp)} امتیاز
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${journey.progress * 100}%`,
                },
              ]}
            />
          </View>

          {journey.next ? (
            <Text style={styles.nextText}>
              تا مرحله «{journey.next.titleFa}»، {formatXp(journey.xpToNext)}{" "}
              امتیاز لازم داری
            </Text>
          ) : (
            <Text style={styles.maxLevelText}>
              به بالاترین سطح سفر ققنوس رسیده‌ای
            </Text>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.infoBackdrop}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalIcon}>
              <Ionicons
                name="information-circle-outline"
                size={28}
                color="#D4AF37"
              />
            </View>

            <Text style={styles.infoModalTitle}>سفر ققنوس چیه؟</Text>

            <Text style={styles.infoModalText}>
               با انجام فعالیت‌های درمانی و ادامه دادن مسیر ققنوس امتیاز به دست
              میاری. هدف فقط جمع کردن امتیاز نیست؛ این عدد ردّ کارهاییه که
              برای دوباره ساختن خودت انجام دادی.
            </Text>

            <Text style={styles.infoModalText}>
              با افزایش امتیاز، ققنوس تو مرحله‌به‌مرحله از خاکستر دوباره زنده
             می‌شه و شکل تازه‌ای پیدا می‌کنه.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.infoCloseButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.infoCloseButtonText}>متوجه شدم</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.07)",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.045)",
  },

  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "900",
  },

  headerSubtitle: {
    marginTop: 2,
    color: "#777D87",
    fontSize: 9,
    fontWeight: "700",
  },

  headerSpacer: {
    width: 42,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 80,
  },

  errorCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.24)",
    backgroundColor: "rgba(245,158,11,.07)",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },

  errorText: {
    flex: 1,
    color: "#D8DCE2",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "right",
  },

  timelineIntro: {
    marginTop: 10,
    marginBottom: 22,
    alignItems: "center",
  },
  timelineTitle: {
    color: "#F4F4F5",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  timelineSubtitle: {
    marginTop: 4,
    color: "#777D87",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
  },

  timeline: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.06)",
    backgroundColor: "rgba(255,255,255,.018)",
    paddingTop: 4,
    paddingBottom: 12,
  },

  timelineRow: {
    minHeight: 112,
    paddingHorizontal: 18,
    flexDirection: "row",
  },

  timelineTextSide: {
    flex: 1,
    paddingRight: 18,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  axisSide: {
    width: 82,
    alignItems: "center",
  },

  lineTop: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(212,175,55,.42)",
  },

  lineBottom: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(212,175,55,.42)",
  },

  lineFuture: {
    backgroundColor: "rgba(255,255,255,.08)",
  },

  node: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },

  nodeCurrent: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "rgba(212,175,55,.16)",
    borderColor: "#F4D675",
    borderWidth: 2,
  },

  nodePassed: {
    backgroundColor: "rgba(212,175,55,.08)",
    borderColor: "rgba(212,175,55,.3)",
  },

  nodeImageClip: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeFuture: {
    backgroundColor: "#20242A",
    borderColor: "rgba(255,255,255,.07)",
  },

  nodeTitle: {
    color: "#D8DCE2",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },

  nodeTitleCurrent: {
    color: "#F5C453",
    fontSize: 15,
  },

  nodeTitleFuture: {
    color: "#676D76",
  },

  nodeXp: {
    marginTop: 4,
    color: "#9298A1",
    fontSize: 9,
    fontWeight: "800",
  },

  nodeTextFuture: {
    color: "#555B64",
  },

  youAreHere: {
    marginTop: 7,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#D4AF37",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },

  youAreHereText: {
    color: "#111318",
    fontSize: 8,
    fontWeight: "900",
  },

  passedRow: {
    marginTop: 6,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },

  passedText: {
    color: "#34D399",
    fontSize: 8,
    fontWeight: "800",
  },

  futureStatus: {
    marginTop: 6,
    color: "#555B64",
    fontSize: 8,
    fontWeight: "700",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.28)",
    backgroundColor: "#11161D",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 30,
  },

  heroGlow: {
    position: "absolute",
    top: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(245,185,66,.08)",
  },

  levelVisual: {
    position: "relative",
    marginBottom: 14,
  },

  levelVisualInner: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: "rgba(245,185,66,.34)",
    backgroundColor: "rgba(212,175,55,.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  levelImage: {
    width: 205,
    height: 205,
  },

  scrollHint: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    marginBottom: -20,
  },

  levelNumberBadge: {
    position: "absolute",
    right: -1,
    bottom: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#D4AF37",
    borderWidth: 2,
    borderColor: "#11161D",
    alignItems: "center",
    justifyContent: "center",
  },

  levelNumberText: {
    color: "#111318",
    fontSize: 11,
    fontWeight: "900",
  },

  currentEyebrow: {
    color: "#8F959F",
    fontSize: 10,
    fontWeight: "800",
  },

  currentTitle: {
    marginTop: 4,
    color: "#F5C453",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  currentDescription: {
    marginTop: 7,
    maxWidth: 290,
    color: "#BEC3CB",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
  },

  xpTotalRow: {
    marginTop: 15,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },

  xpTotalText: {
    color: "#F4F4F5",
    fontSize: 16,
    fontWeight: "900",
  },

  progressTrack: {
    marginTop: 17,
    width: "100%",
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,.07)",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#D4AF37",
  },

  nextText: {
    width: "100%",
    marginTop: 10,
    color: "#AEB4BD",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },

  maxLevelText: {
    marginTop: 12,
    color: "#F5C453",
    fontSize: 10,
    fontWeight: "900",
  },

  noteCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.06)",
    backgroundColor: "rgba(255,255,255,.025)",
    padding: 15,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 9,
  },

  noteText: {
    flex: 1,
    color: "#858B95",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "right",
  },
  infoButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.045)",
  },
  infoBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,.72)",
  },

  infoModalCard: {
    width: "100%",
    maxWidth: 390,
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.24)",
    backgroundColor: "#11161D",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },

  infoModalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,.08)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.22)",
    marginBottom: 12,
  },

  infoModalTitle: {
    color: "#F6C453",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  infoModalText: {
    marginTop: 10,
    color: "#C4C8CF",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },

  infoCloseButton: {
    width: "100%",
    minHeight: 46,
    marginTop: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D4AF37",
  },

  infoCloseButtonText: {
    color: "#111318",
    fontSize: 12,
    fontWeight: "900",
  },
  nodeImage: {
    width: 60,
    height: 60,
  },

  nodeImageCurrent: {
    width: 75,
    height: 75,
  },

  nodeImageFuture: {
    opacity: 0.4,
  },
  nodeImageWrap: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
});
