// constants/env.js

// ⬅️ این برای OTP و چیزهایی است که هنوز روی ورسل هستند
const DEF = "https://express-js-on-vercel-wine-eight.vercel.app";
export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || DEF).replace(/\/+$/, "");

// ⬅️ این برای بک‌اند اصلی خودت روی سرور qoqnoos.app است
const LOCAL_DEF = "https://qoqnoos.app";
export const APP_API_URL = (process.env.EXPO_PUBLIC_APP_API_URL || LOCAL_DEF).replace(/\/+$/, "");

// فقط برای OTP / ورسل
export const toApi = (path = "/") => {
  const p = String(path || "/");
  return `${BACKEND_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

// فقط برای بک‌اند اصلی (کاربر، پلن‌ها، ...)
export const toAppApi = (path = "/") => {
  const p = String(path || "/");
  return `${APP_API_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

if (__DEV__) {
  console.log("[ENV] BACKEND_URL =", BACKEND_URL, " → ", toApi("/api/ping"));
  console.log("[ENV] APP_API_URL =", APP_API_URL, " → ", toAppApi("/api/ping"));
}