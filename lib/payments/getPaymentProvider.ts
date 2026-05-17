import Constants from "expo-constants";

export type PaymentProviderId = "zarinpal" | "bazaar";
export type SubSku = "sub_30" | "sub_90" | "sub_180";

export type PaymentApi = {
  id: PaymentProviderId;
  isAvailable(): Promise<boolean>;
  purchaseSubscription(sku: SubSku, phone: string): Promise<any>;
  restorePurchases(phone: string): Promise<void>;
};

function readPaymentProvider(): PaymentProviderId {
  const fromExpoConfig = (Constants.expoConfig?.extra as any)?.PAYMENT_PROVIDER;
  const fromManifestExtra = (Constants.manifest as any)?.extra?.PAYMENT_PROVIDER;
  const fromManifest2Extra =
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.PAYMENT_PROVIDER;

  const raw = fromExpoConfig || fromManifestExtra || fromManifest2Extra;

  return raw === "bazaar" ? "bazaar" : "zarinpal";
}

export async function getPaymentProvider(): Promise<PaymentApi> {
  const provider = readPaymentProvider();

  if (provider === "bazaar") {
    const mod = await import("./providers/bazaarProvider");
    return mod.bazaarProvider;
  }

  const mod = await import("./providers/zarinpalProvider");
  return mod.zarinpalProvider;
}
