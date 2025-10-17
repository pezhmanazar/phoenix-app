// lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/** کلیدها */
const K_TODAY = "phoenix.today.v1";
const K_REMS  = "phoenix.reminders.v1";

/** انواع ساده مطابق فایل Rooznegar */
type TodayItem = { id: string; title: string; time: string; done: boolean; createdAt: number };
type ReminderItem = { id: string; title: string; when: number; createdAt: number; done?: boolean };

/** ---- TODAY ---- */
export async function loadToday(): Promise<TodayItem[]> {
  try {
    const s = await AsyncStorage.getItem(K_TODAY);
    return s ? (JSON.parse(s) as TodayItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveToday(items: TodayItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(K_TODAY, JSON.stringify(items));
  } catch {}
}

/** ---- REMINDERS ---- */
export async function loadReminders(): Promise<ReminderItem[]> {
  try {
    const s = await AsyncStorage.getItem(K_REMS);
    return s ? (JSON.parse(s) as ReminderItem[]) : [];
  } catch {
    return [];
  }
}

/** ---- TAGS ---- */
const K_TAGS = "phoenix.tags.v1";

/** بارگذاری برچسب‌ها */
export async function loadTags(): Promise<string[]> {
  try {
    const s = await AsyncStorage.getItem(K_TAGS);
    return s ? (JSON.parse(s) as string[]) : [];
  } catch {
    return [];
  }
}

/** ذخیره برچسب‌ها */
export async function saveTags(tags: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(K_TAGS, JSON.stringify(tags ?? []));
  } catch {}
}

export async function saveReminders(items: ReminderItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(K_REMS, JSON.stringify(items));
  } catch {}
}