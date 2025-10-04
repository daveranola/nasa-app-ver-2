import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import dayjs from "dayjs";
import { getWeather } from "../services/meteomatics";
import { assessSlot, findNextBadWeatherSlot } from "../utils/weatherLogic";
import { scheduleWeatherAlert } from "../notifications/notificationService";
import { saveWeather, loadWeather, cacheKeyFor } from "../services/cache";

// Fallback if location is denied/slow: Dublin
const FALLBACK = { lat: 53.3501, lon: -6.2661 };

async function withRetry(fn, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

export default function useWeather() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);

  // Prevent double-invoke in React 18 StrictMode (dev) and re-entrancy
  const startedRef = useRef(false);

  // Don’t re-schedule the same alert repeatedly
  const lastNotifiedISORef = useRef(null);

  const load = useCallback(async () => {
    // Re-entrancy guard (in case refresh is spammed)
    if (status === "loading") return;

    try {
      setStatus("loading");
      setError(null);

      // Ask for permission (don’t throw if denied; we’ll fallback)
      await Location.requestForegroundPermissionsAsync().catch(() => null);

      // 1) Use last known location immediately (fast)
      let last = await Location.getLastKnownPositionAsync().catch(() => null);
      let lat = last?.coords?.latitude;
      let lon = last?.coords?.longitude;

      // Show cached data instantly if we have a key
      if (lat != null && lon != null && status === "idle") {
        const key = cacheKeyFor(lat, lon);
        const cached = await loadWeather(key);
        if (cached) {
          setCurrent(cached.current);
          setForecast(cached.forecast);
          setStatus("done"); // instant render
        }
      }

      // 2) Race a fresh fix, but cap to 4s so we never hang
      try {
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("loc-timeout")), 4000)),
        ]);
        lat = fresh.coords.latitude;
        lon = fresh.coords.longitude;
      } catch {
        if (lat == null || lon == null) {
          lat = FALLBACK.lat;
          lon = FALLBACK.lon;
        }
      }

      // 3) Fetch weather with 12s timeout + 1 retry
      const data = await withRetry(() => getWeather(lat, lon), 2);

      // Only update state if changed (tiny guard against useless re-renders)
      const changed =
        !current ||
        !forecast ||
        forecast.length !== data.forecast.length ||
        current.time !== data.current.time;

      if (changed) {
        setCurrent(data.current);
        setForecast(data.forecast);
        saveWeather(cacheKeyFor(lat, lon), data);
      }

      // 4) Schedule the next bad-weather alert only if it’s new
      const nextBad = findNextBadWeatherSlot(data.forecast);
      if (nextBad && lastNotifiedISORef.current !== nextBad.time) {
        const assess = assessSlot(nextBad);
        const eventTime = dayjs(nextBad.time);
        const notifyAt = eventTime.subtract(1, "hour");

        await scheduleWeatherAlert({
          when: notifyAt,
          title: "Incoming bad weather",
          body: `${assess.reasons.join(", ")} around ${eventTime.local().format("HH:mm")}. ${assess.advice}`,
        });

        lastNotifiedISORef.current = nextBad.time;
      }

      setStatus("done");
    } catch (e) {
      console.log("[useWeather] load error:", e);
      if (!current || forecast.length === 0) setStatus("error");
      setError(e.message ?? String(e));
    }
  }, [status, current, forecast.length]);

  // Run once on mount (guard against StrictMode double-effect)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load();
  }, [load]);

  // Expose manual refresh if you add pull-to-refresh in App.js
  return { status, error, current, forecast, refresh: load };
}
