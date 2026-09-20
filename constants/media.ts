// constants/media.ts

const MEDIA_BASE = "https://media.qoqnoos.app/";

export const mediaUrl = (key: string) =>
  `${MEDIA_BASE}${key.split("/").map(encodeURIComponent).join("/")}`;

/**
 * 🔊 Audio keys (S3)
 * نکته: اینجا فقط KEY ذخیره می‌کنیم، نه URL کامل.
 * URL را با mediaUrl(key) می‌سازیم.
 */
export const AUDIO_KEYS = {
  introOverall: "media/audio/intro/intro-overall.mp3",

  bastanIntro: "media/audio/bastan/intro-bastan.mp3",

  gosastanIntro: "media/audio/gosastan/intro-gosastan.mp3",

  sookhtanIntro: "media/audio/sookhtan/intro-sookhtan.mp3",

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
        "media/audio/sookhtan/day-01/01-sookhtan-day-one-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-01/02-sookhtan-day-one-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-01/03-sookhtan-day-one-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-01/04-sookhtan-day-one-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-01/05-sookhtan-day-one-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-01/06-sookhtan-day-one-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-01/07-sookhtan-day-one-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-01/08-sookhtan-day-one-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-01/09-sookhtan-day-one-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-01/10-sookhtan-day-one-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-01/11-sookhtan-day-one-sleep-meditation.mp3",
    },

    day02: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-02/01-sookhtan-day-two-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-02/02-sookhtan-day-two-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-02/03-sookhtan-day-two-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-02/04-sookhtan-day-two-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-02/05-sookhtan-day-two-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-02/06-sookhtan-day-two-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-02/07-sookhtan-day-two-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-02/08-sookhtan-day-two-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-02/09-sookhtan-day-two-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-02/10-sookhtan-day-two-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-02/11-sookhtan-day-two-sleep-meditation.mp3",
    },

    day03: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-03/01-sookhtan-day-three-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-03/02-sookhtan-day-three-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-03/03-sookhtan-day-three-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-03/04-sookhtan-day-three-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-03/05-sookhtan-day-three-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-03/06-sookhtan-day-three-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-03/07-sookhtan-day-three-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-03/08-sookhtan-day-three-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-03/09-sookhtan-day-three-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-03/10-sookhtan-day-three-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-03/11-sookhtan-day-three-sleep-meditation.mp3",
    },

    day04: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-04/01-sookhtan-day-four-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-04/02-sookhtan-day-four-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-04/03-sookhtan-day-four-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-04/04-sookhtan-day-four-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-04/05-sookhtan-day-four-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-04/06-sookhtan-day-four-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-04/07-sookhtan-day-four-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-04/08-sookhtan-day-four-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-04/09-sookhtan-day-four-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-04/10-sookhtan-day-four-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-04/11-sookhtan-day-four-sleep-meditation.mp3",
    },

    day05: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-05/01-sookhtan-day-five-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-05/02-sookhtan-day-five-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-05/03-sookhtan-day-five-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-05/04-sookhtan-day-five-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-05/05-sookhtan-day-five-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-05/06-sookhtan-day-five-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-05/07-sookhtan-day-five-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-05/08-sookhtan-day-five-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-05/09-sookhtan-day-five-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-05/10-sookhtan-day-five-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-05/11-sookhtan-day-five-sleep-meditation.mp3",
    },

    day06: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-06/01-sookhtan-day-six-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-06/02-sookhtan-day-six-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-06/03-sookhtan-day-six-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-06/04-sookhtan-day-six-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-06/05-sookhtan-day-six-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-06/06-sookhtan-day-six-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-06/07-sookhtan-day-six-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-06/08-sookhtan-day-six-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-06/09-sookhtan-day-six-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-06/10-sookhtan-day-six-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-06/11-sookhtan-day-six-sleep-meditation.mp3",
    },

    day07: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-07/01-sookhtan-day-seven-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-07/02-sookhtan-day-seven-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-07/03-sookhtan-day-seven-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-07/04-sookhtan-day-seven-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-07/05-sookhtan-day-seven-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-07/06-sookhtan-day-seven-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-07/07-sookhtan-day-seven-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-07/08-sookhtan-day-seven-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-07/09-sookhtan-day-seven-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-07/10-sookhtan-day-seven-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-07/11-sookhtan-day-seven-sleep-meditation.mp3",
    },

    day08: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-08/01-sookhtan-day-eight-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-08/02-sookhtan-day-eight-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-08/03-sookhtan-day-eight-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-08/04-sookhtan-day-eight-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-08/05-sookhtan-day-eight-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-08/06-sookhtan-day-eight-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-08/07-sookhtan-day-eight-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-08/08-sookhtan-day-eight-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-08/09-sookhtan-day-eight-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-08/10-sookhtan-day-eight-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-08/11-sookhtan-day-eight-sleep-meditation.mp3",
    },

    day09: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-09/01-sookhtan-day-nine-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-09/02-sookhtan-day-nine-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-09/03-sookhtan-day-nine-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-09/04-sookhtan-day-nine-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-09/05-sookhtan-day-nine-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-09/06-sookhtan-day-nine-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-09/07-sookhtan-day-nine-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-09/08-sookhtan-day-nine-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-09/09-sookhtan-day-nine-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-09/10-sookhtan-day-nine-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-09/11-sookhtan-day-nine-sleep-meditation.mp3",
    },

    day10: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-10/01-sookhtan-day-ten-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-10/02-sookhtan-day-ten-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-10/03-sookhtan-day-ten-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-10/04-sookhtan-day-ten-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-10/05-sookhtan-day-ten-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-10/06-sookhtan-day-ten-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-10/07-sookhtan-day-ten-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-10/08-sookhtan-day-ten-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-10/09-sookhtan-day-ten-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-10/10-sookhtan-day-ten-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-10/11-sookhtan-day-ten-sleep-meditation.mp3",
    },

    day11: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-11/01-sookhtan-day-eleven-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-11/02-sookhtan-day-eleven-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-11/03-sookhtan-day-eleven-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-11/04-sookhtan-day-eleven-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-11/05-sookhtan-day-eleven-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-11/06-sookhtan-day-eleven-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-11/07-sookhtan-day-eleven-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-11/08-sookhtan-day-eleven-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-11/09-sookhtan-day-eleven-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-11/10-sookhtan-day-eleven-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-11/11-sookhtan-day-eleven-sleep-meditation.mp3",
    },

    day12: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-12/01-sookhtan-day-twelve-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-12/02-sookhtan-day-twelve-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-12/03-sookhtan-day-twelve-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-12/04-sookhtan-day-twelve-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-12/05-sookhtan-day-twelve-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-12/06-sookhtan-day-twelve-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-12/07-sookhtan-day-twelve-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-12/08-sookhtan-day-twelve-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-12/09-sookhtan-day-twelve-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-12/10-sookhtan-day-twelve-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-12/11-sookhtan-day-twelve-sleep-meditation.mp3",
    },

    day13: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-13/01-sookhtan-day-thirteen-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-13/02-sookhtan-day-thirteen-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-13/03-sookhtan-day-thirteen-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-13/04-sookhtan-day-thirteen-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-13/05-sookhtan-day-thirteen-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-13/06-sookhtan-day-thirteen-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-13/07-sookhtan-day-thirteen-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-13/08-sookhtan-day-thirteen-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-13/09-sookhtan-day-thirteen-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-13/10-sookhtan-day-thirteen-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-13/11-sookhtan-day-thirteen-sleep-meditation.mp3",
    },

    day14: {
      morningMeditationMood1To5:
        "media/audio/sookhtan/day-14/01-sookhtan-day-fourteen-morning-meditation-mood-1-to-5.mp3",
      morningMeditationMood6To10:
        "media/audio/sookhtan/day-14/02-sookhtan-day-fourteen-morning-meditation-mood-6-to-10.mp3",
      sunMeditation:
        "media/audio/sookhtan/day-14/03-sookhtan-day-fourteen-sun-meditation.mp3",
      morningStretchMeditation:
        "media/audio/sookhtan/day-14/04-sookhtan-day-fourteen-morning-stretch-meditation.mp3",
      specialMeditation:
        "media/audio/sookhtan/day-14/05-sookhtan-day-fourteen-special-meditation.mp3",
      nightMeditationMood1To5:
        "media/audio/sookhtan/day-14/06-sookhtan-day-fourteen-night-meditation-mood-1-to-5.mp3",
      nightMeditationMood6To10:
        "media/audio/sookhtan/day-14/07-sookhtan-day-fourteen-night-meditation-mood-6-to-10.mp3",
      gratitude:
        "media/audio/sookhtan/day-14/08-sookhtan-day-fourteen-gratitude.mp3",
      nightStretchMeditation:
        "media/audio/sookhtan/day-14/09-sookhtan-day-fourteen-night-stretch-meditation.mp3",
      beforeSleepMeditation:
        "media/audio/sookhtan/day-14/10-sookhtan-day-fourteen-before-sleep-meditation.mp3",
      sleepMeditation:
        "media/audio/sookhtan/day-14/11-sookhtan-day-fourteen-sleep-meditation.mp3",
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
    inCrowdFeelAlone01:
      "media/audio/panahgah/techniques/in-crowd-feel-alone-01.mp3",
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
    lesson12:
      "media/audio/mashaal/12-why-this-relationship-mattered-so-much.mp3",
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
