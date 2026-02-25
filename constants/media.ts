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

  // 🔥 پناهگاه – تکنیک چک نکردن
  panahgahNoCheck: {
    awarenessLoop: "media/audio/panahgah/no-check/awareness-loop.mp3",
    dopamineExplain: "media/audio/panahgah/no-check/dopamine-explain.mp3",
    fearOfReplacement: "media/audio/panahgah/no-check/fear-of-replacement.mp3",
    urgeNotCommand: "media/audio/panahgah/no-check/urge-not-command.mp3",
  },

  // 🌿 پناهگاه – آرام‌سازی
  panahgahRelax: {
    boxBreathing: "media/audio/panahgah/relax/box-breathing.mp3",
    grounding5Senses: "media/audio/panahgah/relax/grounding-5senses.mp3",
    longExhale: "media/audio/panahgah/relax/long-exhale.mp3",
    muscleRelease: "media/audio/panahgah/relax/muscle-release.mp3",
    resetBreath: "media/audio/panahgah/relax/reset-breath.mp3",
    urgeSurf: "media/audio/panahgah/relax/urge-surf.mp3",
  },

  // ⛔ فعلاً دیفالت کوچ اگر لازم شد
  panahgahRelaxCoachDefault: "media/audio/panahgah/relax/box-breathing.mp3",

  /**
   * ✅ پناهگاه – ویس‌های سناریوهای «الان ...»
   * مسیر آپلود: media/audio/panahgah/techniques/*.mp3
   *
   * نکته: اگر روی فضای ابری فایل‌ها واقعاً بدون پسوند ذخیره شده‌اند،
   * باید یا در ابری rename شوند و .mp3 بخورد، یا همینجا پسوند را برداریم.
   */
  panahgahTechniques: {
    angerRevenge01: "media/audio/panahgah/techniques/anger-revenge-01.mp3",
    daydreamReturn01: "media/audio/panahgah/techniques/daydream-return-01.mp3",
    deepLoneliness01: "media/audio/panahgah/techniques/deep-loneliness-01.mp3",
    exHurtMe01: "media/audio/panahgah/techniques/ex-hurt-me-01.mp3",
    exWantsBack01: "media/audio/panahgah/techniques/ex-wants-back-01.mp3",
    exWantsToSee01: "media/audio/panahgah/techniques/ex-wants-to-see-01.mp3",
    feelHopeless01: "media/audio/panahgah/techniques/feel-hopeless-01.mp3",
    futureAnxiety01: "media/audio/panahgah/techniques/future-anxiety-01.mp3",
    heardExIsFine01: "media/audio/panahgah/techniques/heard-ex-is-fine-01.mp3",
    iEndedButSad01: "media/audio/panahgah/techniques/i-ended-but-sad-01.mp3",
    iMissEx01: "media/audio/panahgah/techniques/i-miss-ex-01.mp3",
    impulsiveAct01: "media/audio/panahgah/techniques/impulsive-act-01.mp3",
    inCrowdFeelAlone01: "media/audio/panahgah/techniques/in-crowd-feel-alone-01.mp3",
    memoryFlash01: "media/audio/panahgah/techniques/memory-flash-01.mp3",
    paayeshAfkar01: "media/audio/panahgah/techniques/paayesh-afkar-01.mp3",
    pms01: "media/audio/panahgah/techniques/pms-01.mp3",
    sawEx01: "media/audio/panahgah/techniques/saw-ex-01.mp3",
    sawExInDream01: "media/audio/panahgah/techniques/saw-ex-in-dream-01.mp3",
    selfBlame01: "media/audio/panahgah/techniques/self-blame-01.mp3",
    sexualMemories01: "media/audio/panahgah/techniques/sexual-memories-01.mp3",
    startFromZero01: "media/audio/panahgah/techniques/start-from-zero-01.mp3",
    suddenSadness01: "media/audio/panahgah/techniques/sudden-sadness-01.mp3",
    triggeredByCue01: "media/audio/panahgah/techniques/triggered-by-cue-01.mp3",
    waiting01: "media/audio/panahgah/techniques/waiting-01.mp3",
    whatIsExDoing01: "media/audio/panahgah/techniques/what-is-ex-doing-01.mp3",
  },

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