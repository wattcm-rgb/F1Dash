import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../services/openf1Api', () => ({
  openf1Api: { getSessionsByYear: vi.fn() },
}));

import NextSession from '../../components/NextSession';
import { openf1Api } from '../../services/openf1Api';

function makeSession(name: string, type: string, startOffsetMs: number, extra = {}) {
  const start = new Date(Date.now() + startOffsetMs);
  return {
    session_key: Math.floor(Math.random() * 1e6),
    session_name: name,
    session_type: type,
    date_start: start.toISOString(),
    date_end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    year: new Date().getFullYear(),
    meeting_key: 1,
    meeting_name: 'Bahrain Grand Prix',
    circuit_short_name: 'BAH',
    country_name: 'Bahrain',
    ...extra,
  };
}

async function flush() { await act(async () => {}); }

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('NextSession', () => {
  it('shows a loading state initially', () => {
    vi.mocked(openf1Api.getSessionsByYear).mockImplementation(() => new Promise(() => {}));
    render(<NextSession />);
    expect(screen.getByText(/loading next session/i)).not.toBeNull();
  });

  it('shows "No upcoming sessions scheduled." when there are none', async () => {
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([]);
    render(<NextSession />);
    await flush();
    expect(screen.getByText(/no upcoming sessions scheduled/i)).not.toBeNull();
  });

  it('ignores past sessions and shows the soonest upcoming one', async () => {
    const past = makeSession('Practice 1', 'Practice', -60 * 60 * 1000);
    const soon = makeSession('Qualifying', 'Qualifying', 2 * 60 * 60 * 1000);
    const later = makeSession('Race', 'Race', 5 * 60 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([later, past, soon] as never);
    render(<NextSession />);
    await flush();
    expect(screen.getByText('Bahrain Grand Prix · Qualifying')).not.toBeNull();
    expect(screen.getByText(/BAH.*Bahrain/)).not.toBeNull();
  });

  it('shows the NEXT SESSION label and a countdown', async () => {
    const soon = makeSession('Race', 'Race', 3 * 60 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([soon] as never);
    render(<NextSession />);
    await flush();
    expect(screen.getByText('NEXT SESSION')).not.toBeNull();
    expect(screen.getByText(/^in /)).not.toBeNull();
  });

  it('normalises a "Sprint Shootout" session_name to "Sprint Qualifying"', async () => {
    const soon = makeSession('Sprint Shootout', 'Qualifying', 60 * 60 * 1000);
    vi.mocked(openf1Api.getSessionsByYear).mockResolvedValue([soon] as never);
    render(<NextSession />);
    await flush();
    expect(screen.getByText('Bahrain Grand Prix · Sprint Qualifying')).not.toBeNull();
  });
});
