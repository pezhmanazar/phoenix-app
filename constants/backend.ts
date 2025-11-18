// phoenix-app/constants/backend.ts
const LOCAL = "http://192.168.100.4:4000";
const PROD  = "https://express-js-on-vercel-wine-eight.vercel.app";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || (__DEV__ ? LOCAL : PROD);

export default BACKEND_URL;