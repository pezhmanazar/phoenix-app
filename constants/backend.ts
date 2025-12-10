const LOCAL = "http://192.168.100.4:4000";
const PROD = "https://qoqnoos.app";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || (__DEV__ ? LOCAL : PROD);

if (__DEV__) {
  console.log("[BACKEND] BACKEND_URL =", BACKEND_URL);
}

export default BACKEND_URL;