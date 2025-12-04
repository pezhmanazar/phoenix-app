// phoenix-app/components/JalaliSelect.tsx
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  toJalaali,
  toGregorian,
  isValidJalaaliDate,
  jalaaliMonthLength,
} from "jalaali-js";

type Props = {
  initial?: string;              // yyyy-mm-dd (میلادی)
  onChange: (isoDate: string) => void;
  minYear?: number;              // پیش‌فرض 1330
  maxYear?: number;              // پیش‌فرض 1390
  styleContainer?: any;
  stylePicker?: any;
  textColor?: string;
  accentColor?: string;
  dark?: boolean;
  grid?: boolean;                // فقط برای سازگاری با جایی که صدا زده می‌شود
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
  // اگر initial داده شد (میلادی)، به جلالی تبدیل کن
  const initJ = useMemo(() => {
    if (!initial) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(initial);
    if (!m) return null;
    const g = { gy: +m[1], gm: +m[2], gd: +m[3] };
    const j = toJalaali(g.gy, g.gm, g.gd);
    return { jy: j.jy, jm: j.jm, jd: j.jd };
  }, [initial]);

  const [jy, setJy] = useState(initJ?.jy ?? 1370);
  const [jm, setJm] = useState(initJ?.jm ?? 1);
  const [jd, setJd] = useState(initJ?.jd ?? 1);
  const [open, setOpen] = useState<null | "year" | "month" | "day">(null);

  const daysInMonth = useMemo(
    () =>
      Array.from(
        { length: jalaaliMonthLength(jy, jm) },
        (_, i) => i + 1
      ),
    [jy, jm]
  );

  const commit = (jy0: number, jm0: number, jd0: number) => {
    if (!isValidJalaaliDate(jy0, jm0, jd0)) return;
    const g = toGregorian(jy0, jm0, jd0);
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
        borderColor: dark ? "#1F2937" : "#E5E7EB",
        backgroundColor: dark ? "#0B1220" : "#F8FAFC",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontWeight: "800",
          color: dark ? "#E5E7EB" : textColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: dark ? "#1F2937" : "#E5E7EB",
          borderRadius: 14,
          padding: 12,
          gap: 10,
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
                backgroundColor: dark ? "#101317" : "#FFFFFF",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
                maxHeight: "70%",
              },
              stylePicker,
            ]}
          >
            <Text
              style={{
                fontWeight: "900",
                color: dark ? "#E5E7EB" : textColor,
                fontSize: 16,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              انتخاب سال
            </Text>
            <ScrollView>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from(
                  { length: maxYear - minYear + 1 },
                  (_, i) => maxYear - i
                ).map((yy) => {
                  const selected = yy === jy;
                  return (
                    <Pressable
                      key={yy}
                      onPress={() => {
                        const safeDay = Math.min(
                          jd,
                          jalaaliMonthLength(yy, jm)
                        );
                        setJy(yy);
                        setJd(safeDay);
                        setOpen(null);
                        commit(yy, jm, safeDay);
                      }}
                      style={{
                        width: "33.33%",
                        padding: 8,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          height: 44,
                          minWidth: 80,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected
                            ? accentColor
                            : dark
                            ? "#111827"
                            : "#F3F4F6",
                          borderWidth: selected ? 0 : 1,
                          borderColor: dark ? "#1F2937" : "#E5E7EB",
                        }}
                      >
                        <Text
                          style={{
                            color: selected
                              ? "#fff"
                              : dark
                              ? "#E5E7EB"
                              : "#111827",
                            fontWeight: "800",
                          }}
                        >
                          {faDigits(yy)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              onPress={() => setOpen(null)}
              style={{ alignSelf: "center", marginTop: 12 }}
            >
              <Text style={{ color: accentColor, fontWeight: "900" }}>
                بستن
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MONTH */}
      <Modal
        visible={open === "month"}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
      >
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
                backgroundColor: dark ? "#101317" : "#FFFFFF",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
              },
              stylePicker,
            ]}
          >
            <Text
              style={{
                fontWeight: "900",
                color: dark ? "#E5E7EB" : textColor,
                fontSize: 16,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              انتخاب ماه
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthNames.map((m, idx) => {
                const mm = idx + 1;
                const selected = mm === jm;
                return (
                  <Pressable
                    key={mm}
                    onPress={() => {
                      const safeDay = Math.min(
                        jd,
                        jalaaliMonthLength(jy, mm)
                      );
                      setJm(mm);
                      setJd(safeDay);
                      setOpen(null);
                      commit(jy, mm, safeDay);
                    }}
                    style={{
                      width: "33.33%",
                      padding: 8,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        height: 44,
                        minWidth: 90,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected
                          ? accentColor
                          : dark
                          ? "#111827"
                          : "#F3F4F6",
                        borderWidth: selected ? 0 : 1,
                        borderColor: dark ? "#1F2937" : "#E5E7EB",
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: selected
                            ? "#fff"
                            : dark
                            ? "#E5E7EB"
                            : "#111827",
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
            <Pressable
              onPress={() => setOpen(null)}
              style={{ alignSelf: "center", marginTop: 12 }}
            >
              <Text style={{ color: accentColor, fontWeight: "900" }}>
                بستن
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* DAY */}
      <Modal
        visible={open === "day"}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
      >
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
                backgroundColor: dark ? "#101317" : "#FFFFFF",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
                maxHeight: "65%",
              },
              stylePicker,
            ]}
          >
            <Text
              style={{
                fontWeight: "900",
                color: dark ? "#E5E7EB" : textColor,
                fontSize: 16,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              انتخاب روز
            </Text>
            <ScrollView>
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
                      style={{
                        width: "25%",
                        padding: 8,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          height: 44,
                          minWidth: 44,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected
                            ? accentColor
                            : dark
                            ? "#111827"
                            : "#F3F4F6",
                          borderWidth: selected ? 0 : 1,
                          borderColor: dark ? "#1F2937" : "#E5E7EB",
                          paddingHorizontal: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: selected
                              ? "#fff"
                              : dark
                              ? "#E5E7EB"
                              : "#111827",
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
            <Pressable
              onPress={() => setOpen(null)}
              style={{ alignSelf: "center", marginTop: 12 }}
            >
              <Text style={{ color: accentColor, fontWeight: "900" }}>
                بستن
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}