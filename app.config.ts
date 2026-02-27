import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const raw = process.env.PAYMENT_PROVIDER;
  const provider =
    raw && raw.toLowerCase().trim() === "bazaar" ? "bazaar" : "zarinpal";

  return {
    name: config.name ?? "qoqnoos",
    slug: config.slug ?? "phoenix-app",
    version: config.version ?? "1.0.0",
    ...config,
    extra: {
      ...(config.extra || {}),
      PAYMENT_PROVIDER: provider,
    },
  };
};