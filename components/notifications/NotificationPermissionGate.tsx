import AppBannerModal from "../ui/AppBannerModal";
import { useAuth } from "../../hooks/useAuth";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
} from "../../lib/notifications/notificationService";
import { registerDeviceToken } from "../../lib/notifications/registerDevice";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Linking,
} from "react-native";

type Mode =
  | "ask"
  | "settings"
  | null;

export default function NotificationPermissionGate() {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  const [mode, setMode] =
    useState<Mode>(null);

  const [working, setWorking] =
    useState(false);

  /*
   * اگر کاربر «فعلاً نه» زد،
   * در همین session دوباره مزاحمش نمی‌شویم.
   */
  const dismissedThisSession =
    useRef(false);

  /*
   * جلوگیری از اجرای چندباره بررسی
   * هنگام rerenderهای AuthContext
   */
  const checkedForCurrentLogin =
    useRef(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    /*
     * Logout شد:
     * برای Login بعدی دوباره اجازه بررسی بده.
     */
    if (!isAuthenticated) {
      checkedForCurrentLogin.current = false;
      dismissedThisSession.current = false;
      setMode(null);
      return;
    }

    if (
      checkedForCurrentLogin.current ||
      dismissedThisSession.current
    ) {
      return;
    }

    checkedForCurrentLogin.current = true;

    void (async () => {
      try {
        const permission =
          await getNotificationPermissionState();

        /*
         * قبلاً اجازه داده:
         * هیچ Modal لازم نیست.
         * فقط مطمئن شو Device ثبت شده.
         */
        if (permission.granted) {
          await registerDeviceToken();
          return;
        }

        /*
         * هنوز می‌شود Permission خواست.
         */
        if (permission.canAskAgain) {
          setMode("ask");
          return;
        }

        /*
         * دیگر System Prompt قابل نمایش نیست.
         */
        setMode("settings");
      } catch (error) {
        console.warn(
          "[NotificationPermissionGate] check failed:",
          error,
        );
      }
    })();
  }, [
    loading,
    isAuthenticated,
  ]);

  const closeForNow = () => {
    dismissedThisSession.current = true;
    setMode(null);
  };

  const enableNotifications =
    async () => {
      if (working) {
        return;
      }

      setWorking(true);

      try {
        const permission =
          await requestNotificationPermission();

        if (permission.granted) {
          await registerDeviceToken();

          setMode(null);
          return;
        }

        /*
         * کاربر Deny کرد و دیگر قابل سؤال نیست.
         */
        if (!permission.canAskAgain) {
          setMode("settings");
          return;
        }

        /*
         * Deny کرده ولی هنوز می‌شود بعداً سؤال کرد.
         * در همین session دوباره مزاحمش نمی‌شویم.
         */
        dismissedThisSession.current = true;
        setMode(null);
      } catch (error) {
        console.warn(
          "[NotificationPermissionGate] request failed:",
          error,
        );

        dismissedThisSession.current = true;
        setMode(null);
      } finally {
        setWorking(false);
      }
    };

  const openSettings =
    async () => {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.warn(
          "[NotificationPermissionGate] open settings failed:",
          error,
        );
      }
    };

  return (
    <>
      <AppBannerModal
        visible={mode === "ask"}
        kind="info"
        title="فعالسازی اعلان‌های ققنوس"
        message="برای دریافت پاسخ‌های درمانگر و پشتیبان، یادآوری‌های مسیر درمان و پیام‌های مهم ققنوس، اجازه ارسال اعلان رو فعال کن."
        closeText="فعلاً نه"
        confirmText="فعال کردن اعلان‌ها"
        confirmLoading={working}
        onClose={closeForNow}
        onConfirm={() => {
          void enableNotifications();
        }}
      />

      <AppBannerModal
        visible={mode === "settings"}
        kind="warning"
        title="اعلان‌ها غیرفعال هستند"
        message="اجازه اعلان برای ققنوس در تنظیمات گوشی غیرفعال شده. برای دریافت پاسخ‌های پناه و یادآوری‌های درمان،از تنظیمات گوشی اون رو فعال کن."
        closeText="فعلاً نه"
        confirmText="رفتن به تنظیمات"
        confirmLoading={working}
        onClose={closeForNow}
        onConfirm={() => {
          void openSettings();
        }}
      />
    </>
  );
}