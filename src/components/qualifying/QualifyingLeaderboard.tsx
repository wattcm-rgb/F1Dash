import type { OpenF1Driver } from '../../types/openf1';
import { fmtTime } from '../../utils/timing';
import type { QualLap, Segment } from './types';
import { buildQualBest, overallBests, sectorColour, cutoffPosition } from './derive';
import SectorCell from './SectorCell';

interface Props {
  drivers: OpenF1Driver[];
  segmentLaps: QualLap[];    // laps for this segment only
  allLaps: QualLap[];        // all session laps (for computing personal bests across segments)
  segment: Segment;
}

export default function QualifyingLeaderboard({ drivers, segmentLaps, allLaps, segment }: Props) {
  if (!drivers.length) {
    return (
      <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
        No data for this segment yet.
      </div>
    );
  }

  const ob = overallBests(segmentLaps);

  // Build per-driver best for this segment; drivers with no laps in this segment get nulls.
  const driverNums = Array.from(new Set(segmentLaps.map(l => l.driver_number)));
  const driverSet = new Set(driverNums);

  const rows = drivers.map(d => {
    const dn = d.driver_number;
    const best = driverSet.has(dn) ? buildQualBest(dn, segmentLaps) : { driver_number: dn, best_lap: null, best_s1: null, best_s2: null, best_s3: null, laps_done: 0 };
    // Personal bests across ALL laps (to colour partial improvements correctly).
    const pbAll = buildQualBest(dn, allLaps);
    return { driver: d, best, pbAll };
  });

  // Sort by best lap ascending; drivers with no time go to bottom.
  rows.sort((a, b) => {
    if (a.best.best_lap == null && b.best.best_lap == null) return 0;
    if (a.best.best_lap == null) return 1;
    if (b.best.best_lap == null) return -1;
    return a.best.best_lap - b.best.best_lap;
  });

  const pole = rows[0]?.best.best_lap ?? null;
  const cutoff = cutoffPosition(segment, rows.length);

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      {ob.lap != null && (
        <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#475569' }}>
          Theoretical best:&nbsp;
          <span style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 700 }}>{fmtTime((ob.s1 ?? 0) + (ob.s2 ?? 0) + (ob.s3 ?? 0))}</span>
          &nbsp;·&nbsp;Fastest lap:&nbsp;
          <span style={{ fontFamily: 'monospace', color: '#c084fc', fontWeight: 700 }}>{fmtTime(ob.lap)}</span>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="timing-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>P</th>
              <th style={{ minWidth: 110 }}>Driver</th>
              <th style={{ textAlign: 'center' }}>S1</th>
              <th style={{ textAlign: 'center' }}>S2</th>
              <th style={{ textAlign: 'center' }}>S3</th>
              <th style={{ textAlign: 'right', minWidth: 80 }}>Best Lap</th>
              <th style={{ textAlign: 'right', minWidth: 68 }}>Gap</th>
              <th style={{ textAlign: 'center' }}>Laps</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pos = i + 1;
              const eliminated = cutoff != null && pos > cutoff;
              const gap = i === 0 || r.best.best_lap == null || pole == null ? null : r.best.best_lap - pole;

              const s1c = sectorColour(r.best.best_s1, r.pbAll.best_s1, ob.s1);
              const s2c = sectorColour(r.best.best_s2, r.pbAll.best_s2, ob.s2);
              const s3c = sectorColour(r.best.best_s3, r.pbAll.best_s3, ob.s3);

              return (
                <tr
                  key={r.driver.driver_number}
                  className={`timing-row${i === 0 ? ' p1' : ''}`}
                  style={{
                    borderLeft: eliminated ? '2px solid rgba(239,68,68,0.5)' : '2px solid transparent',
                    opacity: r.best.best_lap == null ? 0.45 : 1,
                  }}
                >
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: eliminated ? '#ef4444' : '#475569' }}>{pos}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${r.driver.team_colour || '444'}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.driver.name_acronym}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{r.driver.team_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}><SectorCell time={r.best.best_s1} colour={s1c} /></td>
                  <td style={{ textAlign: 'center' }}><SectorCell time={r.best.best_s2} colour={s2c} /></td>
                  <td style={{ textAlign: 'center' }}><SectorCell time={r.best.best_s3} colour={s3c} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? '#c084fc' : '#f1f5f9' }}>
                      {fmtTime(r.best.best_lap)}
                    </span>
                    {i === 0 && r.best.best_lap != null && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', marginLeft: 5 }}>POLE</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                      {gap != null ? `+${gap.toFixed(3)}` : (i === 0 && r.best.best_lap != null ? '—' : '')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{r.best.laps_done || '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
