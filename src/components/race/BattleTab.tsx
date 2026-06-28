import { useState } from 'react';
import type { OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import { fmtTime, currentStint, TYRE_COLOUR, TYRE_LABEL } from '../../utils/timing';
import type { PitStop, PositionRow } from './types';
import { latestPositionMap, cumulativeTimes, fastestLapFor } from './derive';

interface Props {
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
  stints: OpenF1Stint[];
  pitStops: PitStop[];
  positions: PositionRow[];
}

const W = 900, H = 200;
const PAD = { l: 55, r: 20, t: 20, b: 30 };

function avgPace(dn: number, laps: OpenF1Lap[], n = 5): number | null {
  const dl = laps.filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap).slice(-n);
  if (!dl.length) return null;
  return dl.reduce((s, l) => s + l.lap_duration!, 0) / dl.length;
}

export default function BattleTab({ drivers, laps, stints, pitStops, positions }: Props) {
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);

  const latestPosition = latestPositionMap(positions);
  const { cumTimeMap } = cumulativeTimes(drivers, laps);
  const ordered = [...drivers].sort((x, y) => (latestPosition.get(x.driver_number) ?? 99) - (latestPosition.get(y.driver_number) ?? 99));

  const dA = drivers.find(d => d.driver_number === a);
  const dB = drivers.find(d => d.driver_number === b);

  // lap-by-lap gap (positive = A ahead)
  const gapData: { lap: number; gap: number }[] = [];
  if (a && b) {
    const cA = cumTimeMap.get(a), cB = cumTimeMap.get(b);
    if (cA && cB) {
      const last = Math.min(Math.max(...Array.from(cA.keys()), 0), Math.max(...Array.from(cB.keys()), 0));
      for (let lap = 1; lap <= last; lap++) {
        const ta = cA.get(lap), tb = cB.get(lap);
        if (ta != null && tb != null) gapData.push({ lap, gap: tb - ta });
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {(['A', 'B'] as const).map(id => {
          const sel = id === 'A' ? a : b;
          const setSel = id === 'A' ? setA : setB;
          const driver = id === 'A' ? dA : dB;
          const pace = sel != null ? avgPace(sel, laps) : null;
          const fl = sel != null ? fastestLapFor(sel, laps) : null;
          const stint = sel != null ? currentStint(sel, stints) : undefined;
          const pos = sel != null ? latestPosition.get(sel) : undefined;
          return (
            <div key={id} className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, letterSpacing: '0.06em' }}>DRIVER {id}</div>
              <select
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: driver ? 10 : 0 }}
                value={sel ?? ''}
                onChange={e => setSel(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select —</option>
                {ordered.map(r => (
                  <option key={r.driver_number} value={r.driver_number}>
                    {pos != null && r.driver_number === sel ? '' : ''}{r.name_acronym} ({r.team_name})
                  </option>
                ))}
              </select>
              {driver && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>
                    {driver.name_acronym} {pos != null && <span style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>P{pos}</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                    <div><div style={{ color: '#334155' }}>Avg Pace (5L)</div><div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontWeight: 600 }}>{pace != null ? fmtTime(pace) : '—'}</div></div>
                    <div><div style={{ color: '#334155' }}>Fastest Lap</div><div style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 600 }}>{fmtTime(fl)}</div></div>
                    <div><div style={{ color: '#334155' }}>Tyre</div><div style={{ fontWeight: 700, color: TYRE_COLOUR[stint?.compound ?? 'UNKNOWN'] ?? '#64748b' }}>{TYRE_LABEL[stint?.compound ?? 'UNKNOWN'] ?? '?'}</div></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dA && dB && gapData.length > 0 ? (
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 12 }}>
            LAP-BY-LAP GAP &nbsp;·&nbsp;
            <span style={{ color: `#${dA.team_colour || '888'}` }}>{dA.name_acronym}</span>
            <span style={{ color: '#475569' }}> vs </span>
            <span style={{ color: `#${dB.team_colour || '888'}` }}>{dB.name_acronym}</span>
          </div>
          {(() => {
            const maxGap = Math.max(...gapData.map(d => Math.abs(d.gap)), 10) * 1.15;
            const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
            const total = gapData[gapData.length - 1].lap;
            const gx = (lap: number) => PAD.l + ((lap - 1) / (total - 1 || 1)) * plotW;
            const gy = (gap: number) => PAD.t + plotH / 2 - (gap / maxGap) * (plotH / 2);
            const line = gapData.map(d => `${gx(d.lap)},${gy(d.gap)}`).join(' ');
            const fill = [`${gx(gapData[0].lap)},${gy(0)}`, ...gapData.map(d => `${gx(d.lap)},${gy(d.gap)}`), `${gx(total)},${gy(0)}`].join(' ');
            const pitsA = pitStops.filter(p => p.driver_number === a).map(p => p.lap_number);
            const pitsB = pitStops.filter(p => p.driver_number === b).map(p => p.lap_number);
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
                {[-maxGap * 0.5, 0, maxGap * 0.5].map((v, i) => (
                  <g key={i}>
                    <line x1={PAD.l} y1={gy(v)} x2={W - PAD.r} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'} strokeWidth={v === 0 ? 1.5 : 1} />
                    {v !== 0 && <text x={PAD.l - 6} y={gy(v) + 4} textAnchor="end" fontSize={9} fill="#334155">{v > 0 ? `+${v.toFixed(0)}s` : `${v.toFixed(0)}s`}</text>}
                  </g>
                ))}
                <text x={W - PAD.r - 4} y={PAD.t + 12} textAnchor="end" fontSize={9} fill={`#${dA.team_colour || '888'}`} opacity={0.7}>{dA.name_acronym} ahead ↑</text>
                <text x={W - PAD.r - 4} y={H - PAD.b - 4} textAnchor="end" fontSize={9} fill={`#${dB.team_colour || '888'}`} opacity={0.7}>{dB.name_acronym} ahead ↓</text>
                <polygon points={fill} fill="rgba(100,116,139,0.12)" />
                <polyline points={line} fill="none" stroke="rgba(203,213,225,0.75)" strokeWidth={1.5} strokeLinejoin="round" />
                {pitsA.map(l => <line key={`pa${l}`} x1={gx(l)} y1={PAD.t} x2={gx(l)} y2={H - PAD.b} stroke={`#${dA.team_colour || '888'}`} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />)}
                {pitsB.map(l => <line key={`pb${l}`} x1={gx(l)} y1={PAD.t} x2={gx(l)} y2={H - PAD.b} stroke={`#${dB.team_colour || '888'}`} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />)}
                {[1, Math.round(total / 4), Math.round(total / 2), Math.round(3 * total / 4), total].map(l => (
                  <text key={l} x={gx(l)} y={H - PAD.b + 14} textAnchor="middle" fontSize={9} fill="#334155">{l}</text>
                ))}
              </svg>
            );
          })()}
          <div style={{ fontSize: 10, color: '#334155', marginTop: 6, textAlign: 'center' }}>Dashed vertical lines = pit stops. Gap from cumulative lap times.</div>
        </div>
      ) : (
        <div className="glass" style={{ padding: 32, textAlign: 'center', color: '#334155', fontSize: 13 }}>
          {dA && dB ? 'Not enough lap data yet to plot the gap.' : 'Select two drivers to compare.'}
        </div>
      )}
    </div>
  );
}
