import type { OpenF1Driver, OpenF1Lap } from '../../types/openf1';
import { fmtTime } from '../../utils/timing';
import { sectorColour } from '../qualifying/derive';
import SectorCell from '../qualifying/SectorCell';

interface Props {
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
}

function minOrNull(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  return nums.length ? Math.min(...nums) : null;
}

export default function SectorLeaderboardTab({ drivers, laps }: Props) {
  if (!drivers.length || !laps.length) {
    return (
      <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
        No lap data yet.
      </div>
    );
  }

  // Valid laps only (exclude pit-out, null duration)
  const validLaps = laps.filter(l => !l.is_pit_out_lap && l.lap_duration != null && l.lap_duration > 0);

  // Overall bests across field
  const overallS1 = minOrNull(validLaps.map(l => l.duration_sector_1));
  const overallS2 = minOrNull(validLaps.map(l => l.duration_sector_2));
  const overallS3 = minOrNull(validLaps.map(l => l.duration_sector_3));
  const overallBestLap = minOrNull(validLaps.map(l => l.lap_duration));
  const theoretical = overallS1 != null && overallS2 != null && overallS3 != null
    ? overallS1 + overallS2 + overallS3
    : null;

  // Per-driver aggregates (max speeds, best sector/lap times)
  const driverSpeeds = drivers.map(d => {
    const dn = d.driver_number;
    const dl = laps.filter(l => l.driver_number === dn);
    const speeds1 = dl.map(l => l.i1_speed).filter((v): v is number => v != null);
    const speeds2 = dl.map(l => l.i2_speed).filter((v): v is number => v != null);
    const speedsTrap = dl.map(l => l.st_speed).filter((v): v is number => v != null);
    return {
      dn,
      driver: d,
      bestS1: minOrNull(dl.filter(l => !l.is_pit_out_lap && l.lap_duration != null).map(l => l.duration_sector_1)),
      bestS2: minOrNull(dl.filter(l => !l.is_pit_out_lap && l.lap_duration != null).map(l => l.duration_sector_2)),
      bestS3: minOrNull(dl.filter(l => !l.is_pit_out_lap && l.lap_duration != null).map(l => l.duration_sector_3)),
      bestLap: minOrNull(dl.filter(l => !l.is_pit_out_lap && l.lap_duration != null).map(l => l.lap_duration)),
      bestSpeed1: speeds1.length ? Math.max(...speeds1) : null,
      bestSpeed2: speeds2.length ? Math.max(...speeds2) : null,
      bestSpeedTrap: speedsTrap.length ? Math.max(...speedsTrap) : null,
    };
  });

  // Sort sector table by best lap ascending (nulls last)
  const sectorRows = [...driverSpeeds].sort((a, b) => {
    if (a.bestLap == null && b.bestLap == null) return 0;
    if (a.bestLap == null) return 1;
    if (b.bestLap == null) return -1;
    return a.bestLap - b.bestLap;
  });

  const fastestLapOverall = sectorRows[0]?.bestLap ?? null;

  // Speed trap: sort by speed trap descending (nulls last)
  const hasSpeedData = driverSpeeds.some(d => d.bestSpeedTrap != null);
  const speedRows = hasSpeedData
    ? [...driverSpeeds].sort((a, b) => {
        if (a.bestSpeedTrap == null && b.bestSpeedTrap == null) return 0;
        if (a.bestSpeedTrap == null) return 1;
        if (b.bestSpeedTrap == null) return -1;
        return b.bestSpeedTrap - a.bestSpeedTrap;
      })
    : [];

  // Overall best speeds
  const topSpeed1 = hasSpeedData ? Math.max(...driverSpeeds.map(d => d.bestSpeed1 ?? 0)) : null;
  const topSpeed2 = hasSpeedData ? Math.max(...driverSpeeds.map(d => d.bestSpeed2 ?? 0)) : null;
  const topSpeedTrap = hasSpeedData ? Math.max(...driverSpeeds.map(d => d.bestSpeedTrap ?? 0)) : null;

  // Per-driver personal bests for colour coding
  function sectorColourFor(dn: number, sector: 'S1' | 'S2' | 'S3', time: number | null): import('../qualifying/types').SectorColour {
    const dl = validLaps.filter(l => l.driver_number === dn);
    const pb = sector === 'S1'
      ? minOrNull(dl.map(l => l.duration_sector_1))
      : sector === 'S2'
        ? minOrNull(dl.map(l => l.duration_sector_2))
        : minOrNull(dl.map(l => l.duration_sector_3));
    const ob = sector === 'S1' ? overallS1 : sector === 'S2' ? overallS2 : overallS3;
    return sectorColour(time, pb, ob);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Theoretical best banner */}
      {theoretical != null && (
        <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>THEORETICAL BEST</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#e9d5ff' }}>{fmtTime(theoretical)}</span>
          <span style={{ fontSize: 11, color: '#7c3aed' }}>
            {overallBestLap != null && theoretical < overallBestLap
              ? `${(overallBestLap - theoretical).toFixed(3)}s faster than actual fastest`
              : 'never driven'}
          </span>
        </div>
      )}

      {/* Sector times table */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>
          SECTOR TIMES
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="timing-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>P</th>
                <th style={{ minWidth: 104 }}>Driver</th>
                <th>S1</th>
                <th>S2</th>
                <th>S3</th>
                <th style={{ minWidth: 90 }}>Best Lap</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {sectorRows.map((r, i) => {
                const delta = r.bestLap != null && fastestLapOverall != null && i > 0
                  ? r.bestLap - fastestLapOverall
                  : null;
                return (
                  <tr key={r.dn} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                    <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{i + 1}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${r.driver.team_colour || '444'}`, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.driver.name_acronym}</div>
                          <div style={{ fontSize: 10, color: '#475569' }}>{r.driver.team_name}</div>
                        </div>
                      </div>
                    </td>
                    <td><SectorCell time={r.bestS1} colour={sectorColourFor(r.dn, 'S1', r.bestS1)} /></td>
                    <td><SectorCell time={r.bestS2} colour={sectorColourFor(r.dn, 'S2', r.bestS2)} /></td>
                    <td><SectorCell time={r.bestS3} colour={sectorColourFor(r.dn, 'S3', r.bestS3)} /></td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#a855f7' : '#f1f5f9' }}>
                        {fmtTime(r.bestLap)}
                      </span>
                    </td>
                    <td>
                      {i === 0
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7' }}>FASTEST</span>
                        : <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{delta != null ? `+${delta.toFixed(3)}` : '—'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Speed trap table */}
      {hasSpeedData && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>
            SPEED TRAP
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>P</th>
                  <th style={{ minWidth: 104 }}>Driver</th>
                  <th>Int 1 (km/h)</th>
                  <th>Int 2 (km/h)</th>
                  <th>Speed Trap (km/h)</th>
                </tr>
              </thead>
              <tbody>
                {speedRows.map((r, i) => (
                  <tr key={r.dn} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                    <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{i + 1}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${r.driver.team_colour || '444'}`, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.driver.name_acronym}</div>
                          <div style={{ fontSize: 10, color: '#475569' }}>{r.driver.team_name}</div>
                        </div>
                      </div>
                    </td>
                    {[
                      { val: r.bestSpeed1, top: topSpeed1 },
                      { val: r.bestSpeed2, top: topSpeed2 },
                      { val: r.bestSpeedTrap, top: topSpeedTrap },
                    ].map(({ val, top }, ci) => (
                      <td key={ci}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12,
                          color: val != null && top != null && val === top ? '#a855f7' : '#f1f5f9',
                          fontWeight: val != null && top != null && val === top ? 700 : 400,
                        }}>
                          {val != null ? val.toFixed(0) : '—'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
