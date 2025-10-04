import AsyncStorage from "@react-native-async-storage/async-storage";

/** Round to ~city granularity + hour so we reuse cache nearby and per hour */
export const cacheKeyFor = (lat, lon) =>
  `wx:${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}:${new Date()
    .toISOString()
    .slice(0, 13)}`; // YYYY-MM-DDTHH

export async function saveWeather(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

export async function loadWeather(key) {
  try {
    const s = await AsyncStorage.getItem(key);
    if (!s) return null;
    const parsed = JSON.parse(s);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}
