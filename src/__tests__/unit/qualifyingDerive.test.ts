import { describe, it, expect } from 'vitest';
import {
  sectorColour,
  buildQualBest,
  overallBests,
  theoreticalBestLap,
  detectSegments,
  cutoffPosition,
} from '../../components/qualifying/derive';
import type { QualLap } from '../../components/qualifying/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lap(overrides: Partial<QualLap> = {}): QualLap {
  return {
    driver_number: 1,
    lap_number: 1,
    lap_duration: 90.0,
    sector_1: 28.0,
    sector_2: 32.0,
    sector_3: 30.0,
    is_pit_out_lap: false,
    date_start: '2024-06-01T14:00:00',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sectorColour
// ---------------------------------------------------------------------------

describe('sectorColour', () => {
  it('returns grey when time is null', () => {
    expect(sectorColour(null, 28.0, 27.0)).toBe('grey');
  });

  it('returns purple when time equals the overall best', () => {
    expect(sectorColour(27.5, 28.0, 27.5)).toBe('purple');
  });

  it('returns purple when time is faster than the overall best', () => {
    expect(sectorColour(27.4, 28.0, 27.5)).toBe('purple');
  });

  it('returns green when time equals the personal best (but not overall)', () => {
    expect(sectorColour(28.0, 28.0, 27.5)).toBe('green');
  });

  it('returns green when time beats the personal best (but not overall)', () => {
    expect(sectorColour(27.9, 28.0, 27.5)).toBe('green');
  });

  it('returns yellow when time is slower than personal best', () => {
    expect(sectorColour(29.0, 28.0, 27.5)).toBe('yellow');
  });

  it('returns yellow when overallBest is null but time is slower than personal best', () => {
    expect(sectorColour(29.0, 28.0, null)).toBe('yellow');
  });

  it('returns yellow when both personalBest and overallBest are null', () => {
    // No reference points to compare against, so the time cannot be classified as an improvement.
    expect(sectorColour(29.0, null, null)).toBe('yellow');
  });

  it('returns purple when both bests are equal and time matches', () => {
    expect(sectorColour(28.0, 28.0, 28.0)).toBe('purple');
  });
});

// ---------------------------------------------------------------------------
// buildQualBest
// ---------------------------------------------------------------------------

describe('buildQualBest', () => {
  it('returns null fields when driver has no laps', () => {
    const result = buildQualBest(1, []);
    expect(result.best_lap).toBeNull();
    expect(result.best_s1).toBeNull();
    expect(result.best_s2).toBeNull();
    expect(result.best_s3).toBeNull();
    expect(result.laps_done).toBe(0);
  });

  it('picks the fastest lap_duration across multiple laps', () => {
    const laps = [
      lap({ lap_duration: 91.0, lap_number: 1 }),
      lap({ lap_duration: 89.5, lap_number: 2 }),
      lap({ lap_duration: 90.2, lap_number: 3 }),
    ];
    expect(buildQualBest(1, laps).best_lap).toBe(89.5);
  });

  it('picks the best individual sector times independently', () => {
    const laps = [
      lap({ lap_number: 1, sector_1: 28.0, sector_2: 33.0, sector_3: 31.0, lap_duration: 92.0 }),
      lap({ lap_number: 2, sector_1: 29.0, sector_2: 31.5, sector_3: 29.5, lap_duration: 90.0 }),
    ];
    const best = buildQualBest(1, laps);
    expect(best.best_s1).toBe(28.0);
    expect(best.best_s2).toBe(31.5);
    expect(best.best_s3).toBe(29.5);
  });

  it('excludes pit-out laps from best lap calculation', () => {
    const laps = [
      lap({ lap_duration: 89.0, is_pit_out_lap: true, lap_number: 1 }),
      lap({ lap_duration: 91.0, is_pit_out_lap: false, lap_number: 2 }),
    ];
    expect(buildQualBest(1, laps).best_lap).toBe(91.0);
  });

  it('excludes laps with null lap_duration from best lap', () => {
    const laps = [
      lap({ lap_duration: null, lap_number: 1 }),
      lap({ lap_duration: 90.5, lap_number: 2 }),
    ];
    expect(buildQualBest(1, laps).best_lap).toBe(90.5);
  });

  it('counts all laps for laps_done, including pit-out laps', () => {
    const laps = [
      lap({ lap_number: 1, is_pit_out_lap: true }),
      lap({ lap_number: 2 }),
      lap({ lap_number: 3 }),
    ];
    expect(buildQualBest(1, laps).laps_done).toBe(3);
  });

  it('ignores laps from other drivers', () => {
    const laps = [
      lap({ driver_number: 1, lap_duration: 90.0 }),
      lap({ driver_number: 44, lap_duration: 88.0 }),
    ];
    expect(buildQualBest(1, laps).best_lap).toBe(90.0);
    expect(buildQualBest(44, laps).best_lap).toBe(88.0);
  });

  it('handles sector times that are null', () => {
    const laps = [lap({ sector_1: null, sector_2: null, sector_3: null, lap_duration: 90.0 })];
    const best = buildQualBest(1, laps);
    expect(best.best_s1).toBeNull();
    expect(best.best_s2).toBeNull();
    expect(best.best_s3).toBeNull();
    expect(best.best_lap).toBe(90.0);
  });
});

// ---------------------------------------------------------------------------
// overallBests
// ---------------------------------------------------------------------------

describe('overallBests', () => {
  it('returns nulls when no laps provided', () => {
    const result = overallBests([]);
    expect(result.s1).toBeNull();
    expect(result.s2).toBeNull();
    expect(result.s3).toBeNull();
    expect(result.lap).toBeNull();
  });

  it('finds the minimum across all drivers for each sector', () => {
    const laps = [
      lap({ driver_number: 1, sector_1: 28.0, sector_2: 32.0, sector_3: 30.0, lap_duration: 90.0 }),
      lap({ driver_number: 44, sector_1: 27.5, sector_2: 31.0, sector_3: 31.0, lap_duration: 89.5 }),
    ];
    const result = overallBests(laps);
    expect(result.s1).toBe(27.5);
    expect(result.s2).toBe(31.0);
    expect(result.s3).toBe(30.0);
    expect(result.lap).toBe(89.5);
  });

  it('excludes pit-out laps from overall bests', () => {
    const laps = [
      lap({ sector_1: 20.0, lap_duration: 80.0, is_pit_out_lap: true }),
      lap({ sector_1: 28.0, lap_duration: 90.0, is_pit_out_lap: false }),
    ];
    expect(overallBests(laps).s1).toBe(28.0);
    expect(overallBests(laps).lap).toBe(90.0);
  });

  it('excludes laps with null lap_duration', () => {
    const laps = [
      lap({ sector_1: 20.0, lap_duration: null }),
      lap({ sector_1: 28.0, lap_duration: 90.0 }),
    ];
    // sector_1=20 is from null-duration lap, should be excluded
    expect(overallBests(laps).s1).toBe(28.0);
  });
});

// ---------------------------------------------------------------------------
// theoreticalBestLap
// ---------------------------------------------------------------------------

describe('theoreticalBestLap', () => {
  it('returns null when laps array is empty', () => {
    expect(theoreticalBestLap([])).toBeNull();
  });

  it('returns sum of best S1 + best S2 + best S3 across field', () => {
    const laps = [
      lap({ driver_number: 1, sector_1: 28.0, sector_2: 32.0, sector_3: 30.5, lap_duration: 90.5 }),
      lap({ driver_number: 44, sector_1: 27.0, sector_2: 31.0, sector_3: 31.0, lap_duration: 89.0 }),
    ];
    // best S1=27.0, best S2=31.0, best S3=30.5
    expect(theoreticalBestLap(laps)).toBeCloseTo(88.5, 5);
  });

  it('returns null when any sector is null across all laps', () => {
    const laps = [
      lap({ sector_1: null, sector_2: 32.0, sector_3: 30.0, lap_duration: 90.0 }),
    ];
    expect(theoreticalBestLap(laps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectSegments
// ---------------------------------------------------------------------------

describe('detectSegments', () => {
  const BASE_TIME = new Date('2024-06-01T14:00:00').getTime();

  function atMs(ms: number, overrides: Partial<QualLap> = {}): QualLap {
    return lap({ date_start: new Date(BASE_TIME + ms).toISOString(), ...overrides });
  }

  it('returns three empty arrays for empty input', () => {
    expect(detectSegments([])).toEqual([[], [], []]);
  });

  it('returns all laps in Q1 when there are no breaks', () => {
    const laps = [
      atMs(0),
      atMs(60_000),
      atMs(120_000),
    ];
    const [q1, q2, q3] = detectSegments(laps);
    expect(q1).toHaveLength(3);
    expect(q2).toHaveLength(0);
    expect(q3).toHaveLength(0);
  });

  it('splits into Q1 and Q2 when there is one break > 5 minutes', () => {
    const laps = [
      atMs(0, { lap_number: 1 }),
      atMs(60_000, { lap_number: 2 }),
      atMs(60_000 + 6 * 60_000, { lap_number: 3 }), // 6-min gap
      atMs(60_000 + 7 * 60_000, { lap_number: 4 }),
    ];
    const [q1, q2, q3] = detectSegments(laps);
    expect(q1).toHaveLength(2);
    expect(q2).toHaveLength(2);
    expect(q3).toHaveLength(0);
  });

  it('splits into Q1, Q2, Q3 when there are two breaks > 5 minutes', () => {
    const laps = [
      atMs(0, { lap_number: 1 }),
      atMs(60_000, { lap_number: 2 }),
      atMs(60_000 + 6 * 60_000, { lap_number: 3 }),  // Q1→Q2 break
      atMs(60_000 + 7 * 60_000, { lap_number: 4 }),
      atMs(60_000 + 13 * 60_000, { lap_number: 5 }), // Q2→Q3 break
      atMs(60_000 + 14 * 60_000, { lap_number: 6 }),
    ];
    const [q1, q2, q3] = detectSegments(laps);
    expect(q1).toHaveLength(2);
    expect(q2).toHaveLength(2);
    expect(q3).toHaveLength(2);
  });

  it('does not split on a gap of exactly 5 minutes (must be strictly greater)', () => {
    const laps = [
      atMs(0),
      atMs(5 * 60_000), // exactly 5 min — not a break
    ];
    const [q1, q2] = detectSegments(laps);
    expect(q1).toHaveLength(2);
    expect(q2).toHaveLength(0);
  });

  it('splits on a gap of 5 minutes and 1 millisecond', () => {
    const laps = [
      atMs(0),
      atMs(5 * 60_000 + 1),
    ];
    const [q1, q2] = detectSegments(laps);
    expect(q1).toHaveLength(1);
    expect(q2).toHaveLength(1);
  });

  it('sorts laps chronologically before splitting (order-independent input)', () => {
    // Deliberately out of order
    const laps = [
      atMs(60_000 + 7 * 60_000, { lap_number: 4 }),
      atMs(0, { lap_number: 1 }),
      atMs(60_000 + 6 * 60_000, { lap_number: 3 }),
      atMs(60_000, { lap_number: 2 }),
    ];
    const [q1, q2] = detectSegments(laps);
    expect(q1).toHaveLength(2);
    expect(q2).toHaveLength(2);
  });

  it('assigns laps to the correct segment boundary', () => {
    const early = atMs(0, { lap_number: 1 });
    const late = atMs(10 * 60_000, { lap_number: 2 }); // 10-min gap → Q2
    const [q1, q2] = detectSegments([early, late]);
    expect(q1[0].lap_number).toBe(1);
    expect(q2[0].lap_number).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// cutoffPosition
// ---------------------------------------------------------------------------

describe('cutoffPosition', () => {
  it('returns totalDrivers - 5 for Q1', () => {
    expect(cutoffPosition('Q1', 20)).toBe(15);
    expect(cutoffPosition('Q1', 18)).toBe(13);
  });

  it('returns totalDrivers - 5 for Q2', () => {
    expect(cutoffPosition('Q2', 15)).toBe(10);
  });

  it('returns null for Q3 (no elimination)', () => {
    expect(cutoffPosition('Q3', 10)).toBeNull();
  });
});
