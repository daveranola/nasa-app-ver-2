import dayjs from "dayjs";

/**
 * Decide if a slot is "bad weather" and generate advice.
 * Tweak thresholds to taste.
 */
export function assessSlot(slot) {
  const cold = slot.tempC <= 3;             // very cold
  const veryHot = slot.tempC >= 30;         // very hot
  const heavyRain = slot.precipMM >= 2.0;   // ≥2 mm in the hour
  const rain = slot.precipMM >= 0.2;        // any notable rain
  const windy = slot.windMS >= 10;          // ~36 km/h

  const reasons = [];
  if (heavyRain) reasons.push("heavy rain");
  else if (rain) reasons.push("rain");
  if (windy) reasons.push("strong wind");
  if (cold) reasons.push("cold");
  if (veryHot) reasons.push("heat");

  const isBad = reasons.length > 0;

  let advice = "Normal conditions.";
  if (isBad) {
    if (heavyRain) advice = "Bring a sturdy umbrella and waterproof jacket.";
    else if (rain) advice = "Pack an umbrella or raincoat.";
    if (windy) advice += " Wear a windbreaker and secure loose items.";
    if (cold) advice += " Dress warmly (coat, gloves).";
    if (veryHot) advice += " Stay hydrated and wear sunscreen.";
  }

  return { isBad, reasons, advice: advice.trim() };
}

/** Find the next bad slot and return it (or null) */
export function findNextBadWeatherSlot(forecast) {
  const now = dayjs();
  return forecast.find(s => dayjs(s.time).isAfter(now) && assessSlot(s).isBad) || null;
}
