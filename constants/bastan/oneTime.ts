// constants/bastan/oneTime.ts

// این‌ها زیر‌اقدام‌هایی هستند که باید قبل از انجام، هشدار "فقط یک‌بار" بگیرند
export const BASTAN_ONE_TIME_SUBTASK_KEYS = [
  "UL_1_letter_write_or_photo",   // نامه: نوشتن یا عکس
  "UL_3_72h_lock_confirm",        // شروع قفل ۷۲ ساعت
  "CC_3_signature",               // امضا (اگر کلیدت این نیست بعداً دقیقش می‌کنیم)
  "CR_4_close_date",              // ثبت تاریخ بستن (اگر کلیدت این نیست بعداً دقیقش می‌کنیم)
] as const;

export type BastanOneTimeSubtaskKey = (typeof BASTAN_ONE_TIME_SUBTASK_KEYS)[number];

export function isOneTimeSubtask(key: string) {
  return (BASTAN_ONE_TIME_SUBTASK_KEYS as readonly string[]).includes(key);
}