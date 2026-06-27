import type { OpenF1Lap, OpenF1Stint } from '../types/openf1';

export const TYRE_COLOUR: Record<string, string> = {
  SOFT: '#f87171', MEDIUM: '#facc15', HARD: '#e2e8f0',
  INTERMEDIATE: '#4ade80', WET: '#60a5fa', UNKNOWN: '#64748b',
};

export const TYRE_LABEL: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
};

// "1:23.456" for laps, "23.456" for sub-minute times.
export function fmtTime(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${rest}` : rest;
}

// purple = overall best, green = personal best, yellow = no improvement.
export function sectorClass(v: number | null, pb: number | null, ob: number | null): string {
  if (v == null) return 'white';
  if (ob != null && v <= ob) return 'purple';
  if (pb != null && v <= pb) return 'green';
  return 'yellow';
}

export interface SectorBests { s1: number | null; s2: number | null; s3: number | null; }

export function overallSectorBests(laps: OpenF1Lap[]): SectorBests {
  const best = (sel: (l: OpenF1Lap) => number | null): number | null => {
    const vals = laps.map(sel).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  return {
    s1: best(l => l.duration_sector_1),
    s2: best(l => l.duration_sector_2),
    s3: best(l => l.duration_sector_3),
  };
}

export interface DriverLapStats {
  last: OpenF1Lap | undefined;
  bestLap: number | null;
  lastLap: number | null;
  s1: number | null; s2: number | null; s3: number | null;
  pbS1: number | null; pbS2: number | null; pbS3: number | null;
  inPit: boolean;
  lapsCount: number;
}

export function driverLapStats(driverNumber: number, laps: OpenF1Lap[]): DriverLapStats {
  const dl = laps.filter(l => l.driver_number === driverNumber);
  const valid = dl.filter(l => l.lap_duration != null && !l.is_pit_out_lap);
  const last = dl[dl.length - 1];
  const pb = (sel: (l: OpenF1Lap) => number | null): number | null => {
    const vals = valid.map(sel).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  return {
    last,
    bestLap: valid.length ? Math.min(...valid.map(l => l.lap_duration!)) : null,
    lastLap: last?.lap_duration ?? null,
    s1: last?.duration_sector_1 ?? null,
    s2: last?.duration_sector_2 ?? null,
    s3: last?.duration_sector_3 ?? null,
    pbS1: pb(l => l.duration_sector_1),
    pbS2: pb(l => l.duration_sector_2),
    pbS3: pb(l => l.duration_sector_3),
    inPit: last?.is_pit_out_lap ?? false,
    lapsCount: dl.length,
  };
}

export interface SectorClasses { s1c: string; s2c: string; s3c: string; }

export function sectorClasses(st: DriverLapStats, ob: SectorBests): SectorClasses {
  return {
    s1c: sectorClass(st.s1, st.pbS1, ob.s1),
    s2c: sectorClass(st.s2, st.pbS2, ob.s2),
    s3c: sectorClass(st.s3, st.pbS3, ob.s3),
  };
}

export function currentStint(driverNumber: number, stints: OpenF1Stint[]): OpenF1Stint | undefined {
  return stints
    .filter(s => s.driver_number === driverNumber)
    .sort((a, b) => b.stint_number - a.stint_number)[0];
}

export function tyreAge(stint: OpenF1Stint | undefined, lapsCount: number): number {
  return stint ? stint.tyre_age_at_start + (lapsCount - (stint.lap_start - 1)) : 0;
}

// Sort by best lap (nulls last), then assign 1-based position and gap-to-leader.
export function rankByBestLap<T extends { bestLap: number | null; pos: number; gap: number | null }>(rows: T[]): T[] {
  rows.sort((a, b) => {
    if (a.bestLap == null) return 1;
    if (b.bestLap == null) return -1;
    return a.bestLap - b.bestLap;
  });
  const leader = rows[0]?.bestLap ?? null;
  rows.forEach((r, i) => {
    r.pos = i + 1;
    r.gap = i > 0 && r.bestLap != null && leader != null ? r.bestLap - leader : null;
  });
  return rows;
}
