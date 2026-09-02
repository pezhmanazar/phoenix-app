import React from "react";
import { StyleSheet } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

type Props = {
  pathD: string;
  done: boolean;
  idleColor: string;
  doneColor: string;
};

export default function PelekanPath({
  pathD,
  done,
  idleColor,
  doneColor,
}: Props) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
    >

      <Defs>
        <LinearGradient
          id="goldPath"
          x1="0.5"
          y1="0"
          x2="0.5"
          y2="1"
        >
          <Stop
            offset="0"
            stopColor="#8A6124"
          />

          <Stop
            offset="0.35"
            stopColor="#F4D27A"
          />

          <Stop
            offset="0.5"
            stopColor="#FFD978"
          />

          <Stop
            offset="0.65"
            stopColor="#C9953E"
          />

          <Stop
            offset="1"
            stopColor="#8A6124"
          />
        </LinearGradient>
      </Defs>


      {/* نور اطراف مسیر */}
      <Path
        d={pathD}
        stroke="#D6A94A"
        strokeWidth={34}
        fill="none"
        strokeLinecap="round"
        opacity={0.12}
      />


      {/* لبه طلایی بیرونی */}
      <Path
        d={pathD}
        stroke="url(#goldPath)"
        strokeWidth={24}
        fill="none"
        strokeLinecap="round"
      />


      {/* بدنه تیره مسیر */}
      <Path
        d={pathD}
        stroke="#121212"
        strokeWidth={17}
        fill="none"
        strokeLinecap="round"
      />


      {/* مسیر پیشرفت */}
      <Path
        d={pathD}
        stroke={done ? doneColor : idleColor}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />

    </Svg>
  );
}