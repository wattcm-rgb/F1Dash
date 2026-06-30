import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openf1Api } from '../../services/openf1Api';
import type { OpenF1Session } from '../../types/openf1';

const BASE = 'https://api.openf1.org/v1';

// ---------------------------------------------------------------------------
// Fetch mock
// Global stub so every call to `fetch` in the module goes through mockFetch.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(data: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockHttpError(status: number): void {
  mockFetch.mockResolvedValueOnce({ ok: false, status });
}

function mockNetworkError(): void {
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));
}

// Convenience accessors for the most-recent fetch call.
function calledUrl(): string {
  return (mockFetch.mock.calls[0] as [string])[0];
}
function calledOptions(): RequestInit | undefined {
  return (mockFetch.mock.calls[0] as [string, RequestInit | undefined])[1];
}

// ---------------------------------------------------------------------------
// Session fixture
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OpenF1Session> = {}): OpenF1Session {
  return {
    session_key: 9999,
    session_name: 'Race',
    session_type: 'Race',
    date_start: '2024-03-02T13:00:00',
    date_end: '2024-03-02T15:00:00',
    year: 2024,
    meeting_key: 1,
    meeting_name: 'Bahrain Grand Prix',
    circuit_short_name: 'Bahrain',
    country_name: 'Bahrain',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockClear();
  // Suppress console.error noise from deliberate error-path tests.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// req() – shared error-handling behaviour (exercised via getSessions)
// ---------------------------------------------------------------------------

describe('req() shared behaviour', () => {
  it('returns parsed JSON on a 200 OK response', async () => {
    mockOk([{ session_key: 1 }]);
    expect(await openf1Api.getSessions()).toEqual([{ session_key: 1 }]);
  });

  it('returns the fallback empty array on an HTTP 500 error', async () => {
    mockHttpError(500);
    expect(await openf1Api.getSessions()).toEqual([]);
  });

  it('returns the fallback empty array on an HTTP 404 error', async () => {
    mockHttpError(404);
    expect(await openf1Api.getLaps(9999)).toEqual([]);
  });

  it('returns the fallback and logs an error when fetch throws', async () => {
    mockNetworkError();
    expect(await openf1Api.getSessions()).toEqual([]);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('includes the failing path in the logged error message', async () => {
    mockNetworkError();
    await openf1Api.getSessions();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('/sessions'),
      expect.any(Error),
    );
  });

  it('does not attach an Authorization header when no token is configured', async () => {
    mockOk([]);
    await openf1Api.getSessions();
    // When AUTH_HEADERS is undefined the second arg to fetch is undefined.
    expect(calledOptions()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// URL construction – one test per public method
// ---------------------------------------------------------------------------

describe('URL construction', () => {
  // Each test only needs a resolved response; error handling is covered above.
  beforeEach(() => mockOk([]));

  it('getSessions → /sessions', async () => {
    await openf1Api.getSessions();
    expect(calledUrl()).toBe(`${BASE}/sessions`);
  });

  it('getSessionsByYear(2024) → /sessions?year=2024', async () => {
    await openf1Api.getSessionsByYear(2024);
    expect(calledUrl()).toBe(`${BASE}/sessions?year=2024`);
  });

  it('getDrivers → /drivers', async () => {
    await openf1Api.getDrivers();
    expect(calledUrl()).toBe(`${BASE}/drivers`);
  });

  it('getIntervals(9999) → /intervals?session_key=9999', async () => {
    await openf1Api.getIntervals(9999);
    expect(calledUrl()).toBe(`${BASE}/intervals?session_key=9999`);
  });

  it('getLaps(9999) → /laps?session_key=9999', async () => {
    await openf1Api.getLaps(9999);
    expect(calledUrl()).toBe(`${BASE}/laps?session_key=9999`);
  });

  it('getPitStops(9999) → /pit?session_key=9999', async () => {
    await openf1Api.getPitStops(9999);
    expect(calledUrl()).toBe(`${BASE}/pit?session_key=9999`);
  });

  it('getPositions(9999) → /position?session_key=9999', async () => {
    await openf1Api.getPositions(9999);
    expect(calledUrl()).toBe(`${BASE}/position?session_key=9999`);
  });

  it('getWeather(9999) → /weather?session_key=9999', async () => {
    await openf1Api.getWeather(9999);
    expect(calledUrl()).toBe(`${BASE}/weather?session_key=9999`);
  });

  it('getRaceControlMessages(9999) → /race_control?session_key=9999', async () => {
    await openf1Api.getRaceControlMessages(9999);
    expect(calledUrl()).toBe(`${BASE}/race_control?session_key=9999`);
  });

  it('getStints(9999) → /stints?session_key=9999', async () => {
    await openf1Api.getStints(9999);
    expect(calledUrl()).toBe(`${BASE}/stints?session_key=9999`);
  });

  it('getDriversBySession(9999) → /drivers?session_key=9999', async () => {
    await openf1Api.getDriversBySession(9999);
    expect(calledUrl()).toBe(`${BASE}/drivers?session_key=9999`);
  });

  it('getLocation(9999) → /location?session_key=9999 with no date filter', async () => {
    await openf1Api.getLocation(9999);
    expect(calledUrl()).toBe(`${BASE}/location?session_key=9999`);
  });

  it('getLocation(9999, since) → appends &date>since', async () => {
    await openf1Api.getLocation(9999, '2024-03-02T14:00:00');
    expect(calledUrl()).toBe(`${BASE}/location?session_key=9999&date>2024-03-02T14:00:00`);
  });

  it('getLocationRange → includes driver_number and both date bounds', async () => {
    await openf1Api.getLocationRange(9999, 44, '2024-03-02T14:00:00', '2024-03-02T14:05:00');
    expect(calledUrl()).toBe(
      `${BASE}/location?session_key=9999&driver_number=44&date>2024-03-02T14:00:00&date<2024-03-02T14:05:00`,
    );
  });

  it('getCarData → includes driver_number and both date bounds', async () => {
    await openf1Api.getCarData(9999, 44, '2024-03-02T14:00:00', '2024-03-02T14:05:00');
    expect(calledUrl()).toBe(
      `${BASE}/car_data?session_key=9999&driver_number=44&date>2024-03-02T14:00:00&date<2024-03-02T14:05:00`,
    );
  });
});

// ---------------------------------------------------------------------------
// getLatestSession()
// ---------------------------------------------------------------------------

describe('getLatestSession()', () => {
  it('returns null when the API returns an empty array', async () => {
    mockOk([]);
    expect(await openf1Api.getLatestSession('Race')).toBeNull();
  });

  it('returns null when every session is in the future', async () => {
    mockOk([makeSession({ date_start: '2099-01-01T00:00:00' })]);
    expect(await openf1Api.getLatestSession('Race')).toBeNull();
  });

  it('throws on a non-2xx status (Phase 0.2: getLatestSession uses reqStrict, not the safe fallback)', async () => {
    mockHttpError(500);
    await expect(openf1Api.getLatestSession('Race')).rejects.toThrow('OpenF1 500');
  });

  it('returns the single past session when only one exists', async () => {
    const session = makeSession({ date_start: '2023-06-01T00:00:00' });
    mockOk([session]);
    expect(await openf1Api.getLatestSession('Race')).toEqual(session);
  });

  it('returns the most recent past session and ignores future ones', async () => {
    const older = makeSession({ session_key: 1, date_start: '2020-01-01T00:00:00', meeting_name: 'Older GP' });
    const newer = makeSession({ session_key: 2, date_start: '2023-06-01T00:00:00', meeting_name: 'Newer GP' });
    const future = makeSession({ session_key: 3, date_start: '2099-01-01T00:00:00', meeting_name: 'Future GP' });
    mockOk([older, newer, future]);
    const result = await openf1Api.getLatestSession('Race');
    expect(result?.session_key).toBe(2);
    expect(result?.meeting_name).toBe('Newer GP');
  });

  it('uses the last element of the filtered past array (preserves API ordering)', async () => {
    // API returns sessions oldest-first; getLatestSession takes the tail.
    const s1 = makeSession({ session_key: 10, date_start: '2022-01-01T00:00:00' });
    const s2 = makeSession({ session_key: 11, date_start: '2022-06-01T00:00:00' });
    const s3 = makeSession({ session_key: 12, date_start: '2023-01-01T00:00:00' });
    mockOk([s1, s2, s3]);
    expect((await openf1Api.getLatestSession('Race'))?.session_key).toBe(12);
  });

  it('passes session_type=Practice to the URL', async () => {
    mockOk([]);
    await openf1Api.getLatestSession('Practice');
    expect(calledUrl()).toBe(`${BASE}/sessions?session_type=Practice`);
  });

  it('passes session_type=Qualifying to the URL', async () => {
    mockOk([]);
    await openf1Api.getLatestSession('Qualifying');
    expect(calledUrl()).toBe(`${BASE}/sessions?session_type=Qualifying`);
  });

  it('passes session_type=Race to the URL', async () => {
    mockOk([]);
    await openf1Api.getLatestSession('Race');
    expect(calledUrl()).toBe(`${BASE}/sessions?session_type=Race`);
  });
});

// ---------------------------------------------------------------------------
// getCurrentSession()
// ---------------------------------------------------------------------------

describe('getCurrentSession()', () => {
  it('returns null when the API returns an empty array', async () => {
    mockOk([]);
    expect(await openf1Api.getCurrentSession()).toBeNull();
  });

  it('returns null when the request fails', async () => {
    mockHttpError(503);
    expect(await openf1Api.getCurrentSession()).toBeNull();
  });

  it('returns the first element of the sessions array', async () => {
    const first = makeSession({ session_key: 42 });
    const second = makeSession({ session_key: 99 });
    mockOk([first, second]);
    expect((await openf1Api.getCurrentSession())?.session_key).toBe(42);
  });

  it('calls /sessions?session_key=latest', async () => {
    mockOk([]);
    await openf1Api.getCurrentSession();
    expect(calledUrl()).toBe(`${BASE}/sessions?session_key=latest`);
  });
});

// ---------------------------------------------------------------------------
// Delta-fetch URL construction (Phase 4.1)
// ---------------------------------------------------------------------------

describe('Delta-fetch URL construction', () => {
  beforeEach(() => mockOk([]));

  it('getLapsSince(9999, since) → /laps?session_key=9999&date>since', async () => {
    await openf1Api.getLapsSince(9999, '2024-03-02T14:00:00');
    expect(calledUrl()).toBe(`${BASE}/laps?session_key=9999&date>2024-03-02T14:00:00`);
  });

  it('getPositionsSince(9999, since) → /position?session_key=9999&date>since', async () => {
    await openf1Api.getPositionsSince(9999, '2024-03-02T14:00:00');
    expect(calledUrl()).toBe(`${BASE}/position?session_key=9999&date>2024-03-02T14:00:00`);
  });

  it('getIntervalsSince(9999, since) → /intervals?session_key=9999&date>since', async () => {
    await openf1Api.getIntervalsSince(9999, '2024-03-02T14:00:00');
    expect(calledUrl()).toBe(`${BASE}/intervals?session_key=9999&date>2024-03-02T14:00:00`);
  });
});

// ---------------------------------------------------------------------------
// 429 rate-limit backoff (Phase 4.2)
// ---------------------------------------------------------------------------

describe('429 rate-limit backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('returns the fallback and does not throw when the API returns 429', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    const result = await openf1Api.getSessions();
    expect(result).toEqual([]);
  });

  it('isRateLimited() returns false before any 429 on a fresh module', async () => {
    vi.resetModules();
    const { isRateLimited: freshIsRateLimited } = await import('../../services/openf1Api');
    expect(freshIsRateLimited()).toBe(false);
  });

  it('suppresses subsequent safe requests for 30 s after a 429', async () => {
    // Trigger the 429 to set rateLimitedUntil
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await openf1Api.getSessions();

    // Advance time but stay inside the 30-s window
    vi.advanceTimersByTime(15_000);
    mockFetch.mockClear();
    await openf1Api.getLaps(9999);
    // Fetch should NOT have been called — module is rate-limited
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resumes requests after the 30-s backoff window expires', async () => {
    // Trigger rate limit
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await openf1Api.getSessions();

    // Advance past the 30-s window
    vi.advanceTimersByTime(31_000);
    mockOk([]);
    await openf1Api.getLaps(9999);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Authorization header
// Tests module re-initialisation with a token set at load time.
// vi.resetModules() + dynamic import forces the module to re-evaluate so the
// module-level AUTH_HEADERS constant picks up the stubbed env value.
// ---------------------------------------------------------------------------

describe('Authorization header', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sends Bearer token when VITE_OPENF1_TOKEN is set', async () => {
    vi.stubEnv('VITE_OPENF1_TOKEN', 'test-token-abc');
    vi.resetModules();
    const { openf1Api: authedApi } = await import('../../services/openf1Api');

    mockOk([]);
    await authedApi.getSessions();

    expect(calledOptions()).toMatchObject({
      headers: { Authorization: 'Bearer test-token-abc' },
    });
  });
});
