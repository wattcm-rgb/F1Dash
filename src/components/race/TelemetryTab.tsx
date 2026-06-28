import { useEffect, useState, useCallback } from 'react';
import type { OpenF1Driver, OpenF1Lap } from '../../types/openf1';
import { fmtTime } from '../../utils/timing';
import { openf1Api } from '../../services/openf1Api';
import type { CarDataPt, PositionRow } from './types';
import { latestPositionMap, fastestLapFor } from './derive';

interface Props {
  sessionKey: number | null;
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
  positions: PositionRow[];
}

type Sector = 'FULL' | 'S1' | 'S2' | 'S3';
interface Sample extends CarDataPt { elapsed: number; }     // elapsed 0..1 over whole lap
interface Series { samples: Sample[]; lap: OpenF1Lap; }

const W = 900, H = 240;
const PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 40;
const MAX_SPEED = 360;

function validLaps(dn: number, laps: OpenF1Lap[]): OpenF1Lap[] {
  return laps
    .filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration! > 60 && !!l.date_start)
    .sort((a, b) => a.lap_number - b.lap_number);
}

// Sector window in a lap's own elapsed-fraction space.
function sectorWindow(lap: OpenF1Lap, sector: Sector): [number, number] {
  const total = lap.lap_duration ?? 0;
  const d1 = lap.duration_sector_1, d2 = lap.duration_sector_2;
  if (sector === 'FULL' || total <= 0 || d1 == null || d2 == null) return [0, 1];
  const s1 = d1 / total, s2 = (d1 + d2) / total;
  if (sector === 'S1') return [0, s1];
  if (sector === 'S2') return [s1, s2];
  return [s2, 1];
}

export default function TelemetryTab({ sessionKey, drivers, laps, positions }: Props) {
  const latestPosition = latestPositionMap(positions);
  const ordered = [...drivers].sort((a, b) => (latestPosition.get(a.driver_number) ?? 99) - (latestPosition.get(b.driver_number) ?? 99));

  const [aDriver, setADriver] = useState<number | null>(null);
  const [bDriver, setBDriver] = useState<number | null>(null);
  const [aLap, setALap] = useState<number | null>(null); // null = fastest
  const [bLap, setBLap] = useState<number | null>(null);
  const [sector, setSector] = useState<Sector>('FULL');

  const [seriesA, setSeriesA] = useState<Series | null>(null);
  const [seriesB, setSeriesB] = useState<Series | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSeries = useCallback(async (dn: number, lapNum: number | null): Promise<Series | null> => {
    if (!sessionKey) return null;
    const dls = validLaps(dn, laps);
    if (!dls.length) return null;
    const fastest = fastestLapFor(dn, laps);
    const lap = lapNum != null
      ? dls.find(l => l.lap_number === lapNum) ?? dls[0]
      : dls.find(l => l.lap_duration === fastest) ?? dls[0];
    const t0 = new Date(lap.date_start).getTime();
    const total = lap.lap_duration! * 1000;
    const gt = new Date(t0 - 500).toISOString().replace('Z', '');
    const lt = new Date(t0 + total + 1000).toISOString().replace('Z', '');
    const raw = await openf1Api.getCarData(sessionKey, dn, gt, lt) as CarDataPt[];
    const samples = raw
      .map(p => ({ ...p, elapsed: (new Date(p.date).getTime() - t0) / total }))
      .filter(p => p.elapsed >= -0.01 && p.elapsed <= 1.05)
      .sort((a, b) => a.elapsed - b.elapsed);
    return samples.length ? { samples, lap } : null;
  }, [sessionKey, laps]);

  useEffect(() => {
    if (aDriver == null) { setSeriesA(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchSeries(aDriver, aLap).then(s => { if (!cancelled) setSeriesA(s); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [aDriver, aLap, fetchSeries]);

  useEffect(() => {
    if (bDriver == null) { setSeriesB(null); return; }
    let cancelled = false;
    fetchSeries(bDriver, bLap).then(s => { if (!cancelled) setSeriesB(s); });
    return () => { cancelled = true; };
  }, [bDriver, bLap, fetchSeries]);

  const driverA = drivers.find(d => d.driver_number === aDriver);
  const driverB = drivers.find(d => d.driver_number === bDriver);

  // x maps re-normalised sector position 0..1 to pixels
  const xPx = (t: number) => PAD_L + t * (W - PAD_L - PAD_R);
  const yPx = (spd: number) => H - PAD_B - (spd / MAX_SPEED) * (H - PAD_T - PAD_B);

  // Clip a series to the selected sector and renormalise t to 0..1.
  function clip(series: Series | null): { t: number; s: Sample }[] {
    if (!series) return [];
    const [lo, hi] = sectorWindow(series.lap, sector);
    const span = hi - lo || 1;
    return series.samples
      .filter(s => s.elapsed >= lo - 0.005 && s.elapsed <= hi + 0.005)
      .map(s => ({ t: Math.min(1, Math.max(0, (s.elapsed - lo) / span)), s }));
  }

  const clipA = clip(seriesA);
  const clipB = clip(seriesB);

  function runs(pts: { t: number; s: Sample }[], pred: (s: Sample) => boolean): { x1: number; x2: number }[] {
    const out: { x1: number; x2: number }[] = [];
    let open = false, x1 = 0;
    for (const p of pts) {
      const on = pred(p.s);
      if (on && !open) { open = true; x1 = xPx(p.t); }
      if (!on && open) { open = false; out.push({ x1, x2: xPx(p.t) }); }
    }
    if (open && pts.length) out.push({ x1, x2: xPx(pts[pts.length - 1].t) });
    return out;
  }

  const colorA = driverA ? `#${driverA.team_colour || '888'}` : '#94a3b8';
  const colorB = driverB ? `#${driverB.team_colour || '888'}` : '#64748b';

  function lapSelect(id: 'A' | 'B') {
    const dn = id === 'A' ? aDriver : bDriver;
    const lapNum = id === 'A' ? aLap : bLap;
    const setLap = id === 'A' ? setALap : setBLap;
    if (dn == null) return null;
    const dls = validLaps(dn, laps);
    const fastest = fastestLapFor(dn, laps);
    return (
      <select
        value={lapNum ?? ''}
        onChange={e => setLap(e.target.value === '' ? null : Number(e.target.value))}
        style={{ width: '100%', marginTop: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
      >
        <option value="">Fastest lap{fastest != null ? ` (${fmtTime(fastest)})` : ''}</option>
        {dls.map(l => (
          <option key={l.lap_number} value={l.lap_number}>Lap {l.lap_number} · {fmtTime(l.lap_duration)}</option>
        ))}
      </select>
    );
  }

  function statChips(series: Series | null, driver: OpenF1Driver | undefined, clipped: { t: number; s: Sample }[]) {
    if (!series || !driver || !clipped.length) return null;
    const speeds = clipped.map(c => c.s.speed);
    const top = Math.max(...speeds);
    const avgThr = clipped.reduce((s, c) => s + c.s.throttle, 0) / clipped.length;
    const brakePct = clipped.filter(c => c.s.brake > 0).length / clipped.length * 100;
    const drsPct = clipped.filter(c => c.s.drs >= 8).length / clipped.length * 100;
    return (
      <div className="glass" style={{ padding: '10px 14px', flex: '1 1 200px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', marginBottom: 8 }}>
          {driver.name_acronym} <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>Lap {series.lap.lap_number} · {fmtTime(series.lap.lap_duration)}{sector !== 'FULL' ? ` · ${sector}` : ''}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 11 }}>
          <div><div style={{ color: '#334155' }}>Top Speed</div><div style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>{top} km/h</div></div>
          <div><div style={{ color: '#334155' }}>Avg Throttle</div><div style={{ fontFamily: 'monospace', color: '#4ade80', fontWeight: 600 }}>{avgThr.toFixed(0)}%</div></div>
          <div><div style={{ color: '#334155' }}>Braking</div><div style={{ fontFamily: 'monospace', color: '#f87171' }}>{brakePct.toFixed(0)}%</div></div>
          <div><div style={{ color: '#334155' }}>DRS</div><div style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{drsPct.toFixed(0)}%</div></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {(['A', 'B'] as const).map(id => {
          const sel = id === 'A' ? aDriver : bDriver;
          const setSel = id === 'A' ? setADriver : setBDriver;
          return (
            <div key={id} className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, letterSpacing: '0.06em' }}>DRIVER {id}{id === 'B' ? ' (OPTIONAL)' : ''}</div>
              <select
                value={sel ?? ''}
                onChange={e => { setSel(e.target.value ? Number(e.target.value) : null); (id === 'A' ? setALap : setBLap)(null); }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                <option value="">— Select —</option>
                {ordered.map(d => <option key={d.driver_number} value={d.driver_number}>{d.name_acronym} ({d.team_name})</option>)}
              </select>
              {lapSelect(id)}
            </div>
          );
        })}

        {/* sector filter */}
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, letterSpacing: '0.06em' }}>SECTOR</div>
          <div className="tab-bar">
            {(['FULL', 'S1', 'S2', 'S3'] as Sector[]).map(s => (
              <button key={s} className={`tab-btn${sector === s ? ' active' : ''}`} onClick={() => setSector(s)}>{s === 'FULL' ? 'Lap' : s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: '#475569', paddingLeft: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 8, background: 'rgba(74,222,128,0.12)', display: 'inline-block' }} /> Full throttle</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 8, background: 'rgba(239,68,68,0.12)', display: 'inline-block' }} /> Braking zone</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 6, background: 'rgba(96,165,250,0.5)', display: 'inline-block' }} /> DRS open</span>
        {driverB && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 20, height: 0, borderTop: `2px dashed ${colorB}`, display: 'inline-block' }} /> {driverB.name_acronym}</span>}
      </div>

      {/* chart */}
      <div className="glass" style={{ padding: 12, overflow: 'hidden' }}>
        {aDriver == null && <div style={{ color: '#334155', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>Select Driver A to load telemetry.</div>}
        {aDriver != null && loading && <div style={{ color: '#475569', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>Loading telemetry…</div>}
        {aDriver != null && !loading && !clipA.length && <div style={{ color: '#334155', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>No telemetry data for this lap.</div>}
        {aDriver != null && !loading && clipA.length > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
            {runs(clipA, s => s.brake > 0).map((z, i) => <rect key={`b${i}`} x={z.x1} y={PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={H - PAD_T - PAD_B} fill="rgba(239,68,68,0.10)" />)}
            {runs(clipA, s => s.throttle >= 85).map((z, i) => <rect key={`t${i}`} x={z.x1} y={PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={H - PAD_T - PAD_B} fill="rgba(74,222,128,0.06)" />)}
            {[100, 200, 300].map(spd => (
              <g key={spd}>
                <line x1={PAD_L} y1={yPx(spd)} x2={W - PAD_R} y2={yPx(spd)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                <text x={PAD_L - 6} y={yPx(spd) + 4} textAnchor="end" fontSize={9} fill="#334155">{spd}</text>
              </g>
            ))}
            {runs(clipA, s => s.drs >= 8).map((z, i) => <rect key={`d${i}`} x={z.x1} y={PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={8} fill="rgba(96,165,250,0.55)" rx={1} />)}
            {clipB.length > 0 && <polyline points={clipB.map(c => `${xPx(c.t).toFixed(1)},${yPx(c.s.speed).toFixed(1)}`).join(' ')} fill="none" stroke={colorB} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.75} strokeLinejoin="round" />}
            <polyline points={clipA.map(c => `${xPx(c.t).toFixed(1)},${yPx(c.s.speed).toFixed(1)}`).join(' ')} fill="none" stroke={colorA} strokeWidth={2} strokeLinejoin="round" />
            <text x={PAD_L} y={H - 6} fontSize={9} fill="#334155">{sector === 'FULL' ? 'Lap start' : `${sector} start`}</text>
            <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize={9} fill="#334155">{sector === 'FULL' ? 'Lap end' : `${sector} end`}</text>
            <text x={12} y={(H - PAD_B + PAD_T) / 2} textAnchor="middle" fontSize={9} fill="#334155" transform={`rotate(-90, 12, ${(H - PAD_B + PAD_T) / 2})`}>Speed (km/h)</text>
          </svg>
        )}
      </div>

      {/* stat chips */}
      {!loading && (clipA.length > 0 || clipB.length > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {statChips(seriesA, driverA, clipA)}
          {statChips(seriesB, driverB, clipB)}
        </div>
      )}
    </div>
  );
}
