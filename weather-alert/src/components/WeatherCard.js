import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { assessSlot } from "../utils/weatherLogic";

export default function WeatherCard({ current }) {
  if (!current) return null;

  const assess = assessSlot(current);
  const temp = Math.round(current.tempC);
  const rain = Number(current.precipMM ?? 0);
  const windKmh = Math.round((current.windMS || 0) * 3.6);

  const iconName = useMemo(() => {
    if (rain >= 2) return "weather-pouring";
    if (rain >= 0.2) return "weather-rainy";
    if (temp <= 3) return "snowflake";
    if (temp >= 30) return "white-balance-sunny";
    return "weather-partly-cloudy";
  }, [rain, temp]);

  const headline = useMemo(() => {
    if (rain >= 2) return "Heavy rain";
    if (rain >= 0.2) return "Rain";
    if (temp <= 3) return "Very cold";
    if (temp >= 30) return "Very hot";
    if (windKmh >= 36) return "Windy";
    return "Calm";
  }, [rain, temp, windKmh]);

  const gradient = assess.isBad
    ? ["#2a1b0b", "#1a1410", "#121319"]
    : ["#131722", "#141a26", "#101216"];

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <View style={[styles.card, assess.isBad && styles.badBorder]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <MaterialCommunityIcons name="clock-outline" size={18} style={styles.titleIcon} />
            <Text style={styles.title}>Right now</Text>
          </View>
          <Text style={styles.timestamp}>{dayjs(current.time).local().format("HH:mm")}</Text>
        </View>

        {/* Main row: icon + temp + condition */}
        <View style={styles.mainRow}>
          <MaterialCommunityIcons name={iconName} size={44} style={styles.weatherIcon} />
          <Text style={styles.temp}>{temp}°C</Text>
          <Text style={styles.condition}>{headline}</Text>
        </View>

        {/* Metrics row */}
        <View style={styles.metrics}>
          <Metric label="Rain (1h)" value={`${rain.toFixed(1)} mm`} icon="umbrella-outline" />
          <Metric label="Wind" value={`${windKmh} km/h`} icon="weather-windy" />
        </View>

        {/* Advice */}
        <View style={[styles.adviceBar, assess.isBad ? styles.adviceBad : styles.adviceOk]}>
          <MaterialCommunityIcons
            name={assess.isBad ? "alert-decagram" : "emoticon-happy-outline"}
            size={18}
            style={assess.isBad ? styles.adviceIconBad : styles.adviceIconOk}
          />
          <Text style={[styles.adviceText, assess.isBad ? styles.adviceTextBad : styles.adviceTextOk]}>
            {assess.isBad ? assess.advice : "All good. Enjoy your day!"}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function Metric({ label, value, icon }) {
  return (
    <View style={styles.metricChip}>
      <MaterialCommunityIcons name={icon} size={16} style={styles.metricIcon} />
      <View style={{ gap: 2 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: "hidden",
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...elevate(8),
    gap: 12,
  },
  badBorder: {
    borderColor: "rgba(255,160,80,0.35)",
  },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  titleIcon: { color: "#9ec2ff" },
  title: { fontSize: 16, fontWeight: "800", color: "#eaf0ff", letterSpacing: 0.2 },
  timestamp: { color: "#9aa3b2", fontSize: 12 },

  mainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  weatherIcon: { color: "#bcd7ff" },
  temp: { fontSize: 42, fontWeight: "900", color: "#e6ebf7", letterSpacing: 0.5 },
  condition: { color: "#c9d4e6", fontSize: 16, fontWeight: "700", flex: 1 },

  metrics: {
    flexDirection: "row",
    gap: 10,
  },
  metricChip: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricIcon: { color: "#b9cef8" },
  metricLabel: { color: "#8fa0b8", fontSize: 12, fontWeight: "600" },
  metricValue: { color: "#e7ecf8", fontSize: 14, fontWeight: "800" },

  adviceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  adviceOk: { backgroundColor: "rgba(80,200,120,0.12)", borderWidth: 1, borderColor: "rgba(80,200,120,0.25)" },
  adviceBad: { backgroundColor: "rgba(255,180,80,0.12)", borderWidth: 1, borderColor: "rgba(255,180,80,0.25)" },
  adviceIconOk: { color: "#a6f7c4" },
  adviceIconBad: { color: "#ffd29a" },
  adviceText: { flex: 1, lineHeight: 18 },
  adviceTextOk: { color: "#dff5e8", fontWeight: "600" },
  adviceTextBad: { color: "#ffe8c6", fontWeight: "700" },
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
