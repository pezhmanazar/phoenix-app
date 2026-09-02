import React from "react";
import {
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

type Props = {
  title: string;
  icon: any;
  bg: string;
  border: string;
  textColor: string;
  onPress?: () => void;
};

export default function DayNode({
  title,
  icon,
  bg,
  border,
  textColor,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.node,
        {
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <Image
        source={icon}
        style={styles.icon}
      />

      <Text
        style={[
          styles.text,
          {
            color: textColor,
          },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  node: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },

  text: {
    position: "absolute",
    bottom: -30,
    fontSize: 12,
    fontWeight: "900",
  },
});