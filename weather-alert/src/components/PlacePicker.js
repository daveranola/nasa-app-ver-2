// src/components/PlacePicker.js
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { searchPlaces } from "../services/geocode";

export default function PlacePicker({ visible, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const debRef = useRef(null);
  const abortRef = useRef(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (!visible) {
      setQ("");
      setResults([]);
      setLoading(false);
      setError(null);
      // cancel any inflight
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    // Debounce user input
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      // Cancel previous search if still running
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const query = q.trim();
      if (!query) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const items = await searchPlaces(query, controller.signal);
        setResults(items);
      } catch (e) {
        if (e.name === "AbortError") {
          // Swallow aborts (user kept typing)
        } else {
          setError("Search failed. Check your connection.");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [q, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <MaterialCommunityIcons name="map-search" size={22} style={s.headerIcon} />
            <Text style={s.headerText}>Choose a place</Text>
          </View>

          <View style={s.inputWrap}>
            <MaterialCommunityIcons name="magnify" size={18} style={s.searchIcon} />
            <TextInput
              style={s.input}
              placeholder="City, country… (e.g., Dublin, Ireland)"
              placeholderTextColor="#8b93a7"
              value={q}
              onChangeText={setQ}
              autoFocus
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {q ? (
              <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#93a1bd" />
              </TouchableOpacity>
            ) : null}
          </View>

          {loading && (
            <View style={s.loading}>
              <ActivityIndicator />
              <Text style={s.muted}>Searching…</Text>
            </View>
          )}

          {!!error && !loading && (
            <View style={s.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ff9a9a" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={(item, idx) => `${item.lat},${item.lon}:${idx}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => {
                  onSelect?.(item); // {label, lat, lon, city, country}
                  onClose?.();
                }}
              >
                <MaterialCommunityIcons name="map-marker" size={20} style={s.rowIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {item.city ? `${item.city}` : ""}{item.city && item.country ? ", " : ""}{item.country || ""}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              !loading && !error && q ? (
                <View style={s.empty}>
                  <Text style={s.muted}>No results</Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingVertical: 8 }}
          />

          <TouchableOpacity style={s.close} onPress={onClose}>
            <Text style={s.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#10131a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "80%",
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
      },
    }),
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  headerIcon: { color: "#9cc3ff" },
  headerText: { color: "#eef3ff", fontWeight: "800", fontSize: 18 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchIcon: { color: "#aab3c7", marginRight: 6 },
  input: { flex: 1, color: "#e7eefc", paddingVertical: 8 },
  clearBtn: { padding: 4, marginLeft: 6 },

  loading: { alignItems: "center", gap: 6, paddingVertical: 12 },
  muted: { color: "#9aa3b5" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,90,90,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,90,90,0.25)",
  },
  errorText: { color: "#ff9a9a", fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowIcon: { color: "#9ecbff" },
  rowTitle: { color: "#eaf1ff", fontWeight: "700" },
  rowSub: { color: "#a9b3c8", marginTop: 2, fontSize: 12 },

  empty: { alignItems: "center", paddingVertical: 16 },

  close: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  closeText: { color: "#dbe7ff", fontWeight: "700" },
});
