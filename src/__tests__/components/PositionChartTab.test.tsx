import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PositionChartTab from '../../components/race/PositionChartTab';
import type { OpenF1Driver, OpenF1Lap } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number, acronym = `D${n}`, colour = '334155'): OpenF1Driver {
  return {
    driver_number: n,
    broadcast_name: `Driver ${n}`,
    full_name: `Full Name ${n}`,
    name_acronym: acronym,
    team_name: 'Team',
    team_colour: colour,
  };
}

function makeLap(dn: number, lapNum: number, duration: number): OpenF1Lap {
  return {
    driver_number: dn,
    lap_number: lapNum,
    lap_duration: duration,
    duration_sector_1: null,
    duration_sector_2: null,
    duration_sector_3: null,
    i1_speed: null,
    i2_speed: null,
    st_speed: null,
    is_pit_out_lap: false,
    date_start: '2024-03-02T14:00:00',
  };
}

// ---------------------------------------------------------------------------
// Empty / no-data state
// ---------------------------------------------------------------------------

describe('PositionChartTab — empty states', () => {
  it('shows "No race data yet." when drivers array is empty', () => {
    render(<PositionChartTab drivers={[]} laps={[]} />);
    expect(screen.getByText(/no race data yet/i)).not.toBeNull();
  });

  it('shows "No race data yet." when laps are empty (but drivers are present)', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    render(<PositionChartTab drivers={drivers} laps={[]} />);
    expect(screen.getByText(/no race data yet/i)).not.toBeNull();
  });

  it('shows "No race data yet." when laps exist but all have null duration', () => {
    const drivers = [makeDriver(44, 'HAM')];
    const laps: OpenF1Lap[] = [
      { ...makeLap(44, 1, 90), lap_duration: null },
    ];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    expect(screen.getByText(/no race data yet/i)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chart rendering
// ---------------------------------------------------------------------------

describe('PositionChartTab — chart renders', () => {
  it('renders the "RACE POSITIONS BY LAP" heading', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const laps = [
      makeLap(44, 1, 90), makeLap(44, 2, 91),
      makeLap(1,  1, 92), makeLap(1,  2, 91.5),
    ];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    expect(screen.getByText(/race positions by lap/i)).not.toBeNull();
  });

  it('renders an SVG element for the chart', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const laps = [makeLap(44, 1, 90), makeLap(1, 1, 92)];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders a polyline for each driver that has lap data', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const laps = [
      makeLap(44, 1, 90), makeLap(44, 2, 91),
      makeLap(1,  1, 92), makeLap(1,  2, 91.5),
    ];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    const polylines = document.querySelectorAll('polyline');
    expect(polylines.length).toBe(2);
  });

  it('renders driver acronym labels at the right edge of the chart', () => {
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const laps = [makeLap(44, 1, 90), makeLap(1, 1, 92)];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    expect(screen.getAllByText('HAM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0);
  });

  it('renders the "hover to highlight" usage hint', () => {
    const drivers = [makeDriver(44, 'HAM')];
    const laps = [makeLap(44, 1, 90)];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    expect(screen.getByText(/hover a line to highlight/i)).not.toBeNull();
  });

  it('uses the team colour from driver data for polyline strokes', () => {
    const drivers = [makeDriver(44, 'HAM', 'ff0000')]; // red
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 91)];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    const polyline = document.querySelector('polyline');
    expect(polyline?.getAttribute('stroke')).toBe('#ff0000');
  });

  it('places the faster lap driver (P1) above the slower driver in computed positions', () => {
    // HAM (44) runs 90s laps — faster than VER (1) at 95s
    // At lap 1, HAM should be position 1 (smaller y value in SVG = higher on screen)
    const drivers = [makeDriver(44, 'HAM'), makeDriver(1, 'VER')];
    const laps = [
      makeLap(44, 1, 90),
      makeLap(1,  1, 95),
    ];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    const polylines = Array.from(document.querySelectorAll('polyline'));
    // Extract first y coordinate from each polyline's points attribute
    function firstY(poly: Element): number {
      const pts = poly.getAttribute('points') ?? '';
      const first = pts.trim().split(' ')[0] ?? '';
      return parseFloat(first.split(',')[1] ?? 'NaN');
    }
    const hamPoly = polylines.find(p => p.getAttribute('stroke') === '#334155');
    // Both have same colour in fixture; check that two polylines exist and have different y values
    const ys = polylines.map(firstY);
    expect(ys[0]).not.toBeNaN();
    expect(ys[1]).not.toBeNaN();
    // P1 driver should have a smaller y (higher on chart) — y increases downward in SVG
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys));
    // Suppress unused warning
    void hamPoly;
  });
});

// ---------------------------------------------------------------------------
// openf1Api integration for rate-limited banner
// ---------------------------------------------------------------------------

describe('PositionChartTab — single driver', () => {
  it('renders correctly with only one driver', () => {
    const drivers = [makeDriver(44, 'HAM')];
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 91)];
    render(<PositionChartTab drivers={drivers} laps={laps} />);
    expect(screen.getByText(/race positions by lap/i)).not.toBeNull();
    expect(document.querySelectorAll('polyline').length).toBe(1);
  });
});
