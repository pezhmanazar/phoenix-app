import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

type PracticeTimerProps = {
  durationSeconds: number;
  onComplete?: () => void;
};

const RING_SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PracticeTimer({
  durationSeconds,
  onComplete,
}: PracticeTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setRemainingSeconds(durationSeconds);
    setIsRunning(false);
    setCompleted(false);
  }, [durationSeconds]);

  useEffect(() => {
    if (!isRunning || completed) return;

    if (remainingSeconds <= 0) {
      setIsRunning(false);
      if (!completed) {
        setCompleted(true);
        onComplete?.();
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds, completed, onComplete]);

  useEffect(() => {
    if (remainingSeconds === 0 && !completed) {
      setIsRunning(false);
      setCompleted(true);
      onComplete?.();
    }
  }, [remainingSeconds, completed, onComplete]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }, [remainingSeconds]);

  const progress = useMemo(() => {
    if (durationSeconds <= 0) return 0;
    return (durationSeconds - remainingSeconds) / durationSeconds;
  }, [durationSeconds, remainingSeconds]);

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const handleReset = () => {
    setIsRunning(false);
    setCompleted(false);
    setRemainingSeconds(durationSeconds);
  };

  return (
    <View style={styles.container}>
      <View style={styles.timerShell}>
        <Pressable style={styles.resetButton} onPress={handleReset}>
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path
      d="M4.5 9.5A8 8 0 1 1 7 17"
      stroke="#DDE7DA"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M4.5 4.5v5h5"
      stroke="#DDE7DA"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
</Pressable>

        <View style={styles.ringWrapper}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
            <Defs>
              <LinearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#A7F16B" />
                <Stop offset="100%" stopColor="#7ED957" />
              </LinearGradient>
            </Defs>

            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />

            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="url(#timerGradient)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              rotation={-90}
              originX={RING_SIZE / 2}
              originY={RING_SIZE / 2}
            />
          </Svg>

          <View style={styles.centerContent}>
            <Text style={styles.timeText}>
              {completed ? "00:00" : formattedTime}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.primaryButton, isRunning ? styles.pauseButton : null]}
        onPress={() => {
          if (completed) {
            handleReset();
            setIsRunning(true);
            return;
          }

          setIsRunning((prev) => !prev);
        }}
      >
        {isRunning ? (
          <View style={styles.pauseIcon}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        ) : (
          <View style={styles.playIcon} />
        )}

        <Text
          style={[
            styles.primaryButtonText,
            isRunning ? styles.pauseButtonText : null,
          ]}
        >
          {isRunning ? "توقف" : "شروع"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  timerShell: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  resetButton: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringSvg: {
    position: "absolute",
  },
  centerContent: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(7,19,10,0.72)",
    borderWidth: 1,
    borderColor: "rgba(126,217,87,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1,
  },
  primaryButton: {
    minWidth: 128,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#7ED957",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  pauseButton: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#08120A",
    marginLeft: 2,
  },
  pauseIcon: {
    width: 14,
    height: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  primaryButtonText: {
    color: "#08120A",
    fontWeight: "900",
    fontSize: 14,
  },
  pauseButtonText: {
    color: "#FFFFFF",
  },
});
