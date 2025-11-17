import * as SecureStore from "expo-secure-store";

const KEY = "phoenix.session";

export async function saveSession(token: string) {
  await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function loadSession() {
  return SecureStore.getItemAsync(KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(KEY);
}