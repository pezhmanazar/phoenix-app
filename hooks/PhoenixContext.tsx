// hooks/PhoenixContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme as RNDark, DefaultTheme as RNLight, Theme } from "@react-navigation/native";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** ---------- تم‌های پایدار (خارج از کامپوننت) ---------- */
const lightTheme: Theme = {
  ...RNLight,
  colors: {
    ...RNLight.colors,
    primary: "#FF6B00",
  },
};
const darkTheme: Theme = {
  ...RNDark,
  colors: {
    ...RNDark.colors,
    primary: "#FF6B00",
  },
};

type Ctx = {
  /** تم و حالت */
  isDark: boolean;
  toggleTheme: () => void;
  navTheme?: Theme;

  /** پروفایل */
  profileName: string;
  avatarUrl: string;
  setProfileName: (s: string) => void;
  setAvatarUrl: (s: string) => void;

  /** پیشرفت‌ها */
  pelekanProgress: number;
  setPelekanProgress: (n: number) => void;
  dayProgress: number;
  setDayProgress: (n: number) => void;

  /** امتیاز/استریک تکنیک‌ها */
  points: number;
  addPoints: (n: number) => void;
  streakDays: number;
  bestStreak: number;
  incrementStreak: () => void;
  resetStreak: () => void;

  /** قطع تماس (No Contact) */
  noContactStreak: number;
  canLogNoContactToday: boolean;
  incNoContact: () => boolean; // true if logged today, false if already logged
  resetNoContact: () => void;
};

const PhoenixCtx = createContext<Ctx | null>(null);

export function PhoenixProvider({ children }: { children: React.ReactNode }) {
  /** ------------- حالت‌ها ------------- */
  const [isDark, setIsDark] = useState(false);

  const [profileName, setProfileName] = useState("پژمان");
  const [avatarUrl, setAvatarUrl] = useState("https://i.pravatar.cc/150?img=66");

  const [pelekanProgress, setPelekanProgress] = useState(0);
  const [dayProgress, setDayProgress] = useState(0);

  const [points, setPoints] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const [noContactStreak, setNoContactStreak] = useState(0);
  const [lastNoContactDay, setLastNoContactDay] = useState<string>(""); // "YYYY-MM-DD"

  /** ------------- پرسیست ساده (اختیاری) ------------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@phoenix_state_v1");
        if (raw) {
          const s = JSON.parse(raw);
          if (typeof s.isDark === "boolean") setIsDark(s.isDark);
          if (s.profileName) setProfileName(s.profileName);
          if (s.avatarUrl) setAvatarUrl(s.avatarUrl);
          if (typeof s.pelekanProgress === "number") setPelekanProgress(s.pelekanProgress);
          if (typeof s.dayProgress === "number") setDayProgress(s.dayProgress);
          if (typeof s.points === "number") setPoints(s.points);
          if (typeof s.streakDays === "number") setStreakDays(s.streakDays);
          if (typeof s.bestStreak === "number") setBestStreak(s.bestStreak);
          if (typeof s.noContactStreak === "number") setNoContactStreak(s.noContactStreak);
          if (typeof s.lastNoContactDay === "string") setLastNoContactDay(s.lastNoContactDay);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const s = {
      isDark,
      profileName,
      avatarUrl,
      pelekanProgress,
      dayProgress,
      points,
      streakDays,
      bestStreak,
      noContactStreak,
      lastNoContactDay,
    };
    AsyncStorage.setItem("@phoenix_state_v1", JSON.stringify(s)).catch(() => {});
  }, [
    isDark,
    profileName,
    avatarUrl,
    pelekanProgress,
    dayProgress,
    points,
    streakDays,
    bestStreak,
    noContactStreak,
    lastNoContactDay,
  ]);

  /** ------------- اکشن‌ها ------------- */
  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);

  const addPoints = useCallback((n: number) => setPoints((p) => Math.max(0, p + n)), []);
  const incrementStreak = useCallback(() => {
    setStreakDays((d) => {
      const nd = d + 1;
      setBestStreak((b) => Math.max(b, nd));
      return nd;
    });
  }, []);
  const resetStreak = useCallback(() => setStreakDays(0), []);

  // helper برای تاریخ روز به فرمت YYYY-MM-DD
  const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const canLogNoContactToday = lastNoContactDay !== todayKey();
  const incNoContact = useCallback(() => {
    const tk = todayKey();
    if (lastNoContactDay === tk) return false;
    setNoContactStreak((s) => s + 1);
    setLastNoContactDay(tk);
    return true;
  }, [lastNoContactDay]);
  const resetNoContact = useCallback(() => {
    setNoContactStreak(0);
    setLastNoContactDay("");
  }, []);

  /** ------------- تم پایدار ------------- */
  const navTheme = useMemo<Theme>(() => (isDark ? darkTheme : lightTheme), [isDark]);

  /** ------------- مقدار کانتکست (با useMemo) ------------- */
  const value = useMemo<Ctx>(
    () => ({
      isDark,
      toggleTheme,
      navTheme,

      profileName,
      avatarUrl,
      setProfileName,
      setAvatarUrl,

      pelekanProgress,
      setPelekanProgress,
      dayProgress,
      setDayProgress,

      points,
      addPoints,
      streakDays,
      bestStreak,
      incrementStreak,
      resetStreak,

      noContactStreak,
      canLogNoContactToday,
      incNoContact,
      resetNoContact,
    }),
    [
      isDark,
      toggleTheme,
      navTheme,

      profileName,
      avatarUrl,

      pelekanProgress,
      dayProgress,

      points,
      streakDays,
      bestStreak,

      canLogNoContactToday,
      incNoContact,
    ]
  );

  return <PhoenixCtx.Provider value={value}>{children}</PhoenixCtx.Provider>;
}

export function usePhoenix() {
  const v = useContext(PhoenixCtx);
  if (!v) throw new Error("usePhoenix must be used within PhoenixProvider");
  return v;
}