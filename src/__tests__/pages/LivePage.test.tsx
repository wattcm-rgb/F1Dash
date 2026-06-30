import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

// Mock the heavy live sub-views so the hub test stays isolated to tab logic.
vi.mock('../../components/race/LiveRaceView', () => ({
  default: ({ kind }: { kind: string }) => <div>RACE_VIEW:{kind}</div>,
}));
vi.mock('../../components/qualifying/LiveQualView', () => ({
  default: ({ kind }: { kind: string }) => <div>QUAL_VIEW:{kind}</div>,
}));

vi.mock('../../services/openf1Api', () => ({
  openf1Api: { getSessionsByYear: vi.fn() },
}));

import LivePage from '../../pages/LivePage';
import { openf1Api } from '../../services/openf1Api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(type: string, name: string, startOffsetMs: number, durMs = 2 * 60 * 60 * 1000) {
  const start = new Date(Date.now() + startOffsetMs);
  return {
    session_key: Math.floor(Math.random() * 1e6),
    session_name: name,
    session_type: type,
    date_start: start.toISOString(),
    date_end: new Date(start.getTime() + durMs).toISOString(),
    year: new Date().getFullYear(),
    meeting_key: 1,
    meeting_name: 'Test GP',
    circuit_short_name: 'TST',
    country_name: 'Testland',
  };
}

async function flush() { await act(async () => {}); }

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Sub-tab nav
// ---------------------------------------------------------------------------

describe('LivePage hub — sub-tab nav', () => {
  it('renders all four sub-tab buttons', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<LivePage />);
    await flush();
    expect(screen.getByRole('button', { name: 'Sprint Qual' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sprint' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Qualifying' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Race' })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Default-tab resolution
// ---------------------------------------------------------------------------

describe('LivePage hub — default tab', () => {
  it('defaults to Race when there are no sessions', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<LivePage />);
    await flush();
    expect(screen.getByText('RACE_VIEW:Race')).not.toBeNull();
  });

  it('defaults to Race when getSessionsByYear throws', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockRejectedValue(new Error('boom'));
    render(<LivePage />);
    await flush();
    expect(screen.getByText('RACE_VIEW:Race')).not.toBeNull();
  });

  it('selects the session that is live right now', async () => {
    // A live Qualifying session (started 1h ago, ends in 1h)
    const live = makeSession('Qualifying', 'Qualifying', -60 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([live] as never);
    render(<LivePage />);
    await flush();
    expect(screen.getByText('QUAL_VIEW:Qualifying')).not.toBeNull();
  });

  it('selects the soonest upcoming session when none are live', async () => {
    const sprintQualSoon = makeSession('Qualifying', 'Sprint Shootout', 60 * 60 * 1000);      // +1h
    const raceLater      = makeSession('Race', 'Race', 5 * 60 * 60 * 1000);                    // +5h
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([raceLater, sprintQualSoon] as never);
    render(<LivePage />);
    await flush();
    expect(screen.getByText('QUAL_VIEW:Sprint Shootout')).not.toBeNull();
  });

  it('maps a live Sprint race to the Sprint sub-view', async () => {
    const liveSprint = makeSession('Race', 'Sprint', -30 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([liveSprint] as never);
    render(<LivePage />);
    await flush();
    expect(screen.getByText('RACE_VIEW:Sprint')).not.toBeNull();
  });

  it('ignores Practice sessions when resolving the default tab', async () => {
    // Practice is live now, but Qualifying is the soonest of the four shown types.
    const practiceLive = makeSession('Practice', 'Practice 1', -30 * 60 * 1000);
    const qualiSoon    = makeSession('Qualifying', 'Qualifying', 60 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([practiceLive, qualiSoon] as never);
    render(<LivePage />);
    await flush();
    expect(screen.getByText('QUAL_VIEW:Qualifying')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Manual tab switching
// ---------------------------------------------------------------------------

describe('LivePage hub — manual switching', () => {
  it('switches to the clicked sub-view', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<LivePage />);
    await flush();
    // Default is Race
    expect(screen.getByText('RACE_VIEW:Race')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sprint Qual' }));
    expect(screen.getByText('QUAL_VIEW:Sprint Shootout')).not.toBeNull();
  });
});
