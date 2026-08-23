import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

const API_URL =
  process.env.EXPO_PUBLIC_APP_API_URL || "https://api.qoqnoos.app";

console.log("NOTIFICATION_API_URL:", API_URL);

export async function registerDeviceToken() {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require physical device");
      return;
    }

    const sessionToken = await AsyncStorage.getItem("session_v1");

    if (!sessionToken) {
      console.log("No session token, skip device registration");
      return;
    }

    const permission = await Notifications.getPermissionsAsync();

    if (permission.status !== "granted") {
      console.log("Notification permission not granted");
      return;
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();

    const token = String(deviceToken.data);

    const ping = await fetch(`${API_URL}/health`);
console.log("HEALTH_STATUS:", ping.status);

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
      console.log("DEVICE_REGISTER_ERROR:", data);
      return;
    }

    console.log("DEVICE_REGISTERED:", data);
  } catch (error) {
    console.log("REGISTER_DEVICE_FAILED:", error);
  }
}