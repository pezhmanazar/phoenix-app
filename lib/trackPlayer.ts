// lib/trackPlayer.ts
import TrackPlayer, { AppKilledPlaybackBehavior, Capability, Event } from 'react-native-track-player';

let isSetup = false;

export async function setupIfNeeded() {
  if (isSetup) return;
  await TrackPlayer.setupPlayer({
    // @ts-ignore: این پراپرتی داخلی اندروید هست
    androidAudioContentType: 'music',
    // @ts-ignore
    androidAudioUsage: 'media',
  });

  await TrackPlayer.updateOptions({
    // کنترل‌هایی که می‌خوای تو نوتیف/لاک‌اسکرین دیده بشن:
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SeekTo,
      Capability.Stop,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.JumpForward, Capability.JumpBackward],
    progressUpdateEventInterval: 1, // هر ۱ ثانیه پروگرس بده
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      // (اگه خواستی بعداً بذاریم روی ContinuePlaybackWithMediaSession)
      // alwaysPauseOnInterruption: true, // دلخواه
      // icon: require('../assets/images/notification-icon.png'), // دلخواه
    },
    // forward/back پیش‌فرض روی ۱۰ ثانیه‌ست؛ می‌تونی تغییر بدی:
    jumpInterval: 10,
  });

  isSetup = true;
}

export async function loadTrack(opts: {
  id: string;
  url: string; // یا file://
  title: string;
  artist?: string;
  artwork?: string | number; // number برای require(...)
  initialPosition?: number;  // میلی‌ثانیه
  playWhenReady?: boolean;   // پیش‌فرض false
}) {
  await setupIfNeeded();

  // هر بار یک آیتم ساده: صف رو ریست می‌کنیم
  await TrackPlayer.reset();

  const { id, url, title, artist = ' ', artwork, initialPosition = 0, playWhenReady = false } = opts;

  await TrackPlayer.add({
    id,
    url,
    title,
    artist,
    artwork,
    duration: undefined, // می‌تونه خودش تشخیص بده
  });

  if (initialPosition > 0) {
    await TrackPlayer.seekTo(initialPosition / 1000); // TrackPlayer برحسب ثانیه می‌خونه؟ (نسخه‌های اخیر ثانیه)
  }

  if (playWhenReady) {
    await TrackPlayer.play();
  } else {
    await TrackPlayer.pause();
  }
}

export async function play() { try { await TrackPlayer.play(); } catch {} }
export async function pause() { try { await TrackPlayer.pause(); } catch {} }
export async function seekToSeconds(sec: number) { try { await TrackPlayer.seekTo(sec); } catch {} }
export async function seekBySeconds(delta: number) {
  try {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, position + delta));
  } catch {}
}
export async function destroy() { try { await TrackPlayer.destroy(); } catch {} }
export async function getProgress() {
  try { return await TrackPlayer.getProgress(); } catch { return { position: 0, duration: 0, buffered: 0 }; }
}