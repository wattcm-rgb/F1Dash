import { describe, it, expect } from 'vitest';
import {
  placeholderDriver,
  TYRE_COLOUR,
  TYRE_LABEL,
  fmtTime,
  sectorClass,
  overallSectorBests,
  driverLapStats,
  sectorClasses,
  currentStint,
  tyreAge,
  rankByBestLap,
} from '../../utils/timing';
import type { OpenF1Lap, OpenF1Stint, OpenF1Driver } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLap(overrides: Partial<OpenF1Lap> & Pick<OpenF1Lap, 'driver_number' | 'lap_number'>): OpenF1Lap {
  return {
    lap_duration: null,
    duration_sector_1: null,
    duration_sector_2: null,
    duration_sector_3: null,
    i1_speed: null,
    i2_speed: null,
    st_speed: null,
    is_pit_out_lap: false,
    date_start: '2024-03-02T14:00:00',
    ...overrides,
  };
}

function makeStint(overrides: Partial<OpenF1Stint> & Pick<OpenF1Stint, 'driver_number' | 'stint_number'>): OpenF1Stint {
  return {
    lap_start: 1,
    lap_end: null,
    compound: 'SOFT',
    tyre_age_at_start: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// placeholderDriver
// ---------------------------------------------------------------------------

describe('placeholderDriver', () => {
  it('returns a driver with a negated driver_number', () => {
    expect(placeholderDriver(3).driver_number).toBe(-3);
    expect(placeholderDriver(1).driver_number).toBe(-1);
  });

  it('sets all name fields to the em-dash placeholder', () => {
    const d: OpenF1Driver = placeholderDriver(1);
    expect(d.broadcast_name).toBe('—');
    expect(d.full_name).toBe('—');
    expect(d.name_acronym).toBe('—');
    expect(d.team_name).toBe('—');
  });

  it('uses a dark slate team_colour so placeholder rows are visually distinct', () => {
    expect(placeholderDriver(1).team_colour).toBe('1e293b');
  });
});

// ---------------------------------------------------------------------------
// TYRE_COLOUR / TYRE_LABEL maps
// ---------------------------------------------------------------------------

describe('TYRE_COLOUR', () => {
  const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET', 'UNKNOWN'] as const;

  it('has a colour entry for every compound', () => {
    compounds.forEach(c => expect(TYRE_COLOUR[c]).toBeDefined());
  });

  it('uses the expected colours for each compound', () => {
    expect(TYRE_COLOUR.SOFT).toBe('#f87171');
    expect(TYRE_COLOUR.MEDIUM).toBe('#facc15');
    expect(TYRE_COLOUR.HARD).toBe('#e2e8f0');
    expect(TYRE_COLOUR.INTERMEDIATE).toBe('#4ade80');
    expect(TYRE_COLOUR.WET).toBe('#60a5fa');
    expect(TYRE_COLOUR.UNKNOWN).toBe('#64748b');
  });
});

describe('TYRE_LABEL', () => {
  it('uses a single-letter label for every compound', () => {
    expect(TYRE_LABEL.SOFT).toBe('S');
    expect(TYRE_LABEL.MEDIUM).toBe('M');
    expect(TYRE_LABEL.HARD).toBe('H');
    expect(TYRE_LABEL.INTERMEDIATE).toBe('I');
    expect(TYRE_LABEL.WET).toBe('W');
    expect(TYRE_LABEL.UNKNOWN).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// fmtTime
// ---------------------------------------------------------------------------

describe('fmtTime', () => {
  it('returns "—" for null', () => {
    expect(fmtTime(null)).toBe('—');
  });

  it('formats zero as sub-minute', () => {
    expect(fmtTime(0)).toBe('00.000');
  });

  it('pads single-digit seconds with a leading zero', () => {
    expect(fmtTime(3.1)).toBe('03.100');
  });

  it('formats a typical sub-minute sector time', () => {
    expect(fmtTime(23.456)).toBe('23.456');
  });

  it('formats exactly 60 seconds as 1:00.000', () => {
    expect(fmtTime(60)).toBe('1:00.000');
  });

  it('formats a typical lap time over a minute', () => {
    expect(fmtTime(83.456)).toBe('1:23.456');
  });

  it('preserves three decimal places', () => {
    expect(fmtTime(90)).toBe('1:30.000');
  });
});

// ---------------------------------------------------------------------------
// sectorClass
// ---------------------------------------------------------------------------

describe('sectorClass', () => {
  it('returns "white" when the current value is null', () => {
    expect(sectorClass(null, 20, 19)).toBe('white');
    expect(sectorClass(null, null, null)).toBe('white');
  });

  it('returns "purple" when the value equals the overall best', () => {
    expect(sectorClass(19, 20, 19)).toBe('purple');
  });

  it('returns "purple" when the value beats the overall best', () => {
    expect(sectorClass(18, 20, 19)).toBe('purple');
  });

  it('returns "green" when the value equals the personal best but not the overall best', () => {
    // v(20) > ob(19) but v(20) <= pb(20)
    expect(sectorClass(20, 20, 19)).toBe('green');
  });

  it('returns "green" when the value equals the personal best and there is no overall best', () => {
    expect(sectorClass(20, 20, null)).toBe('green');
  });

  it('returns "yellow" when the value is worse than both bests', () => {
    expect(sectorClass(21, 20, 19)).toBe('yellow');
  });

  it('returns "yellow" when there are no bests to compare against', () => {
    expect(sectorClass(20, null, null)).toBe('yellow');
  });
});

// ---------------------------------------------------------------------------
// overallSectorBests
// ---------------------------------------------------------------------------

describe('overallSectorBests', () => {
  it('returns all-null for an empty lap array', () => {
    expect(overallSectorBests([])).toEqual({ s1: null, s2: null, s3: null });
  });

  it('returns the sectors from a single lap', () => {
    const laps = [makeLap({ driver_number: 1, lap_number: 1, duration_sector_1: 20, duration_sector_2: 30, duration_sector_3: 25 })];
    expect(overallSectorBests(laps)).toEqual({ s1: 20, s2: 30, s3: 25 });
  });

  it('returns the minimum sector time across all drivers and laps', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, duration_sector_1: 20, duration_sector_2: 31, duration_sector_3: 25 }),
      makeLap({ driver_number: 2, lap_number: 1, duration_sector_1: 19, duration_sector_2: 30, duration_sector_3: 26 }),
    ];
    expect(overallSectorBests(laps)).toEqual({ s1: 19, s2: 30, s3: 25 });
  });

  it('ignores null sector values when computing the minimum', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, duration_sector_1: null, duration_sector_2: 30 }),
      makeLap({ driver_number: 2, lap_number: 1, duration_sector_1: 19, duration_sector_2: null }),
    ];
    expect(overallSectorBests(laps)).toEqual({ s1: 19, s2: 30, s3: null });
  });

  it('returns null for a sector where every lap has a null value', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, duration_sector_1: null }),
      makeLap({ driver_number: 2, lap_number: 1, duration_sector_1: null }),
    ];
    expect(overallSectorBests(laps).s1).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// driverLapStats
// ---------------------------------------------------------------------------

describe('driverLapStats', () => {
  it('returns zero/null defaults when the driver has no laps', () => {
    const stats = driverLapStats(1, []);
    expect(stats.last).toBeUndefined();
    expect(stats.bestLap).toBeNull();
    expect(stats.lastLap).toBeNull();
    expect(stats.s1).toBeNull();
    expect(stats.s2).toBeNull();
    expect(stats.s3).toBeNull();
    expect(stats.pbS1).toBeNull();
    expect(stats.pbS2).toBeNull();
    expect(stats.pbS3).toBeNull();
    expect(stats.inPit).toBe(false);
    expect(stats.lapsCount).toBe(0);
  });

  it('returns correct stats for a single normal lap', () => {
    const laps = [makeLap({
      driver_number: 1, lap_number: 1,
      lap_duration: 90.5,
      duration_sector_1: 28, duration_sector_2: 35, duration_sector_3: 27.5,
    })];
    const stats = driverLapStats(1, laps);
    expect(stats.bestLap).toBe(90.5);
    expect(stats.lastLap).toBe(90.5);
    expect(stats.s1).toBe(28);
    expect(stats.s2).toBe(35);
    expect(stats.s3).toBe(27.5);
    expect(stats.pbS1).toBe(28);
    expect(stats.pbS2).toBe(35);
    expect(stats.pbS3).toBe(27.5);
    expect(stats.lapsCount).toBe(1);
    expect(stats.inPit).toBe(false);
  });

  it('picks bestLap as the minimum valid lap_duration across multiple laps', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, lap_duration: 91 }),
      makeLap({ driver_number: 1, lap_number: 2, lap_duration: 89.5 }),
      makeLap({ driver_number: 1, lap_number: 3, lap_duration: 90 }),
    ];
    expect(driverLapStats(1, laps).bestLap).toBe(89.5);
  });

  it('excludes pit-out laps from bestLap and personal-best sectors', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, lap_duration: 90.5, duration_sector_1: 28 }),
      makeLap({ driver_number: 1, lap_number: 2, lap_duration: 120, is_pit_out_lap: true, duration_sector_1: 40 }),
    ];
    const stats = driverLapStats(1, laps);
    expect(stats.bestLap).toBe(90.5);
    expect(stats.pbS1).toBe(28);
    expect(stats.lapsCount).toBe(2); // all laps still counted
  });

  it('reads s1/s2/s3 from the last lap even when it is a pit-out lap', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, duration_sector_1: 28 }),
      makeLap({ driver_number: 1, lap_number: 2, is_pit_out_lap: true, duration_sector_1: 40 }),
    ];
    expect(driverLapStats(1, laps).s1).toBe(40);
  });

  it('sets inPit true when the last recorded lap is a pit-out lap', () => {
    const laps = [makeLap({ driver_number: 1, lap_number: 1, is_pit_out_lap: true })];
    expect(driverLapStats(1, laps).inPit).toBe(true);
  });

  it('excludes laps with null lap_duration from bestLap', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, lap_duration: null }), // in-progress lap
      makeLap({ driver_number: 1, lap_number: 2, lap_duration: 91 }),
    ];
    expect(driverLapStats(1, laps).bestLap).toBe(91);
  });

  it('ignores laps belonging to other drivers', () => {
    const laps = [makeLap({ driver_number: 2, lap_number: 1, lap_duration: 88 })];
    expect(driverLapStats(1, laps).bestLap).toBeNull();
    expect(driverLapStats(1, laps).lapsCount).toBe(0);
  });

  it('tracks personal-best sectors independently across laps', () => {
    const laps = [
      makeLap({ driver_number: 1, lap_number: 1, lap_duration: 91, duration_sector_1: 28, duration_sector_2: 36, duration_sector_3: 27 }),
      makeLap({ driver_number: 1, lap_number: 2, lap_duration: 90, duration_sector_1: 30, duration_sector_2: 34, duration_sector_3: 26 }),
    ];
    const stats = driverLapStats(1, laps);
    expect(stats.pbS1).toBe(28);
    expect(stats.pbS2).toBe(34);
    expect(stats.pbS3).toBe(26);
  });
});

// ---------------------------------------------------------------------------
// sectorClasses
// ---------------------------------------------------------------------------

describe('sectorClasses', () => {
  it('returns the correct class for each sector based on value vs. personal and overall bests', () => {
    const st = driverLapStats(1, [
      makeLap({ driver_number: 1, lap_number: 1, lap_duration: 91, duration_sector_1: 20, duration_sector_2: 34, duration_sector_3: 29 }),
      makeLap({ driver_number: 1, lap_number: 2, lap_duration: 90, duration_sector_1: 18, duration_sector_2: 32, duration_sector_3: 30 }),
    ]);
    // ob: s1=19 (other driver), s2=30 (other), s3=28 (other)
    const ob = { s1: 19, s2: 30, s3: 28 };
    const { s1c, s2c, s3c } = sectorClasses(st, ob);
    // s1=18 <= ob(19) → purple
    expect(s1c).toBe('purple');
    // s2=32, ob=30: 32 > 30; pb=32: 32 <= 32 → green
    expect(s2c).toBe('green');
    // s3=30, ob=28: 30 > 28; pb=29: 30 > 29 → yellow
    expect(s3c).toBe('yellow');
  });

  it('returns "white" for all sectors when last-lap sectors are null', () => {
    const st = driverLapStats(1, []); // no laps → all null
    const ob = { s1: null, s2: null, s3: null };
    const { s1c, s2c, s3c } = sectorClasses(st, ob);
    expect(s1c).toBe('white');
    expect(s2c).toBe('white');
    expect(s3c).toBe('white');
  });
});

// ---------------------------------------------------------------------------
// currentStint
// ---------------------------------------------------------------------------

describe('currentStint', () => {
  it('returns undefined for an empty stints array', () => {
    expect(currentStint(1, [])).toBeUndefined();
  });

  it('returns undefined when the driver has no stints', () => {
    const stints = [makeStint({ driver_number: 2, stint_number: 1 })];
    expect(currentStint(1, stints)).toBeUndefined();
  });

  it('returns the only stint when a driver has one', () => {
    const stint = makeStint({ driver_number: 1, stint_number: 1, compound: 'SOFT' });
    expect(currentStint(1, [stint])).toEqual(stint);
  });

  it('returns the stint with the highest stint_number (most recent)', () => {
    const stints = [
      makeStint({ driver_number: 1, stint_number: 1, compound: 'SOFT' }),
      makeStint({ driver_number: 1, stint_number: 2, compound: 'MEDIUM' }),
      makeStint({ driver_number: 1, stint_number: 3, compound: 'HARD' }),
    ];
    expect(currentStint(1, stints)?.compound).toBe('HARD');
  });

  it('ignores stints belonging to other drivers', () => {
    const stints = [
      makeStint({ driver_number: 2, stint_number: 5, compound: 'SOFT' }),
      makeStint({ driver_number: 1, stint_number: 1, compound: 'MEDIUM' }),
    ];
    expect(currentStint(1, stints)?.compound).toBe('MEDIUM');
  });

  it('handles out-of-order stint_numbers and still returns the highest', () => {
    const stints = [
      makeStint({ driver_number: 1, stint_number: 3, compound: 'HARD' }),
      makeStint({ driver_number: 1, stint_number: 1, compound: 'SOFT' }),
      makeStint({ driver_number: 1, stint_number: 2, compound: 'MEDIUM' }),
    ];
    expect(currentStint(1, stints)?.stint_number).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// tyreAge
// ---------------------------------------------------------------------------

describe('tyreAge', () => {
  it('returns 0 when stint is undefined', () => {
    expect(tyreAge(undefined, 5)).toBe(0);
  });

  it('calculates age for a fresh tyre starting from lap 1', () => {
    // age = 0 + (5 - (1 - 1)) = 5
    const stint = makeStint({ driver_number: 1, stint_number: 1, lap_start: 1, tyre_age_at_start: 0 });
    expect(tyreAge(stint, 5)).toBe(5);
  });

  it('adds pre-existing tyre age for a used (carry-over) tyre', () => {
    // age = 5 + (3 - (1 - 1)) = 8
    const stint = makeStint({ driver_number: 1, stint_number: 1, lap_start: 1, tyre_age_at_start: 5 });
    expect(tyreAge(stint, 3)).toBe(8);
  });

  it('calculates age for a pit-stop stint change mid-race', () => {
    // age = 0 + (20 - (15 - 1)) = 6
    const stint = makeStint({ driver_number: 1, stint_number: 2, lap_start: 15, tyre_age_at_start: 0 });
    expect(tyreAge(stint, 20)).toBe(6);
  });

  it('returns 1 on the very first lap of a new stint', () => {
    // age = 0 + (10 - (10 - 1)) = 1
    const stint = makeStint({ driver_number: 1, stint_number: 2, lap_start: 10, tyre_age_at_start: 0 });
    expect(tyreAge(stint, 10)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// rankByBestLap
// ---------------------------------------------------------------------------

describe('rankByBestLap', () => {
  type Row = { bestLap: number | null; pos: number; gap: number | null; name: string };

  function makeRow(name: string, bestLap: number | null): Row {
    return { name, bestLap, pos: 0, gap: null };
  }

  it('returns an empty array unchanged', () => {
    expect(rankByBestLap([])).toEqual([]);
  });

  it('assigns pos=1 and gap=null to the single row', () => {
    const rows = [makeRow('VER', 90)];
    const [result] = rankByBestLap(rows);
    expect(result.pos).toBe(1);
    expect(result.gap).toBeNull();
  });

  it('sorts rows by bestLap ascending', () => {
    const rows = [makeRow('HAM', 91), makeRow('VER', 89), makeRow('LEC', 90)];
    const result = rankByBestLap(rows);
    expect(result.map(r => r.name)).toEqual(['VER', 'LEC', 'HAM']);
  });

  it('assigns sequential 1-based positions', () => {
    const rows = [makeRow('HAM', 91), makeRow('VER', 89), makeRow('LEC', 90)];
    const result = rankByBestLap(rows);
    expect(result.map(r => r.pos)).toEqual([1, 2, 3]);
  });

  it('sets gap=null for the leader and calculates gap-to-leader for others', () => {
    const rows = [makeRow('VER', 89), makeRow('LEC', 90), makeRow('HAM', 91)];
    const result = rankByBestLap(rows);
    expect(result[0].gap).toBeNull();
    expect(result[1].gap).toBeCloseTo(1.0);
    expect(result[2].gap).toBeCloseTo(2.0);
  });

  it('sorts rows with null bestLap to the end', () => {
    const rows = [makeRow('DNF', null), makeRow('VER', 89), makeRow('DNF2', null)];
    const result = rankByBestLap(rows);
    expect(result[0].name).toBe('VER');
    expect(result[0].pos).toBe(1);
  });

  it('assigns null gap to DNF/no-lap-time rows', () => {
    const rows = [makeRow('VER', 89), makeRow('DNF', null)];
    const result = rankByBestLap(rows);
    expect(result[1].gap).toBeNull();
  });

  it('assigns null gap to every row when all bestLaps are null', () => {
    const rows = [makeRow('DNF1', null), makeRow('DNF2', null)];
    rankByBestLap(rows).forEach(r => expect(r.gap).toBeNull());
  });

  it('mutates the input array and returns the same reference', () => {
    const rows = [makeRow('VER', 89), makeRow('HAM', 91)];
    const result = rankByBestLap(rows);
    expect(result).toBe(rows);
  });
});
