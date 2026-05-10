const PROD = "https://qoqnoos.app";

const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL || PROD
).replace(/\/+$/, "");

export default BACKEND_URL;
export { BACKEND_URL };
