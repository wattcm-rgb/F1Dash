import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Leaderboard from '../../components/race/Leaderboard';
import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import type { PitStop, PositionRow, Interval } from '../../components/race/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number, acronym: string, team = 'Team', colour = '1e293b'): OpenF1Driver {
  return { driver_number: n, broadcast_name: acronym, full_name: acronym, name_acronym: acronym, team_name: team, team_colour: colour };
}

function makeLap(dn: number, lapNum: number, duration: number, pitOut = false): OpenF1Lap {
  return {
    driver_number: dn, lap_number: lapNum, lap_duration: duration,
    duration_sector_1: null, duration_sector_2: null, duration_sector_3: null,
    i1_speed: null, i2_speed: null, st_speed: null,
    is_pit_out_lap: pitOut, date_start: `2024-03-02T14:${String(lapNum).padStart(2, '0')}:00`,
  };
}

function makeStint(dn: number, stintNum: number, compound: OpenF1Stint['compound'], lapStart: number, lapEnd: number | null = null): OpenF1Stint {
  return { driver_number: dn, stint_number: stintNum, compound, lap_start: lapStart, lap_end: lapEnd, tyre_age_at_start: 0 };
}

function makePos(dn: number, pos: number, date = '2024-03-02T14:00:00'): PositionRow {
  return { driver_number: dn, position: pos, date };
}

function makeInterval(dn: number, gap: number | string | null, interval: number | string | null): Interval {
  return { driver_number: dn, gap_to_leader: gap, interval };
}

function makePit(dn: number, lapNum: number, duration: number | null = 25): PitStop {
  return { driver_number: dn, lap_number: lapNum, pit_duration: duration, date: '2024-03-02T14:30:00' };
}

// Blank-slate props — override only what the test needs.
function base() {
  return {
    mode: 'historical' as const,
    drivers: [] as OpenF1Driver[],
    laps: [] as OpenF1Lap[],
    stints: [] as OpenF1Stint[],
    pitStops: [] as PitStop[],
    positions: [] as PositionRow[],
    intervals: [] as Interval[],
    investigated: new Set<number>(),
  };
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

describe('empty states', () => {
  it('shows "No classification data yet." in historical mode with no drivers', () => {
    render(<Leaderboard {...base()} mode="historical" />);
    expect(screen.getByText('No classification data yet.')).not.toBeNull();
  });

  it('shows "Waiting for live timing data…" in live mode with no drivers', () => {
    render(<Leaderboard {...base()} mode="live" />);
    expect(screen.getByText('Waiting for live timing data…')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Column headers — differ between live and historical
// ---------------------------------------------------------------------------

describe('column headers', () => {
  it('historical mode shows a "Fastest Lap" header', () => {
    render(<Leaderboard {...base()} mode="historical" />);
    expect(screen.getByText('Fastest Lap')).not.toBeNull();
  });

  it('historical mode does not render an "Int" column header', () => {
    render(<Leaderboard {...base()} mode="historical" />);
    expect(screen.queryByText('Int')).toBeNull();
  });

  it('live mode shows a "Last Lap" header', () => {
    render(<Leaderboard {...base()} mode="live" />);
    expect(screen.getByText('Last Lap')).not.toBeNull();
  });

  it('live mode renders an "Int" column header', () => {
    render(<Leaderboard {...base()} mode="live" />);
    expect(screen.getByText('Int')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Driver info
// ---------------------------------------------------------------------------

describe('driver info', () => {
  const driver = makeDriver(44, 'HAM', 'Mercedes');

  it('shows the driver name acronym in the row', () => {
    render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} />);
    expect(screen.getByText('HAM')).not.toBeNull();
  });

  it('shows the team name in the row', () => {
    render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} />);
    expect(screen.getByText('Mercedes')).not.toBeNull();
  });

  it('shows multiple drivers from the same prop list', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()} drivers={[d1, d2]} positions={[makePos(1, 1), makePos(44, 2)]} />);
    expect(screen.getByText('VER')).not.toBeNull();
    expect(screen.getByText('HAM')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Position column
// ---------------------------------------------------------------------------

describe('position column', () => {
  it('shows the position number when position data is available', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 7)]} />);
    expect(screen.getByText('7')).not.toBeNull();
  });

  it('shows "—" in the position cell when no position data is available (defaults to 99)', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    const { container } = render(<Leaderboard {...base()} drivers={[driver]} />);
    // No position supplied → latestPositionMap returns empty → position=99 → displayed as "—"
    const posCell = container.querySelector('tbody tr td:first-child');
    expect(posCell?.textContent).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// Gap column
// Leader label depends on mode; non-leaders show computed gaps.
// ---------------------------------------------------------------------------

describe('gap column', () => {
  it('shows "WINNER" for the first-placed driver in historical mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()} mode="historical" drivers={[driver]} positions={[makePos(44, 1)]} />);
    expect(screen.getByText('WINNER')).not.toBeNull();
  });

  it('shows "LEAD" for the first-placed driver in live mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()} mode="live" drivers={[driver]} positions={[makePos(44, 1)]} />);
    expect(screen.getByText('LEAD')).not.toBeNull();
  });

  it('shows the formatted gap for a non-leader in live mode', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()}
      mode="live"
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      intervals={[makeInterval(1, 0, 0), makeInterval(44, 5.678, 2.1)]}
    />);
    // fmtGap(5.678) = "+5.678"
    expect(screen.getByText('+5.678')).not.toBeNull();
  });

  it('shows a cumulative time gap for a non-leader in historical mode', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    // Leader: lap1=90 + lap2=90 = 180s. P2: lap1=90 + lap2=91 = 181s. Gap = +1.000
    render(<Leaderboard {...base()}
      mode="historical"
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      laps={[makeLap(1, 1, 90), makeLap(1, 2, 90), makeLap(44, 1, 90), makeLap(44, 2, 91)]}
    />);
    expect(screen.getByText('+1.000')).not.toBeNull();
  });

  it('shows "+1 LAP" for a driver one lap behind in historical mode', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    // Leader has 3 laps; P2 only has 2 → one lap down
    render(<Leaderboard {...base()}
      mode="historical"
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      laps={[makeLap(1, 1, 90), makeLap(1, 2, 90), makeLap(1, 3, 90), makeLap(44, 1, 90), makeLap(44, 2, 90)]}
    />);
    expect(screen.getByText('+1 LAP')).not.toBeNull();
  });

  it('shows "+2 LAPS" (plural) for a driver two laps behind', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()}
      mode="historical"
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      laps={[makeLap(1, 1, 90), makeLap(1, 2, 90), makeLap(1, 3, 90), makeLap(44, 1, 90)]}
    />);
    expect(screen.getByText('+2 LAPS')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Investigation badge
// ---------------------------------------------------------------------------

describe('investigation badge', () => {
  it('shows an "INV" badge for a driver in the investigated set', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()}
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      investigated={new Set([44])}
    />);
    expect(screen.getByText('INV')).not.toBeNull();
  });

  it('does not show "INV" for drivers not in the investigated set', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} />);
    expect(screen.queryByText('INV')).toBeNull();
  });

  it('shows "INV" only for the investigated driver, not for others in the same render', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()}
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      investigated={new Set([44])} // only HAM
    />);
    expect(screen.getAllByText('INV').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pit stop column
// ---------------------------------------------------------------------------

describe('pit stop column', () => {
  it('shows the pit stop count when the driver has stopped', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    // Use 3 stops so the count "3" won't conflict with any position number
    render(<Leaderboard {...base()}
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      pitStops={[makePit(44, 10), makePit(44, 25), makePit(44, 45)]}
    />);
    expect(screen.getByText('3')).not.toBeNull();
  });

  it('shows "—" in the pits cell when the driver has no pit stops', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    const { container } = render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} />);
    // In historical mode pits is the 5th td: P, Driver, Gap, Tyres, Pits, Fastest, Laps
    const pitsCell = container.querySelector('tbody tr td:nth-child(5)');
    expect(pitsCell?.textContent).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// Laps column
// ---------------------------------------------------------------------------

describe('laps column', () => {
  it('shows the number of completed laps', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    // Use 42 laps — distinctive value unlikely to appear elsewhere
    const laps = Array.from({ length: 42 }, (_, i) => makeLap(44, i + 1, 90));
    render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} laps={laps} />);
    expect(screen.getByText('42')).not.toBeNull();
  });

  it('shows "—" in the laps cell when no valid laps exist for a driver', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    const { container } = render(<Leaderboard {...base()} drivers={[driver]} positions={[makePos(44, 1)]} />);
    // Laps column is always the last td
    const lapsCell = container.querySelector('tbody tr td:last-child');
    expect(lapsCell?.textContent).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// Lap time display
// ---------------------------------------------------------------------------

describe('lap time display', () => {
  it('shows the formatted last lap time in live mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    // fmtTime(83.456) = "1:23.456"
    render(<Leaderboard {...base()}
      mode="live"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      laps={[makeLap(44, 1, 83.456)]}
    />);
    const { container } = render(<Leaderboard {...base()}
      mode="live"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      laps={[makeLap(44, 1, 83.456)]}
    />);
    expect(container.textContent).toContain('1:23.456');
  });

  it('shows the formatted fastest lap time in historical mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    const { container } = render(<Leaderboard {...base()}
      mode="historical"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      laps={[makeLap(44, 1, 83.456)]}
    />);
    expect(container.textContent).toContain('1:23.456');
  });
});

// ---------------------------------------------------------------------------
// Fastest lap indicator ("FL" badge)
// Only rendered in historical mode for the driver with the overall best time.
// ---------------------------------------------------------------------------

describe('fastest lap indicator', () => {
  it('shows an "FL" badge for the driver with the overall fastest lap', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    // HAM has the faster lap (89s vs 91s)
    render(<Leaderboard {...base()}
      mode="historical"
      drivers={[d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2)]}
      laps={[makeLap(1, 1, 91), makeLap(44, 1, 89)]}
    />);
    expect(screen.getByText('FL')).not.toBeNull();
  });

  it('renders exactly one "FL" badge even when multiple drivers have valid laps', () => {
    const d1 = makeDriver(1, 'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    const d3 = makeDriver(16, 'LEC', 'Ferrari');
    render(<Leaderboard {...base()}
      mode="historical"
      drivers={[d1, d2, d3]}
      positions={[makePos(1, 1), makePos(44, 2), makePos(16, 3)]}
      laps={[makeLap(1, 1, 91), makeLap(44, 1, 89), makeLap(16, 1, 90)]}
    />);
    expect(screen.getAllByText('FL').length).toBe(1);
  });

  it('does not show "FL" in live mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    render(<Leaderboard {...base()}
      mode="live"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      laps={[makeLap(44, 1, 89)]}
    />);
    expect(screen.queryByText('FL')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tyre display
// In live mode: current compound letter + laps-on-tyre age.
// In historical mode: TyreChips renders the full stint history.
// ---------------------------------------------------------------------------

describe('tyre display', () => {
  it('shows the current compound letter and age in live mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    // SOFT tyre from lap 1; driver has 3 laps on it → tyreAge = 3
    const { container } = render(<Leaderboard {...base()}
      mode="live"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      stints={[makeStint(44, 1, 'SOFT', 1)]}
      laps={[makeLap(44, 1, 90), makeLap(44, 2, 90), makeLap(44, 3, 90)]}
    />);
    // TYRE_LABEL.SOFT = 'S'; tyreAge = 3 → "3L"
    expect(container.textContent).toContain('S');
    expect(container.textContent).toContain('3L');
  });

  it('shows "?" for a driver with no stint data in live mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    // No stints → curCompound defaults to 'UNKNOWN' → TYRE_LABEL.UNKNOWN = '?'
    const { container } = render(<Leaderboard {...base()}
      mode="live"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
    />);
    expect(container.textContent).toContain('?');
  });

  it('renders tyre stint history via TyreChips in historical mode', () => {
    const driver = makeDriver(44, 'HAM', 'Mercedes');
    const { container } = render(<Leaderboard {...base()}
      mode="historical"
      drivers={[driver]}
      positions={[makePos(44, 1)]}
      stints={[makeStint(44, 1, 'SOFT', 1, 20), makeStint(44, 2, 'MEDIUM', 21)]}
      laps={[makeLap(44, 1, 90)]}
    />);
    // TyreChips renders TYRE_LABEL values: S for SOFT, M for MEDIUM
    expect(container.textContent).toContain('S');
    expect(container.textContent).toContain('M');
  });
});

// ---------------------------------------------------------------------------
// Row sorting
// ---------------------------------------------------------------------------

describe('row sorting', () => {
  it('renders drivers in ascending position order regardless of prop array order', () => {
    const d1 = makeDriver(1,  'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes');
    const d3 = makeDriver(16, 'LEC', 'Ferrari');
    // Props supplied in a scrambled order
    const { container } = render(<Leaderboard {...base()}
      drivers={[d3, d1, d2]}
      positions={[makePos(1, 1), makePos(44, 2), makePos(16, 3)]}
    />);
    const text = container.textContent ?? '';
    // VER (P1) before HAM (P2) before LEC (P3)
    expect(text.indexOf('VER')).toBeLessThan(text.indexOf('HAM'));
    expect(text.indexOf('HAM')).toBeLessThan(text.indexOf('LEC'));
  });

  it('places drivers with no position data (position=99) last', () => {
    const d1 = makeDriver(1,  'VER', 'Red Bull');
    const d2 = makeDriver(44, 'HAM', 'Mercedes'); // no position supplied
    const { container } = render(<Leaderboard {...base()}
      drivers={[d2, d1]}          // HAM listed first in props
      positions={[makePos(1, 1)]} // only VER has a position
    />);
    const text = container.textContent ?? '';
    // VER (P1) should appear before HAM (P99)
    expect(text.indexOf('VER')).toBeLessThan(text.indexOf('HAM'));
  });
});
