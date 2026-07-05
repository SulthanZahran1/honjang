/**
 * DirectionButtons — three buttons: EN→KO, KO→EN, Auto.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../constants/theme";
import type { TranslationDirection } from "../types/protocol";

interface Props {
  direction: TranslationDirection;
  onChange: (d: TranslationDirection) => void;
}

const OPTIONS: { label: string; value: TranslationDirection }[] = [
  { label: "EN→KO", value: "en_to_ko" },
  { label: "KO→EN", value: "ko_to_en" },
  { label: "Auto", value: "auto" },
];

export function DirectionButtons({ direction, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = direction === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.btn, active && styles.btnActive]}
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
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnActive: {
    backgroundColor: Colors.surfaceAlt,
    borderColor: Colors.primary,
  },
  label: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
  labelActive: {
    color: Colors.text,
  },
});