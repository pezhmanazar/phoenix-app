import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { AchievementItem } from "../../api/achievements";

type Props = {
  item: AchievementItem;
  featured?: boolean;
};

function toPersianDigits(value: string | number) {
  return String(value).replace(
    /\d/g,
    (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)],
  );
}

function formatEarnedDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    ).format(date);
  } catch {
    return toPersianDigits(
      date.toLocaleDateString(),
    );
  }
}

function getAchievementIcon(
  code: string,
): keyof typeof Ionicons.glyphMap {
  if (code.startsWith("NO_CONTACT_")) {
    return "shield-checkmark";
  }

  if (code === "PHOENIX_RESISTANCE") {
    return "shield";
  }

  if (code === "STEEL_CONTINUITY") {
    return "diamond";
  }

  if (code === "GOLDEN_PHOENIX") {
    return "trophy";
  }

  return "medal";
}

function getUnlockedAccent(code: string) {
  if (code === "GOLDEN_PHOENIX") {
    return "#F6C453";
  }

  if (code === "STEEL_CONTINUITY") {
    return "#CBD5E1";
  }

  if (code === "PHOENIX_RESISTANCE") {
    return "#F59E0B";
  }

  if (code.startsWith("NO_CONTACT_")) {
    return "#34D399";
  }

  return "#D4AF37";
}

export default function AchievementCard({
  item,
  featured = false,
}: Props) {
  const unlocked = item.unlocked;

  const accent = unlocked
    ? getUnlockedAccent(item.code)
    : "#60646C";

  const earnedDate = formatEarnedDate(
    item.earnedAt,
  );

  return (
    <View
      style={[
        styles.card,
        featured
          ? styles.featuredCard
          : styles.normalCard,

        unlocked
          ? {
              borderColor: `${accent}66`,
              backgroundColor: `${accent}10`,
            }
          : styles.lockedCard,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          featured && styles.featuredGlow,
          {
            backgroundColor: unlocked
              ? `${accent}18`
              : "rgba(120,120,120,.07)",
          },
        ]}
      />

      <View
        style={[
          styles.medallionOuter,
          featured &&
            styles.featuredMedallionOuter,
          {
            borderColor: unlocked
              ? `${accent}99`
              : "rgba(255,255,255,.09)",
          },
        ]}
      >
        <View
          style={[
            styles.medallionInner,
            featured &&
              styles.featuredMedallionInner,
            {
              backgroundColor: unlocked
                ? `${accent}1F`
                : "#25282D",
            },
          ]}
        >
          <Ionicons
            name={getAchievementIcon(
              item.code,
            )}
            size={featured ? 42 : 31}
            color={
              unlocked
                ? accent
                : "#686D75"
            }
          />

          {!unlocked ? (
            <View style={styles.lockBadge}>
              <Ionicons
                name="lock-closed"
                size={10}
                color="#A3A7AE"
              />
            </View>
          ) : (
            <View
              style={[
                styles.unlockBadge,
                {
                  backgroundColor: accent,
                },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={11}
                color="#111318"
              />
            </View>
          )}
        </View>
      </View>

      <Text
        style={[
          styles.title,
          featured && styles.featuredTitle,
          !unlocked &&
            styles.lockedTitle,
        ]}
      >
        {item.titleFa}
      </Text>

      {featured ? (
        <Text
          style={[
            styles.description,
            !unlocked &&
              styles.lockedDescription,
          ]}
        >
          {item.description ||
            "بالاترین دستاورد مسیر ققنوس"}
        </Text>
      ) : null}

      <View style={styles.statusWrap}>
        {unlocked ? (
          <>
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={accent}
            />

            <Text
              style={[
                styles.statusText,
                { color: accent },
              ]}
            >
              کسب شده
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color="#737780"
            />

            <Text style={styles.lockedStatus}>
              قفل
            </Text>
          </>
        )}
      </View>

      {unlocked && earnedDate ? (
        <Text style={styles.dateText}>
          {earnedDate}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
  },

  normalCard: {
    width: "47.8%",
    minHeight: 205,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },

  featuredCard: {
    width: "100%",
    minHeight: 285,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 25,
  },

  lockedCard: {
    borderColor: "rgba(255,255,255,.075)",
    backgroundColor: "rgba(70,73,79,.13)",
  },

  glow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    top: -45,
  },

  featuredGlow: {
    width: 260,
    height: 260,
    top: -100,
  },

  medallionOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,.25)",
    marginBottom: 13,
  },

  featuredMedallionOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    marginBottom: 18,
  },

  medallionInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
  },

  featuredMedallionInner: {
    width: 98,
    height: 98,
    borderRadius: 49,
  },

  lockBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#383C43",
    borderWidth: 2,
    borderColor: "#171A1F",
    alignItems: "center",
    justifyContent: "center",
  },

  unlockBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 20,
    minHeight: 40,
  },

  featuredTitle: {
    fontSize: 18,
    minHeight: 0,
  },

  lockedTitle: {
    color: "#8B9099",
  },

  description: {
    marginTop: 8,
    color: "#C9CDD4",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },

  lockedDescription: {
    color: "#737780",
  },

  statusWrap: {
    marginTop: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "900",
  },

  lockedStatus: {
    color: "#737780",
    fontSize: 10,
    fontWeight: "800",
  },

  dateText: {
    marginTop: 5,
    color: "#8D939C",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
});