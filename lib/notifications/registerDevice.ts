import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

const API_URL =
  process.env.EXPO_PUBLIC_APP_API_URL || "https://api.qoqnoos.app";

export async function registerDeviceToken() {
  try {
    if (!Device.isDevice) {
      return;
    }

    const sessionToken = await AsyncStorage.getItem("session_v1");

    if (!sessionToken) {
      return;
    }

    const permission = await Notifications.getPermissionsAsync();

    if (permission.status !== "granted") {
      return;
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();

    const token = String(deviceToken.data);

    const response = await fetch(
      `${API_URL}/api/notifications/register-device`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          token,
          platform: Device.osName?.toLowerCase() || "android",
          deviceName: Device.modelName || null,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.warn("DEVICE_REGISTER_ERROR:", data);
      return;
    }

  } catch (error) {
    console.warn("REGISTER_DEVICE_FAILED:", error);
  }
}

export async function unregisterDeviceToken() {
  try {
    if (!Device.isDevice) {
      return;
    }

    const sessionToken =
      await AsyncStorage.getItem("session_v1");

    if (!sessionToken) {
      return;
    }

    const permission =
      await Notifications.getPermissionsAsync();

    if (permission.status !== "granted") {
      return;
    }

    const deviceToken =
      await Notifications.getDevicePushTokenAsync();

    const token = String(deviceToken.data);

    const response = await fetch(
      `${API_URL}/api/notifications/unregister-device`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          token,
        }),
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn(
        "DEVICE_UNREGISTER_ERROR:",
        data,
      );
    }
  } catch (error) {
    console.warn(
      "UNREGISTER_DEVICE_FAILED:",
      error,
    );
  }
}