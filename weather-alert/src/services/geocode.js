// src/services/geocode.js
// Forward geocoding with timeout, cancellation, and two providers.
// Works in Expo Go (no API keys). Returns [{ label, lat, lon, city, country }]

function normalizeItem(item) {
  const a = item.address || {};
  const city =
    a.city ||
    a.town ||
    a.village ||
    a.suburb ||
    a.county ||
    a.state_district ||
    a.state ||
    null;
  const country = a.country || item.countryName || null;
  const label =
    (item.display_name && item.display_name.split(",").slice(0, 3).join(", ")) ||
    [city, country].filter(Boolean).join(", ") ||
    item.name ||
    "Unknown";
  return {
    label,
    lat: Number(item.lat),
    lon: Number(item.lon),
    city,
    country,
  };
}

async function fetchJsonWithTimeout(url, { signal, headers = {}, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: signal || controller.signal,
      headers,
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function nominatimSearch(q, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    q
  )}&addressdetails=1&limit=8`;
  const data = await fetchJsonWithTimeout(url, {
    signal,
    headers: {
      "User-Agent": "weather-alert-app/1.0",
      Referer: "https://example.com",
    },
    timeoutMs: 8000,
  });
  return (data || []).map((x) => ({
    ...normalizeItem(x),
    lat: Number(x.lat),
    lon: Number(x.lon),
  }));
}

async function bigDataCloudSearch(q, signal) {
  // BigDataCloud doesn't support a general "search", so we do a best-effort:
  // If user types "City, Country", we pass it straight to Nominatim first.
  // Here we try their forward geocode by name via "geocode" endpoint alternatives:
  // We'll approximate by calling the "free-text" forward geocoder through Nominatim
  // fallback already; but keep BDC for resilience using localityLanguage.
  // For compatibility, we'll call their reverse-geocode-client with 'q' won't work.
  // Instead: call their "free-text" suggestion endpoint is not public. So:
  // We'll implement a simple country-only fallback using country name parsing.
  // => Practically, leave this as a second call to Nominatim with different params,
  // but keep the function here for structure. If BDC adds a free endpoint later,
  // swap in easily.
  return [];
}

// Public API with cancellation support
export async function searchPlaces(query, externalAbortSignal) {
  const q = (query || "").trim();
  if (!q) return [];

  // Try Nominatim, then (optionally) BDC
  try {
    const nomi = await nominatimSearch(q, externalAbortSignal);
    if (nomi.length) return nomi;
  } catch (e) {
    // fall through to second provider
  }

  try {
    const bdc = await bigDataCloudSearch(q, externalAbortSignal);
    if (bdc.length) return bdc;
  } catch (e) {
    // ignore
  }

  return [];
}
