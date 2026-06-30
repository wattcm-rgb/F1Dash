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

// Module-level rate-limit backoff state. When the API returns 429, all safe
// requests are skipped for 30 s. Strict requests (session detection) still throw.
let rateLimitedUntil = 0;
export function isRateLimited(): boolean { return Date.now() < rateLimitedUntil; }

// Safe helper — on any error logs and returns the fallback. Use for data polling.
async function req<T>(path: string, fallback: T): Promise<T> {
  if (Date.now() < rateLimitedUntil) return fallback; // skip while throttled
  try {
    const res = await fetch(`${OPENF1_BASE_URL}${path}`, AUTH_HEADERS ? { headers: AUTH_HEADERS } : undefined);
    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 30_000;
      console.warn('OpenF1 rate limited — pausing requests for 30 s');
      return fallback;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    console.error(`OpenF1 request failed (${path}):`, error);
    return fallback;
  }
}

// Strict helper — throws on any error. Use for session detection so callers
// can distinguish "API down / rate-limited" from "no session found".
async function reqStrict<T>(path: string): Promise<T> {
  const res = await fetch(`${OPENF1_BASE_URL}${path}`, AUTH_HEADERS ? { headers: AUTH_HEADERS } : undefined);
  if (!res.ok) throw new Error(`OpenF1 ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export const openf1Api = {
  getSessions: () => req('/sessions', []),

  getSessionsByYear: (year: number) => req(`/sessions?year=${year}`, []),

  getDrivers: () => req('/drivers', []),

  getIntervals: (sessionKey: number) =>
    req(`/intervals?session_key=${sessionKey}`, []),

  getLaps: (sessionKey: number) =>
    req(`/laps?session_key=${sessionKey}`, []),

  getPitStops: (sessionKey: number) =>
    req(`/pit?session_key=${sessionKey}`, []),

  // Authoritative running order / classification (one row per position change).
  getPositions: (sessionKey: number) =>
    req(`/position?session_key=${sessionKey}`, []),

  getWeather: (sessionKey: number) =>
    req(`/weather?session_key=${sessionKey}`, []),

  getRaceControlMessages: (sessionKey: number) =>
    req(`/race_control?session_key=${sessionKey}`, []),

  getStints: (sessionKey: number) =>
    req(`/stints?session_key=${sessionKey}`, []),

  getDriversBySession: (sessionKey: number) =>
    req(`/drivers?session_key=${sessionKey}`, []),

  getLocation: (sessionKey: number, since?: string) =>
    req(`/location?session_key=${sessionKey}${since ? `&date>${since}` : ''}`, []),

  // Position trace for a single driver over a time window — used to build the
  // static track outline in advance from an earlier session of the same meeting.
  getLocationRange: (sessionKey: number, driverNumber: number, dateGt: string, dateLt: string) =>
    req(`/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>${dateGt}&date<${dateLt}`, []),

  getCarData: (sessionKey: number, driverNumber: number, dateGt: string, dateLt: string) =>
    req(`/car_data?session_key=${sessionKey}&driver_number=${driverNumber}&date>${dateGt}&date<${dateLt}`, []),

  // Delta-fetch variants — only return rows with date > since. Use in live polling
  // to merge new rows into existing state instead of replacing the whole array.
  getLapsSince: (sessionKey: number, since: string) =>
    req(`/laps?session_key=${sessionKey}&date>${since}`, []),

  getPositionsSince: (sessionKey: number, since: string) =>
    req(`/position?session_key=${sessionKey}&date>${since}`, []),

  getIntervalsSince: (sessionKey: number, since: string) =>
    req(`/intervals?session_key=${sessionKey}&date>${since}`, []),

  // Returns the most recent past session of a given type (and optional name).
  // Uses reqStrict so callers can catch API errors (e.g. 429) vs "no session found".
  async getLatestSession(
    type: 'Practice' | 'Qualifying' | 'Race',
    nameFilter?: string,
  ): Promise<OpenF1Session | null> {
    const sessions = await reqStrict<OpenF1Session[]>(`/sessions?session_type=${type}`);
    if (!sessions.length) return null;
    const now = new Date();
    let past = sessions.filter((s) => s.date_start && new Date(s.date_start) <= now);
    if (nameFilter) past = past.filter((s) => s.session_name === nameFilter);
    if (!past.length) return null;
    return past.reduce((best, s) =>
      new Date(s.date_start) > new Date(best.date_start) ? s : best
    );
  },

  // Standard qualifying sessions for a given year.
  getQualifyingSessions: (year: number) =>
    req<OpenF1Session[]>(`/sessions?year=${year}&session_type=Qualifying`, []),

  // Sprint Qualifying (Shootout) sessions for a given year.
  getSprintQualifyingSessions: (year: number) =>
    req<OpenF1Session[]>(`/sessions?year=${year}&session_name=Sprint Shootout`, []),

  // Sprint Race sessions for a given year.
  getSprintSessions: (year: number) =>
    req<OpenF1Session[]>(`/sessions?year=${year}&session_name=Sprint`, []),

  // The single most-recent session of any type (OpenF1's `latest` keyword). Used to
  // decide whether anything is live right now for the sidebar indicator.
  async getCurrentSession(): Promise<OpenF1Session | null> {
    const sessions = await req<OpenF1Session[]>(`/sessions?session_key=latest`, []);
    return sessions.length ? sessions[0] : null;
  },
};
