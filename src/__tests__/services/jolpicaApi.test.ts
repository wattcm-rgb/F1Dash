import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jolpicaApi } from '../../services/jolpicaApi';

const BASE = 'https://api.jolpi.ca/ergast/f1';

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(data: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function mockHttpError(status: number, body: unknown = {}): void {
  // jolpicaApi does NOT check res.ok — it always calls res.json().
  // Simulate an HTTP error response that still has a parseable JSON body.
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

function calledUrl(): string {
  return (mockFetch.mock.calls[0] as [string])[0];
}

function calledOptions(): RequestInit | undefined {
  return (mockFetch.mock.calls[0] as [string, RequestInit | undefined])[1];
}

beforeEach(() => {
  mockFetch.mockClear();
});

// ---------------------------------------------------------------------------
// Response passthrough
// Unlike openf1Api, jolpicaApi returns res.json() directly with no wrapping,
// transformation, or fallback — callers receive exactly what the API sends.
// ---------------------------------------------------------------------------

describe('response passthrough', () => {
  it('returns the parsed JSON body directly', async () => {
    const body = { MRData: { SeasonTable: { Seasons: [{ season: '2024' }] } } };
    mockOk(body);
    expect(await jolpicaApi.getSeasons()).toEqual(body);
  });

  it('throws on a non-2xx HTTP status (res.ok check added in Phase 0)', async () => {
    mockHttpError(404, { message: 'Not Found' });
    await expect(jolpicaApi.getSeasons()).rejects.toThrow('Jolpica 404');
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// jolpicaApi has no try/catch — errors surface to the caller unmodified.
// ---------------------------------------------------------------------------

describe('error propagation', () => {
  it('propagates a network error (fetch throws) to the caller', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    await expect(jolpicaApi.getSeasons()).rejects.toThrow('Network failure');
  });

  it('propagates a JSON parse error (res.json() throws) to the caller', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    });
    await expect(jolpicaApi.getRaces(2024)).rejects.toBeInstanceOf(SyntaxError);
  });
});

// ---------------------------------------------------------------------------
// No authentication
// All Jolpica/Ergast endpoints are public — no Authorization header is sent.
// ---------------------------------------------------------------------------

describe('no authentication', () => {
  it('makes requests with no second argument to fetch (no headers)', async () => {
    mockOk({});
    await jolpicaApi.getSeasons();
    expect(calledOptions()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// URL construction — one test per public method
// ---------------------------------------------------------------------------

describe('URL construction', () => {
  beforeEach(() => mockOk({}));

  it('getSeasons → /seasons.json?limit=1000', async () => {
    await jolpicaApi.getSeasons();
    expect(calledUrl()).toBe(`${BASE}/seasons.json?limit=1000`);
  });

  it('getRaces(2024) → /2024/races.json?limit=100', async () => {
    await jolpicaApi.getRaces(2024);
    expect(calledUrl()).toBe(`${BASE}/2024/races.json?limit=100`);
  });

  it('getDrivers → /drivers.json?limit=1000', async () => {
    await jolpicaApi.getDrivers();
    expect(calledUrl()).toBe(`${BASE}/drivers.json?limit=1000`);
  });

  it('getConstructors → /constructors.json?limit=1000', async () => {
    await jolpicaApi.getConstructors();
    expect(calledUrl()).toBe(`${BASE}/constructors.json?limit=1000`);
  });

  it('getDriverStandings(2024) → /2024/driverStandings.json', async () => {
    await jolpicaApi.getDriverStandings(2024);
    expect(calledUrl()).toBe(`${BASE}/2024/driverStandings.json`);
  });

  it('getConstructorStandings(2024) → /2024/constructorStandings.json', async () => {
    await jolpicaApi.getConstructorStandings(2024);
    expect(calledUrl()).toBe(`${BASE}/2024/constructorStandings.json`);
  });

  it('getRaceResults(2024, 1) → /2024/1/results.json', async () => {
    await jolpicaApi.getRaceResults(2024, 1);
    expect(calledUrl()).toBe(`${BASE}/2024/1/results.json`);
  });

  it('getQualifyingResults(2024, 5) → /2024/5/qualifying.json', async () => {
    await jolpicaApi.getQualifyingResults(2024, 5);
    expect(calledUrl()).toBe(`${BASE}/2024/5/qualifying.json`);
  });

  it('getDriverSeasonResults(2024, "hamilton") → /2024/drivers/hamilton/results.json?limit=100', async () => {
    await jolpicaApi.getDriverSeasonResults(2024, 'hamilton');
    expect(calledUrl()).toBe(`${BASE}/2024/drivers/hamilton/results.json?limit=100`);
  });
});

// ---------------------------------------------------------------------------
// Parameter interpolation
// Spot-checks that dynamic segments are placed correctly in the path.
// ---------------------------------------------------------------------------

describe('parameter interpolation', () => {
  beforeEach(() => mockOk({}));

  it('getRaces uses the provided season year in the path', async () => {
    await jolpicaApi.getRaces(2021);
    expect(calledUrl()).toBe(`${BASE}/2021/races.json?limit=100`);
  });

  it('getDriverStandings uses the provided season year in the path', async () => {
    await jolpicaApi.getDriverStandings(2019);
    expect(calledUrl()).toBe(`${BASE}/2019/driverStandings.json`);
  });

  it('getRaceResults places season before round in the path', async () => {
    await jolpicaApi.getRaceResults(2022, 22);
    expect(calledUrl()).toBe(`${BASE}/2022/22/results.json`);
  });

  it('getQualifyingResults places season before round in the path', async () => {
    await jolpicaApi.getQualifyingResults(2023, 10);
    expect(calledUrl()).toBe(`${BASE}/2023/10/qualifying.json`);
  });

  it('getDriverSeasonResults includes driverId verbatim between /drivers/ and /results', async () => {
    await jolpicaApi.getDriverSeasonResults(2024, 'max_verstappen');
    expect(calledUrl()).toContain('/drivers/max_verstappen/results.json');
  });
});
