import type { QualLap, SectorColour, DriverQualBest } from './types';

function minOrNull(vals: (number | null)[]): number | null {
  const filtered = vals.filter((v): v is number => v != null);
  return filtered.length ? Math.min(...filtered) : null;
}

export function sectorColour(
  time: number | null,
  personalBest: number | null,
  overallBest: number | null,
): SectorColour {
  if (time == null) return 'grey';
  if (overallBest != null && time <= overallBest) return 'purple';
  if (personalBest != null && time <= personalBest) return 'green';
  return 'yellow';
}

export function buildQualBest(dn: number, laps: QualLap[]): DriverQualBest {
  const dl = laps.filter(l => l.driver_number === dn && !l.is_pit_out_lap && l.lap_duration != null);
  return {
    driver_number: dn,
    best_lap: dl.length ? Math.min(...dl.map(l => l.lap_duration!)) : null,
    best_s1: minOrNull(dl.map(l => l.sector_1)),
    best_s2: minOrNull(dl.map(l => l.sector_2)),
    best_s3: minOrNull(dl.map(l => l.sector_3)),
    laps_done: laps.filter(l => l.driver_number === dn).length,
  };
}

export function overallBests(laps: QualLap[]) {
  const valid = laps.filter(l => !l.is_pit_out_lap && l.lap_duration != null);
  return {
    s1: minOrNull(valid.map(l => l.sector_1)),
    s2: minOrNull(valid.map(l => l.sector_2)),
    s3: minOrNull(valid.map(l => l.sector_3)),
    lap: minOrNull(valid.map(l => l.lap_duration)),
  };
}

export function theoreticalBestLap(laps: QualLap[]): number | null {
  const { s1, s2, s3 } = overallBests(laps);
  if (s1 == null || s2 == null || s3 == null) return null;
  return s1 + s2 + s3;
}

// Split all laps into Q1/Q2/Q3 segments by detecting breaks > 5 minutes.
export function detectSegments(laps: QualLap[]): [QualLap[], QualLap[], QualLap[]] {
  if (!laps.length) return [[], [], []];

  const sorted = [...laps].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
  );

  // Find indices where a gap of >5 min exists between consecutive laps.
  const breakPoints: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].date_start).getTime() - new Date(sorted[i - 1].date_start).getTime();
    if (gap > 5 * 60 * 1000) breakPoints.push(i);
  }

  if (breakPoints.length === 0) return [sorted, [], []];
  if (breakPoints.length === 1) return [sorted.slice(0, breakPoints[0]), sorted.slice(breakPoints[0]), []];
  return [
    sorted.slice(0, breakPoints[0]),
    sorted.slice(breakPoints[0], breakPoints[1]),
    sorted.slice(breakPoints[1]),
  ];
}

// Elimination cut-off position for each segment (drivers below this position are eliminated).
export function cutoffPosition(segment: 'Q1' | 'Q2' | 'Q3', totalDrivers: number): number | null {
  if (segment === 'Q1') return totalDrivers - 5;   // bottom 5 eliminated
  if (segment === 'Q2') return totalDrivers - 5;   // bottom 5 eliminated
  return null;                                       // Q3 — no elimination
}
