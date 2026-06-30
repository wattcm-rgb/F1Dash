import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BattleTab from '../../components/race/BattleTab';
import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import type { PitStop, PositionRow } from '../../components/race/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number, acronym: string, team = 'Team'): OpenF1Driver {
  return { driver_number: n, broadcast_name: acronym, full_name: acronym, name_acronym: acronym, team_name: team, team_colour: '1e293b' };
}

function makePos(dn: number, pos: number): PositionRow {
  return { driver_number: dn, position: pos, date: '2024-03-02T14:00:00' };
}

function base() {
  return {
    drivers: [] as OpenF1Driver[],
    laps:    [] as OpenF1Lap[],
    stints:  [] as OpenF1Stint[],
    pitStops: [] as PitStop[],
    positions: [] as PositionRow[],
  };
}

// ---------------------------------------------------------------------------
// Initial / empty state
// ---------------------------------------------------------------------------

describe('BattleTab — initial state', () => {
  it('shows the driver-selection prompt when no drivers are loaded', () => {
    render(<BattleTab {...base()} />);
    expect(screen.getByText('Select two drivers to compare.')).not.toBeNull();
  });

  it('shows "DRIVER A" and "DRIVER B" panel labels', () => {
    render(<BattleTab {...base()} />);
    expect(screen.getByText('DRIVER A')).not.toBeNull();
    expect(screen.getByText('DRIVER B')).not.toBeNull();
  });

  it('renders two select dropdowns', () => {
    const { container } = render(<BattleTab {...base()} />);
    expect(container.querySelectorAll('select').length).toBe(2);
  });

  it('each dropdown has a placeholder "— Select —" option', () => {
    render(<BattleTab {...base()} />);
    expect(screen.getAllByText('— Select —').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Driver list in dropdowns
// ---------------------------------------------------------------------------

describe('BattleTab — driver dropdown population', () => {
  it('lists each driver as an option in both dropdowns', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const { container } = render(<BattleTab {...base()} drivers={drivers} />);
    // Count <option> elements (not parent containers) to avoid textContent cascade.
    const optionTexts = Array.from(container.querySelectorAll('option')).map(o => o.textContent ?? '');
    expect(optionTexts.filter(t => t.includes('HAM')).length).toBe(2);
    expect(optionTexts.filter(t => t.includes('VER')).length).toBe(2);
  });

  it('sorts drivers by position (ascending) in the dropdown', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER'), makeDriver(16, 'LEC')];
    const positions = [makePos(44, 2), makePos(1, 1), makePos(16, 3)];
    const { container } = render(<BattleTab {...base()} drivers={drivers} positions={positions} />);
    // Check first select's option order
    const options = Array.from(container.querySelectorAll('select')[0].querySelectorAll('option'));
    const acronyms = options.slice(1).map(o => o.textContent); // skip the placeholder
    expect(acronyms[0]).toMatch(/VER/); // P1
    expect(acronyms[1]).toMatch(/HAM/); // P2
    expect(acronyms[2]).toMatch(/LEC/); // P3
  });
});

// ---------------------------------------------------------------------------
// No forecast or chart shown initially (neither driver selected)
// ---------------------------------------------------------------------------

describe('BattleTab — no comparison without selection', () => {
  it('does not show BATTLE FORECAST header before drivers are selected', () => {
    render(<BattleTab {...base()} />);
    expect(screen.queryByText('BATTLE FORECAST')).toBeNull();
  });

  it('does not show the LAP-BY-LAP GAP chart header before selection', () => {
    render(<BattleTab {...base()} />);
    expect(screen.queryByText(/LAP-BY-LAP GAP/)).toBeNull();
  });
});
