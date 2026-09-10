// app/onboarding.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ImageSourcePropType,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KEY = "hasOnboarded_v1";

const { width } = Dimensions.get("window");

type Slide = {
  image: ImageSourcePropType;
  title: string;
  description: string;
  eyebrow: string;
  eyebrowIcon: keyof typeof Ionicons.glyphMap;
};

export default function Onboarding() {
  const slides = useMemo<Slide[]>(
    () => [
      {
        image: require("../assets/images/onboarding/onboardin01.webp"),
        title: "به ققنوس خوش اومدی",
        description:
          "جدایی پایان تو نیست. اینجا قدم‌به‌قدم از درد و زخم عبور می‌کنی و دوباره متولد میشی.",
        eyebrow: "آغازی دوباره",
        eyebrowIcon: "sparkles-outline",
      },

      {
        image: require("../assets/images/onboarding/onboardin02.webp"),
        title: "یک مسیر مشخص برای عبور",
        description:
          "پلکان درمان هر روز بهت میگه قدم بعدی چیه؛ بدون سردرگمی و بدون رها کردن مسیر خیلی زود حالت خوب میشه.",
        eyebrow: "قدم‌به‌قدم",
        eyebrowIcon: "footsteps-outline",
      },

      {
        image: require("../assets/images/onboarding/onboardin03.webp"),
        title: "وقتی یهویی حالت بد میشه",
        description:
          "پناهگاه برای لحظه‌های سخت ساخته شده که در عرض چند دقیقه درد، اضطراب و آشفتگی تو رو آروم کنه.",
        eyebrow: "پناهگاه امن تو",
        eyebrowIcon: "shield-checkmark-outline",
      },

      {
        image: require("../assets/images/onboarding/onboardin04.webp"),
        title: "تو این مسیر تنها نیستی",
        description:
          "هرجا به کمک نیاز داشتی، می‌تونی با درمانگرت در ارتباط باشی و ازش بدون محدودیت راهنمایی بگیری.",
        eyebrow: "یک پناه متخصص",
        eyebrowIcon: "chatbubbles-outline",
      },

      {
        image: require("../assets/images/onboarding/onboardin05.webp"),
        title: "وقت شروع کردنه",
        description:
          "قرار نیست گذشته پاک بشه؛ قراره ازش عبور کنی، دوباره خودت رو بسازی و زندگی کنی.",
        eyebrow: "زندگی دوباره",
        eyebrowIcon: "sunny-outline",
      },
    ],
    [],
  );

  const [index, setIndex] = useState(0);

  const indexRef = useRef(0);

  const translateX = useRef(new Animated.Value(0)).current;

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(nextIndex, slides.length - 1));

    indexRef.current = clamped;
    setIndex(clamped);

    Animated.spring(translateX, {
      toValue: -clamped * width,
      useNativeDriver: true,
      tension: 72,
      friction: 11,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        return (
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },

      onPanResponderMove: (_, gesture) => {
        const currentIndex = indexRef.current;

        // مقاومت نرم در ابتدا و انتهای اسلایدها
        if (
          (currentIndex === 0 && gesture.dx > 0) ||
          (currentIndex === slides.length - 1 && gesture.dx < 0)
        ) {
          translateX.setValue(
            -currentIndex * width + gesture.dx * 0.25,
          );

          return;
        }

        translateX.setValue(
          -currentIndex * width + gesture.dx,
        );
      },

      onPanResponderRelease: (_, gesture) => {
        const currentIndex = indexRef.current;

        const threshold = width * 0.16;

        const shouldGoNext =
          gesture.dx < -threshold ||
          gesture.vx < -0.55;

        const shouldGoPrevious =
          gesture.dx > threshold ||
          gesture.vx > 0.55;

        if (
          shouldGoNext &&
          currentIndex < slides.length - 1
        ) {
          goTo(currentIndex + 1);
          return;
        }

        if (
          shouldGoPrevious &&
          currentIndex > 0
        ) {
          goTo(currentIndex - 1);
          return;
        }

        goTo(currentIndex);
      },

      onPanResponderTerminate: () => {
        goTo(indexRef.current);
      },
    }),
  ).current;

  async function finish() {
    await AsyncStorage.setItem(KEY, "1");
    router.replace("/");
  }

  function next() {
    if (index >= slides.length - 1) {
      finish();
      return;
    }

    goTo(index + 1);
  }

  const isLast = index === slides.length - 1;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#071018"
      />

      <View style={styles.root}>
        {/* =========================
            اسلایدها
        ========================== */}

        <View
          style={styles.carouselViewport}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.carouselTrack,
              {
                width: width * slides.length,
                transform: [{ translateX }],
              },
            ]}
          >
            {slides.map((item, i) => {
              const position = -i * width;

              const imageScale =
                translateX.interpolate({
                  inputRange: [
                    position - width,
                    position,
                    position + width,
                  ],
                  outputRange: [
                    1.07,
                    1,
                    1.07,
                  ],
                  extrapolate: "clamp",
                });

              const imageOpacity =
                translateX.interpolate({
                  inputRange: [
                    position - width,
                    position,
                    position + width,
                  ],
                  outputRange: [
                    0.5,
                    1,
                    0.5,
                  ],
                  extrapolate: "clamp",
                });

              const contentTranslateY =
                translateX.interpolate({
                  inputRange: [
                    position - width,
                    position,
                    position + width,
                  ],
                  outputRange: [
                    18,
                    0,
                    18,
                  ],
                  extrapolate: "clamp",
                });

              const contentOpacity =
                translateX.interpolate({
                  inputRange: [
                    position - width * 0.72,
                    position,
                    position + width * 0.72,
                  ],
                  outputRange: [
                    0,
                    1,
                    0,
                  ],
                  extrapolate: "clamp",
                });

              return (
                <View
                  key={i}
                  style={[
                    styles.slide,
                    {
                      width,
                    },
                  ]}
                >
                  {/* تصویر اصلی */}
                  <Animated.Image
                    source={item.image}
                    resizeMode="cover"
                    style={[
                      styles.backgroundImage,
                      {
                        opacity: imageOpacity,
                        transform: [
                          {
                            scale: imageScale,
                          },
                        ],
                      },
                    ]}
                  />

                  {/* سایه پایین */}
                  <View
                    pointerEvents="none"
                    style={styles.bottomShade}
                  />

                  {/* متن */}
                  <Animated.View
                    style={[
                      styles.content,
                      {
                        opacity: contentOpacity,

                        transform: [
                          {
                            translateY:
                              contentTranslateY,
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.title}>
                      {item.title}
                    </Text>

                    <Text
                      style={styles.description}
                    >
                      {item.description}
                    </Text>

                    {/* برچسب کوچک */}
                    <View style={styles.eyebrow}>
                      <Ionicons
                        name={item.eyebrowIcon}
                        size={16}
                        color="#E9B949"
                      />

                      <Text
                        style={styles.eyebrowText}
                      >
                        {item.eyebrow}
                      </Text>
                    </View>
                  </Animated.View>
                </View>
              );
            })}
          </Animated.View>
        </View>

        {/* =========================
            رد کردن
        ========================== */}

        {!isLast && (
          <View
            pointerEvents="box-none"
            style={styles.skipArea}
          >
            <Pressable
              onPress={finish}
              hitSlop={12}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.skipText}>
                رد کردن
              </Text>
            </Pressable>
          </View>
        )}

        {/* =========================
            فوتر
        ========================== */}

        <View style={styles.footer}>
          {/* Progress / Pagination */}
          <View style={styles.pagination}>
            {slides.map((_, i) => {
              const active = i === index;

              return (
                <Pressable
                  key={i}
                  hitSlop={10}
                  onPress={() => goTo(i)}
                  style={[
                    styles.dot,
                    active &&
                      styles.dotActive,
                  ]}
                />
              );
            })}
          </View>

          {/* =====================
              صفحات ۱ تا ۴
          ====================== */}

          {!isLast ? (
            <View
              style={styles.navigationRow}
            >
              {/* سمت چپ: قبلی */}
              <View style={styles.navSide}>
                {index > 0 ? (
                  <Pressable
                    onPress={() =>
                      goTo(index - 1)
                    }
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.previousButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={17}
                      color="rgba(232,238,247,.72)"
                    />

                    <Text
                      style={
                        styles.previousText
                      }
                    >
                      قبلی
                    </Text>
                  </Pressable>
                ) : (
                  <View />
                )}
              </View>

              {/* سمت راست: بعدی */}
              <Pressable
                onPress={next}
                style={({ pressed }) => [
                  styles.nextButton,

                  pressed && {
                    transform: [
                      {
                        scale: 0.94,
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name="arrow-forward"
                  size={25}
                  color="#161006"
                />
              </Pressable>
            </View>
          ) : (
            /* =====================
                صفحه آخر
            ====================== */

            <Pressable
              onPress={finish}
              style={({ pressed }) => [
                styles.startButton,

                pressed && {
                  transform: [
                    {
                      scale: 0.98,
                    },
                  ],
                },
              ]}
            >
              {/*
                ساختار سه‌قسمتی باعث می‌شود
                زبان گوشی هیچ‌وقت جای آیکن
                را عوض نکند.
              */}

              <View
                style={styles.startSpacer}
              />

              <Text
                style={styles.startText}
              >
                شروع مسیر من
              </Text>

              <View
                style={styles.startIcon}
              >
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#171006"
                />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   Style
========================================================= */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#071018",
  },

  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#071018",

    /*
     * کل هندسه صفحه را مستقل
     * از زبان سیستم نگه می‌داریم.
     */
    direction: "ltr",
  },

  /* =======================================================
     Carousel
  ======================================================= */

  carouselViewport: {
    ...StyleSheet.absoluteFillObject,

    overflow: "hidden",

    direction: "ltr",
  },

  carouselTrack: {
    flex: 1,

    flexDirection: "row",

    direction: "ltr",
  },

  slide: {
    height: "100%",

    overflow: "hidden",

    backgroundColor: "#071018",

    direction: "ltr",
  },

  backgroundImage: {
    ...StyleSheet.absoluteFillObject,

    width: "100%",
    height: "100%",
  },

  bottomShade: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: "48%",

    backgroundColor:
      "rgba(5,10,15,.12)",
  },

  /* =======================================================
     متن‌ها
  ======================================================= */

  content: {
    position: "absolute",

    left: 24,
    right: 24,

    bottom: 132,

    alignItems: "center",

    direction: "ltr",
  },

  title: {
    color: "#F1C76A",

    fontSize: 23,
    lineHeight: 34,

    fontWeight: "900",

    textAlign: "center",

    /*
     * فقط خود متن فارسی RTL است.
     * جای عنصر تغییر نمی‌کند.
     */
    writingDirection: "rtl",
  },

  description: {
    marginTop: 10,

    maxWidth: 350,

    color:
      "rgba(239,243,248,.84)",

    fontSize: 13.5,
    lineHeight: 23,

    textAlign: "center",

    writingDirection: "rtl",
  },

  /* =======================================================
     Eyebrow
  ======================================================= */

  eyebrow: {
    marginTop: 12,

    flexDirection: "row",

    direction: "ltr",

    alignItems: "center",
    justifyContent: "center",

    gap: 7,

    paddingHorizontal: 12,
    paddingVertical: 7,

    borderRadius: 999,

    backgroundColor:
      "rgba(212,175,55,.055)",

    borderWidth: 1,

    borderColor:
      "rgba(212,175,55,.16)",
  },

  eyebrowText: {
    color: "#DDB44C",

    fontSize: 11.5,

    fontWeight: "800",

    writingDirection: "rtl",

    textAlign: "right",
  },

  /* =======================================================
     Skip
  ======================================================= */

  /*
   * به جای right: 18 روی خود دکمه،
   * یک کانتینر LTR تمام‌عرض داریم.
   * بنابراین فارسی شدن سیستم
   * نمی‌تواند دکمه را به چپ ببرد.
   */

  skipArea: {
    position: "absolute",

    top: 8,

    left: 0,
    right: 0,

    paddingHorizontal: 18,

    flexDirection: "row",

    direction: "ltr",

    justifyContent: "flex-end",
  },

  skipButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,

    borderRadius: 12,

    backgroundColor:
      "rgba(5,10,15,.20)",
  },

  skipText: {
    color:
      "rgba(239,243,248,.78)",

    fontSize: 12.5,

    fontWeight: "800",

    writingDirection: "rtl",
  },

  /* =======================================================
     Footer
  ======================================================= */

  footer: {
    position: "absolute",

    left: 20,
    right: 20,

    bottom: 12,

    gap: 10,

    direction: "ltr",
  },

  /* =======================================================
     Pagination
  ======================================================= */

  pagination: {
    height: 12,

    flexDirection: "row",

    direction: "ltr",

    alignItems: "center",

    justifyContent: "center",

    gap: 7,
  },

  dot: {
    width: 7,
    height: 7,

    borderRadius: 99,

    backgroundColor:
      "rgba(255,255,255,.25)",
  },

  dotActive: {
    width: 18,

    backgroundColor: "#E9B949",

    shadowColor: "#E9B949",

    shadowOpacity: 0.45,

    shadowRadius: 7,

    elevation: 4,
  },

  /* =======================================================
     Navigation
  ======================================================= */

  navigationRow: {
    height: 58,

    /*
     * خیلی مهم:
     * قبلی همیشه سمت چپ
     * بعدی همیشه سمت راست
     */
    flexDirection: "row",

    direction: "ltr",

    alignItems: "center",

    justifyContent: "space-between",
  },

  navSide: {
    minWidth: 84,

    direction: "ltr",
  },

  previousButton: {
    flexDirection: "row",

    direction: "ltr",

    alignItems: "center",

    gap: 6,

    paddingVertical: 10,

    paddingHorizontal: 4,
  },

  previousText: {
    color:
      "rgba(232,238,247,.72)",

    fontSize: 12.5,

    fontWeight: "800",

    writingDirection: "rtl",

    textAlign: "right",
  },

  /* =======================================================
     Next
  ======================================================= */

  nextButton: {
    width: 56,
    height: 56,

    borderRadius: 28,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#EAAF48",

    borderWidth: 1,

    borderColor:
      "rgba(255,220,145,.85)",

    shadowColor: "#E9A83F",

    shadowOpacity: 0.5,

    shadowRadius: 14,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 8,

    direction: "ltr",
  },

  /* =======================================================
     Start
  ======================================================= */

  startButton: {
    height: 58,

    borderRadius: 20,

    /*
     * همیشه:
     * spacer چپ
     * متن وسط
     * فلش راست
     */
    flexDirection: "row",

    direction: "ltr",

    alignItems: "center",

    backgroundColor: "#EAAF48",

    borderWidth: 1,

    borderColor:
      "rgba(255,220,145,.85)",

    shadowColor: "#E9A83F",

    shadowOpacity: 0.45,

    shadowRadius: 15,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 8,

    paddingHorizontal: 8,
  },

  startSpacer: {
    width: 42,
    height: 42,
  },

  startText: {
    flex: 1,

    color: "#171006",

    fontSize: 15,

    fontWeight: "900",

    textAlign: "center",

    writingDirection: "rtl",
  },

  startIcon: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor:
      "rgba(255,255,255,.20)",

    direction: "ltr",
  },

  /* =======================================================
     Press feedback
  ======================================================= */

  pressed: {
    opacity: 0.68,
  },
});