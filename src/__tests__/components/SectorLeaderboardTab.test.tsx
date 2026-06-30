import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectorLeaderboardTab from '../../components/race/SectorLeaderboardTab';
import type { OpenF1Driver, OpenF1Lap } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number, acronym = `D${n}`): OpenF1Driver {
  return {
    driver_number: n,
    broadcast_name: `Driver ${n}`,
    full_name: `Full Name ${n}`,
    name_acronym: acronym,
    team_name: 'Team',
    team_colour: '334155',
  };
}

function makeLap(
  dn: number,
  lapNum: number,
  duration: number | null,
  s1: number | null = null,
  s2: number | null = null,
  s3: number | null = null,
  speed: number | null = null,
  isPitOut = false,
): OpenF1Lap {
  return {
    driver_number: dn,
    lap_number: lapNum,
    lap_duration: duration,
    duration_sector_1: s1,
    duration_sector_2: s2,
    duration_sector_3: s3,
    i1_speed: null,
    i2_speed: null,
    st_speed: speed,
    is_pit_out_lap: isPitOut,
    date_start: '2024-03-02T14:00:00',
  };
}

const DRIVERS = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];

// ---------------------------------------------------------------------------
// Empty / no-data states
// ---------------------------------------------------------------------------

describe('SectorLeaderboardTab — empty states', () => {
  it('shows "No lap data yet." when drivers array is empty', () => {
    render(<SectorLeaderboardTab drivers={[]} laps={[]} />);
    expect(screen.getByText(/no lap data yet/i)).not.toBeNull();
  });

  it('shows "No lap data yet." when laps array is empty (but drivers are present)', () => {
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={[]} />);
    expect(screen.getByText(/no lap data yet/i)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sector times table
// ---------------------------------------------------------------------------

describe('SectorLeaderboardTab — sector times table', () => {
  it('renders driver acronyms in the sector table', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31),
      makeLap(1,  1, 92, 29, 31, 32),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    expect(screen.getAllByText('HAM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0);
  });

  it('sorts sector table with fastest lap driver first', () => {
    const laps = [
      makeLap(1,  1, 92, 29, 31, 32),
      makeLap(44, 1, 90, 28, 31, 31),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    const rows = document.querySelectorAll('tbody tr');
    // First row should be HAM (90s lap)
    expect((rows[0] as HTMLElement).textContent).toContain('HAM');
  });

  it('shows "FASTEST" label for the P1 driver', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31),
      makeLap(1,  1, 92, 29, 31, 32),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    expect(screen.getAllByText('FASTEST').length).toBeGreaterThan(0);
  });

  it('excludes pit-out laps from sector time calculations', () => {
    const laps = [
      makeLap(44, 1, 200, 50, 100, 50, null, /* isPitOut= */ true),
      makeLap(44, 2, 90,  28, 31,  31),
      makeLap(1,  1, 92,  29, 31,  32),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    // HAM should still be first (90 < 92) — pit-out lap should not win
    const rows = document.querySelectorAll('tbody tr');
    expect((rows[0] as HTMLElement).textContent).toContain('HAM');
  });
});

// ---------------------------------------------------------------------------
// Theoretical best banner
// ---------------------------------------------------------------------------

describe('SectorLeaderboardTab — theoretical best', () => {
  it('shows the THEORETICAL BEST banner when all three sector bests are available', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31),
      makeLap(1,  1, 92, 29, 31, 32),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    expect(screen.getByText(/theoretical best/i)).not.toBeNull();
  });

  it('does not show the theoretical best banner when sector data is missing', () => {
    // No sector times set (all null)
    const laps = [
      makeLap(44, 1, 90),
      makeLap(1,  1, 92),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    expect(screen.queryByText(/theoretical best/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Speed trap table
// ---------------------------------------------------------------------------

describe('SectorLeaderboardTab — speed trap table', () => {
  it('does not render the speed trap section when no speed data is available', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31),
      makeLap(1,  1, 92, 29, 31, 32),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    expect(screen.queryByText(/speed trap/i)).toBeNull();
  });

  it('renders the speed trap section when st_speed data is present', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31, 320),
      makeLap(1,  1, 92, 29, 31, 32, 310),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    // "SPEED TRAP" appears as both a section heading and a column header
    expect(screen.getAllByText(/speed trap/i).length).toBeGreaterThan(0);
  });

  it('sorts speed trap with fastest driver first', () => {
    const laps = [
      makeLap(44, 1, 90, 28, 31, 31, 320),
      makeLap(1,  1, 92, 29, 31, 32, 310),
    ];
    render(<SectorLeaderboardTab drivers={DRIVERS} laps={laps} />);
    // Speed trap renders in a second table — find the second tbody
    const tbodies = document.querySelectorAll('tbody');
    const speedBody = tbodies[1];
    if (speedBody) {
      const firstRow = speedBody.querySelectorAll('tr')[0];
      expect((firstRow as HTMLElement).textContent).toContain('HAM'); // 320 > 310
    }
  });
});
