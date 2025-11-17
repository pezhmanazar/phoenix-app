// constants/env.js
const DEF = "https://express-js-on-vercel-wine-eight.vercel.app";

export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || DEF).replace(/\/+$/, "");

export const toApi = (path = "/") => {
  const p = String(path || "/");
  return `${BACKEND_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

if (__DEV__) {
  console.log("[ENV] BACKEND_URL =", BACKEND_URL, " → ", toApi("/api/ping"));
}