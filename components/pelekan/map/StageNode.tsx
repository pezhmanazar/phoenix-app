import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";

type Props = {
  stage: any;
  stageIcon: any;

  bg: string;
  border: string;
  labelColor: string;

  status: "done" | "active" | "locked";

  onPress?: () => void;
  disabled?: boolean;
};

export default function StageNode({
  stage,
  stageIcon,
  bg,
  border,
  labelColor,
  status,
  onPress,
  disabled,
}: Props) {

const isDone = status === "done";
const isActive = status === "active";

  const glowColor = isDone
    ? "#22C55E"
    : isActive
      ? "#D4AF37"
      : "#64748B";

  const content = (
    <View style={styles.wrapper}>
      <View style={styles.hexContainer}>

        <Svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
        >

          {/* هاله نور بیرونی */}
          <Polygon
            points="
              50,2
              86,20
              98,50
              86,80
              50,98
              14,80
              2,50
              14,20
            "
            fill={glowColor}
            opacity={0.18}
          />


          {/* بدنه اصلی شش ضلعی */}
          <Polygon
            points="
              50,8
              82,24
              92,50
              82,76
              50,92
              18,76
              8,50
              18,24
            "
            fill={bg}
            stroke={border}
            strokeWidth="3"
          />


          {/* لبه داخلی برای عمق */}
          <Polygon
            points="
              50,14
              76,28
              84,50
              76,72
              50,86
              24,72
              16,50
              24,28
            "
            fill="none"
            stroke={glowColor}
            strokeWidth="1.5"
            opacity={0.55}
          />

        </Svg>

        <Image
          source={stageIcon}
          style={styles.icon}
        />

      </View>

      <Text
        style={[
          styles.text,
          {
            color: labelColor,
          },
        ]}
      >
        {stage.titleFa}
      </Text>

    </View>
  );

  if (disabled) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({

  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  hexContainer: {
    width: 100,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    position: "absolute",
    width: 50,
    height: 50,
    resizeMode: "contain",
  },

  text: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
  },

});