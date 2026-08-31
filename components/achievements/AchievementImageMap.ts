import type { ImageSourcePropType } from "react-native";

type AchievementImagePair = {
  unlocked: ImageSourcePropType;
  locked: ImageSourcePropType;
};

const ACHIEVEMENT_IMAGES: Record<string, AchievementImagePair> = {
  BASTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/bastan_complete.png"),
    locked: require("../../assets/achievements/bastan_complete_locked.png"),
  },

  NO_CONTACT_10: {
    unlocked: require("../../assets/achievements/no_contact_10.png"),
    locked: require("../../assets/achievements/no_contact_10_locked.png"),
  },

  GOSASTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/gosastan_complete.png"),
    locked: require("../../assets/achievements/gosastan_complete_locked.png"),
  },

  NO_CONTACT_21: {
    unlocked: require("../../assets/achievements/no_contact_21.png"),
    locked: require("../../assets/achievements/no_contact_21_locked.png"),
  },

  SOOKHTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/sookhtan_complete.png"),
    locked: require("../../assets/achievements/sookhtan_complete_locked.png"),
  },

  PHOENIX_RESISTANCE: {
    unlocked: require("../../assets/achievements/phoenix_resistance.png"),
    locked: require("../../assets/achievements/phoenix_resistance_locked.png"),
  },

  SERESHTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/sereshtan_complete.png"),
    locked: require("../../assets/achievements/sereshtan_complete_locked.png"),
  },

  NO_CONTACT_40: {
    unlocked: require("../../assets/achievements/no_contact_40.png"),
    locked: require("../../assets/achievements/no_contact_40_locked.png"),
  },

  ZIESTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/ziestan_complete.png"),
    locked: require("../../assets/achievements/ziestan_complete_locked.png"),
  },

  SAKHTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/sakhtan_complete.png"),
    locked: require("../../assets/achievements/sakhtan_complete_locked.png"),
  },

  STEEL_CONTINUITY: {
    unlocked: require("../../assets/achievements/steel_continuity.png"),
    locked: require("../../assets/achievements/steel_continuity_locked.png"),
  },

  RASTAN_COMPLETE: {
    unlocked: require("../../assets/achievements/rastan_complete.png"),
    locked: require("../../assets/achievements/rastan_complete_locked.png"),
  },

  GOLDEN_PHOENIX: {
    unlocked: require("../../assets/achievements/golden_phoenix.png"),
    locked: require("../../assets/achievements/golden_phoenix_locked.png"),
  },
};

export function getAchievementImage(
  code: string,
  unlocked: boolean,
): ImageSourcePropType | null {
  const images = ACHIEVEMENT_IMAGES[code];

  if (!images) {
    return null;
  }

  return unlocked ? images.unlocked : images.locked;
}
