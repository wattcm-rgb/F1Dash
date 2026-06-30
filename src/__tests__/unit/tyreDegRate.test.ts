import { describe, it, expect } from 'vitest';
import { tyreDegRate } from '../../components/race/derive';
import type { OpenF1Lap, OpenF1Stint } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  lapStart: number,
  lapEnd: number | null = null,
): OpenF1Stint {
  return { driver_number: dn, stint_number: stintNum, compound: 'SOFT', lap_start: lapStart, lap_end: lapEnd, tyre_age_at_start: 0 };
}

// Build a clean set of 10 laps for driver 44 with a flat slope of +0.1s/lap
// starting at lap 1, stint 1 (lapStart=1, lapEnd=null).
function flatDegLaps(dn: number, count = 10, base = 90, slope = 0.1): OpenF1Lap[] {
  return Array.from({ length: count }, (_, i) =>
    makeLap(dn, i + 1, base + i * slope),
  );
}

// ---------------------------------------------------------------------------
// Basic cases
// ---------------------------------------------------------------------------

describe('tyreDegRate', () => {
  it('returns null when the driver has no matching stint', () => {
    const laps = flatDegLaps(44);
    const stints = [makeStint(1, 1, 1)]; // driver 1, not 44
    expect(tyreDegRate(44, 1, laps, stints)).toBeNull();
  });

  it('returns null when the driver has fewer than 4 clean laps in the stint', () => {
    const laps = [makeLap(44, 1, 90), makeLap(44, 2, 91), makeLap(44, 3, 92)];
    const stints = [makeStint(44, 1, 1)];
    expect(tyreDegRate(44, 1, laps, stints)).toBeNull();
  });

  it('returns null for a single-lap stint', () => {
    const laps = [makeLap(44, 1, 90)];
    const stints = [makeStint(44, 1, 1, 1)];
    expect(tyreDegRate(44, 1, laps, stints)).toBeNull();
  });

  it('returns null when all stint laps have null duration', () => {
    const laps = [makeLap(44, 1, null), makeLap(44, 2, null), makeLap(44, 3, null), makeLap(44, 4, null)];
    const stints = [makeStint(44, 1, 1)];
    expect(tyreDegRate(44, 1, laps, stints)).toBeNull();
  });

  it('returns a positive slope for a degrading stint', () => {
    const laps = flatDegLaps(44, 10, 90, 0.1);
    const stints = [makeStint(44, 1, 1)];
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 2);
  });

  it('returns a negative slope for an improving stint (e.g. tyre warm-up)', () => {
    const laps = flatDegLaps(44, 10, 90, -0.05);
    const stints = [makeStint(44, 1, 1)];
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(-0.05, 2);
  });

  it('returns ~0 for a perfectly flat stint', () => {
    const laps = flatDegLaps(44, 10, 90, 0);
    const stints = [makeStint(44, 1, 1)];
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    expect(Math.abs(rate!)).toBeLessThan(0.001);
  });

  it('excludes pit-out laps from the regression', () => {
    // Pit-out lap 1 is wildly slow — should not distort the slope
    const laps = [
      makeLap(44, 1, 200, /* isPitOut= */ true), // should be ignored
      makeLap(44, 2, 90),
      makeLap(44, 3, 90.1),
      makeLap(44, 4, 90.2),
      makeLap(44, 5, 90.3),
    ];
    const stints = [makeStint(44, 1, 1)]; // lap_start=1 includes the pit-out lap range
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 2);
  });

  it('excludes laps above 110% of median (safety-car / crash laps)', () => {
    // Laps 1-4 are clean ~90 s; lap 5 is artificially slow (safety car)
    const laps = [
      makeLap(44, 1, 90),
      makeLap(44, 2, 90.1),
      makeLap(44, 3, 90.2),
      makeLap(44, 4, 90.3),
      makeLap(44, 5, 200), // should be excluded by the 110% median filter
    ];
    const stints = [makeStint(44, 1, 1)];
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    // With only the 4 clean laps the slope should still be ~0.1
    expect(rate!).toBeCloseTo(0.1, 2);
  });

  it('only counts laps within the stint lap range (lap_start … lap_end)', () => {
    // Driver has laps 1-10 but the stint is only laps 6-10
    const laps = flatDegLaps(44, 10, 90, 0.5);
    const stints = [makeStint(44, 1, 6, 10)];
    // Laps 6-10 have slope 0.5 s/lap; laps 1-5 should be excluded
    const rate = tyreDegRate(44, 1, laps, stints);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.5, 2);
  });

  it('handles multiple drivers and picks only the correct driver', () => {
    const laps44 = flatDegLaps(44, 10, 90, 0.1);
    const laps1  = flatDegLaps(1, 10, 80, 0.5);
    const stints = [makeStint(44, 1, 1), makeStint(1, 1, 1)];
    const rate44 = tyreDegRate(44, 1, [...laps44, ...laps1], stints);
    expect(rate44).toBeCloseTo(0.1, 2);
  });

  it('handles a second stint for the same driver', () => {
    const lapsStint1 = flatDegLaps(44, 15, 90, 0.3);
    const lapsStint2 = flatDegLaps(44, 10, 91, 0.05).map(l => ({
      ...l,
      lap_number: l.lap_number + 15,
    }));
    const stints = [
      makeStint(44, 1, 1, 15),
      makeStint(44, 2, 16, null),
    ];
    const rate2 = tyreDegRate(44, 2, [...lapsStint1, ...lapsStint2], stints);
    expect(rate2).not.toBeNull();
    expect(rate2!).toBeCloseTo(0.05, 2);
  });
});
