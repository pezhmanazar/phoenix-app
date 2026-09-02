import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  title: string;
  icon: any;
  bg: string;
  border: string;
  textColor: string;
  onPress?: () => void;
  disabled?: boolean;
};

export default function ActionNode({
  title,
  icon,
  bg,
  border,
  textColor,
  onPress,
  disabled,
}: Props) {
  const content = (
    <View
      style={[
        styles.node,
        {
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <Image source={icon} style={styles.icon} />

      <Text style={[styles.text, { color: textColor }]}>
        {title}
      </Text>
    </View>
  );

  if (disabled) return content;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  node: {
    width: 58,
    height: 58,
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
    bottom: -24,
    fontSize: 11,
    fontWeight: "800",
  },
});