import axios from "axios";
import Constants from "expo-constants";
import dayjs from "dayjs";

const { METEOMATICS_USERNAME, METEOMATICS_PASSWORD } = Constants.expoConfig.extra ?? {};

const BASE = "https://api.meteomatics.com";

/**
 * Fetches:
 * - now: t_2m:C, precip_1h:mm, wind_speed_10m:ms, weather_symbol_1h:idx
 * - next 6 hours hourly
 */
export async function getWeather(lat, lon) {
  if (!METEOMATICS_USERNAME || !METEOMATICS_PASSWORD) {
    throw new Error("Missing Meteomatics credentials. Add them to .env and app.config.js");
  }

  const auth = {
    username: METEOMATICS_USERNAME,
    password: METEOMATICS_PASSWORD
  };

  const params = "t_2m:C,precip_1h:mm,wind_speed_10m:ms,weather_symbol_1h:idx";
  const nowUTC = dayjs().utc();
  const start = nowUTC.format("YYYY-MM-DDTHH:mm:ss[Z]");
  const end = nowUTC.add(6, "hour").format("YYYY-MM-DDTHH:mm:ss[Z]");
  const step = "PT1H";

  // Current snapshot
  const currentUrl = `${BASE}/${start}/${params}/${lat},${lon}/json?model=mix`;

  // Range for next hours
  const rangeUrl = `${BASE}/${start}--${end}:${step}/${params}/${lat},${lon}/json?model=mix`;

  const [currentRes, rangeRes] = await Promise.all([
    axios.get(currentUrl, { auth }),
    axios.get(rangeUrl, { auth })
  ]);

  const current = parseMeteomatics(currentRes.data);
  const forecast = parseMeteomatics(rangeRes.data);

  return { current: current[0], forecast };
}

/** Convert Meteomatics JSON into a friendly array of hour slots */
function parseMeteomatics(json) {
  // structure: { data: [ { parameter, coordinates: [ { dates: [ { date, value }, ...] } ] } ] }
  const map = {};
  json?.data?.forEach(series => {
    const key = series.parameter;
    const dates = series.coordinates?.[0]?.dates ?? [];
    dates.forEach((d, idx) => {
      if (!map[idx]) map[idx] = { time: d.date };
      map[idx][key] = d.value;
    });
  });
  // Remap to array and friendly keys
  return Object.values(map).map(x => ({
    time: x.time,
    tempC: x["t_2m:C"],
    precipMM: x["precip_1h:mm"],
    windMS: x["wind_speed_10m:ms"],
    symbol: x["weather_symbol_1h:idx"]
  }));
}
