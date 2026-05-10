import BACKEND_URL from "./backend";

const APP_API_URL = (process.env.EXPO_PUBLIC_APP_API_URL || BACKEND_URL).replace(/\/+$/, "");

export { BACKEND_URL };
export const toApi = (path = "/") => {
  const p = String(path || "/");
  return `${BACKEND_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

export const toAppApi = (path = "/") => {
  const p = String(path || "/");
  return `${APP_API_URL}${p.startsWith("/") ? p : `/${p}`}`;
};