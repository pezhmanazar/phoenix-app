// lib/panahgah/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const visitKey = (scenarioId: string) => `Panahgah.visits.${scenarioId}`;
const historyKey = (scenarioId: string) => `Panahgah.history.${scenarioId}`;

export type HistoryEntry = {
  id: string;
  createdAt: number;
  payload: string;                           // متنِ فرمت‌شده (نمایشی)
  data?: Record<string, string>;             // مقادیر خام فرم (برای نمایش مطمئن)
};

export async function getVisitIndex(scenarioId: string) {
  const raw = await AsyncStorage.getItem(visitKey(scenarioId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Math.max(0, n);
}
export async function bumpVisitIndex(scenarioId: string) {
  const cur = await getVisitIndex(scenarioId);
  await AsyncStorage.setItem(visitKey(scenarioId), String(cur + 1));
}

export async function getHistory(scenarioId: string): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(historyKey(scenarioId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as HistoryEntry[];
    // تضمین فیلدها
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addHistoryEntry(
  scenarioId: string,
  payload: string,
  data?: Record<string, string>
) {
  const arr = await getHistory(scenarioId);
  const entry: HistoryEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    payload: (payload ?? "").toString(),
    ...(data ? { data } : {}),
  };
  arr.unshift(entry);
  await AsyncStorage.setItem(historyKey(scenarioId), JSON.stringify(arr));
}

export async function clearHistory(scenarioId: string) {
  await AsyncStorage.removeItem(historyKey(scenarioId));
}

export async function removeHistoryEntry(scenarioId: string, entryId: string) {
  const arr = await getHistory(scenarioId);
  const next = arr.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(historyKey(scenarioId), JSON.stringify(next));
}