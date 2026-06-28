import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import { fmtTime, currentStint, tyreAge, driverLapStats, TYRE_COLOUR, TYRE_LABEL } from '../../utils/timing';
import type { PitStop, PositionRow, Interval } from './types';
import {
  latestPositionMap, cumulativeTimes, fastestLapFor, overallFastestLap,
  tyreHistoryFor, gapVal, fmtGap,
} from './derive';
import TyreChips from './TyreChips';

interface Props {
  mode: 'live' | 'historical';
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
  stints: OpenF1Stint[];
  pitStops: PitStop[];
  positions: PositionRow[];
  intervals: Interval[];
  investigated: Set<number>;
}

export default function Leaderboard({ mode, drivers, laps, stints, pitStops, positions, intervals, investigated }: Props) {
  const live = mode === 'live';
  const latestPosition = latestPositionMap(positions);
  const { cumTimeMap, lapsCompletedMap, maxLaps } = cumulativeTimes(drivers, laps);
  const fastest = overallFastestLap(drivers, laps);
  const latestIv = new Map<number, Interval>();
  for (const iv of intervals) latestIv.set(iv.driver_number, iv);

  const rows = drivers.map(d => {
    const dn = d.driver_number;
    const stats = driverLapStats(dn, laps);
    const stint = currentStint(dn, stints);
    return {
      driver: d,
      position: latestPosition.get(dn) ?? 99,
      gapRaw: latestIv.get(dn)?.gap_to_leader ?? null,
      intervalRaw: latestIv.get(dn)?.interval ?? null,
      tyreHistory: tyreHistoryFor(dn, stints, maxLaps),
      curCompound: stint?.compound ?? 'UNKNOWN',
      curAge: tyreAge(stint, stats.lapsCount),
      pits: pitStops.filter(p => p.driver_number === dn).length,
      fastestLap: fastestLapFor(dn, laps),
      lastLap: stats.lastLap,
      lapsCount: lapsCompletedMap.get(dn) ?? 0,
    };
  });

  // Sort by official position; fall back to gap-to-leader (start of session).
  rows.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return gapVal(a.gapRaw) - gapVal(b.gapRaw);
  });

  const leaderCum = rows[0] ? cumTimeMap.get(rows[0].driver.driver_number)?.get(maxLaps) ?? null : null;

  function histGap(dn: number, isLeader: boolean): string {
    if (isLeader) return '—';
    const done = lapsCompletedMap.get(dn) ?? 0;
    if (done < maxLaps - 0.5) { const lb = maxLaps - done; return `+${lb} LAP${lb > 1 ? 'S' : ''}`; }
    const t = cumTimeMap.get(dn)?.get(done) ?? null;
    if (t == null || leaderCum == null) return '—';
    const g = t - leaderCum;
    return g > 0 ? `+${g.toFixed(3)}` : '—';
  }

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="timing-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>P</th>
              <th style={{ minWidth: 104 }}>Driver</th>
              <th style={{ textAlign: 'left' }}>Gap</th>
              {live && <th style={{ textAlign: 'left' }}>Int</th>}
              <th style={{ textAlign: 'left', minWidth: 130 }}>Tyres</th>
              <th>Pits</th>
              {live
                ? <th style={{ textAlign: 'left' }}>Last Lap</th>
                : <th style={{ textAlign: 'left' }}>Fastest Lap</th>}
              <th>Laps</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={live ? 8 : 7} style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>
                {live ? 'Waiting for live timing data…' : 'No classification data yet.'}
              </td></tr>
            )}
            {rows.map((r, i) => {
              const dn = r.driver.driver_number;
              const isFast = fastest?.dn === dn;
              return (
                <tr key={dn} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                  <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{r.position < 99 ? r.position : '—'}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${r.driver.team_colour || '444'}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.driver.name_acronym}</span>
                          {investigated.has(dn) && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(245,158,11,0.3)' }}>INV</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{r.driver.team_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: i === 0 ? '#facc15' : '#94a3b8' }}>
                      {i === 0 ? (live ? 'LEAD' : 'WINNER') : (live ? fmtGap(r.gapRaw) : histGap(dn, false))}
                    </span>
                  </td>
                  {live && (
                    <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{i === 0 ? '—' : fmtGap(r.intervalRaw)}</span></td>
                  )}
                  <td style={{ textAlign: 'left' }}>
                    {live ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: TYRE_COLOUR[r.curCompound] ?? '#64748b', fontSize: 13 }}>{TYRE_LABEL[r.curCompound] ?? '?'}</span>
                        {r.curAge > 0 && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>{r.curAge}L</span>}
                        {r.tyreHistory.length > 1 && <span style={{ opacity: 0.55 }}><TyreChips history={r.tyreHistory.slice(0, -1)} showLaps={false} /></span>}
                      </div>
                    ) : (
                      <TyreChips history={r.tyreHistory} />
                    )}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', color: r.pits > 0 ? '#f1f5f9' : '#334155' }}>{r.pits > 0 ? r.pits : '—'}</span></td>
                  <td style={{ textAlign: 'left' }}>
                    {live ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{fmtTime(r.lastLap)}</span>
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: isFast ? '#a855f7' : '#64748b', fontWeight: isFast ? 700 : 400 }}>
                        {fmtTime(r.fastestLap)}{isFast && <span style={{ marginLeft: 4, fontSize: 9 }}>FL</span>}
                      </span>
                    )}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{r.lapsCount > 0 ? r.lapsCount : '—'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
