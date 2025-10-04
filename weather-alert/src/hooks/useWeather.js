import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import dayjs from "dayjs";
import { getWeather } from "../services/meteomatics";
import { assessSlot, findNextBadWeatherSlot } from "../utils/weatherLogic";
import { scheduleWeatherAlert } from "../notifications/notificationService";

export default function useWeather() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission denied");

      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      setCoords({ lat, lon });

      const data = await getWeather(lat, lon);
      setCurrent(data.current);
      setForecast(data.forecast);

      // schedule alert for next bad weather (1 hour before)
      const nextBad = findNextBadWeatherSlot(data.forecast);
      if (nextBad) {
        const assess = assessSlot(nextBad);
        const eventTime = dayjs(nextBad.time);
        const notifyAt = eventTime.subtract(1, "hour");

        await scheduleWeatherAlert({
          when: notifyAt,
          title: "Incoming bad weather",
          body: `${assess.reasons.join(", ")} around ${eventTime.local().format("HH:mm")}. ${assess.advice}`
        });
      }

      setStatus("done");
    } catch (e) {
      setError(e.message ?? String(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { status, error, coords, current, forecast };
}
