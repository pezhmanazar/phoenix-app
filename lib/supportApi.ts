// lib/supportApi.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "http://127.0.0.1:4000";

// کلیدها برای ذخیره IDها در حافظه‌ی دستگاه
const KEY_USER_ID = "phoenix_user_id";
const KEY_TICKET_ID_TECH = "phoenix_ticket_id_tech";
const KEY_TICKET_ID_THERAPY = "phoenix_ticket_id_therapy";

// ساخت یک رشته‌ی تصادفی ساده (بدون وابستگی)
function randomId() {
  return "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// گرفتن/ساختن userId محلی
export async function getOrCreateUserId(): Promise<string> {
  let uid = await AsyncStorage.getItem(KEY_USER_ID);
  if (!uid) {
    uid = randomId();
    await AsyncStorage.setItem(KEY_USER_ID, uid);
  }
  return uid;
}

// خواندن/نوشتن آخرین ticketId برای هر نوع
function ticketKey(type: "tech" | "therapy") {
  return type === "tech" ? KEY_TICKET_ID_TECH : KEY_TICKET_ID_THERAPY;
}
export async function getSavedTicketId(type: "tech" | "therapy") {
  return AsyncStorage.getItem(ticketKey(type));
}
export async function saveTicketId(type: "tech" | "therapy", id: string) {
  return AsyncStorage.setItem(ticketKey(type), id);
}

// گرفتن تیکت برای نمایش (اگر id ذخیره شده داری)
export async function fetchTicketById(id: string) {
  const res = await fetch(`${BASE_URL}/api/tickets/${id}`);
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.ok ? json.ticket : null;
}

// ⬇️ مهم: «ارسال پیام» (و در صورت نبود تیکت، ساخت تیکت)
// این همان /api/tickets/send است که در بک‌اند اضافه کرده‌ای.
export async function sendTicketMessage(params: {
  type: "tech" | "therapy";
  text: string;                 // محتوای پیام
  openedByName: string;         // نام فعلی کاربر (از Context اپ)
  contact?: string | null;      // اختیاری: ایمیل/شماره
}) {
  const { type, text, openedByName, contact } = params;
  const openedById = await getOrCreateUserId();

  const res = await fetch(`${BASE_URL}/api/tickets/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type,
      text,
      openedById,
      openedByName,
      contact: contact ?? null,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "send_failed");
  }

  // تیکت برمی‌گردد؛ id را ذخیره کن تا برای دفعات بعدی history را لود کنی
  const ticket = json.ticket;
  if (ticket?.id) await saveTicketId(type, ticket.id);

  return ticket; // شامل messages به‌روز
}