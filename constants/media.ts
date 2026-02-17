// constants/media.ts

const MEDIA_BASE = "https://api.qoqnoos.app/api/media/stream?key=";

export const mediaUrl = (key: string) =>
  `${MEDIA_BASE}${encodeURIComponent(key)}`;

/**
 * 🔊 Audio keys (S3)
 * نکته: اینجا فقط KEY ذخیره می‌کنیم، نه URL کامل.
 * URL را با mediaUrl(key) می‌سازیم.
 */
export const AUDIO_KEYS = {
  introOverall: "media/audio/intro/intro-overall.mp3",

  bastanIntro: "media/audio/bastan/intro-bastan.mp3",
  gosastanIntro: "media/audio/gosastan/intro-gosastan.mp3",

  panahgahIntro: "media/audio/panahgah/intro-panahgah.mp3",

  mashaalIntroLocked: "media/audio/mashaal/intro-mashaal.mp3",
  mashaal01: "media/audio/mashaal/mashaal-01.mp3",

  review: {
    danger: "media/audio/review/review-danger.mp3",
    draining: "media/audio/review/review-draining.mp3",
    unstable: "media/audio/review/review-unstable.mp3",
    good: "media/audio/review/review-good.mp3",
    unclear: "media/audio/review/review-unclear.mp3",
  },
} as const;