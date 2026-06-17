import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const MOOD_HISTORY_STORAGE_KEY = "pelekan:mood-history";

export type MoodHistoryEntry = {
  dayCode: string;
  taskCode: string;
  score: number;
  date: string;
};

async function readMoodHistory(): Promise<MoodHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(MOOD_HISTORY_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => {
      return (
        item &&
        typeof item.dayCode === "string" &&
        typeof item.taskCode === "string" &&
        typeof item.score === "number" &&
        typeof item.date === "string"
      );
    });
  } catch (error) {
    console.warn("Failed to read mood history:", error);
    return [];
  }
}

async function writeMoodHistory(entries: MoodHistoryEntry[]) {
  await AsyncStorage.setItem(
    MOOD_HISTORY_STORAGE_KEY,
    JSON.stringify(entries)
  );
}

export function useMoodHistory() {
  const [entries, setEntries] = useState<MoodHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMoodHistory = useCallback(async () => {
    setIsLoading(true);

    try {
      const history = await readMoodHistory();
      setEntries(history);
      return history;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveMoodEntry = useCallback(async (entry: MoodHistoryEntry) => {
    const current = await readMoodHistory();

    const filtered = current.filter((item) => item.dayCode !== entry.dayCode);

    const next = [...filtered, entry].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    await writeMoodHistory(next);
    setEntries(next);

    return next;
  }, []);

  const removeMoodEntryByDayCode = useCallback(async (dayCode: string) => {
    const current = await readMoodHistory();

    const next = current.filter((item) => item.dayCode !== dayCode);

    await writeMoodHistory(next);
    setEntries(next);

    return next;
  }, []);

  const clearMoodHistory = useCallback(async () => {
    await AsyncStorage.removeItem(MOOD_HISTORY_STORAGE_KEY);
    setEntries([]);
  }, []);

  useEffect(() => {
    loadMoodHistory();
  }, [loadMoodHistory]);

  return {
    entries,
    isLoading,
    loadMoodHistory,
    saveMoodEntry,
    removeMoodEntryByDayCode,
    clearMoodHistory,
  };
}
