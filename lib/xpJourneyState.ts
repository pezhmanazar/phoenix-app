import AsyncStorage from "@react-native-async-storage/async-storage";

const K_INTRODUCED = "phoenix.xpJourney.introduced.v1";

const K_LAST_SEEN_LEVEL = "phoenix.xpJourney.lastSeenLevel.v1";

export async function getXpJourneyIntroduced() {
  const value = await AsyncStorage.getItem(K_INTRODUCED);

  return value === "1";
}

export async function setXpJourneyIntroduced(value: boolean) {
  await AsyncStorage.setItem(
    K_INTRODUCED,
    value ? "1" : "0",
  );
}

export async function getLastSeenXpLevel() {
  const value = await AsyncStorage.getItem(
    K_LAST_SEEN_LEVEL,
  );

  if (value == null) {
    return 0;
  }

  const n = Number(value);

  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function setLastSeenXpLevel(
  level: number,
) {
  await AsyncStorage.setItem(
    K_LAST_SEEN_LEVEL,
    String(Math.max(0, Math.floor(level))),
  );
}

export async function resetXpJourneyState() {
  await AsyncStorage.multiRemove([
    K_INTRODUCED,
    K_LAST_SEEN_LEVEL,
  ]);
}