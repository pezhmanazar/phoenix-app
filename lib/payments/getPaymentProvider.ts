import Constants from "expo-constants";

export type PaymentProviderId = "zarinpal" | "bazaar";
export type SubSku = "sub_30" | "sub_90" | "sub_180";

export type PaymentApi = {
  id: PaymentProviderId;
  isAvailable(): Promise<boolean>;
  purchaseSubscription(sku: SubSku, phone: string): Promise<any>;
  restorePurchases(phone: string): Promise<void>;
};

export async function getPaymentProvider(): Promise<PaymentApi> {
  const provider = (Constants.expoConfig?.extra as any)?.PAYMENT_PROVIDER as PaymentProviderId | undefined;

  if (provider === "bazaar") {
    const mod = await import("./providers/bazaarProvider");
    return mod.bazaarProvider;
  }

  const mod = await import("./providers/zarinpalProvider");
  return mod.zarinpalProvider;
}