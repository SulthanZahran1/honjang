/**
 * TranscriptView — scrollable list of transcript entries.
 * Each entry shows direction arrow, original text, translated text.
 */

import { useEffect, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors, Spacing, Typography } from "../constants/theme";
import type { TranscriptEntry } from "../hooks/useTranslator";

interface Props {
  entries: TranscriptEntry[];
  interimText: string;
}

function directionArrow(direction: string): string {
  switch (direction) {
    case "en_to_ko":
      return "EN → KO";
    case "ko_to_en":
      return "KO → EN";
    default:
      return "→";
  }
}

function Entry({ item }: { item: TranscriptEntry }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <Text style={styles.direction}>{directionArrow(item.direction)}</Text>
        {item.detectedLanguage ? (
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>
              {item.detectedLanguage.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.original}>{item.originalText}</Text>
      <Text style={styles.translated}>{item.translatedText}</Text>
    </View>
  );
}

export function TranscriptView({ entries, interimText }: Props) {
  const listRef = useRef<FlatList<TranscriptEntry>>(null);

  useEffect(() => {
    if (entries.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [entries.length, interimText]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Entry item={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No transcript yet. Tap the mic to start.</Text>
        }
        ListFooterComponent={
          interimText ? (
            <View style={styles.interimBox}>
              <Text style={styles.interimLabel}>Listening…</Text>
              <Text style={styles.interimText}>{interimText}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  entry: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  direction: {
    color: Colors.primary,
    fontSize: Typography.small,
    fontWeight: "700",
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
  original: {
    color: Colors.textDim,
    fontSize: Typography.body,
    marginBottom: Spacing.xs,
  },
  translated: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: "600",
  },
  empty: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  interimBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  interimLabel: {
    color: Colors.primary,
    fontSize: Typography.small,
    marginBottom: Spacing.xs,
  },
  interimText: {
    color: Colors.text,
    fontSize: Typography.body,
  },
});