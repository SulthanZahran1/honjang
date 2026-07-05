/**
 * ConversationScreen — the main translator screen.
 *
 * Layout (top → bottom):
 *   - ModeToggle (Pipeline / Voice Agent)
 *   - DirectionButtons (EN→KO / KO→EN / Auto)
 *   - LLM role toggle (Pure Translator / Conversational Interpreter)
 *   - Detected language badge
 *   - Status indicator
 *   - TranscriptView (flex)
 *   - Push-to-talk button (pipeline) OR always-on indicator (voice agent)
 */

import { useEffect } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../constants/theme";
import { ModeToggle } from "../components/ModeToggle";
import { DirectionButtons } from "../components/DirectionButtons";
import { TranscriptView } from "../components/TranscriptView";
import { useTranslator } from "../hooks/useTranslator";
import { LLMRole } from "../types/settings";

const STATUS_COLORS: Record<string, string> = {
  idle: Colors.textMuted,
  connecting: Colors.warning,
  connected: Colors.success,
  listening: Colors.primary,
  translating: Colors.warning,
  speaking: Colors.accent,
  error: Colors.error,
  disconnected: Colors.textMuted,
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  connected: "Connected",
  listening: "Listening…",
  translating: "Translating…",
  speaking: "Speaking…",
  error: "Error",
  disconnected: "Disconnected",
};

export function ConversationScreen() {
  const t = useTranslator();
  const pulseAnim = new Animated.Value(0.4);

  // Pulse animation for "always-on" indicator
  useEffect(() => {
    if (t.mode !== "raw_voice_agent") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = STATUS_COLORS[t.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[t.status] ?? t.status;

  const handleMicPress = async () => {
    if (t.isRecording) {
      await t.stopTalking();
    } else {
      await t.startTalking();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Mode + Direction + Role controls */}
      <View style={styles.controlsBar}>
        <ModeToggle mode={t.mode} onChange={t.setMode} />
        <DirectionButtons direction={t.direction} onChange={t.setDirection} />

        <View style={styles.roleRow}>
          <Pressable
            style={[
              styles.roleBtn,
              t.llmRole === "translator" && styles.roleBtnActive,
            ]}
            onPress={() => t.setLlmRole("translator" as LLMRole)}
          >
            <Text
              style={[
                styles.roleLabel,
                t.llmRole === "translator" && styles.roleLabelActive,
              ]}
            >
              Pure Translator
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.roleBtn,
              t.llmRole === "interpreter" && styles.roleBtnActive,
            ]}
            onPress={() => t.setLlmRole("interpreter" as LLMRole)}
          >
            <Text
              style={[
                styles.roleLabel,
                t.llmRole === "interpreter" && styles.roleLabelActive,
              ]}
            >
              Conversational Interpreter
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Status + detected language */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>{statusLabel}</Text>
        {t.detectedLanguage ? (
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>
              {t.detectedLanguage.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {t.wsStatus !== "connected" && t.wsStatus !== "connecting" && t.wsStatus !== "reconnecting" ? (
          <Pressable style={styles.connectBtn} onPress={t.connect}>
            <Text style={styles.connectBtnText}>Connect</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Transcript */}
      <TranscriptView entries={t.transcript} interimText={t.interimText} />

      {/* Bottom action area */}
      <View style={styles.bottomBar}>
        {t.mode === "pipeline" ? (
          <Pressable
            style={[
              styles.micBtn,
              t.isRecording && styles.micBtnActive,
            ]}
            onPressIn={handleMicPress}
            onPressOut={handleMicPress}
          >
            <Ionicons
              name={t.isRecording ? "stop-circle" : "mic-circle"}
              size={72}
              color={t.isRecording ? Colors.accent : Colors.primary}
            />
            <Text style={styles.micLabel}>
              {t.isRecording ? "Release to stop" : "Hold to talk"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.alwaysOnBox}>
            <Animated.View
              style={[styles.pulseDot, { opacity: pulseAnim }]}
            />
            <Text style={styles.alwaysOnLabel}>Always-on listening</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  controlsBar: {
    paddingBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  roleBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAlt,
  },
  roleLabel: {
    color: Colors.textDim,
    fontSize: Typography.small,
    fontWeight: "600",
  },
  roleLabelActive: {
    color: Colors.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Colors.textDim,
    fontSize: Typography.caption,
  },
  langBadge: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  langBadgeText: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: "700",
  },
  connectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  connectBtnText: {
    color: "#fff",
    fontSize: Typography.caption,
    fontWeight: "700",
  },
  bottomBar: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  micBtn: {
    alignItems: "center",
  },
  micBtnActive: {},
  micLabel: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    marginTop: 4,
  },
  alwaysOnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  alwaysOnLabel: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: "600",
  },
});