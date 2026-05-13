// phoenix-app/utils/tickets/identity.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserIdentity = {
  id?: string;
  phone?: string;
  fullName?: string | null;
};

export type ResolvedTicketIdentity = {
  openedById: string;
  openedByName: string;
};

export async function getUserIdentity(): Promise<ResolvedTicketIdentity> {
  try {
    const keys = ["user_profile", "profile", "me", "phoenix_profile"];
    let raw: string | null = null;

    for (const k of keys) {
      raw = await AsyncStorage.getItem(k);
      if (raw) break;
    }

    const p = raw ? JSON.parse(raw) : {};
    const openedById =
      p?.id || p?.userId || p?.uid || p?.phone || p?.mobile || p?.email || "";
    const openedByName =
      p?.fullName || p?.name || p?.displayName || p?.phone || "کاربر";

    return {
      openedById: String(openedById || ""),
      openedByName: String(openedByName || "کاربر"),
    };
  } catch {
    return { openedById: "", openedByName: "کاربر" };
  }
}

export async function resolveIdentity(
  fromUser?: UserIdentity | null
): Promise<ResolvedTicketIdentity> {
  if (fromUser) {
    const openedById = fromUser.phone || fromUser.id || "";
    const openedByName = fromUser.fullName || fromUser.phone || "کاربر";

    return {
      openedById: String(openedById || ""),
      openedByName: String(openedByName || "کاربر"),
    };
  }

  return await getUserIdentity();
}
