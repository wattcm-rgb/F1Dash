import type { OpenF1Session } from '../types/openf1';

// Default to the public OpenF1 API (HTTPS, no mixed-content issues on GitHub Pages).
// Override the base URL with VITE_OPENF1_BASE_URL if proxying through your own host.
const OPENF1_BASE_URL =
  import.meta.env.VITE_OPENF1_BASE_URL ?? 'https://api.openf1.org/v1';

// Paid/real-time tier requires authentication. Set VITE_OPENF1_TOKEN to your OpenF1
// access token and it is sent as `Authorization: Bearer <token>` on every request.
// NOTE: a static site exposes this token publicly — anyone can read it from the JS
// bundle. Use a proxy if the quota matters.
const OPENF1_TOKEN = import.meta.env.VITE_OPENF1_TOKEN as string | undefined;

const AUTH_HEADERS: HeadersInit | undefined = OPENF1_TOKEN
  ? { Authorization: `Bearer ${OPENF1_TOKEN}` }
  : undefined;

// Single fetch helper so auth + error handling live in one place.
async function req<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${OPENF1_BASE_URL}${path}`, AUTH_HEADERS ? { headers: AUTH_HEADERS } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    console.error(`OpenF1 request failed (${path}):`, error);
    return fallback;
  }
}

export const openf1Api = {
  getSessions: () => req('/sessions', []),

  getSessionsByYear: (year: number) => req(`/sessions?year=${year}`, []),

  getDrivers: () => req('/drivers', []),

  getIntervals: (sessionKey: number) =>
    req(`/intervals?session_key=${sessionKey}&limit=100`, []),

  getLaps: (sessionKey: number) =>
    req(`/laps?session_key=${sessionKey}&limit=10000`, []),

  getPitStops: (sessionKey: number) =>
    req(`/pit_stops?session_key=${sessionKey}`, []),

  getWeather: (sessionKey: number) =>
    req(`/weather?session_key=${sessionKey}`, []),

  getRaceControlMessages: (sessionKey: number) =>
    req(`/race_control?session_key=${sessionKey}`, []),

  getStints: (sessionKey: number) =>
    req(`/stints?session_key=${sessionKey}`, []),

  getDriversBySession: (sessionKey: number) =>
    req(`/drivers?session_key=${sessionKey}`, []),

  getLocation: (sessionKey: number, since?: string) =>
    req(`/location?session_key=${sessionKey}&limit=10000${since ? `&date>${since}` : ''}`, []),

  // Position trace for a single driver over a time window — used to build the
  // static track outline in advance from an earlier session of the same meeting.
  getLocationRange: (sessionKey: number, driverNumber: number, dateGt: string, dateLt: string) =>
    req(`/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>${dateGt}&date<${dateLt}`, []),

  async getLatestSession(type: 'Practice' | 'Qualifying' | 'Race') {
    const sessions = await req<OpenF1Session[]>(`/sessions?session_type=${type}`, []);
    if (!sessions.length) return null;
    const now = new Date();
    const past = sessions.filter((s) => s.date_start && new Date(s.date_start) <= now);
    return past.length ? past[past.length - 1] : null;
  },
};
