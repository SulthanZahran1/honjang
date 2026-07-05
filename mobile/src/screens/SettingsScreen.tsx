/**
 * SettingsScreen — configuration form.
 *
 * Sections:
 *   - Connection (VPS URL)
 *   - LLM (model + role)
 *   - TTS (model toggle + voice ID)
 *   - Relationship (user role, senior role, politeness, context, topic)
 *   - VAD Parameters (sliders)
 */

import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Typography } from "../constants/theme";
import { VADSettingsPanel } from "../components/VADSettingsPanel";
import { SettingsService } from "../services/SettingsService";
import {
  AppSettings,
  LLM_MODEL_SUGGESTIONS,
  LLMRole,
  PolitenessLevel,
  TTSModel,
} from "../types/settings";

export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void SettingsService.load().then(setSettings);
  }, []);

  const patch = useCallback(async (p: Partial<AppSettings>) => {
    const next = await SettingsService.update(p);
    setSettings(next);
  }, []);

  if (!settings) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <Text style={styles.fieldLabel}>VPS URL</Text>
          <TextInput
            style={styles.input}
            value={settings.vpsUrl}
            onChangeText={(v) => patch({ vpsUrl: v })}
            placeholder="ws://localhost:8000/ws"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* LLM */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LLM</Text>
          <Text style={styles.fieldLabel}>OpenRouter Model ID</Text>
          <TextInput
            style={styles.input}
            value={settings.llmModel}
            onChangeText={(v) => patch({ llmModel: v })}
            placeholder="google/gemini-3.1-flash-lite"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.suggestionLabel}>Suggestions:</Text>
          {LLM_MODEL_SUGGESTIONS.map((s) => (
            <Pressable
              key={s.value}
              style={styles.suggestionBtn}
              onPress={() => patch({ llmModel: s.value })}
            >
              <Text style={styles.suggestionText}>
                {s.label} — <Text style={styles.suggestionValue}>{s.value}</Text>
              </Text>
            </Pressable>
          ))}

          <Text style={styles.fieldLabel}>LLM Role</Text>
          <View style={styles.toggleRow}>
            {(["translator", "interpreter"] as LLMRole[]).map((role) => (
              <Pressable
                key={role}
                style={[
                  styles.toggleBtn,
                  settings.llmRole === role && styles.toggleBtnActive,
                ]}
                onPress={() => patch({ llmRole: role })}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    settings.llmRole === role && styles.toggleLabelActive,
                  ]}
                >
                  {role === "translator" ? "Pure Translator" : "Conversational Interpreter"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* TTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TTS</Text>
          <Text style={styles.fieldLabel}>ElevenLabs Model</Text>
          <View style={styles.toggleRow}>
            {(["eleven_flash_v2_5", "eleven_v3"] as TTSModel[]).map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.toggleBtn,
                  settings.ttsModel === m && styles.toggleBtnActive,
                ]}
                onPress={() => patch({ ttsModel: m })}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    settings.ttsModel === m && styles.toggleLabelActive,
                  ]}
                >
                  {m === "eleven_flash_v2_5" ? "Flash v2.5" : "v3"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>ElevenLabs Voice ID</Text>
          <TextInput
            style={styles.input}
            value={settings.elevenlabsVoiceId}
            onChangeText={(v) => patch({ elevenlabsVoiceId: v })}
            placeholder="Voice ID (optional)"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Relationship */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship</Text>

          <Text style={styles.fieldLabel}>Your Role</Text>
          <TextInput
            style={styles.input}
            value={settings.userRole}
            onChangeText={(v) => patch({ userRole: v })}
            placeholder="a junior employee"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Senior Role</Text>
          <TextInput
            style={styles.input}
            value={settings.seniorRole}
            onChangeText={(v) => patch({ seniorRole: v })}
            placeholder="a senior colleague in Korea"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Politeness Level</Text>
          <View style={styles.toggleRow}>
            {(["auto", "합쇼체", "해요체"] as PolitenessLevel[]).map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.toggleBtn,
                  settings.politenessLevel === p && styles.toggleBtnActive,
                ]}
                onPress={() => patch({ politenessLevel: p })}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    settings.politenessLevel === p && styles.toggleLabelActive,
                  ]}
                >
                  {p === "auto" ? "Auto" : p}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Context</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={settings.context}
            onChangeText={(v) => patch({ context: v })}
            placeholder="Additional context (optional)"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Topic</Text>
          <TextInput
            style={styles.input}
            value={settings.topic}
            onChangeText={(v) => patch({ topic: v })}
            placeholder="technical stuff"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* VAD */}
        <VADSettingsPanel
          vad={settings.vad}
          onChange={(vadPatch) =>
            patch({ vad: { ...settings.vad, ...vadPatch } })
          }
        />

        {/* Reset */}
        <Pressable
          style={styles.resetBtn}
          onPress={async () => {
            const defaults = await SettingsService.reset();
            setSettings(defaults);
          }}
        >
          <Text style={styles.resetBtnText}>Reset to Defaults</Text>
        </Pressable>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: Colors.textDim,
    fontSize: Typography.body,
  },
  scroll: {
    padding: Spacing.md,
  },
  screenTitle: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  section: {
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
  fieldLabel: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
  },
  suggestionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.small,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  suggestionBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 6,
    marginBottom: 4,
  },
  suggestionText: {
    color: Colors.textDim,
    fontSize: Typography.small,
  },
  suggestionValue: {
    color: Colors.primary,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAlt,
  },
  toggleLabel: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
  toggleLabelActive: {
    color: Colors.text,
  },
  resetBtn: {
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  resetBtnText: {
    color: "#fff",
    fontSize: Typography.body,
    fontWeight: "700",
  },
});