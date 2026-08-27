import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export type NotificationPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
};

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!Device.isDevice) {
    return {
      granted: false,
      canAskAgain: false,
      status:
        Notifications.PermissionStatus.UNDETERMINED,
    };
  }

  const settings =
    await Notifications.getPermissionsAsync();

  const granted =
    settings.granted ||
    settings.ios?.status ===
      Notifications.IosAuthorizationStatus.AUTHORIZED;

  return {
    granted,
    canAskAgain:
      typeof settings.canAskAgain === "boolean"
        ? settings.canAskAgain
        : true,
    status: settings.status,
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const current =
    await getNotificationPermissionState();

  if (current.granted) {
    return current;
  }

  if (!current.canAskAgain) {
    return current;
  }

  const result =
    await Notifications.requestPermissionsAsync();

  const granted =
    result.granted ||
    result.ios?.status ===
      Notifications.IosAuthorizationStatus.AUTHORIZED;

  return {
    granted,
    canAskAgain:
      typeof result.canAskAgain === "boolean"
        ? result.canAskAgain
        : true,
    status: result.status,
  };
}

export async function getFCMToken() {
  if (!Device.isDevice) {
    return null;
  }

  try {
    const token =
      await Notifications.getDevicePushTokenAsync();

    return token.data;
  } catch (error) {
    console.log(
      "FCM TOKEN ERROR:",
      error,
    );

    return null;
  }
}

export async function setupNotifications() {
  const permission =
    await requestNotificationPermission();

  if (!permission.granted) {
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