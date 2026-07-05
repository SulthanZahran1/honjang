/**
 * HistoryScreen — fetches session list from VPS, displays sessions with
 * date, model, turn count. Tap to expand and see full transcript.
 *
 * Endpoints:
 *   GET {baseUrl}/api/sessions
 *   GET {baseUrl}/api/sessions/{id}/turns
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../constants/theme";
import { SettingsService } from "../services/SettingsService";

interface Session {
  id: number;
  llm_model: string;
  started_at: string | null;
  ended_at: string | null;
}

interface Turn {
  id: number;
  direction: string;
  original_text: string;
  translated_text: string;
  detected_language: string | null;
  timestamp: string | null;
}

function wsToHttp(wsUrl: string): string {
  // ws://host:port/ws → http://host:port
  const http = wsUrl
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
  // strip trailing /ws path
  return http.replace(/\/ws\/?$/, "");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function directionLabel(direction: string): string {
  switch (direction) {
    case "en_to_ko":
      return "EN → KO";
    case "ko_to_en":
      return "KO → EN";
    default:
      return direction;
  }
}

export function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await SettingsService.load();
      const http = wsToHttp(s.vpsUrl);
      setBaseUrl(http);
      const res = await fetch(`${http}/api/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Session[];
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const toggleSession = useCallback(
    async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        setTurns([]);
        return;
      }
      setExpandedId(id);
      setTurns([]);
      setTurnsLoading(true);
      try {
        const res = await fetch(`${baseUrl}/api/sessions/${id}/turns`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Turn[];
        setTurns(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load turns");
      } finally {
        setTurnsLoading(false);
      }
    },
    [baseUrl, expandedId],
  );

  const renderItem = ({ item }: { item: Session }) => {
    const expanded = expandedId === item.id;
    return (
      <View style={styles.sessionCard}>
        <Pressable
          style={styles.sessionHeader}
          onPress={() => toggleSession(item.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionDate}>{formatDate(item.started_at)}</Text>
            <Text style={styles.sessionModel} numberOfLines={1}>
              {item.llm_model}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.textDim}
          />
        </Pressable>

        {expanded && (
          <View style={styles.turnsContainer}>
            {turnsLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : turns.length === 0 ? (
              <Text style={styles.emptyTurns}>No turns recorded.</Text>
            ) : (
              turns.map((turn) => (
                <View key={turn.id} style={styles.turnItem}>
                  <View style={styles.turnHeader}>
                    <Text style={styles.turnDirection}>
                      {directionLabel(turn.direction)}
                    </Text>
                    <Text style={styles.turnTime}>
                      {formatDate(turn.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.turnOriginal}>{turn.original_text}</Text>
                  <Text style={styles.turnTranslated}>{turn.translated_text}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>History</Text>
        <Pressable onPress={fetchSessions} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerMsg}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerMsg}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchSessions}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerMsg}>
          <Text style={styles.emptyText}>No sessions yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  screenTitle: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: Spacing.sm,
  },
  list: {
    padding: Spacing.md,
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  sessionDate: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: "600",
  },
  sessionModel: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    marginTop: 2,
  },
  turnsContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  turnItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  turnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  turnDirection: {
    color: Colors.primary,
    fontSize: Typography.small,
    fontWeight: "700",
  },
  turnTime: {
    color: Colors.textMuted,
    fontSize: Typography.small,
  },
  turnOriginal: {
    color: Colors.textDim,
    fontSize: Typography.caption,
    marginBottom: 2,
  },
  turnTranslated: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: "600",
  },
  centerMsg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.body,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: Typography.body,
  },
  emptyTurns: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    textAlign: "center",
    paddingVertical: Spacing.sm,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: Typography.body,
    fontWeight: "700",
  },
});