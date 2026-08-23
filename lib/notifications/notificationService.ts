//phoenix-app\lib\notifications\notificationService.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export async function requestNotificationPermission() {
  if (!Device.isDevice) {
    return false;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") {
    return true;
  }

  const { status } =
    await Notifications.requestPermissionsAsync();

  return status === "granted";
}

export async function getFCMToken() {
  if (!Device.isDevice) {
    return null;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();

    return token.data;
  } catch (error) {
    console.log("FCM TOKEN ERROR:", error);
    return null;
  }
}
export async function setupNotifications() {
  const permission = await requestNotificationPermission();

  if (!permission) {
    return null;
  }

  const token = await getFCMToken();

  if (!token) {
    return null;
  }

  return {
    token,
    platform: "android",
  };
}