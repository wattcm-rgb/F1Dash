import { useMemo } from 'react';
import type { OpenF1Driver, OpenF1Stint } from '../../types/openf1';
import type { PitStop, PositionRow } from './types';
import { latestPositionMap, cumulativeTimes, tyreHistoryFor, fastestPitFor } from './derive';
import TyreChips from './TyreChips';

interface Props {
  drivers: OpenF1Driver[];
  stints: OpenF1Stint[];
  pitStops: PitStop[];
  positions: PositionRow[];
  laps: { driver_number: number; lap_number: number; lap_duration: number | null }[];
}

export default function PitStopsTab({ drivers, stints, pitStops, positions, laps }: Props) {
  const latestPosition = useMemo(() => latestPositionMap(positions), [positions]);
  const { maxLaps } = useMemo(() => cumulativeTimes(drivers, laps as never), [drivers, laps]);

  const rows = drivers.map(d => {
    const dn = d.driver_number;
    const driverPits = pitStops.filter(p => p.driver_number === dn).sort((a, b) => a.lap_number - b.lap_number);
    const last = driverPits[driverPits.length - 1];
    return {
      driver: d,
      stops: driverPits.length,
      tyreHistory: tyreHistoryFor(dn, stints, maxLaps),
      lastLap: last?.lap_number ?? null,
      fastestStop: fastestPitFor(dn, pitStops),
    };
  }).sort((a, b) => (latestPosition.get(a.driver.driver_number) ?? 99) - (latestPosition.get(b.driver.driver_number) ?? 99));

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>PIT STOP HISTORY</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="timing-table">
          <thead>
            <tr>
              <th style={{ minWidth: 104 }}>Driver</th>
              <th>Stops</th>
              <th style={{ textAlign: 'left' }}>Last Pit Lap</th>
              <th style={{ textAlign: 'left' }}>Fastest Stop</th>
              <th style={{ textAlign: 'left', minWidth: 200 }}>Tyre History</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>No pit stop data.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.driver.driver_number} className="timing-row">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${row.driver.team_colour || '444'}`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{row.driver.name_acronym}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{row.driver.team_name}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: row.stops > 0 ? '#f1f5f9' : '#334155' }}>{row.stops > 0 ? row.stops : '—'}</span></td>
                <td style={{ textAlign: 'left' }}><span style={{ color: '#64748b', fontSize: 12 }}>{row.lastLap != null ? `Lap ${row.lastLap}` : '—'}</span></td>
                <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{row.fastestStop != null ? `${row.fastestStop.toFixed(1)}s` : '—'}</span></td>
                <td style={{ textAlign: 'left' }}><TyreChips history={row.tyreHistory} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
