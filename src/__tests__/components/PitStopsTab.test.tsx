import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PitStopsTab from '../../components/race/PitStopsTab';
import type { OpenF1Driver, OpenF1Stint } from '../../types/openf1';
import type { PitStop, PositionRow } from '../../components/race/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number, acronym: string, team = 'Team'): OpenF1Driver {
  return { driver_number: n, broadcast_name: acronym, full_name: acronym, name_acronym: acronym, team_name: team, team_colour: '1e293b' };
}

function makeStint(dn: number, stintNum: number, compound: OpenF1Stint['compound'], lapStart: number, lapEnd: number | null = null): OpenF1Stint {
  return { driver_number: dn, stint_number: stintNum, compound, lap_start: lapStart, lap_end: lapEnd, tyre_age_at_start: 0 };
}

function makePit(dn: number, lapNum: number, duration: number | null = 25): PitStop {
  return { driver_number: dn, lap_number: lapNum, pit_duration: duration, date: '2024-03-02T14:00:00' };
}

function makePos(dn: number, pos: number): PositionRow {
  return { driver_number: dn, position: pos, date: '2024-03-02T14:00:00' };
}

function base() {
  return {
    drivers: [] as OpenF1Driver[],
    stints:  [] as OpenF1Stint[],
    pitStops: [] as PitStop[],
    positions: [] as PositionRow[],
    laps: [] as { driver_number: number; lap_number: number; lap_duration: number | null }[],
  };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe('PitStopsTab — header', () => {
  it('shows the PIT STOP HISTORY section header', () => {
    render(<PitStopsTab {...base()} />);
    expect(screen.getByText('PIT STOP HISTORY')).not.toBeNull();
  });

  it('shows the column headers: Driver, Stops, Last Pit Lap, Fastest Stop, Tyre History', () => {
    render(<PitStopsTab {...base()} />);
    expect(screen.getByText('Driver')).not.toBeNull();
    expect(screen.getByText('Stops')).not.toBeNull();
    expect(screen.getByText('Last Pit Lap')).not.toBeNull();
    expect(screen.getByText('Fastest Stop')).not.toBeNull();
    expect(screen.getByText('Tyre History')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('PitStopsTab — empty state', () => {
  it('shows "No pit stop data." when the drivers array is empty', () => {
    render(<PitStopsTab {...base()} />);
    expect(screen.getByText('No pit stop data.')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Driver row rendering
// ---------------------------------------------------------------------------

describe('PitStopsTab — driver rows', () => {
  it('renders the driver acronym in the table', () => {
    render(<PitStopsTab {...base()} drivers={[makeDriver(44, 'HAM')]} />);
    expect(screen.getByText('HAM')).not.toBeNull();
  });

  it('renders the team name below the driver acronym', () => {
    render(<PitStopsTab {...base()} drivers={[makeDriver(44, 'HAM', 'Mercedes')]} />);
    expect(screen.getByText('Mercedes')).not.toBeNull();
  });

  it('shows "—" in the Stops column when the driver has no pit stops', () => {
    const { container } = render(
      <PitStopsTab {...base()} drivers={[makeDriver(44, 'HAM')]} />,
    );
    // The stops cell is the second <td> in the driver's row.
    const td = container.querySelector('tbody tr td:nth-child(2)') as HTMLElement;
    expect(td.textContent).toBe('—');
  });

  it('shows the pit stop count when the driver has stops', () => {
    render(
      <PitStopsTab
        {...base()}
        drivers={[makeDriver(44, 'HAM')]}
        pitStops={[makePit(44, 10), makePit(44, 30)]}
      />,
    );
    expect(screen.getByText('2')).not.toBeNull();
  });

  it('shows "Lap N" in the Last Pit Lap column', () => {
    render(
      <PitStopsTab
        {...base()}
        drivers={[makeDriver(44, 'HAM')]}
        pitStops={[makePit(44, 18), makePit(44, 37)]}
      />,
    );
    // Last pit lap is the highest lap_number in input order (sorted ASC, so last = 37).
    expect(screen.getByText('Lap 37')).not.toBeNull();
  });

  it('shows "—" in Last Pit Lap when driver has no stops', () => {
    const { container } = render(
      <PitStopsTab {...base()} drivers={[makeDriver(44, 'HAM')]} />,
    );
    const td = container.querySelector('tbody tr td:nth-child(3)') as HTMLElement;
    expect(td.textContent).toBe('—');
  });

  it('shows fastest stop formatted as "N.Xs" in the Fastest Stop column', () => {
    render(
      <PitStopsTab
        {...base()}
        drivers={[makeDriver(44, 'HAM')]}
        pitStops={[makePit(44, 10, 23.4), makePit(44, 30, 21.8)]}
      />,
    );
    expect(screen.getByText('21.8s')).not.toBeNull();
  });

  it('shows "—" in Fastest Stop when driver has no stops', () => {
    const { container } = render(
      <PitStopsTab {...base()} drivers={[makeDriver(44, 'HAM')]} />,
    );
    const td = container.querySelector('tbody tr td:nth-child(4)') as HTMLElement;
    expect(td.textContent).toBe('—');
  });

  it('renders tyre history chips using TyreChips', () => {
    const stints = [makeStint(44, 1, 'SOFT', 1, 20), makeStint(44, 2, 'MEDIUM', 21, null)];
    render(
      <PitStopsTab
        {...base()}
        drivers={[makeDriver(44, 'HAM')]}
        stints={stints}
        pitStops={[makePit(44, 20)]}
      />,
    );
    expect(screen.getByText('S')).not.toBeNull();
    expect(screen.getByText('M')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Row ordering
// ---------------------------------------------------------------------------

describe('PitStopsTab — row ordering', () => {
  it('sorts rows by position ascending (P1 first)', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER'), makeDriver(16, 'LEC')];
    const positions = [makePos(44, 2), makePos(1, 1), makePos(16, 3)];
    const { container } = render(<PitStopsTab {...base()} drivers={drivers} positions={positions} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('VER');
    expect(rows[1].textContent).toContain('HAM');
    expect(rows[2].textContent).toContain('LEC');
  });
});
