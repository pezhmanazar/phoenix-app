// /lib/notifSession.ts
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
  Track,
} from "react-native-track-player";

let _inited = false;

/** فقط یکبار گزینه‌ها رو ست می‌کنیم */
export async function initNotifications() {
  if (_inited) return;
  await TrackPlayer.setupPlayer({
    // buffer تنظیم‌ها اگر لازم شد بعداً سفارشی کن
  });

  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      // اگه خواستی بعداً MediaStyle پیشرفته‌تر هم اضافه میشه
    },
    // دکمه‌ها
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.JumpForward, Capability.JumpBackward],
    progressUpdateEventInterval: 2, // ثانیه
    jumpInterval: 10, // ±۱۰ ثانیه
    alwaysPauseOnInterruption: true,
  });

  await TrackPlayer.setRepeatMode(RepeatMode.Off);
  _inited = true;
}

/** ترک مربوط به همین ویس را داخل نوتیفیکیشن ست می‌کنیم (با صدای صفر) */
export async function setNotifTrack(t: {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artwork?: string;
  duration?: number; // اختیاری؛ اگر نداشتی TrackPlayer خودش حدس می‌زند
}) {
  // برای جلوگیری از صدای دوبل: ترک نوتیفیکیشن بی‌صدا شود
  // (چون پلیر اصلی‌ت expo-av است)
  const track: Track = {
    id: t.id,
    url: t.url,
    title: t.title,
    artist: t.artist ?? " ",
    artwork: t.artwork,
    duration: t.duration, // اگه داشتی بده
    // type/kind پیش‌فرض اوکیه
  };

  await TrackPlayer.reset();
  await TrackPlayer.add([track]);
  await TrackPlayer.setVolume(0); // 🔇 نوتیف خاموش
}

/** سنکِ Play/Pause با expo-av */
export async function syncPlay(isPlaying: boolean) {
  const st = await TrackPlayer.getState();
  if (isPlaying) {
    if (st !== State.Playing) await TrackPlayer.play();
  } else {
    if (st === State.Playing) await TrackPlayer.pause();
  }
}

/** سنک Seek با expo-av */
export async function syncSeek(positionSec: number) {
  await TrackPlayer.seekTo(Math.max(0, positionSec));
}

/** تمیزکاری اختیاری (نوتیف رو ببند) */
export async function stopNotif() {
  try {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
  } catch {}
}