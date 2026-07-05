/**
 * ModeToggle — segmented control for Pipeline / Voice Agent mode.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../constants/theme";
import type { TranslatorMode } from "../types/protocol";

interface Props {
  mode: TranslatorMode;
  onChange: (m: TranslatorMode) => void;
}

const OPTIONS: { label: string; value: TranslatorMode }[] = [
  { label: "Pipeline", value: "pipeline" },
  { label: "Voice Agent", value: "raw_voice_agent" },
];

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 2,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
  labelActive: {
    color: "#fff",
  },
});