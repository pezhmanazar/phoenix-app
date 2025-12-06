// constants/env.js

// ⬅️ این برای OTP و چیزهایی است که روی ورسل هستند
const DEF = "https://qoqnoos.app";
export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || DEF).replace(/\/+$/, "");

// ⬅️ این برای بک‌اند خودت روی لپ‌تاپ است (phoenix-backend)
const LOCAL_DEF = __DEV__
  ? "http://192.168.100.4:4000" // IP لپ‌تاپ روی وای‌فای
  : "http://192.168.100.4:4000"; // فعلاً برای ریلیز هم همین، بعداً عوض می‌کنیم

export const APP_API_URL = (process.env.EXPO_PUBLIC_APP_API_URL || LOCAL_DEF).replace(/\/+$/, "");

// فقط برای پینگ ورسل
export const toApi = (path = "/") => {
  const p = String(path || "/");
  return `${BACKEND_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

if (__DEV__) {
  console.log("[ENV] BACKEND_URL =", BACKEND_URL, " → ", toApi("/api/ping"));
  console.log("[ENV] APP_API_URL =", APP_API_URL);
}