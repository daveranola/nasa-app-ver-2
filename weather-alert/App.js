import React, { useEffect, useMemo } from "react";
import {
  StatusBar,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import useWeather from "./src/hooks/useWeather";
import WeatherCard from "./src/components/WeatherCard";
import { askNotificationPermission } from "./src/notifications/notificationService";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(utc);
dayjs.extend(relativeTime);

export default function App() {
  const { status, error, current, forecast, locationInfo } = useWeather();

  useEffect(() => {
    (async () => {
      try {
        await askNotificationPermission();
      } catch (e) {
        console.warn("Notifications setup:", e.message);
      }
    })();
  }, []);

  const headerSubtitle = useMemo(() => {
    if (status === "done" && current?.time) {
      return `Updated ${dayjs(current.time).local().fromNow()}`;
    }
    if (status === "loading") return "Fetching your local weather…";
    return "Weather alerts an hour ahead";
  }, [status, current]);

  // compute once, reused by all rows
  const maxRain = useMemo(
    () =>
      Math.max(
        0,
        ...forecast.map((f) => (Number.isFinite(f.precipMM) ? f.precipMM : 0))
      ),
    [forecast]
  );

  // ✅ Build a location label from whatever we have
  const locationLabel = useMemo(() => {
    const parts = [
      locationInfo?.city || null,
      locationInfo?.country || null,
    ].filter(Boolean);
    if (parts.length) return parts.join(", ");
    if (locationInfo?.lat != null && locationInfo?.lon != null) {
      return `${Number(locationInfo.lat).toFixed(3)}, ${Number(locationInfo.lon).toFixed(3)}`;
    }
    return "Locating…";
  }, [locationInfo]);

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={["#0e0f12", "#121520", "#0a0c12"]}
        style={{ flex: 1 }}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle="light-content" />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <MaterialCommunityIcons
                name="weather-cloudy-clock"
                size={28}
                style={styles.titleIcon}
              />
              <Text style={styles.h1}>Weather Alert</Text>
            </View>

            {/* LOCATION */}
            <View style={styles.locPill}>
              <MaterialCommunityIcons name="map-marker" size={16} style={styles.locIcon} />
              <Text style={styles.locText}>{locationLabel}</Text>
            </View>

            <Text style={styles.sub}>{headerSubtitle}</Text>
          </View>

          <View style={styles.content}>
            {status === "loading" && (
              <View style={styles.centerCard}>
                <ActivityIndicator />
                <Text style={styles.muted}>Loading weather…</Text>
              </View>
            )}

            {status === "error" && (
              <View style={[styles.centerCard, styles.errorCard]}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={20}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorText}>Error: {error}</Text>
                <Text style={styles.mutedSmall}>
                  Check your internet connection and Meteomatics credentials.
                </Text>
              </View>
            )}

            {status === "done" && (
              <>
                {/* Current conditions */}
                <View style={styles.block}>
                  <WeatherCard current={current} />
                </View>

                {/* Forecast list */}
                <Text style={styles.h2}>Next hours</Text>
                <View style={styles.listCard}>
                  <FlatList
                    data={forecast}
                    keyExtractor={(item) => item.time}
                    ItemSeparatorComponent={() => <View style={styles.sep} />}
                    contentContainerStyle={{ paddingVertical: 6 }}
                    initialNumToRender={12}
                    windowSize={8}
                    removeClippedSubviews
                    renderItem={({ item }) => (
                      <ForecastRow item={item} maxRain={maxRain} />
                    )}
                    showsVerticalScrollIndicator={false}
                  />
                </View>

                <View style={styles.infoBar}>
                  <MaterialCommunityIcons
                    name="bell-alert"
                    size={18}
                    style={{ marginRight: 8, color: "#ffd89a" }}
                  />
                  <Text style={styles.infoText}>
                    We’ll notify you <Text style={styles.bold}>1 hour before</Text>{" "}
                    the next bad weather window (rain, strong wind, very hot/cold).
                  </Text>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

/* ---------- Pretty forecast row with rain bars ---------- */
function ForecastRow({ item, maxRain = 1 }) {
  const temp = Math.round(item.tempC);
  const rain = Number(item.precipMM ?? 0);
  const windKmh = Math.round((item.windMS || 0) * 3.6);

  const chips = [];
  if (windKmh >= 25) chips.push({ icon: "weather-windy", label: `${windKmh} km/h` });

  const iconName =
    rain >= 2
      ? "weather-pouring"
      : rain >= 0.2
      ? "weather-rainy"
      : temp <= 3
      ? "snowflake"
      : temp >= 30
      ? "white-balance-sunny"
      : "weather-partly-cloudy";

  const pct = Math.min(100, Math.round((rain / Math.max(maxRain, 0.1)) * 100));

  return (
    <View style={rowStyles.row}>
      {/* left: time + icon */}
      <View style={rowStyles.left}>
        <MaterialCommunityIcons name={iconName} size={22} style={rowStyles.rowIcon} />
        <Text style={rowStyles.time}>{dayjs(item.time).local().format("HH:mm")}</Text>
      </View>

      {/* center: temp */}
      <Text style={rowStyles.temp}>{temp}°C</Text>

      {/* right: rain bar + value + chips */}
      <View style={rowStyles.right}>
        <View style={rowStyles.rainTop}>
          <Text style={rowStyles.rainLabel}>Rain</Text>
          <Text style={rowStyles.rainValue}>{rain.toFixed(1)} mm</Text>
        </View>

        <View style={rowStyles.barTrack}>
          <View style={[rowStyles.barFill, { width: `${pct}%` }]} />
        </View>

        <View style={rowStyles.chipsWrap}>
          {chips.map((c, idx) => (
            <View key={idx} style={rowStyles.chip}>
              <MaterialCommunityIcons name={c.icon} size={14} style={rowStyles.chipIcon} />
              <Text style={rowStyles.chipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleIcon: { color: "#9cc3ff" },
  h1: { color: "#eaf0ff", fontSize: 28, fontWeight: "800", letterSpacing: 0.3 },

  // Location pill
  locPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(156,195,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(156,195,255,0.25)",
  },
  locIcon: { color: "#bcd6ff" },
  locText: { color: "#dbe7ff", fontWeight: "700", letterSpacing: 0.2 },

  sub: { color: "#98a2b3", marginTop: 4 },

  content: { paddingHorizontal: 16, gap: 14, flex: 1 },
  block: { borderRadius: 18, overflow: "hidden" },

  centerCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 8,
    ...elevate(8),
  },

  errorCard: { borderWidth: 1, borderColor: "rgba(255,90,90,0.35)" },
  errorIcon: { color: "#ff7a7a" },
  errorText: { color: "#ff9a9a", fontWeight: "700" },
  muted: { color: "#9aa0a6" },
  mutedSmall: { color: "#86909c", fontSize: 12 },

  h2: { color: "#e8ecf8", fontSize: 18, fontWeight: "700", marginTop: 4, marginLeft: 4 },

  listCard: {
    backgroundColor: "rgba(18,22,32,0.75)",
    borderRadius: 16,
    paddingHorizontal: 8,
    ...elevate(6),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  sep: { height: 8 },

  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,215,130,0.08)",
  },
  infoText: { color: "#e9edf5", flex: 1, lineHeight: 18 },
  bold: { fontWeight: "800" },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8, width: 84 },
  rowIcon: { color: "#9ecbff" },
  time: { color: "#e6ebf7", fontWeight: "700", letterSpacing: 0.4 },

  temp: { color: "#e6ebf7", fontWeight: "800", width: 60, textAlign: "center" },

  right: { flex: 1, marginLeft: 8 },

  rainTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  rainLabel: { color: "#aab6c6", fontSize: 12, fontWeight: "600" },
  rainValue: { color: "#dce7f8", fontSize: 12, fontWeight: "800" },

  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(130,170,255,0.18)",
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(130,170,255,0.9)",
  },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(90,140,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(112,160,255,0.25)",
  },
  chipIcon: { color: "#b8d2ff" },
  chipText: { color: "#dbe7ff", fontSize: 12, fontWeight: "600" },

  okChip: {
    color: "#b7f5c9",
    backgroundColor: "rgba(80,200,120,0.15)",
    borderColor: "rgba(80,200,120,0.25)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    overflow: "hidden",
  },
});

/* Utility shadow/elevation */
function elevate(e = 6) {
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: e,
      shadowOffset: { width: 0, height: e / 2 },
    },
    android: { elevation: e },
    default: {},
  });
}
