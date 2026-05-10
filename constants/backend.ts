const PROD = "https://qoqnoos.app";

const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL || PROD
).replace(/\/+$/, "");

if (__DEV__) {
  console.log("[BACKEND] BACKEND_URL =", BACKEND_URL);
}

export default BACKEND_URL;
export { BACKEND_URL };
