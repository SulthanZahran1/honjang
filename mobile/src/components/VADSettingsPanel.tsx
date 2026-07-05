/**
 * VADSettingsPanel — sliders for VAD parameters.
 */

import { StyleSheet, Text, View } from "react-native";
import { Slider } from "./ui/Slider";
import { Colors, Spacing, Typography } from "../constants/theme";
import type { VADSettings } from "../types/settings";

interface Props {
  vad: VADSettings;
  onChange: (patch: Partial<VADSettings>) => void;
}

export function VADSettingsPanel({ vad, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>VAD Parameters</Text>

      <Slider
        label="Silence threshold"
        valueLabel={`${vad.vad_min_silence_ms} ms`}
        value={vad.vad_min_silence_ms}
        minimumValue={200}
        maximumValue={800}
        step={10}
        onValueChange={(v) => onChange({ vad_min_silence_ms: Math.round(v) })}
      />

      <Slider
        label="Pause threshold"
        valueLabel={`${vad.vad_pause_threshold.toFixed(1)} s`}
        value={vad.vad_pause_threshold}
        minimumValue={0.5}
        maximumValue={2.0}
        step={0.1}
        onValueChange={(v) =>
          onChange({ vad_pause_threshold: Math.round(v * 10) / 10 })
        }
      />

      <Slider
        label="Utterance end timeout"
        valueLabel={`${vad.vad_utterance_end_ms} ms`}
        value={vad.vad_utterance_end_ms}
        minimumValue={500}
        maximumValue={3000}
        step={50}
        onValueChange={(v) => onChange({ vad_utterance_end_ms: Math.round(v) })}
      />

      <Slider
        label="Activation threshold"
        valueLabel={vad.vad_activation_threshold.toFixed(2)}
        value={vad.vad_activation_threshold}
        minimumValue={0.3}
        maximumValue={0.9}
        step={0.05}
        onValueChange={(v) =>
          onChange({ vad_activation_threshold: Math.round(v * 100) / 100 })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: Typography.heading,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
});