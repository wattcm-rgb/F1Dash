import { describe, it, expect } from 'vitest';
import {
  latestPositionMap,
  cumulativeTimes,
  fastestLapFor,
  overallFastestLap,
  tyreHistoryFor,
  investigatedSet,
  fastestPitFor,
  gapVal,
  fmtGap,
  flagColor,
  latestFlag,
  sectorFlagMap,
} from '../../components/race/derive';
import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import type { PositionRow, PitStop, RcMsg } from '../../components/race/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDriver(n: number): OpenF1Driver {
  return {
    driver_number: n,
    broadcast_name: `Driver ${n}`,
    full_name: `Full Name ${n}`,
    name_acronym: `D${n}`,
    team_name: 'Team',
    team_colour: '1e293b',
  };
}

function makeLap(
  dn: number,
  lapNum: number,
  duration: number | null,
  isPitOut = false,
): OpenF1Lap {
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
    is_pit_out_lap: isPitOut,
    date_start: '2024-03-02T14:00:00',
  };
}

function makeStint(
  dn: number,
  stintNum: number,
  compound: OpenF1Stint['compound'],
  lapStart: number,
  lapEnd: number | null = null,
): OpenF1Stint {
  return { driver_number: dn, stint_number: stintNum, compound, lap_start: lapStart, lap_end: lapEnd, tyre_age_at_start: 0 };
}

function makePos(dn: number, pos: number, date = '2024-03-02T14:00:00'): PositionRow {
  return { driver_number: dn, position: pos, date };
}

function makePit(dn: number, lapNum: number, duration: number | null = 25): PitStop {
  return { driver_number: dn, lap_number: lapNum, pit_duration: duration, date: '2024-03-02T14:00:00' };
}

function makeMsg(overrides: Partial<RcMsg> = {}): RcMsg {
  return { date: '2024-03-02T14:30:00', message: '', ...overrides };
}

// ---------------------------------------------------------------------------
// latestPositionMap
// ---------------------------------------------------------------------------

describe('latestPositionMap', () => {
  it('returns an empty map for an empty input', () => {
    expect(latestPositionMap([])).toEqual(new Map());
  });

  it('stores the position for a driver with one entry', () => {
    const map = latestPositionMap([makePos(44, 3)]);
    expect(map.get(44)).toBe(3);
  });

  it('keeps the entry with the latest date when a driver appears multiple times', () => {
    const rows = [
      makePos(44, 1, '2024-03-02T13:00:00'),
      makePos(44, 2, '2024-03-02T14:00:00'),
    ];
    expect(latestPositionMap(rows).get(44)).toBe(2);
  });

  it('does not overwrite a later entry with an earlier one', () => {
    const rows = [
      makePos(44, 2, '2024-03-02T14:00:00'), // later, seen first
      makePos(44, 5, '2024-03-02T13:00:00'), // earlier — must NOT overwrite
    ];
    expect(latestPositionMap(rows).get(44)).toBe(2);
  });

  it('handles multiple drivers independently', () => {
    const rows = [makePos(44, 1), makePos(1, 2), makePos(33, 3)];
    const map = latestPositionMap(rows);
    expect(map.get(44)).toBe(1);
    expect(map.get(1)).toBe(2);
    expect(map.get(33)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// cumulativeTimes
// ---------------------------------------------------------------------------

describe('cumulativeTimes', () => {
  it('returns empty maps and maxLaps=0 when drivers array is empty', () => {
    const { cumTimeMap, lapsCompletedMap, maxLaps } = cumulativeTimes([], []);
    expect(cumTimeMap.size).toBe(0);
    expect(lapsCompletedMap.size).toBe(0);
    expect(maxLaps).toBe(0);
  });

  it('computes cumulative time correctly for a single lap', () => {
    const { cumTimeMap } = cumulativeTimes([makeDriver(44)], [makeLap(44, 1, 90)]);
    expect(cumTimeMap.get(44)!.get(1)).toBe(90);
  });

  it('accumulates lap times across laps', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 91), makeLap(44, 3, 89)];
    const { cumTimeMap } = cumulativeTimes([makeDriver(44)], laps);
    const byLap = cumTimeMap.get(44)!;
    expect(byLap.get(1)).toBe(90);
    expect(byLap.get(2)).toBe(90 + 91);
    expect(byLap.get(3)).toBe(90 + 91 + 89);
  });

  it('sorts laps by lap_number before accumulating even if input is unordered', () => {
    const laps = [makeLap(44, 3, 89), makeLap(44, 1, 90), makeLap(44, 2, 91)];
    const { cumTimeMap } = cumulativeTimes([makeDriver(44)], laps);
    const byLap = cumTimeMap.get(44)!;
    expect(byLap.get(1)).toBe(90);
    expect(byLap.get(2)).toBe(90 + 91);
    expect(byLap.get(3)).toBe(90 + 91 + 89);
  });

  it('ignores laps with null duration', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, null)];
    const { lapsCompletedMap } = cumulativeTimes([makeDriver(44)], laps);
    expect(lapsCompletedMap.get(44)).toBe(1);
  });

  it('ignores laps with zero duration', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 0)];
    const { lapsCompletedMap } = cumulativeTimes([makeDriver(44)], laps);
    expect(lapsCompletedMap.get(44)).toBe(1);
  });

  it('includes pit-out laps — only null/zero duration is filtered', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 95, /* isPitOut= */ true)];
    const { lapsCompletedMap } = cumulativeTimes([makeDriver(44)], laps);
    expect(lapsCompletedMap.get(44)).toBe(2);
  });

  it('sets maxLaps to the highest laps completed across all drivers', () => {
    const drivers = [makeDriver(44), makeDriver(1)];
    const laps = [
      makeLap(44, 1, 90), makeLap(44, 2, 91), makeLap(44, 3, 89),
      makeLap(1,  1, 92),
    ];
    const { maxLaps } = cumulativeTimes(drivers, laps);
    expect(maxLaps).toBe(3);
  });

  it('only counts laps belonging to each driver', () => {
    const laps = [makeLap(44, 1, 90), makeLap(1, 2, 91)];
    const { lapsCompletedMap } = cumulativeTimes([makeDriver(44)], laps);
    expect(lapsCompletedMap.get(44)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// fastestLapFor
// ---------------------------------------------------------------------------

describe('fastestLapFor', () => {
  it('returns null when there are no laps', () => {
    expect(fastestLapFor(44, [])).toBeNull();
  });

  it('returns null when all laps have null duration', () => {
    expect(fastestLapFor(44, [makeLap(44, 1, null)])).toBeNull();
  });

  it('returns null when all laps have zero duration', () => {
    expect(fastestLapFor(44, [makeLap(44, 1, 0)])).toBeNull();
  });

  it('returns null when laps exist only for other drivers', () => {
    expect(fastestLapFor(44, [makeLap(1, 1, 90)])).toBeNull();
  });

  it('returns the minimum lap duration across valid laps', () => {
    const laps = [makeLap(44, 1, 92), makeLap(44, 2, 88), makeLap(44, 3, 91)];
    expect(fastestLapFor(44, laps)).toBe(88);
  });

  it('excludes pit-out laps from the fastest-lap calculation', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 60, /* isPitOut= */ true)];
    expect(fastestLapFor(44, laps)).toBe(90);
  });

  it('only considers laps for the specified driver', () => {
    const laps = [makeLap(44, 1, 88), makeLap(1, 1, 70)];
    expect(fastestLapFor(44, laps)).toBe(88);
  });
});

// ---------------------------------------------------------------------------
// overallFastestLap
// ---------------------------------------------------------------------------

describe('overallFastestLap', () => {
  it('returns null when drivers array is empty', () => {
    expect(overallFastestLap([], [])).toBeNull();
  });

  it('returns null when no driver has valid laps', () => {
    expect(overallFastestLap([makeDriver(44)], [makeLap(44, 1, null)])).toBeNull();
  });

  it('returns the driver and time for the single fastest lap', () => {
    expect(overallFastestLap([makeDriver(44)], [makeLap(44, 1, 88)])).toEqual({ dn: 44, time: 88 });
  });

  it('returns the driver with the overall fastest lap across multiple drivers', () => {
    const drivers = [makeDriver(44), makeDriver(1)];
    const laps = [makeLap(44, 1, 90), makeLap(1, 1, 87)];
    expect(overallFastestLap(drivers, laps)).toEqual({ dn: 1, time: 87 });
  });

  it('excludes pit-out laps when finding the overall fastest', () => {
    const drivers = [makeDriver(44), makeDriver(1)];
    const laps = [
      makeLap(44, 1, 90),
      makeLap(1,  1, 60, /* isPitOut= */ true),
      makeLap(1,  2, 91),
    ];
    expect(overallFastestLap(drivers, laps)).toEqual({ dn: 44, time: 90 });
  });
});

// ---------------------------------------------------------------------------
// tyreHistoryFor
// ---------------------------------------------------------------------------

describe('tyreHistoryFor', () => {
  it('returns empty array when the driver has no stints', () => {
    expect(tyreHistoryFor(44, [], 50)).toEqual([]);
  });

  it('returns empty array when stints belong only to other drivers', () => {
    expect(tyreHistoryFor(44, [makeStint(1, 1, 'SOFT', 1, 20)], 50)).toEqual([]);
  });

  it('uses lap_end as endLap when it is set', () => {
    const [stint] = tyreHistoryFor(44, [makeStint(44, 1, 'SOFT', 1, 20)], 50);
    expect(stint.endLap).toBe(20);
    expect(stint.laps).toBe(20); // 20 - 1 + 1
  });

  it('uses maxLaps as endLap for the sole stint when lap_end is null', () => {
    const [stint] = tyreHistoryFor(44, [makeStint(44, 1, 'MEDIUM', 1, null)], 50);
    expect(stint.endLap).toBe(50);
    expect(stint.laps).toBe(50); // 50 - 1 + 1
  });

  it('derives endLap from next stint lap_start - 1 for mid-race stints with null lap_end', () => {
    const stints = [
      makeStint(44, 1, 'SOFT',   1,  null),
      makeStint(44, 2, 'MEDIUM', 21, null),
    ];
    const history = tyreHistoryFor(44, stints, 50);
    expect(history[0].endLap).toBe(20);
    expect(history[1].endLap).toBe(50);
  });

  it('preserves compound and startLap on each stint', () => {
    const [stint] = tyreHistoryFor(44, [makeStint(44, 1, 'HARD', 5, 30)], 50);
    expect(stint.compound).toBe('HARD');
    expect(stint.startLap).toBe(5);
  });

  it('sorts stints by stint_number regardless of input order', () => {
    const stints = [
      makeStint(44, 2, 'MEDIUM', 21, 40),
      makeStint(44, 1, 'SOFT',   1,  20),
    ];
    const history = tyreHistoryFor(44, stints, 50);
    expect(history[0].compound).toBe('SOFT');
    expect(history[1].compound).toBe('MEDIUM');
  });

  it('clamps laps to 0 for degenerate data where end < start', () => {
    const [stint] = tyreHistoryFor(44, [makeStint(44, 1, 'SOFT', 10, 5)], 50);
    expect(stint.laps).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// investigatedSet
// ---------------------------------------------------------------------------

describe('investigatedSet', () => {
  it('returns empty set for empty messages', () => {
    expect(investigatedSet([])).toEqual(new Set());
  });

  it('returns empty set when no messages contain UNDER INVESTIGATION', () => {
    expect(investigatedSet([makeMsg({ message: 'Track clear' })])).toEqual(new Set());
  });

  it('adds driver_number directly when the field is populated', () => {
    const set = investigatedSet([makeMsg({ message: 'CAR 44 UNDER INVESTIGATION', driver_number: 44 })]);
    expect(set.has(44)).toBe(true);
  });

  it('extracts driver number from the "CAR N" pattern when driver_number field is absent', () => {
    const set = investigatedSet([makeMsg({ message: 'CAR 33 UNDER INVESTIGATION' })]);
    expect(set.has(33)).toBe(true);
  });

  it('matching is case-insensitive', () => {
    const set = investigatedSet([makeMsg({ message: 'car 44 under investigation', driver_number: 44 })]);
    expect(set.has(44)).toBe(true);
  });

  it('adds nothing when message has no driver_number and no CAR pattern', () => {
    const set = investigatedSet([makeMsg({ message: 'Incident UNDER INVESTIGATION no car specified' })]);
    expect(set.size).toBe(0);
  });

  it('accumulates multiple investigated drivers from separate messages', () => {
    const msgs = [
      makeMsg({ message: 'UNDER INVESTIGATION', driver_number: 44 }),
      makeMsg({ message: 'UNDER INVESTIGATION', driver_number: 1 }),
    ];
    const set = investigatedSet(msgs);
    expect(set.has(44)).toBe(true);
    expect(set.has(1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fastestPitFor
// ---------------------------------------------------------------------------

describe('fastestPitFor', () => {
  it('returns null when there are no pit stops', () => {
    expect(fastestPitFor(44, [])).toBeNull();
  });

  it('returns null when all pit durations are null', () => {
    expect(fastestPitFor(44, [makePit(44, 5, null)])).toBeNull();
  });

  it('returns null when pits belong only to other drivers', () => {
    expect(fastestPitFor(44, [makePit(1, 5, 22)])).toBeNull();
  });

  it('returns the pit duration for a driver with one stop', () => {
    expect(fastestPitFor(44, [makePit(44, 5, 23)])).toBe(23);
  });

  it('returns the minimum across multiple stops', () => {
    const pits = [makePit(44, 5, 25), makePit(44, 20, 21), makePit(44, 35, 24)];
    expect(fastestPitFor(44, pits)).toBe(21);
  });

  it('only considers pits for the specified driver', () => {
    const pits = [makePit(44, 5, 25), makePit(1, 5, 18)];
    expect(fastestPitFor(44, pits)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// gapVal
// ---------------------------------------------------------------------------

describe('gapVal', () => {
  it('returns 0 for null', () => {
    expect(gapVal(null)).toBe(0);
  });

  it('returns the number directly for a numeric gap', () => {
    expect(gapVal(5.678)).toBe(5.678);
  });

  it('returns 0 for numeric 0', () => {
    expect(gapVal(0)).toBe(0);
  });

  it('parses a "+N.NNN" string gap correctly', () => {
    expect(gapVal('+5.678')).toBeCloseTo(5.678);
  });

  it('parses a string gap without a leading "+"', () => {
    expect(gapVal('3.141')).toBeCloseTo(3.141);
  });

  it('returns 1e6 + 1 for a "1 LAP" string', () => {
    expect(gapVal('1 LAP')).toBe(1e6 + 1);
  });

  it('returns 1e6 + 2 for a "2 LAPS" string', () => {
    expect(gapVal('2 LAPS')).toBe(1e6 + 2);
  });
});

// ---------------------------------------------------------------------------
// fmtGap
// ---------------------------------------------------------------------------

describe('fmtGap', () => {
  it('returns "—" for leader=true regardless of gap value', () => {
    expect(fmtGap(5.678, true)).toBe('—');
    expect(fmtGap(null,  true)).toBe('—');
  });

  it('returns "—" for a null gap (non-leader)', () => {
    expect(fmtGap(null)).toBe('—');
  });

  it('formats a numeric gap with a leading "+" and 3 decimal places', () => {
    expect(fmtGap(5.678)).toBe('+5.678');
  });

  it('formats numeric 0 as "+0.000"', () => {
    expect(fmtGap(0)).toBe('+0.000');
  });

  it('returns a string gap as-is when it already starts with "+"', () => {
    expect(fmtGap('+12.345')).toBe('+12.345');
  });

  it('prepends "+" to a string gap that does not start with "+"', () => {
    expect(fmtGap('12.345')).toBe('+12.345');
  });

  it('returns lapped-driver strings as-is when they start with "+"', () => {
    expect(fmtGap('+1 LAP')).toBe('+1 LAP');
  });
});

// ---------------------------------------------------------------------------
// flagColor
// ---------------------------------------------------------------------------

describe('flagColor', () => {
  it('returns green (#4ade80) for null', () => {
    expect(flagColor(null)).toBe('#4ade80');
  });

  it('returns green (#4ade80) for undefined', () => {
    expect(flagColor(undefined)).toBe('#4ade80');
  });

  it('returns red (#ef4444) for RED', () => {
    expect(flagColor('RED')).toBe('#ef4444');
  });

  it('returns yellow (#facc15) for YELLOW', () => {
    expect(flagColor('YELLOW')).toBe('#facc15');
  });

  it('returns yellow (#facc15) for DOUBLE YELLOW (contains YELLOW)', () => {
    expect(flagColor('DOUBLE YELLOW')).toBe('#facc15');
  });

  it('returns yellow (#facc15) for SC', () => {
    expect(flagColor('SC')).toBe('#facc15');
  });

  it('returns yellow (#facc15) for VSC', () => {
    expect(flagColor('VSC')).toBe('#facc15');
  });

  it('returns white (#f1f5f9) for CHEQUERED', () => {
    expect(flagColor('CHEQUERED')).toBe('#f1f5f9');
  });

  it('returns green (#4ade80) for unrecognised flags (e.g. BLUE)', () => {
    expect(flagColor('BLUE')).toBe('#4ade80');
  });
});

// ---------------------------------------------------------------------------
// latestFlag
// ---------------------------------------------------------------------------

describe('latestFlag', () => {
  it('returns null for an empty message list', () => {
    expect(latestFlag([])).toBeNull();
  });

  it('returns null when all flags are CLEAR', () => {
    expect(latestFlag([makeMsg({ flag: 'CLEAR' }), makeMsg({ flag: 'CLEAR' })])).toBeNull();
  });

  it('returns null when no message has a flag field', () => {
    expect(latestFlag([makeMsg()])).toBeNull();
  });

  it('returns the single non-CLEAR message when only one exists', () => {
    const msg = makeMsg({ flag: 'YELLOW' });
    expect(latestFlag([msg])).toBe(msg);
  });

  it('returns the last non-CLEAR message in input order', () => {
    const first  = makeMsg({ flag: 'YELLOW' });
    const second = makeMsg({ flag: 'RED' });
    expect(latestFlag([first, second])).toBe(second);
  });

  it('ignores CLEAR messages when finding the latest flag', () => {
    const yellow = makeMsg({ flag: 'YELLOW' });
    const clear  = makeMsg({ flag: 'CLEAR' });
    expect(latestFlag([yellow, clear])).toBe(yellow);
  });
});

// ---------------------------------------------------------------------------
// sectorFlagMap
// ---------------------------------------------------------------------------

describe('sectorFlagMap', () => {
  it('returns an empty object for empty messages', () => {
    expect(sectorFlagMap([])).toEqual({});
  });

  it('skips messages with no flag', () => {
    expect(sectorFlagMap([makeMsg({ sector: 1 })])).toEqual({});
  });

  it('skips messages where sector is null', () => {
    expect(sectorFlagMap([makeMsg({ flag: 'YELLOW', sector: null })])).toEqual({});
  });

  it('skips messages where sector is 0', () => {
    expect(sectorFlagMap([makeMsg({ flag: 'YELLOW', sector: 0 })])).toEqual({});
  });

  it('maps a flag to its sector number', () => {
    expect(sectorFlagMap([makeMsg({ flag: 'YELLOW', sector: 2 })])).toEqual({ 2: 'YELLOW' });
  });

  it('handles flags across multiple sectors independently', () => {
    const msgs = [
      makeMsg({ flag: 'YELLOW',        sector: 1 }),
      makeMsg({ flag: 'DOUBLE YELLOW', sector: 2 }),
    ];
    expect(sectorFlagMap(msgs)).toEqual({ 1: 'YELLOW', 2: 'DOUBLE YELLOW' });
  });

  it('later entries overwrite earlier ones for the same sector', () => {
    const msgs = [makeMsg({ flag: 'YELLOW', sector: 1 }), makeMsg({ flag: 'GREEN', sector: 1 })];
    expect(sectorFlagMap(msgs)).toEqual({ 1: 'GREEN' });
  });
});
