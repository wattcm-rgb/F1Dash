import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../services/openf1Api', () => ({
  openf1Api: {
    getSessionsByYear:       vi.fn(),
    getLaps:                 vi.fn(),
    getStints:               vi.fn(),
    getDriversBySession:     vi.fn(),
    getPitStops:             vi.fn(),
    getRaceControlMessages:  vi.fn(),
    getWeather:              vi.fn(),
    getPositions:            vi.fn(),
  },
}));

import RacePage from '../../pages/RacePage';
import { openf1Api } from '../../services/openf1Api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A past Race session; isPastSession(s) → true because date_start is in the past.
const PAST_RACE = {
  session_key:        2001,
  session_name:       'Race',
  session_type:       'Race',
  date_start:         '2024-03-02T13:00:00',
  date_end:           '2024-03-02T15:00:00',
  year:               2024,
  meeting_key:        10,
  meeting_name:       'Australian Grand Prix',
  circuit_short_name: 'MEL',
  country_name:       'Australia',
};

// A Sprint session — must be excluded by the "session_name === 'Race'" filter.
const SPRINT_SESSION = { ...PAST_RACE, session_key: 2002, session_name: 'Sprint', meeting_name: 'Sprint Race' };

async function flush() { await act(async () => {}); }

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ now: Date.now() });
  vi.clearAllMocks();
  vi.mocked(openf1Api.getLaps).mockResolvedValue([]);
  vi.mocked(openf1Api.getStints).mockResolvedValue([]);
  vi.mocked(openf1Api.getDriversBySession).mockResolvedValue([]);
  vi.mocked(openf1Api.getPitStops).mockResolvedValue([]);
  vi.mocked(openf1Api.getRaceControlMessages).mockResolvedValue([]);
  vi.mocked(openf1Api.getWeather).mockResolvedValue([]);
  vi.mocked(openf1Api.getPositions).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Year selector
// ---------------------------------------------------------------------------

describe('RacePage — year selector', () => {
  it('renders a year dropdown containing the expected seasons', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<RacePage />);
    const options = Array.from(container.querySelectorAll('select option')).map(o => o.textContent);
    expect(options).toContain('2026');
    expect(options).toContain('2025');
    expect(options).toContain('2024');
    expect(options).toContain('2023');
  });

  it('defaults the year selector to the current year', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<RacePage />);
    const yearSelect = container.querySelector('select') as HTMLSelectElement;
    expect(yearSelect.value).toBe(String(new Date().getFullYear()));
  });
});

// ---------------------------------------------------------------------------
// No sessions state
// getSessionsByYear returns [] (or only non-Race sessions).
// ---------------------------------------------------------------------------

describe('RacePage — no sessions', () => {
  it('shows "Race History" heading before any session is loaded', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<RacePage />);
    await flush();
    expect(screen.getByText('Race History')).not.toBeNull();
  });

  it('shows "No race data available for N." when the season has no races', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<RacePage />);
    await flush();
    expect(screen.getByText(/No race data available for/)).not.toBeNull();
  });

  it('excludes Sprint sessions — treats the year as empty when only a Sprint is returned', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([SPRINT_SESSION] as never);
    render(<RacePage />);
    await flush();
    expect(screen.getByText(/No race data available for/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// With sessions loaded
// ---------------------------------------------------------------------------

describe('RacePage — with sessions', () => {
  it('shows the session label in the heading after sessions are loaded', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_RACE] as never);
    render(<RacePage />);
    await flush();
    await flush(); // session data fetch settles
    expect(screen.getByText('Australian Grand Prix · Race')).not.toBeNull();
  });

  it('populates the race selector dropdown with the loaded session', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_RACE] as never);
    const { container } = render(<RacePage />);
    await flush();
    const optionTexts = Array.from(container.querySelectorAll('select option')).map(o => o.textContent ?? '');
    expect(optionTexts.some(t => t.includes('Australian Grand Prix'))).toBe(true);
  });

  it('shows the circuit and country info below the heading', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_RACE] as never);
    render(<RacePage />);
    await flush();
    await flush();
    expect(screen.getByText(/MEL.*Australia/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// getSessionsByYear resolves quickly, but the race-data fetch is slow.
// ---------------------------------------------------------------------------

describe('RacePage — loading state', () => {
  it('shows "Loading race data…" while the race data fetch is in-flight', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_RACE] as never);
    // getLaps never resolves → loading state stays true
    vi.mocked(openf1Api.getLaps).mockImplementation(() => new Promise(() => {}));
    render(<RacePage />);
    await flush(); // sessions load, session selected, loading=true
    expect(screen.getByText('Loading race data…')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Weather chip placeholders
// ---------------------------------------------------------------------------

describe('RacePage — weather chips', () => {
  it('shows "—" for Air temperature before weather data loads', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    render(<RacePage />);
    expect(screen.getByText('Air').parentElement!.textContent).toContain('—');
  });

  it('shows "—" for Track temperature before weather data loads', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    render(<RacePage />);
    expect(screen.getByText('Track').parentElement!.textContent).toContain('—');
  });
});
