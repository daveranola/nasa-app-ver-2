import axios from "axios";
import Constants from "expo-constants";
import dayjs from "dayjs";

// Safely read Expo extra in Expo Go & dev builds
const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest2?.extra ??
  Constants.manifest?.extra ??
  {};

const { METEOMATICS_USERNAME, METEOMATICS_PASSWORD } = extra;

const BASE = "https://api.meteomatics.com";
const PARAMS = "t_2m:C,precip_1h:mm,wind_speed_10m:ms,weather_symbol_1h:idx";

/**
 * One fast call for "now + next 6 hours"; first item is your "current".
 * Has a hard 12s timeout so it never hangs.
 */
export async function getWeather(lat, lon) {
  if (!METEOMATICS_USERNAME || !METEOMATICS_PASSWORD) {
    throw new Error(
      "Missing Meteomatics credentials (.env/app.config.js). Restart with `npm start -c` after changes."
    );
  }

  const auth = { username: METEOMATICS_USERNAME, password: METEOMATICS_PASSWORD };
  const nowUTC = dayjs().utc();
  const start = nowUTC.format("YYYY-MM-DDTHH:mm:ss[Z]");
  const end   = nowUTC.add(6, "hour").format("YYYY-MM-DDTHH:mm:ss[Z]");
  const step  = "PT1H";
  const url   = `${BASE}/${start}--${end}:${step}/${PARAMS}/${lat},${lon}/json?model=mix`;

  try {
    const res = await axios.get(url, { auth, timeout: 12000 });
    const arr = parse(res.data);
    return { current: arr[0], forecast: arr };
  } catch (e) {
    const code = e.response?.status;
    if (code === 401) throw new Error("401 Unauthorized from Meteomatics — check username/password.");
    if (e.code === "ECONNABORTED") throw new Error("Weather request timed out.");
    throw new Error(`Meteomatics error: ${code || ""} ${e.message}`);
  }
}

function parse(json) {
  // Convert Meteomatics shape into array of hourly slots
  const map = {};
  json?.data?.forEach((series) => {
    const key = series.parameter;
    const dates = series.coordinates?.[0]?.dates ?? [];
    dates.forEach((d, i) => {
      if (!map[i]) map[i] = { time: d.date };
      map[i][key] = d.value;
    });
  });
  return Object.values(map).map((x) => ({
    time: x.time,
    tempC: x["t_2m:C"],
    precipMM: x["precip_1h:mm"],
    windMS: x["wind_speed_10m:ms"],
    symbol: x["weather_symbol_1h:idx"],
  }));
}
