import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import type { PositionRow, PitStop, RcMsg } from './types';

// Latest known position for each driver (final classification once a race is over).
export function latestPositionMap(positions: PositionRow[]): Map<number, number> {
  const out = new Map<number, number>();
  const seen = new Map<number, string>();
  for (const p of positions) {
    const prev = seen.get(p.driver_number);
    if (!prev || p.date > prev) { seen.set(p.driver_number, p.date); out.set(p.driver_number, p.position); }
  }
  return out;
}

export interface CumulativeTimes {
  // driver -> (lapNumber -> cumulative race time in seconds)
  cumTimeMap: Map<number, Map<number, number>>;
  lapsCompletedMap: Map<number, number>;
  maxLaps: number;
}

// Cumulative elapsed race time per driver per lap, from individual lap durations.
export function cumulativeTimes(drivers: OpenF1Driver[], laps: OpenF1Lap[]): CumulativeTimes {
  const cumTimeMap = new Map<number, Map<number, number>>();
  const lapsCompletedMap = new Map<number, number>();
  for (const d of drivers) {
    const dLaps = laps
      .filter(l => l.driver_number === d.driver_number && l.lap_duration != null && l.lap_duration > 0)
      .sort((a, b) => a.lap_number - b.lap_number);
    let cum = 0;
    const byLap = new Map<number, number>();
    for (const l of dLaps) { cum += l.lap_duration!; byLap.set(l.lap_number, cum); }
    cumTimeMap.set(d.driver_number, byLap);
    lapsCompletedMap.set(d.driver_number, dLaps.length);
  }
  const maxLaps = lapsCompletedMap.size ? Math.max(...Array.from(lapsCompletedMap.values())) : 0;
  return { cumTimeMap, lapsCompletedMap, maxLaps };
}

// Fastest valid lap for one driver (seconds), ignoring pit-out and junk laps.
export function fastestLapFor(dn: number, laps: OpenF1Lap[]): number | null {
  const dl = laps.filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration! > 0);
  return dl.length ? Math.min(...dl.map(l => l.lap_duration!)) : null;
}

// Overall fastest lap of the session.
export function overallFastestLap(drivers: OpenF1Driver[], laps: OpenF1Lap[]): { dn: number; time: number } | null {
  let best: { dn: number; time: number } | null = null;
  for (const d of drivers) {
    const f = fastestLapFor(d.driver_number, laps);
    if (f != null && (best == null || f < best.time)) best = { dn: d.driver_number, time: f };
  }
  return best;
}

// Ordered tyre stints for a driver, with computed length in laps.
export interface TyreStint { compound: string; laps: number; startLap: number; endLap: number; }

export function tyreHistoryFor(dn: number, stints: OpenF1Stint[], maxLaps: number): TyreStint[] {
  const ds = stints.filter(s => s.driver_number === dn).sort((a, b) => a.stint_number - b.stint_number);
  return ds.map((s, i) => {
    const end = s.lap_end != null ? s.lap_end : ds[i + 1] ? ds[i + 1].lap_start - 1 : maxLaps;
    return { compound: s.compound, startLap: s.lap_start, endLap: end, laps: Math.max(0, end - s.lap_start + 1) };
  });
}

// Drivers flagged "under investigation" in race-control messages.
export function investigatedSet(msgs: RcMsg[]): Set<number> {
  const inv = new Set<number>();
  for (const m of msgs) {
    if (!m.message?.toUpperCase().includes('UNDER INVESTIGATION')) continue;
    if (m.driver_number) inv.add(m.driver_number);
    else { const mm = m.message.match(/CAR\s+(\d+)/i); if (mm) inv.add(Number(mm[1])); }
  }
  return inv;
}

// Fastest (shortest) pit stop duration for a driver.
export function fastestPitFor(dn: number, pits: PitStop[]): number | null {
  const durs = pits.filter(p => p.driver_number === dn && p.pit_duration != null).map(p => p.pit_duration!);
  return durs.length ? Math.min(...durs) : null;
}

export function gapVal(g: number | string | null): number {
  if (g == null) return 0;
  if (typeof g === 'string') {
    if (g.includes('LAP')) return 1e6 + parseInt(g);
    return parseFloat(g.replace('+', ''));
  }
  return g;
}

export function fmtGap(g: number | string | null, leader = false): string {
  if (leader) return '—';
  if (g == null) return '—';
  if (typeof g === 'string') return g.startsWith('+') ? g : `+${g}`;
  return `+${g.toFixed(3)}`;
}

export function flagColor(flag: string | null | undefined): string {
  if (!flag) return '#4ade80';
  if (flag === 'RED') return '#ef4444';
  if (flag.includes('YELLOW')) return '#facc15';
  if (flag === 'SC' || flag === 'VSC') return '#facc15';
  if (flag === 'CHEQUERED') return '#f1f5f9';
  return '#4ade80';
}

export function latestFlag(msgs: RcMsg[]): RcMsg | null {
  const flags = msgs.filter(m => m.flag && m.flag !== 'CLEAR');
  return flags.length ? flags[flags.length - 1] : null;
}

export function sectorFlagMap(msgs: RcMsg[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const m of msgs) if (m.flag && m.sector != null && m.sector > 0) out[m.sector] = m.flag;
  return out;
}
