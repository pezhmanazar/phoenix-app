// service.js
const TrackPlayer = require('react-native-track-player').default;

module.exports = async function () {
  // هندلرهای کنترل‌های نوتیفیکیشن/لاک‌اسکرین
  TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-stop', () => TrackPlayer.destroy());

  // جهش‌های زمانی
  TrackPlayer.addEventListener('remote-jump-forward', async (event) => {
    try {
      const { position } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(position + (event.interval ?? 10));
    } catch {}
  });

  TrackPlayer.addEventListener('remote-jump-backward', async (event) => {
    try {
      const { position } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(Math.max(0, position - (event.interval ?? 10)));
    } catch {}
  });

  // اسکراب از روی نوتیفیکیشن (اندروید 13+)
  TrackPlayer.addEventListener('remote-seek', async (event) => {
    try {
      await TrackPlayer.seekTo(event.position);
    } catch {}
  });

  // تغییر سرعت از نوتیف (اگر سیستم اجازه بده)
  TrackPlayer.addEventListener('remote-duck', () => {}); // اختیاری، برای ducking

  // وقتی آهنگ تموم شد
  TrackPlayer.addEventListener('playback-queue-ended', async ({ position }) => {
    try {
      const { duration } = await TrackPlayer.getProgress();
      // اگه واقعا به انتها رسید، همونجا بمونه (رفتار کلاسیک پلیرها)
      if (duration && position >= duration - 0.25) {
        await TrackPlayer.pause();
        await TrackPlayer.seekTo(duration);
      }
    } catch {}
  });
};