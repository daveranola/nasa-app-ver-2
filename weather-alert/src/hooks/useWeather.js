import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import dayjs from "dayjs";
import { getWeather } from "../services/meteomatics";
import { assessSlot, findNextBadWeatherSlot } from "../utils/weatherLogic";
import { scheduleWeatherAlert } from "../notifications/notificationService";
import { saveWeather, loadWeather, cacheKeyFor } from "../services/cache";

// Fallback if location is denied/slow: Dublin
const FALLBACK = { lat: 53.3501, lon: -6.2661 };
// Auto-refresh cadence
const POLL_MS = 5 * 60 * 1000;

// Simple retry helper
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

// Robust reverse geocoding (Expo first, web fallback)
async function reverseGeocodeRobust(lat, lon) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const r = results?.[0];
    const city = r?.city || r?.subregion || r?.district || r?.name || r?.region || null;
    const country = r?.country || null;
    if (city || country) return { city, country };
  } catch {}

  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
    const res = await fetch(url, { headers: { "User-Agent": "weather-alert-app/1.0" } });
    if (res.ok) {
      const j = await res.json();
      const city =
        j.city ||
        j.locality ||
        j.localityInfo?.administrative?.[0]?.name ||
        j.principalSubdivision ||
        null;
      const country = j.countryName || null;
      if (city || country) return { city, country };
    }
  } catch {}

  return { city: null, country: null };
}

export default function useWeather() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [locationInfo, setLocationInfo] = useState({
    lat: null,
    lon: null,
    city: null,
    country: null,
  });

  // Guards & timers
  const startedRef = useRef(false);
  const lastNotifiedISORef = useRef(null);
  const intervalRef = useRef(null);
  const lastFetchRef = useRef(0);

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      // Don’t stack requests; load() itself also guards on "loading"
      load();
    }, POLL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (status === "loading") return; // re-entrancy guard

    try {
      setStatus("loading");
      setError(null);

      // Permission (don’t hard-fail; we’ll use fallback)
      await Location.requestForegroundPermissionsAsync().catch(() => null);

      // 1) Last known location (fast)
      let last = await Location.getLastKnownPositionAsync().catch(() => null);
      let lat = last?.coords?.latitude;
      let lon = last?.coords?.longitude;

      // Show cached immediately if we have something and this is first run
      if (lat != null && lon != null && lastFetchRef.current === 0 && status === "idle") {
        const key = cacheKeyFor(lat, lon);
        const cached = await loadWeather(key);
        if (cached) {
          setCurrent(cached.current);
          setForecast(cached.forecast);
          setStatus("done");
        }
      }

      // 2) Fresh fix (cap to 4s)
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

      // Save coords + resolve city/country (don’t block network fetch)
      setLocationInfo((prev) => ({ ...prev, lat, lon }));
      reverseGeocodeRobust(lat, lon)
        .then(({ city, country }) => setLocationInfo((prev) => ({ ...prev, city, country })))
        .catch(() => {});

      // 3) Weather fetch with timeout + 1 retry
      const data = await withRetry(() => getWeather(lat, lon), 2);

      // Update only when changed
      const changed =
        !current ||
        forecast.length !== data.forecast.length ||
        current.time !== data.current.time;

      if (changed) {
        setCurrent(data.current);
        setForecast(data.forecast);
        saveWeather(cacheKeyFor(lat, lon), data);
      }

      // 4) Schedule alert once per new bad slot
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

      lastFetchRef.current = Date.now();
      setStatus("done");
    } catch (e) {
      console.log("[useWeather] load error:", e);
      if (!current || forecast.length === 0) setStatus("error");
      setError(e.message ?? String(e));
    }
  }, [status, current, forecast.length]);

  // Run once on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load();
  }, [load]);

  // Start/stop the 5-min timer based on app active state
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // If we’ve been away longer than POLL_MS, refresh immediately
        if (Date.now() - lastFetchRef.current > POLL_MS) {
          load();
        }
        startTimer();
      } else {
        stopTimer();
      }
    });

    // Start timer immediately if app is already active
    startTimer();

    return () => {
      sub.remove();
      stopTimer();
    };
  }, [load, startTimer, stopTimer]);

  return { status, error, current, forecast, locationInfo, refresh: load };
}
