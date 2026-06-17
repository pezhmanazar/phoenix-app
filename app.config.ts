/// <reference types="node" />

import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const rawProvider = process.env.PAYMENT_PROVIDER;
  const provider =
    rawProvider && rawProvider.toLowerCase().trim() === "bazaar"
      ? "bazaar"
      : "zarinpal";

  const bazaarRsa = (process.env.EXPO_PUBLIC_BAZAAR_RSA_PUBLIC_KEY || "").trim();

  return {
    ...config,

    name: config.name ?? "qoqnoos",
    slug: config.slug ?? "phoenix-app",
    version: config.version ?? "1.0.0",

    plugins: [
  ...(config.plugins || []),
  "expo-audio",
  "expo-asset",
],

    extra: {
      ...(config.extra || {}),
      PAYMENT_PROVIDER: provider,

      EXPO_PUBLIC_BAZAAR_RSA_PUBLIC_KEY: bazaarRsa,
    },
  };
};
