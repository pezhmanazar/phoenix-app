import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Screen from "../../components/Screen";
import AppBannerModal from "../../components/ui/AppBannerModal";
import { useMoodHistory } from "../../hooks/useMoodHistory";

const MAX_SCORE = 20;
const CHART_HEIGHT = 185;
const FULLSCREEN_CHART_HEIGHT = 320;
const CHART_WIDTH_PER_ITEM = 22;
const CHART_PADDING_X = 18;
const POINT_SIZE = 9;

const SCORE_UP_COLOR = "#22C55E";
const SCORE_DOWN_COLOR = "#EF4444";
const SCORE_SAME_COLOR = "#D4AF37";
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function getDayDiff(fromDate: string, toDate: string) {
  const from = startOfLocalDay(fromDate);
  const to = startOfLocalDay(toDate);

  if (from === null || to === null) {
    return 1;
  }

  return Math.round((to - from) / DAY_MS);
}

function getSegmentColor(fromScore: number, toScore: number) {
  if (toScore > fromScore) return SCORE_UP_COLOR;
  if (toScore < fromScore) return SCORE_DOWN_COLOR;
  return SCORE_SAME_COLOR;
}

function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatDateLabel(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "تاریخ نامعتبر";
  }

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();

    return `${toPersianDigits(yyyy)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`;
  }
}

function formatChartDateLabel(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "نامعتبر";
  }

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const mm = date.getMonth() + 1;
    const dd = date.getDate();

    return `${toPersianDigits(dd)}/${toPersianDigits(mm)}`;
  }
}

function getSafeScore(score: number) {
  return Math.max(0, Math.min(MAX_SCORE, Number(score) || 0));
}

type ChartPoint = {
  dayCode: string;
  date: string;
  score: number;
  safeScore: number;
  x: number;
  y: number;
};

type ChartSegment = {
  key: string;
  x: number;
  y: number;
  length: number;
  angle: number;
  color: string;
  isDotted: boolean;
};

type ChartCanvasProps = {
  chartWidth: number;
  chartHeight: number;
  chartPoints: ChartPoint[];
  chartSegments: ChartSegment[];
};

function ChartCanvas({
  chartWidth,
  chartHeight,
  chartPoints,
  chartSegments,
}: ChartCanvasProps) {
  return (
    <View
      style={[styles.chartArea, { width: chartWidth, height: chartHeight }]}
    >
      <View style={styles.gridLineTop} />
      <View
        style={[styles.gridLineMiddle, { top: 18 + (chartHeight - 75) / 2 }]}
      />
      <View style={[styles.gridLineBottom, { top: 18 + (chartHeight - 75) }]} />

      {chartSegments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.lineSegment,
            segment.isDotted
              ? styles.dottedLineSegment
              : styles.solidLineSegment,
            {
              left: segment.x,
              top: segment.y,
              width: segment.length,
              borderTopColor: segment.color,
              backgroundColor: segment.isDotted ? "transparent" : segment.color,
              transform: [{ rotateZ: `${segment.angle}deg` }],
            },
          ]}
        />
      ))}

      {chartPoints.map((point) => (
        <View
          key={`${point.dayCode}-${point.date}`}
          style={[
            styles.pointWrap,
            {
              left: point.x - 24,
              top: point.y - 34,
            },
          ]}
        >
          <Text style={styles.pointScore}>
            {toPersianDigits(point.safeScore)}
          </Text>

          <View style={styles.pointDot} />

          <Text style={styles.pointDate}>
            {formatChartDateLabel(point.date)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function MoodChartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entries, isLoading, loadMoodHistory } = useMoodHistory();

  const [warningVisible, setWarningVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadMoodHistory();
    }, [loadMoodHistory]),
  );

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [entries]);

  const chartWidth = Math.max(
    280,
    CHART_PADDING_X * 2 +
      Math.max(sortedEntries.length - 1, 1) * CHART_WIDTH_PER_ITEM,
  );

  const chartPoints = useMemo(() => {
    return sortedEntries.map((item, index) => {
      const safeScore = getSafeScore(item.score);
      const x = CHART_PADDING_X + index * CHART_WIDTH_PER_ITEM;
      const y = 18 + (1 - safeScore / MAX_SCORE) * CHART_HEIGHT;

      return {
        ...item,
        safeScore,
        x,
        y,
      };
    });
  }, [sortedEntries]);

  const fullscreenChartPoints = useMemo(() => {
    return sortedEntries.map((item, index) => {
      const safeScore = getSafeScore(item.score);
      const x = CHART_PADDING_X + index * CHART_WIDTH_PER_ITEM;
      const y = 18 + (1 - safeScore / MAX_SCORE) * FULLSCREEN_CHART_HEIGHT;

      return {
        ...item,
        safeScore,
        x,
        y,
      };
    });
  }, [sortedEntries]);

  const chartSegments = useMemo(() => {
    return chartPoints.slice(0, -1).map((point, index) => {
      const nextPoint = chartPoints[index + 1];
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const dayDiff = getDayDiff(point.date, nextPoint.date);

      return {
        key: `${point.dayCode}-${nextPoint.dayCode}-${index}`,
        x: point.x,
        y: point.y,
        length,
        angle,
        color: getSegmentColor(point.safeScore, nextPoint.safeScore),
        isDotted: dayDiff > 1,
      };
    });
  }, [chartPoints]);

  const fullscreenChartSegments = useMemo(() => {
    return fullscreenChartPoints.slice(0, -1).map((point, index) => {
      const nextPoint = fullscreenChartPoints[index + 1];
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const dayDiff = getDayDiff(point.date, nextPoint.date);

      return {
        key: `fullscreen-${point.dayCode}-${nextPoint.dayCode}-${index}`,
        x: point.x,
        y: point.y,
        length,
        angle,
        color: getSegmentColor(point.safeScore, nextPoint.safeScore),
        isDotted: dayDiff > 1,
      };
    });
  }, [fullscreenChartPoints]);

  return (
    <View style={styles.container}>
      <Screen
        backgroundColor="#0b0f14"
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-forward" size={20} color="#E5E7EB" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>نمودار پیشرفت</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setWarningVisible(true)}
            style={styles.warningHeaderButton}
          >
            <Ionicons name="warning-outline" size={20} color="#FBBF24" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>روند نمره‌های روزانه</Text>
          </View>

          <Text style={styles.cardSubtitle}>
            نمره‌ای که در مرور روز به کل روزت از ۱ تا ۲۰ دادی
          </Text>

          {isLoading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>در حال بارگذاری...</Text>
            </View>
          ) : sortedEntries.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                هنوز نمره‌ای برای نمایش ثبت نشده.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.chartFrame}>
                <View style={styles.yAxisLabels}>
                  <Text style={styles.axisLabel}>{toPersianDigits(20)}</Text>
                  <Text style={styles.axisLabel}>{toPersianDigits(10)}</Text>
                  <Text style={styles.axisLabel}>{toPersianDigits(1)}</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContent}
                >
                  <ChartCanvas
                    chartWidth={chartWidth}
                    chartHeight={260}
                    chartPoints={chartPoints}
                    chartSegments={chartSegments}
                  />
                </ScrollView>
              </View>

              <View style={styles.chartActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setLegendVisible(true)}
                  style={styles.infoButton}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="rgba(231,238,247,.68)"
                  />
                  <Text style={styles.infoButtonText}>راهنمای نمودار</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsFullscreenOpen(true)}
                  style={styles.expandButton}
                >
                  <Ionicons name="expand-outline" size={18} color="#E5E7EB" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {sortedEntries.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.listTitle}>جزئیات ثبت‌ها</Text>

            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {[...sortedEntries].reverse().map((item) => (
                <View
                  key={`${item.dayCode}-${item.date}`}
                  style={styles.listRow}
                >
                  <View style={styles.listScoreBadge}>
                    <Text style={styles.listScoreText}>
                      {toPersianDigits(item.score)}
                    </Text>
                  </View>

                  <View style={styles.listTextWrap}>
                    <Text style={styles.listDate}>
                      {formatDateLabel(item.date)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Screen>

      <Modal
        visible={isFullscreenOpen}
        animationType="slide"
        onRequestClose={() => setIsFullscreenOpen(false)}
        statusBarTranslucent
      >
        <SafeAreaView
          style={styles.fullscreenContainer}
          edges={["top", "bottom"]}
        >
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsFullscreenOpen(false)}
              style={styles.backButton}
            >
              <Ionicons name="close" size={20} color="#E5E7EB" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>نمودار پیشرفت</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.fullscreenChartFrame}>
            <View style={styles.fullscreenYAxisLabels}>
              <Text style={styles.axisLabel}>{toPersianDigits(20)}</Text>
              <Text style={styles.axisLabel}>{toPersianDigits(10)}</Text>
              <Text style={styles.axisLabel}>{toPersianDigits(1)}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              <ChartCanvas
                chartWidth={chartWidth}
                chartHeight={395}
                chartPoints={fullscreenChartPoints}
                chartSegments={fullscreenChartSegments}
              />
            </ScrollView>
          </View>

          <View style={styles.chartActionsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setLegendVisible(true)}
              style={styles.infoButton}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="rgba(231,238,247,.68)"
              />
              <Text style={styles.infoButtonText}>راهنمای نمودار</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={legendVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setLegendVisible(false)}
      >
        <View style={styles.legendModalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.legendBackdrop}
            onPress={() => setLegendVisible(false)}
          />

          <SafeAreaView
            style={[
              styles.legendSheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 24 },
            ]}
            edges={["bottom"]}
          >
            <View style={styles.legendHandle} />
            <View style={styles.legendSheetHeader}>
              <Text style={styles.legendSheetTitle}>راهنمای نمودار</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setLegendVisible(false)}
                style={styles.legendCloseButton}
              >
                <Ionicons name="close" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>

            <View style={styles.legendWrap}>
              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendLine,
                    { backgroundColor: SCORE_UP_COLOR },
                  ]}
                />
                <Text style={styles.legendText}>بهتر از ثبت قبلی</Text>
              </View>

              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendLine,
                    { backgroundColor: SCORE_DOWN_COLOR },
                  ]}
                />
                <Text style={styles.legendText}>کمتر از ثبت قبلی</Text>
              </View>

              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendLine,
                    { backgroundColor: SCORE_SAME_COLOR },
                  ]}
                />
                <Text style={styles.legendText}>بدون تغییر</Text>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendDottedWrap}>
                  <View style={styles.legendDottedLine} />
                </View>
                <Text style={styles.legendText}>وجود توقف در روزها</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <AppBannerModal
        visible={warningVisible}
        kind="warning"
        title="ذخیره‌سازی محلی نمودار"
        message="این نمودار فعلاً فقط روی همین دستگاه ذخیره می‌شه. اگه با یه دستگاه دیگه وارد بشی، برنامه رو حذف کنی، یا حافظه برنامه پاک بشه، اطلاعات نمودار منتقل نمی‌شه."
        closeText="متوجه شدم"
        onClose={() => setWarningVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 120,
    rowGap: 12,
    direction: "ltr",
  },

  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  warningHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251,191,36,.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,.22)",
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  cardTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  expandButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  cardTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    marginTop: 2,
    color: "rgba(231,238,247,.72)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(231,238,247,.75)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  chartScrollContent: {
    paddingTop: 12,
    paddingLeft: 4,
  },

  chartArea: {
    marginTop: 8,
    position: "relative",
  },
  gridLineTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
  },
  gridLineMiddle: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,.06)",
  },
  gridLineBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,.08)",
  },

  lineSegment: {
    position: "absolute",
    transformOrigin: "left center",
  },
  solidLineSegment: {
    height: 3,
    borderRadius: 999,
  },
  dottedLineSegment: {
    height: 0,
    borderTopWidth: 3,
    borderStyle: "dotted",
  },
  pointWrap: {
    position: "absolute",
    width: 48,
    alignItems: "center",
  },
  pointScore: {
    color: "#F9FAFB",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },
  pointDot: {
    width: POINT_SIZE,
    height: POINT_SIZE,
    borderRadius: POINT_SIZE / 2,
    backgroundColor: "#D4AF37",
    borderWidth: 3,
    borderColor: "#0b0f14",
  },
  pointDate: {
    marginTop: 8,
    color: "rgba(231,238,247,.70)",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 14,
  },
  legendWrap: {
    marginTop: 14,
    rowGap: 10,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  legendRow: {
    width: "50%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },

  legendLine: {
    width: 26,
    height: 3,
    borderRadius: 999,
  },
  legendDottedWrap: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  legendDottedLine: {
    width: 26,
    borderTopWidth: 3,
    borderStyle: "dotted",
    borderTopColor: SCORE_SAME_COLOR,
  },
  legendText: {
    color: "rgba(231,238,247,.78)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },

  listCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    minHeight: 180,
  },
  listTitle: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 12,
  },
  listContent: {
    rowGap: 10,
    paddingBottom: 96,
  },

  listRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.06)",
  },
  listScoreBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(212,175,55,.16)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  listScoreText: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
  },
  listTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  listDate: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#0b0f14",
    paddingHorizontal: 12,
  },

  fullscreenHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartFrame: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginTop: 4,
  },

  yAxisLabels: {
    width: 24,
    height: 203,
    marginTop: 26,
    alignItems: "center",
    justifyContent: "space-between",
  },

  axisLabel: {
    color: "rgba(231,238,247,.55)",
    fontSize: 10,
    fontWeight: "800",
  },

  fullscreenChartFrame: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginTop: 4,
  },

  fullscreenYAxisLabels: {
    width: 24,
    height: 338,
    marginTop: 26,
    alignItems: "center",
    justifyContent: "space-between",
  },

  chartActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },

  infoButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },

  infoButtonText: {
    color: "rgba(231,238,247,.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  legendModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  legendBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  legendSheet: {
    backgroundColor: "#161b22",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },

  legendHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  legendSheetHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  legendSheetTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
  },
  legendCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});
