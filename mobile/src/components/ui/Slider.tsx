/**
 * Slider — a styled wrapper around @react-native-community/slider.
 * If the native slider package is not installed, falls back to a
 * read-only bar so the settings screen still compiles and renders.
 *
 * In a production Expo app, install:
 *   @react-native-community/slider
 */

import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

interface Props {
  label: string;
  valueLabel: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (v: number) => void;
}

// Lazy-load the native slider; tolerate its absence at compile time.
let NativeSlider: React.ComponentType<Record<string, unknown>> | null = null;
try {
  // The cast through `unknown` keeps tsc from erroring when the package
  // isn't installed in node_modules.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = require("@react-native-community/slider");
  NativeSlider = mod?.default ?? null;
} catch {
  NativeSlider = null;
}

export function Slider({
  label,
  valueLabel,
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
}: Props) {
  const pct = Math.round(
    ((value - minimumValue) / (maximumValue - minimumValue)) * 100,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueLabel}</Text>
      </View>
      {NativeSlider ? (
        <NativeSlider
          style={styles.slider}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={Colors.primary}
        />
      ) : (
        <View style={styles.fallbackBar}>
          <View style={[styles.fallbackFill, { width: `${pct}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  label: {
    color: Colors.textDim,
    fontSize: Typography.caption,
  },
  value: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  fallbackBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  fallbackFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
});