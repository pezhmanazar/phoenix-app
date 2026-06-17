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
  sookhtanIntro: "media/audio/gosastan/intro-gosastan.mp3",

  gosastan: {
    day01: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-01/01-gosastan-day-one-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-01/02-gosastan-day-one-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-01/03-gosastan-day-one-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-01/04-gosastan-day-one-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-01/05-gosastan-day-one-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-01/06-gosastan-day-one-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-01/07-gosastan-day-one-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-01/08-gosastan-day-one-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-01/09-gosastan-day-one-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-01/10-gosastan-day-one-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-01/11-gosastan-day-one-sleep-meditation.mp3",
    },

    day02: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-02/01-gosastan-day-two-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-02/02-gosastan-day-two-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-02/03-gosastan-day-two-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-02/04-gosastan-day-two-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-02/05-gosastan-day-two-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-02/06-gosastan-day-two-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-02/07-gosastan-day-two-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-02/08-gosastan-day-two-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-02/09-gosastan-day-two-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-02/10-gosastan-day-two-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-02/11-gosastan-day-two-sleep-meditation.mp3",
    },

    day03: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-03/01-gosastan-day-three-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-03/02-gosastan-day-three-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-03/03-gosastan-day-three-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-03/04-gosastan-day-three-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-03/05-gosastan-day-three-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-03/06-gosastan-day-three-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-03/07-gosastan-day-three-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-03/08-gosastan-day-three-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-03/09-gosastan-day-three-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-03/10-gosastan-day-three-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-03/11-gosastan-day-three-sleep-meditation.mp3",
    },

    day04: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-04/01-gosastan-day-four-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-04/02-gosastan-day-four-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-04/03-gosastan-day-four-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-04/04-gosastan-day-four-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-04/05-gosastan-day-four-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-04/06-gosastan-day-four-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-04/07-gosastan-day-four-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-04/08-gosastan-day-four-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-04/09-gosastan-day-four-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-04/10-gosastan-day-four-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-04/11-gosastan-day-four-sleep-meditation.mp3",
    },

    day05: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-05/01-gosastan-day-five-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-05/02-gosastan-day-five-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-05/03-gosastan-day-five-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-05/04-gosastan-day-five-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-05/05-gosastan-day-five-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-05/06-gosastan-day-five-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-05/07-gosastan-day-five-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-05/08-gosastan-day-five-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-05/09-gosastan-day-five-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-05/10-gosastan-day-five-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-05/11-gosastan-day-five-sleep-meditation.mp3",
    },
  },

    sookhtan: {
    day01: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-01/01-gosastan-day-one-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-01/02-gosastan-day-one-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-01/03-gosastan-day-one-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-01/04-gosastan-day-one-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-01/05-gosastan-day-one-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-01/06-gosastan-day-one-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-01/07-gosastan-day-one-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-01/08-gosastan-day-one-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-01/09-gosastan-day-one-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-01/10-gosastan-day-one-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-01/11-gosastan-day-one-sleep-meditation.mp3",
    },

    day02: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-02/01-gosastan-day-two-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-02/02-gosastan-day-two-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-02/03-gosastan-day-two-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-02/04-gosastan-day-two-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-02/05-gosastan-day-two-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-02/06-gosastan-day-two-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-02/07-gosastan-day-two-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-02/08-gosastan-day-two-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-02/09-gosastan-day-two-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-02/10-gosastan-day-two-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-02/11-gosastan-day-two-sleep-meditation.mp3",
    },

    day03: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-03/01-gosastan-day-three-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-03/02-gosastan-day-three-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-03/03-gosastan-day-three-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-03/04-gosastan-day-three-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-03/05-gosastan-day-three-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-03/06-gosastan-day-three-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-03/07-gosastan-day-three-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-03/08-gosastan-day-three-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-03/09-gosastan-day-three-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-03/10-gosastan-day-three-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-03/11-gosastan-day-three-sleep-meditation.mp3",
    },

    day04: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-04/01-gosastan-day-four-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-04/02-gosastan-day-four-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-04/03-gosastan-day-four-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-04/04-gosastan-day-four-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-04/05-gosastan-day-four-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-04/06-gosastan-day-four-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-04/07-gosastan-day-four-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-04/08-gosastan-day-four-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-04/09-gosastan-day-four-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-04/10-gosastan-day-four-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-04/11-gosastan-day-four-sleep-meditation.mp3",
    },

    day05: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-05/01-gosastan-day-five-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-05/02-gosastan-day-five-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-05/03-gosastan-day-five-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-05/04-gosastan-day-five-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-05/05-gosastan-day-five-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-05/06-gosastan-day-five-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-05/07-gosastan-day-five-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-05/08-gosastan-day-five-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-05/09-gosastan-day-five-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-05/10-gosastan-day-five-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-05/11-gosastan-day-five-sleep-meditation.mp3",
    },

    day06: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-06/01-gosastan-day-six-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-06/02-gosastan-day-six-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-06/03-gosastan-day-six-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-06/04-gosastan-day-six-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-06/05-gosastan-day-six-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-06/06-gosastan-day-six-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-06/07-gosastan-day-six-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-06/08-gosastan-day-six-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-06/09-gosastan-day-six-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-06/10-gosastan-day-six-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-06/11-gosastan-day-six-sleep-meditation.mp3",
    },

    day07: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-07/01-gosastan-day-seven-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-07/02-gosastan-day-seven-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-07/03-gosastan-day-seven-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-07/04-gosastan-day-seven-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-07/05-gosastan-day-seven-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-07/06-gosastan-day-seven-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-07/07-gosastan-day-seven-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-07/08-gosastan-day-seven-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-07/09-gosastan-day-seven-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-07/10-gosastan-day-seven-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-07/11-gosastan-day-seven-sleep-meditation.mp3",
    },

    day08: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-08/01-gosastan-day-eight-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-08/02-gosastan-day-eight-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-08/03-gosastan-day-eight-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-08/04-gosastan-day-eight-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-08/05-gosastan-day-eight-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-08/06-gosastan-day-eight-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-08/07-gosastan-day-eight-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-08/08-gosastan-day-eight-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-08/09-gosastan-day-eight-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-08/10-gosastan-day-eight-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-08/11-gosastan-day-eight-sleep-meditation.mp3",
    },

    day09: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-09/01-gosastan-day-nine-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-09/02-gosastan-day-nine-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-09/03-gosastan-day-nine-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-09/04-gosastan-day-nine-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-09/05-gosastan-day-nine-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-09/06-gosastan-day-nine-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-09/07-gosastan-day-nine-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-09/08-gosastan-day-nine-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-09/09-gosastan-day-nine-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-09/10-gosastan-day-nine-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-09/11-gosastan-day-nine-sleep-meditation.mp3",
    },

    day10: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-10/01-gosastan-day-ten-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-10/02-gosastan-day-ten-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-10/03-gosastan-day-ten-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-10/04-gosastan-day-ten-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-10/05-gosastan-day-ten-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-10/06-gosastan-day-ten-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-10/07-gosastan-day-ten-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-10/08-gosastan-day-ten-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-10/09-gosastan-day-ten-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-10/10-gosastan-day-ten-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-10/11-gosastan-day-ten-sleep-meditation.mp3",
    },

    day11: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-11/01-gosastan-day-eleven-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-11/02-gosastan-day-eleven-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-11/03-gosastan-day-eleven-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-11/04-gosastan-day-eleven-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-11/05-gosastan-day-eleven-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-11/06-gosastan-day-eleven-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-11/07-gosastan-day-eleven-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-11/08-gosastan-day-eleven-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-11/09-gosastan-day-eleven-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-11/10-gosastan-day-eleven-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-11/11-gosastan-day-eleven-sleep-meditation.mp3",
    },

    day12: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-12/01-gosastan-day-twelve-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-12/02-gosastan-day-twelve-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-12/03-gosastan-day-twelve-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-12/04-gosastan-day-twelve-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-12/05-gosastan-day-twelve-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-12/06-gosastan-day-twelve-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-12/07-gosastan-day-twelve-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-12/08-gosastan-day-twelve-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-12/09-gosastan-day-twelve-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-12/10-gosastan-day-twelve-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-12/11-gosastan-day-twelve-sleep-meditation.mp3",
    },

    day13: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-13/01-gosastan-day-thirteen-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-13/02-gosastan-day-thirteen-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-13/03-gosastan-day-thirteen-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-13/04-gosastan-day-thirteen-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-13/05-gosastan-day-thirteen-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-13/06-gosastan-day-thirteen-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-13/07-gosastan-day-thirteen-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-13/08-gosastan-day-thirteen-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-13/09-gosastan-day-thirteen-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-13/10-gosastan-day-thirteen-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-13/11-gosastan-day-thirteen-sleep-meditation.mp3",
    },

    day14: {
      morningMeditationMood1To5:
        "media/audio/gosastan/day-14/01-gosastan-day-fourteen-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/gosastan/day-14/02-gosastan-day-fourteen-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/gosastan/day-14/03-gosastan-day-fourteen-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/gosastan/day-14/04-gosastan-day-fourteen-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/gosastan/day-14/05-gosastan-day-fourteen-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/gosastan/day-14/06-gosastan-day-fourteen-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/gosastan/day-14/07-gosastan-day-fourteen-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/gosastan/day-14/08-gosastan-day-fourteen-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/gosastan/day-14/09-gosastan-day-fourteen-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/gosastan/day-14/10-gosastan-day-fourteen-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/gosastan/day-14/11-gosastan-day-fourteen-sleep-meditation.mp3",
    },
  },

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
mashaal01: "media/audio/mashaal/01-what-is-heartbreak.mp3",

mashaal: {
  intro: "media/audio/mashaal/intro-mashaal.mp3",

  lesson01: "media/audio/mashaal/01-what-is-heartbreak.mp3",
  lesson02: "media/audio/mashaal/02-brain-role-in-heartbreak-pain.mp3",
  lesson03: "media/audio/mashaal/03-what-have-i-lost.mp3",
  lesson04: "media/audio/mashaal/04-loving-brain-and-deprived-brain.mp3",
  lesson05: "media/audio/mashaal/05-emotional-grief.mp3",
  lesson06: "media/audio/mashaal/06-relationship-addiction.mp3",
  lesson07: "media/audio/mashaal/07-why-cant-i-let-go.mp3",
  lesson08: "media/audio/mashaal/08-types-of-attachment-dependency.mp3",
  lesson09: "media/audio/mashaal/09-attachment-styles-introduction.mp3",
  lesson10: "media/audio/mashaal/10-schemas-role-in-heartbreak.mp3",
  lesson11: "media/audio/mashaal/11-other-schemas-introduction.mp3",
  lesson12: "media/audio/mashaal/12-why-this-relationship-mattered-so-much.mp3",
  lesson13: "media/audio/mashaal/13-cognitive-distortions.mp3",
  lesson14: "media/audio/mashaal/14-rumination.mp3",
  lesson15: "media/audio/mashaal/15-questions-after-breakup.mp3",
  lesson16: "media/audio/mashaal/16-common-false-beliefs.mp3",
  lesson17: "media/audio/mashaal/17-psychology-of-betrayal.mp3",
  lesson18: "media/audio/mashaal/18-rejection-wound.mp3",
  lesson19: "media/audio/mashaal/19-shame-comparison-self-blame.mp3",
  lesson20: "media/audio/mashaal/20-self-esteem-after-breakup.mp3",
  lesson21: "media/audio/mashaal/21-why-did-this-relationship-end.mp3",
  lesson22: "media/audio/mashaal/22-is-getting-back-together-possible.mp3",
  lesson23: "media/audio/mashaal/23-healthy-love-or-dependency.mp3",
  lesson24: "media/audio/mashaal/24-healthy-relationship-boundaries.mp3",
  lesson25: "media/audio/mashaal/25-deciding-the-path-forward.mp3",
},



  review: {
    danger: "media/audio/review/review-danger.mp3",
    draining: "media/audio/review/review-draining.mp3",
    unstable: "media/audio/review/review-unstable.mp3",
    good: "media/audio/review/review-good.mp3",
    unclear: "media/audio/review/review-unclear.mp3",
  },
} as const;