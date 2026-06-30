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

import SprintPage from '../../pages/SprintPage';
import { openf1Api } from '../../services/openf1Api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A past Sprint session; isPastSession(s) → true because date_start is in the past.
const PAST_SPRINT = {
  session_key:        3001,
  session_name:       'Sprint',
  session_type:       'Race',
  date_start:         '2024-04-20T13:00:00',
  date_end:           '2024-04-20T14:00:00',
  year:               2024,
  meeting_key:        20,
  meeting_name:       'Chinese Grand Prix',
  circuit_short_name: 'SHA',
  country_name:       'China',
};

// A full Race session — must be excluded by the "session_name === 'Sprint'" filter.
const RACE_SESSION = { ...PAST_SPRINT, session_key: 3002, session_name: 'Race', meeting_name: 'Chinese Grand Prix' };

async function flush() { await act(async () => {}); }

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

describe('SprintPage — year selector', () => {
  it('renders a year dropdown containing the expected seasons', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SprintPage />);
    const options = Array.from(container.querySelectorAll('select option')).map(o => o.textContent);
    expect(options).toContain('2026');
    expect(options).toContain('2023');
  });

  it('defaults the year selector to the current year', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SprintPage />);
    const yearSelect = container.querySelector('select') as HTMLSelectElement;
    expect(yearSelect.value).toBe(String(new Date().getFullYear()));
  });
});

// ---------------------------------------------------------------------------
// No sessions state
// ---------------------------------------------------------------------------

describe('SprintPage — no sessions', () => {
  it('shows "Sprint History" heading before any session is loaded', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<SprintPage />);
    await flush();
    expect(screen.getByText('Sprint History')).not.toBeNull();
  });

  it('shows "No sprint data available for N." when the season has no sprints', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<SprintPage />);
    await flush();
    expect(screen.getByText(/No sprint data available for/)).not.toBeNull();
  });

  it('excludes full Race sessions — treats the year as empty when only a Race is returned', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([RACE_SESSION] as never);
    render(<SprintPage />);
    await flush();
    expect(screen.getByText(/No sprint data available for/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// With sessions loaded
// ---------------------------------------------------------------------------

describe('SprintPage — with sessions', () => {
  it('shows the session label in the heading after sessions are loaded', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_SPRINT] as never);
    render(<SprintPage />);
    await flush();
    await flush();
    expect(screen.getByText('Chinese Grand Prix · Sprint')).not.toBeNull();
  });

  it('shows the circuit and country info below the heading', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_SPRINT] as never);
    render(<SprintPage />);
    await flush();
    await flush();
    expect(screen.getByText(/SHA.*China/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('SprintPage — loading state', () => {
  it('shows "Loading sprint data…" while the data fetch is in-flight', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([PAST_SPRINT] as never);
    vi.mocked(openf1Api.getLaps).mockImplementation(() => new Promise(() => {}));
    render(<SprintPage />);
    await flush();
    expect(screen.getByText('Loading sprint data…')).not.toBeNull();
  });
});
