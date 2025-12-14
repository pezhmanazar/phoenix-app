// phoenix-app/components/JalaliSelect.tsx
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  toJalaali,
  toGregorian,
  isValidJalaaliDate,
  jalaaliMonthLength,
} from "jalaali-js";

type Props = {
  initial?: string; // yyyy-mm-dd (میلادی)
  onChange: (isoDate: string) => void;
  minYear?: number; // پیش‌فرض 1330
  maxYear?: number; // پیش‌فرض 1390
  styleContainer?: any;
  stylePicker?: any;
  textColor?: string;
  accentColor?: string;
  dark?: boolean;
  grid?: boolean; // فقط برای سازگاری
};

const pad = (n: number) => String(n).padStart(2, "0");
const faDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

const monthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// ✅ Wrapper های امن برای TS (حل خطای "Expected 1 arguments, but got 3")
function toJalaliSafe(gy: number, gm: number, gd: number) {
  return (toJalaali as any)(gy, gm, gd) as { jy: number; jm: number; jd: number };
}
function toGregorianSafe(jy: number, jm: number, jd: number) {
  return (toGregorian as any)(jy, jm, jd) as { gy: number; gm: number; gd: number };
}

export default function JalaliSelect({
  initial,
  onChange,
  minYear = 1330,
  maxYear = 1390,
  styleContainer,
  stylePicker,
  textColor = "#0F172A",
  accentColor = "#0EA5A4",
  dark = false,
}: Props) {
  const insets = useSafeAreaInsets();

  // تم هماهنگ‌تر (اگر دارک بود)
  const C = {
    sheetBg: dark ? "#0b0f14" : "#FFFFFF",
    sheetBg2: dark ? "rgba(255,255,255,.03)" : "#FFFFFF",
    line: dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)",
    chipBg: dark ? "rgba(255,255,255,.04)" : "#F8FAFC",
    chipBorder: dark ? "rgba(255,255,255,.10)" : "#E5E7EB",
    text: dark ? "#e8eef7" : textColor,
    muted: dark ? "rgba(231,238,247,.72)" : "rgba(15,23,42,.70)",
    itemBg: dark ? "rgba(255,255,255,.04)" : "#F3F4F6",
  };

  // اگر initial داده شد (میلادی)، به جلالی تبدیل کن
  const initJ = useMemo(() => {
    if (!initial) return null;

    // اگر ISO کامل بود، فقط تاریخ
    const dateOnly = initial.includes("T") ? initial.split("T")[0] : initial;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (!m) return null;

    const gy = +m[1];
    const gm = +m[2];
    const gd = +m[3];

    const j = toJalaliSafe(gy, gm, gd);
    return { jy: j.jy, jm: j.jm, jd: j.jd };
  }, [initial]);

  const [jy, setJy] = useState(initJ?.jy ?? 1370);
  const [jm, setJm] = useState(initJ?.jm ?? 1);
  const [jd, setJd] = useState(initJ?.jd ?? 1);
  const [open, setOpen] = useState<null | "year" | "month" | "day">(null);

  const daysInMonth = useMemo(
    () =>
      Array.from({ length: jalaaliMonthLength(jy, jm) }, (_, i) => i + 1),
    [jy, jm]
  );

  const commit = (jy0: number, jm0: number, jd0: number) => {
    if (!isValidJalaaliDate(jy0, jm0, jd0)) return;
    const g = toGregorianSafe(jy0, jm0, jd0);
    const iso = `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
    onChange(iso);
  };

  const chip = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.chipBorder,
        backgroundColor: C.chipBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "800", color: C.text }}>{label}</Text>
    </Pressable>
  );

  // ✅ شیت با SafeArea پایین (دکمه بستن زیر دکمه‌های سیستمی نره)
  const Sheet = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={[
          {
            backgroundColor: C.sheetBg2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 14, // ✅ این مهمه
            borderWidth: 1,
            borderColor: C.line,
          },
          stylePicker,
        ]}
      >
        <Text
          style={{
            fontWeight: "900",
            color: C.text,
            fontSize: 16,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {title}
        </Text>

        {children}

        <Pressable
          onPress={() => setOpen(null)}
          style={{ alignSelf: "center", marginTop: 14 }}
        >
          <Text style={{ color: accentColor, fontWeight: "900" }}>بستن</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 14,
          padding: 12,
          gap: 10,
          backgroundColor: "transparent",
        },
        styleContainer,
      ]}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        {chip(`سال: ${faDigits(jy)}`, () => setOpen("year"))}
        {chip(`ماه: ${monthNames[jm - 1]}`, () => setOpen("month"))}
        {chip(`روز: ${faDigits(jd)}`, () => setOpen("day"))}
      </View>

      {/* YEAR */}
      <Modal
        visible={open === "year"}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
      >
        <Sheet title="انتخاب سال">
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i).map(
                (yy) => {
                  const selected = yy === jy;
                  return (
                    <Pressable
                      key={yy}
                      onPress={() => {
                        const safeDay = Math.min(jd, jalaaliMonthLength(yy, jm));
                        setJy(yy);
                        setJd(safeDay);
                        setOpen(null);
                        commit(yy, jm, safeDay);
                      }}
                      style={{ width: "33.33%", padding: 8, alignItems: "center" }}
                    >
                      <View
                        style={{
                          height: 44,
                          minWidth: 80,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? accentColor : C.itemBg,
                          borderWidth: selected ? 0 : 1,
                          borderColor: C.line,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#fff" : C.text,
                            fontWeight: "900",
                          }}
                        >
                          {faDigits(yy)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>
          </ScrollView>
        </Sheet>
      </Modal>

      {/* MONTH */}
      <Modal
        visible={open === "month"}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
      >
        <Sheet title="انتخاب ماه">
          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthNames.map((m, idx) => {
                const mm = idx + 1;
                const selected = mm === jm;
                return (
                  <Pressable
                    key={mm}
                    onPress={() => {
                      const safeDay = Math.min(jd, jalaaliMonthLength(jy, mm));
                      setJm(mm);
                      setJd(safeDay);
                      setOpen(null);
                      commit(jy, mm, safeDay);
                    }}
                    style={{ width: "33.33%", padding: 8, alignItems: "center" }}
                  >
                    <View
                      style={{
                        height: 44,
                        minWidth: 90,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? accentColor : C.itemBg,
                        borderWidth: selected ? 0 : 1,
                        borderColor: C.line,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : C.text,
                          fontWeight: "900",
                          fontSize: 13,
                        }}
                      >
                        {m}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Sheet>
      </Modal>

      {/* DAY */}
      <Modal
        visible={open === "day"}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
      >
        <Sheet title="انتخاب روز">
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {daysInMonth.map((d) => {
                const selected = d === jd;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      setJd(d);
                      setOpen(null);
                      commit(jy, jm, d);
                    }}
                    style={{ width: "25%", padding: 8, alignItems: "center" }}
                  >
                    <View
                      style={{
                        height: 44,
                        minWidth: 44,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? accentColor : C.itemBg,
                        borderWidth: selected ? 0 : 1,
                        borderColor: C.line,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : C.text,
                          fontWeight: "900",
                        }}
                      >
                        {faDigits(d)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Sheet>
      </Modal>
    </View>
  );
}