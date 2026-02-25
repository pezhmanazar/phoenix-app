// lib/panahgah/actions/models.ts

export type ActionCategory = "sensory" | "body" | "mental" | "environment";

export type ActionItem = {
  id: string;
  label: string;
  category: ActionCategory;
};

export const ACTIONS: ActionItem[] = [
  { id: "water", label: "یک لیوان آب خنک رو آهسته و جرعه جرعه می‌خورم", category: "sensory" },
  { id: "ice", label: "۳۰ ثانیه یک تیکه یخ رو توو دستم نگه می‌دارم", category: "sensory" },
  { id: "mint", label: "یک آبنبات یا آدامس نعناعی می‌خورم", category: "sensory" },
  { id: "smell", label: "یک بوی خوش رو به مدت دو دقیقه بو می‌کنم (مثل عطر یا گل)", category: "sensory" },
  { id: "music", label: "یک موسیقی آروم و بدون کلام رو  گوش میدم", category: "sensory" },
  { id: "tea", label: "یک نوشیدنی گرم درست می‌کنم و اون رو می‌خورم (مثل چای، قهوه یا دمنوش)", category: "sensory" },

  { id: "walk", label: "۲ دقیقه قدم می‌زنم (حتی داخل اتاق)", category: "body" },
  { id: "shake", label: "۲ دقیقه دست‌ها و شونه‌هام رو تکون میدم", category: "body" },
  { id: "stretch", label: "دو دقیقه گردن و شونه‌هام رو می‌کشم", category: "body" },
  { id: "wall_push", label: "۲۰ تا بشین پاشوی آروم انجام میدم", category: "body" },
  { id: "hand_on_chest", label: "دو دقیقه می‌رقصم", category: "body" },

  { id: "name5", label: "پنج تا چیزی که می‌بینم رو نام می‌برم و کاربردی که برام داره رو میگم", category: "mental" },
  { id: "cost3", label: "روی کاغذ احساساتم رو می‌نویسم ", category: "mental" },
  { id: "one_line", label: "دو دقیقه هیچ کاری نمی‌کنم و به سقف خیره میشم", category: "mental" },
  { id: "timer10", label: "دو دقیقه به اهدافی که دوست دارم بدست بیارم فکر می‌کنم", category: "mental" },

  { id: "window", label: "پنجره رو باز می‌کنم و ۵ نفس عمیق می‌کشم", category: "environment" },
  { id: "cold_water_face", label: "صورتم رو با آب خنک می‌شورم", category: "environment" },
  { id: "tidy", label: "۲ دقیقه یک نقطه کوچیک از خونه یا اتاقم رو مرتب می‌کنم", category: "environment" },
  { id: "light", label: "جای یه چیز رو داخل اتاقم عوض می‌کنم و تا فردا اجازه میدم اونجا بمونه", category: "environment" },
  { id: "text_safe", label: "به یک آدم امن یک پیام کوتاه میدم یا بهش زنگ می‌زنم", category: "environment" },
];

/* ---------- Seeded pick (رندوم پایدار) ---------- */
export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function seededShuffle<T>(arr: T[], seed: string) {
  const a = [...arr];
  let h = hashSeed(seed) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (i + 1), 2654435761);
    const j = Math.abs(h) % (i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function pickActions(seed: string, count = 6): ActionItem[] {
  return seededShuffle(ACTIONS, seed).slice(0, Math.min(count, ACTIONS.length));
}