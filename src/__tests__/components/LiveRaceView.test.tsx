import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../services/openf1Api', () => ({
  isRateLimited: vi.fn(() => false),
  openf1Api: {
    getLatestSession:        vi.fn(),
    getLaps:                 vi.fn(),
    getStints:               vi.fn(),
    getDriversBySession:     vi.fn(),
    getPitStops:             vi.fn(),
    getIntervals:            vi.fn(),
    getIntervalsSince:       vi.fn(),
    getRaceControlMessages:  vi.fn(),
    getWeather:              vi.fn(),
    getPositions:            vi.fn(),
    getPositionsSince:       vi.fn(),
    getLapsSince:            vi.fn(),
    getLocation:             vi.fn(),
  },
}));

import LiveRaceView from '../../components/race/LiveRaceView';
import { openf1Api } from '../../services/openf1Api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAST_SESSION = {
  session_key:        1001,
  session_name:       'Race',
  session_type:       'Race',
  date_start:         '2024-03-02T13:00:00',
  date_end:           '2024-03-02T15:00:00',
  year:               2024,
  meeting_key:        1,
  meeting_name:       'Bahrain Grand Prix',
  circuit_short_name: 'BAH',
  country_name:       'Bahrain',
};

const PAST_SPRINT = { ...PAST_SESSION, session_key: 1002, session_name: 'Sprint', meeting_name: 'Bahrain Grand Prix' };

function liveSession(overrides = {}) {
  return {
    ...PAST_SESSION,
    date_start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    date_end:   new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

async function flush() { await act(async () => {}); }

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ now: Date.now() });
  vi.clearAllMocks();
  vi.mocked(openf1Api.getLaps).mockResolvedValue([]);
  vi.mocked(openf1Api.getLapsSince).mockResolvedValue([]);
  vi.mocked(openf1Api.getStints).mockResolvedValue([]);
  vi.mocked(openf1Api.getDriversBySession).mockResolvedValue([]);
  vi.mocked(openf1Api.getPitStops).mockResolvedValue([]);
  vi.mocked(openf1Api.getIntervals).mockResolvedValue([]);
  vi.mocked(openf1Api.getIntervalsSince).mockResolvedValue([]);
  vi.mocked(openf1Api.getRaceControlMessages).mockResolvedValue([]);
  vi.mocked(openf1Api.getWeather).mockResolvedValue([]);
  vi.mocked(openf1Api.getPositions).mockResolvedValue([]);
  vi.mocked(openf1Api.getPositionsSince).mockResolvedValue([]);
  vi.mocked(openf1Api.getLocation).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Detecting state
// ---------------------------------------------------------------------------

describe('LiveRaceView (Race) — detecting state', () => {
  it('shows "Checking for a live session…" while getLatestSession is pending', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Race" />);
    expect(screen.getByText(/checking for a live session/i)).not.toBeNull();
  });

  it('shows CHECKING (not OFFLINE or LIVE) while detecting', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Race" />);
    expect(screen.queryByText('CHECKING')).not.toBeNull();
    expect(screen.queryByText('OFFLINE')).toBeNull();
    expect(screen.queryByText('LIVE')).toBeNull();
  });

  it('shows "Live Race" as the heading while detecting (no session yet)', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Race" />);
    expect(screen.getByText('Live Race')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No session found
// ---------------------------------------------------------------------------

describe('LiveRaceView (Race) — no session found', () => {
  it('shows the "No live race right now" banner when getLatestSession returns null', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText(/no live race right now/i)).not.toBeNull();
  });

  it('shows the OFFLINE badge when no session is returned', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText('OFFLINE')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Past session (offline)
// ---------------------------------------------------------------------------

describe('LiveRaceView (Race) — past session (offline)', () => {
  it('shows the OFFLINE badge for a past session', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SESSION as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText('OFFLINE')).not.toBeNull();
  });

  it('shows the session label in the heading', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SESSION as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText('Bahrain Grand Prix · Race')).not.toBeNull();
  });

  it('shows the circuit and country info below the heading', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SESSION as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText(/BAH.*Bahrain/)).not.toBeNull();
  });

  it('includes the last race name in the offline banner', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SESSION as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(screen.getByText(/Last race: Bahrain Grand Prix/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Live session
// ---------------------------------------------------------------------------

describe('LiveRaceView (Race) — live session', () => {
  it('shows the LIVE badge for a currently live session', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(liveSession() as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    await flush();
    expect(screen.getByText('LIVE')).not.toBeNull();
  });

  it('shows the session label in the heading when the session is live', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(liveSession() as never);
    render(<LiveRaceView kind="Race" />);
    await flush();
    await flush();
    expect(screen.getByText('Bahrain Grand Prix · Race')).not.toBeNull();
  });

  it('detects using session_type=Race and session_name=Race', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveRaceView kind="Race" />);
    await flush();
    expect(openf1Api.getLatestSession).toHaveBeenCalledWith('Race', 'Race');
  });
});

// ---------------------------------------------------------------------------
// Sprint variant
// ---------------------------------------------------------------------------

describe('LiveRaceView (Sprint)', () => {
  it('shows "Live Sprint" as the heading while detecting', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Sprint" />);
    expect(screen.getByText('Live Sprint')).not.toBeNull();
  });

  it('detects using session_name=Sprint', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveRaceView kind="Sprint" />);
    await flush();
    expect(openf1Api.getLatestSession).toHaveBeenCalledWith('Race', 'Sprint');
  });

  it('shows the "No live sprint right now" banner when no session is live', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SPRINT as never);
    render(<LiveRaceView kind="Sprint" />);
    await flush();
    expect(screen.getByText(/no live sprint right now/i)).not.toBeNull();
  });

  it('labels the header with · Sprint for a detected session', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(PAST_SPRINT as never);
    render(<LiveRaceView kind="Sprint" />);
    await flush();
    expect(screen.getByText('Bahrain Grand Prix · Sprint')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Weather chip placeholders
// ---------------------------------------------------------------------------

describe('LiveRaceView — weather chips', () => {
  it('shows "—" for Air temperature before weather data is available', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Race" />);
    expect(screen.getByText('Air').parentElement!.textContent).toContain('—');
  });

  it('shows "—" for Track temperature before weather data is available', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveRaceView kind="Race" />);
    expect(screen.getByText('Track').parentElement!.textContent).toContain('—');
  });
});
