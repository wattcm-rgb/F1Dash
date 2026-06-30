import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualifyingLeaderboard from '../../components/qualifying/QualifyingLeaderboard';
import type { OpenF1Driver } from '../../types/openf1';
import type { QualLap } from '../../components/qualifying/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function driver(number: number, acronym: string, team = 'Team A', colour = 'ef4444'): OpenF1Driver {
  return {
    driver_number: number,
    broadcast_name: acronym,
    full_name: acronym,
    name_acronym: acronym,
    team_name: team,
    team_colour: colour,
  };
}

const BASE_TIME = new Date('2024-06-01T14:00:00').getTime();

function lap(dn: number, overrides: Partial<QualLap> = {}): QualLap {
  return {
    driver_number: dn,
    lap_number: 1,
    lap_duration: 90.0,
    sector_1: 28.0,
    sector_2: 32.0,
    sector_3: 30.0,
    is_pit_out_lap: false,
    date_start: new Date(BASE_TIME).toISOString(),
    ...overrides,
  };
}

const DRIVERS = [
  driver(1, 'VER', 'Red Bull', 'ff0000'),
  driver(44, 'HAM', 'Mercedes', '00d2be'),
  driver(16, 'LEC', 'Ferrari', 'e8002d'),
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — rendering', () => {
  it('renders driver acronyms', () => {
    const laps = [
      lap(1, { lap_duration: 89.0 }),
      lap(44, { lap_duration: 90.0 }),
      lap(16, { lap_duration: 91.0 }),
    ];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText('VER')).not.toBeNull();
    expect(screen.getByText('HAM')).not.toBeNull();
    expect(screen.getByText('LEC')).not.toBeNull();
  });

  it('shows "No data for this segment yet." when drivers list is empty', () => {
    render(<QualifyingLeaderboard drivers={[]} segmentLaps={[]} allLaps={[]} segment="Q1" />);
    expect(screen.getByText(/no data for this segment/i)).not.toBeNull();
  });

  it('renders team names', () => {
    const laps = [lap(1, { lap_duration: 89.0 })];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText('Red Bull')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — sorting', () => {
  it('sorts drivers by best lap time ascending (fastest first)', () => {
    const laps = [
      lap(1,  { lap_duration: 91.0 }),
      lap(44, { lap_duration: 89.0 }),
      lap(16, { lap_duration: 90.0 }),
    ];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows[0].textContent).toContain('HAM');
    expect(rows[1].textContent).toContain('LEC');
    expect(rows[2].textContent).toContain('VER');
  });

  it('places drivers with no lap time at the bottom', () => {
    const laps = [
      lap(1,  { lap_duration: 89.0 }),
      lap(44, { lap_duration: null }), // no time
    ];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('VER');
  });
});

// ---------------------------------------------------------------------------
// Gap calculation
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — gap column', () => {
  it('shows POLE label for the driver in P1', () => {
    const laps = [
      lap(1,  { lap_duration: 89.0 }),
      lap(44, { lap_duration: 90.0 }),
    ];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText('POLE')).not.toBeNull();
  });

  it('shows gap in +X.XXX format for other drivers', () => {
    const laps = [
      lap(1,  { lap_duration: 89.0 }),
      lap(44, { lap_duration: 90.0 }),
    ];
    render(<QualifyingLeaderboard drivers={DRIVERS} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText('+1.000')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Elimination zone
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — elimination zone', () => {
  function buildDrivers(n: number): OpenF1Driver[] {
    return Array.from({ length: n }, (_, i) => driver(i + 1, `D${String(i + 1).padStart(2, '0')}`));
  }

  function buildLaps(drivers: OpenF1Driver[]): QualLap[] {
    return drivers.map((d, i) => lap(d.driver_number, { lap_duration: 89.0 + i * 0.5 }));
  }

  function countEliminatedRows(container: HTMLElement): number {
    // jsdom exposes React style props on element.style — check borderLeft directly
    // rather than using an attribute selector (jsdom adds spaces inside rgba()).
    const rows = Array.from(container.querySelectorAll('tbody tr')) as HTMLElement[];
    return rows.filter(row => row.style.borderLeft && !row.style.borderLeft.includes('transparent')).length;
  }

  it('marks the bottom 5 rows in Q1 with 20 drivers', () => {
    const drivers = buildDrivers(20);
    const laps = buildLaps(drivers);
    const { container } = render(
      <QualifyingLeaderboard drivers={drivers} segmentLaps={laps} allLaps={laps} segment="Q1" />,
    );
    expect(countEliminatedRows(container)).toBe(5);
  });

  it('marks the bottom 5 rows in Q2 with 15 drivers', () => {
    const drivers = buildDrivers(15);
    const laps = buildLaps(drivers);
    const { container } = render(
      <QualifyingLeaderboard drivers={drivers} segmentLaps={laps} allLaps={laps} segment="Q2" />,
    );
    expect(countEliminatedRows(container)).toBe(5);
  });

  it('marks no rows in Q3 (no elimination)', () => {
    const drivers = buildDrivers(10);
    const laps = buildLaps(drivers);
    const { container } = render(
      <QualifyingLeaderboard drivers={drivers} segmentLaps={laps} allLaps={laps} segment="Q3" />,
    );
    expect(countEliminatedRows(container)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sector colours
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — sector colour cells', () => {
  it('renders three SectorCell columns (S1, S2, S3)', () => {
    const laps = [lap(1, { sector_1: 28.0, sector_2: 32.0, sector_3: 30.0, lap_duration: 90.0 })];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    // When only one driver, all three sectors should be purple (they are the overall best).
    const purpleCells = document.querySelectorAll('span[style*="rgb(168, 85, 247)"]');
    expect(purpleCells.length).toBeGreaterThanOrEqual(3);
  });

  it('shows dashes for drivers with null sector times', () => {
    const laps = [lap(1, { sector_1: null, sector_2: null, sector_3: null, lap_duration: 90.0 })];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    // Three grey cells each showing '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Theoretical best / fastest lap header
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — header stats', () => {
  it('shows the theoretical best lap when all three sector bests exist', () => {
    const laps = [
      lap(1,  { sector_1: 28.0, sector_2: 32.0, sector_3: 30.0, lap_duration: 90.0 }),
    ];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText(/theoretical best/i)).not.toBeNull();
  });

  it('shows the fastest lap in the header', () => {
    const laps = [lap(1, { sector_1: 28.0, sector_2: 32.0, sector_3: 30.0, lap_duration: 90.0 })];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText(/fastest lap/i)).not.toBeNull();
  });

  it('does not show the header stats when all sector times are null', () => {
    const laps = [lap(1, { sector_1: null, sector_2: null, sector_3: null, lap_duration: null })];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.queryByText(/theoretical best/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Laps column
// ---------------------------------------------------------------------------

describe('QualifyingLeaderboard — laps column', () => {
  it('shows total laps done (including out-laps)', () => {
    const laps = [
      lap(1, { lap_number: 1, is_pit_out_lap: true }),
      lap(1, { lap_number: 2, lap_duration: 90.0 }),
      lap(1, { lap_number: 3, lap_duration: 89.5 }),
    ];
    render(<QualifyingLeaderboard drivers={[DRIVERS[0]]} segmentLaps={laps} allLaps={laps} segment="Q3" />);
    expect(screen.getByText('3')).not.toBeNull();
  });
});
