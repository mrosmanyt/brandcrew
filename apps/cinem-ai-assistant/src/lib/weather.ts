/**
 * Weather tool — Open-Meteo (free, no API key).
 */
export type WeatherReport = {
  city: string;
  country?: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  condition: string;
  forecast: { time: string; tempC: number; condition: string }[];
};

const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

export function parseWeatherQuery(text: string): string | null {
  const t = text.trim();
  const m =
    t.match(/\bweather(?:\s+in|\s+for|\s+at)?\s+(.+?)(?:\?|$)/i) ||
    t.match(/\bforecast(?:\s+for|\s+in)?\s+(.+?)(?:\?|$)/i) ||
    t.match(/\btemperature(?:\s+in|\s+at)?\s+(.+?)(?:\?|$)/i) ||
    t.match(/\bhow(?:'s| is) the weather in\s+(.+?)(?:\?|$)/i);
  if (!m) return null;
  return m[1]
    .replace(/\b(today|now|please|right now)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isWeatherCommand(text: string): boolean {
  return parseWeatherQuery(text) !== null;
}

async function geocode(city: string): Promise<{ lat: number; lon: number; name: string; country: string } | null> {
  const url = `${GEO}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string; country: string }[];
  };
  const r = data.results?.[0];
  if (!r) return null;
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country };
}

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  80: "Showers",
  95: "Thunderstorm",
};

function wmoLabel(code: number): string {
  return WMO[code] || "Variable";
}

export async function fetchWeather(city: string): Promise<WeatherReport> {
  const geo = await geocode(city);
  if (!geo) throw new Error(`Could not find "${city}". Try a major city name.`);

  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lon),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code",
    forecast_days: "1",
    timezone: "auto",
  });
  const res = await fetch(`${FORECAST}?${params}`);
  if (!res.ok) throw new Error(`Weather service error (${res.status})`);

  const data = (await res.json()) as {
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
    };
    hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] };
  };

  const cur = data.current;
  if (!cur) throw new Error("No current weather data.");

  const forecast: WeatherReport["forecast"] = [];
  const times = data.hourly?.time || [];
  const temps = data.hourly?.temperature_2m || [];
  const codes = data.hourly?.weather_code || [];
  const now = Date.now();
  for (let i = 0; i < times.length && forecast.length < 6; i++) {
    const ts = new Date(times[i]).getTime();
    if (ts <= now) continue;
    forecast.push({
      time: new Date(times[i]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tempC: Math.round(temps[i]),
      condition: wmoLabel(codes[i] ?? 0),
    });
  }

  return {
    city: geo.name,
    country: geo.country,
    tempC: Math.round(cur.temperature_2m),
    feelsLikeC: Math.round(cur.apparent_temperature),
    humidity: cur.relative_humidity_2m,
    windKmh: Math.round(cur.wind_speed_10m),
    condition: wmoLabel(cur.weather_code),
    forecast,
  };
}

export function formatWeatherReply(w: WeatherReport): string {
  const loc = w.country ? `${w.city}, ${w.country}` : w.city;
  const lines = [
    `**${loc}** — ${w.condition}, **${w.tempC}°C** (feels like ${w.feelsLikeC}°C).`,
    `Humidity ${w.humidity}%, wind ~${w.windKmh} km/h.`,
  ];
  if (w.forecast.length) {
    lines.push(
      "Next hours: " +
        w.forecast.map((f) => `${f.time} ${f.tempC}°C ${f.condition}`).join(" · "),
    );
  }
  return lines.join("\n");
}
