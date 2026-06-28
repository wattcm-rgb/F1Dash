import { useEffect, useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { sessionLabel, isPastSession } from '../types/openf1';
import { TYRE_COLOUR, TYRE_LABEL, fmtTime, currentStint } from '../utils/timing';
import WeatherChip from '../components/WeatherChip';

type Tab = 'LEADERBOARD' | 'PIT STOPS' | 'BATTLE' | 'TRACK MAP' | 'TELEMETRY';

interface PitStop { driver_number: number; lap_number: number; pit_duration: number | null; }
interface PositionRow { driver_number: number; position: number; date: string; }
interface LocationPt { driver_number: number; x: number; y: number; }
interface CarDataPt { date: string; speed: number; throttle: number; brake: number; n_gear: number; drs: number; }

const YEARS = [2026, 2025, 2024, 2023];

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTransform(pts: { x: number; y: number }[], svgW: number, svgH: number, pad: number) {
  if (!pts.length) return (_x: number, _y: number) => ({ sx: 0, sy: 0 });
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rX = maxX - minX || 1, rY = maxY - minY || 1;
  const scale = Math.min((svgW - 2 * pad) / rX, (svgH - 2 * pad) / rY);
  const offX = pad + ((svgW - 2 * pad) - rX * scale) / 2;
  const offY = pad + ((svgH - 2 * pad) - rY * scale) / 2;
  return (x: number, y: number) => ({
    sx: offX + (x - minX) * scale,
    sy: svgH - (offY + (y - minY) * scale),
  });
}

// Compute contiguous runs of a boolean condition over points for SVG zone rectangles.
function zones<T extends { elapsed: number }>(pts: T[], pred: (p: T) => boolean) {
  const out: { x1: number; x2: number }[] = [];
  let open = false; let x1 = 0;
  const xOf = (e: number) => SVG_PAD_L + e * (SVG_W - SVG_PAD_L - SVG_PAD_R);
  for (const p of pts) {
    const on = pred(p);
    if (on && !open) { open = true; x1 = xOf(p.elapsed); }
    if (!on && open) { open = false; out.push({ x1, x2: xOf(p.elapsed) }); }
  }
  if (open && pts.length) out.push({ x1, x2: xOf(pts[pts.length - 1].elapsed) });
  return out;
}

// Speed trace SVG constants
const SVG_W = 900, SVG_H = 220;
const SVG_PAD_L = 50, SVG_PAD_R = 20, SVG_PAD_T = 20, SVG_PAD_B = 35;
const MAX_SPEED = 360;
const xPx = (elapsed: number) => SVG_PAD_L + elapsed * (SVG_W - SVG_PAD_L - SVG_PAD_R);
const yPx = (speed: number) => SVG_H - SVG_PAD_B - (speed / MAX_SPEED) * (SVG_H - SVG_PAD_T - SVG_PAD_B);
const yZero = SVG_H - SVG_PAD_B;

// Gap chart SVG constants
const GAP_W = 900, GAP_H = 200;
const GAP_PAD = { l: 55, r: 20, t: 20, b: 30 };

// ── component ─────────────────────────────────────────────────────────────────

export default function RacePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [raceSessions, setRaceSessions] = useState<OpenF1Session[]>([]);
  const [session, setSession] = useState<OpenF1Session | null>(null);

  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<OpenF1Stint[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [rcMsgs, setRcMsgs] = useState<{ date: string; message: string; flag?: string | null }[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [trackOutline, setTrackOutline] = useState<{ x: number; y: number }[]>([]);

  const [tab, setTab] = useState<Tab>('LEADERBOARD');
  const [loading, setLoading] = useState(false);

  const [battleA, setBattleA] = useState<number | null>(null);
  const [battleB, setBattleB] = useState<number | null>(null);

  const [telA, setTelA] = useState<number | null>(null);
  const [telB, setTelB] = useState<number | null>(null);
  const [telDataA, setTelDataA] = useState<(CarDataPt & { elapsed: number })[]>([]);
  const [telDataB, setTelDataB] = useState<(CarDataPt & { elapsed: number })[]>([]);
  const [telLapA, setTelLapA] = useState<OpenF1Lap | null>(null);
  const [telLapB, setTelLapB] = useState<OpenF1Lap | null>(null);
  const [telLoading, setTelLoading] = useState(false);

  // ── Load race sessions for year ──
  useEffect(() => {
    setRaceSessions([]); setSession(null);
    async function load() {
      const all = await openf1Api.getSessionsByYear(year) as OpenF1Session[];
      const races = all
        .filter(s => s.session_type === 'Race' && isPastSession(s))
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      setRaceSessions(races);
      if (races.length) setSession(races[races.length - 1]);
    }
    load();
  }, [year]);

  // ── Load race data when session changes ──
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setLaps([]); setStints([]); setDrivers([]); setPitStops([]);
    setPositions([]); setRcMsgs([]); setWeather(null); setTrackOutline([]);
    setBattleA(null); setBattleB(null);
    setTelA(null); setTelB(null); setTelDataA([]); setTelDataB([]);
    setTelLapA(null); setTelLapB(null);
    const key = session.session_key;
    Promise.all([
      openf1Api.getLaps(key),
      openf1Api.getStints(key),
      openf1Api.getDriversBySession(key),
      openf1Api.getPitStops(key),
      openf1Api.getPositions(key),
      openf1Api.getRaceControlMessages(key),
      openf1Api.getWeather(key),
    ]).then(([l, st, d, pit, pos, rc, wx]) => {
      setLaps(l as OpenF1Lap[]);
      setStints(st as OpenF1Stint[]);
      setDrivers(d as OpenF1Driver[]);
      setPitStops(pit as PitStop[]);
      setPositions(pos as PositionRow[]);
      setRcMsgs(rc as { date: string; message: string; flag?: string | null }[]);
      const wxArr = wx as OpenF1Weather[];
      if (wxArr.length) setWeather(wxArr[wxArr.length - 1]);
    }).finally(() => setLoading(false));
  }, [session]);

  // ── Build track outline from the meeting's other sessions ──
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const { meeting_key, session_key } = session;
    async function buildOutline() {
      try {
        const all = await openf1Api.getSessionsByYear(year) as OpenF1Session[];
        const candidates = all
          .filter(s => s.meeting_key === meeting_key && s.session_key !== session_key && isPastSession(s))
          .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
        candidates.push(session!);
        for (const cand of candidates) {
          if (cancelled) return;
          const lapData = await openf1Api.getLaps(cand.session_key) as OpenF1Lap[];
          const valid = lapData.filter(l => l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration > 50 && l.lap_duration < 200 && l.date_start);
          if (!valid.length) continue;
          valid.sort((a, b) => a.lap_duration! - b.lap_duration!);
          const lap = valid[0];
          const t0 = new Date(lap.date_start).getTime();
          const gt = new Date(t0 - 500).toISOString().replace('Z', '');
          const lt = new Date(t0 + lap.lap_duration! * 1000 + 1500).toISOString().replace('Z', '');
          const pts = await openf1Api.getLocationRange(cand.session_key, lap.driver_number, gt, lt) as LocationPt[];
          const clean = pts.filter(p => p.x != null && p.y != null && !(p.x === 0 && p.y === 0));
          if (clean.length > 30 && !cancelled) { setTrackOutline(clean.map(p => ({ x: p.x, y: p.y }))); return; }
        }
      } catch { /* leave outline empty */ }
    }
    buildOutline();
    return () => { cancelled = true; };
  }, [session, year]);

  // ── Telemetry fetch ──
  const fetchTelemetry = useCallback(async (dn: number) => {
    if (!session) return null;
    const dLaps = laps.filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration > 60 && !!l.date_start);
    if (!dLaps.length) return null;
    const fastest = dLaps.reduce((b, l) => l.lap_duration! < b.lap_duration! ? l : b);
    const t0 = new Date(fastest.date_start).getTime();
    const tTotal = fastest.lap_duration! * 1000;
    const gt = new Date(t0 - 500).toISOString().replace('Z', '');
    const lt = new Date(t0 + tTotal + 1000).toISOString().replace('Z', '');
    const raw = await openf1Api.getCarData(session.session_key, dn, gt, lt) as CarDataPt[];
    const normalized = raw
      .map(pt => ({ ...pt, elapsed: (new Date(pt.date).getTime() - t0) / tTotal }))
      .filter(pt => pt.elapsed >= -0.01 && pt.elapsed <= 1.05)
      .sort((a, b) => a.elapsed - b.elapsed);
    return { data: normalized, lap: fastest };
  }, [laps, session]);

  useEffect(() => {
    if (tab !== 'TELEMETRY' || !telA) return;
    if (telLoading) return;
    setTelLoading(true);
    setTelDataA([]); setTelDataB([]); setTelLapA(null); setTelLapB(null);
    const loads = [fetchTelemetry(telA), telB ? fetchTelemetry(telB) : Promise.resolve(null)];
    Promise.all(loads).then(([ra, rb]) => {
      if (ra) { setTelDataA(ra.data); setTelLapA(ra.lap); }
      if (rb) { setTelDataB(rb.data); setTelLapB(rb.lap); }
    }).finally(() => setTelLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, telA, telB]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Latest position per driver (final classification order)
  const latestPosition = new Map<number, number>();
  {
    const seenDate = new Map<number, string>();
    for (const p of positions) {
      const prev = seenDate.get(p.driver_number);
      if (!prev || p.date > prev) { seenDate.set(p.driver_number, p.date); latestPosition.set(p.driver_number, p.position); }
    }
  }

  // Cumulative race time per driver per lap
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

  // Sorted leaderboard
  const sortedBoard = drivers
    .map(d => {
      const dLaps = laps.filter(l => l.driver_number === d.driver_number && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration > 0);
      const fastestLap = dLaps.length ? Math.min(...dLaps.map(l => l.lap_duration!)) : null;
      const isFastestOverall = fastestLap != null && drivers.every(od => {
        const oFastest = laps.filter(l => l.driver_number === od.driver_number && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration > 0);
        return !oFastest.length || Math.min(...oFastest.map(l => l.lap_duration!)) >= fastestLap;
      });
      return {
        driver: d,
        pos: latestPosition.get(d.driver_number) ?? 99,
        finalCompound: currentStint(d.driver_number, stints)?.compound ?? 'UNKNOWN',
        pits: pitStops.filter(p => p.driver_number === d.driver_number).length,
        fastestLap,
        isFastestOverall,
        lapsCount: lapsCompletedMap.get(d.driver_number) ?? 0,
      };
    })
    .sort((a, b) => a.pos - b.pos);

  // Gap to leader (computed from cumulative lap times)
  const leaderDN = sortedBoard[0]?.driver.driver_number;
  const leaderCumTime = leaderDN != null ? (cumTimeMap.get(leaderDN)?.get(maxLaps) ?? null) : null;

  // Fastest lap of race
  const overallFastestLap = sortedBoard.reduce<{ dn: number; time: number } | null>((best, r) => {
    if (r.fastestLap == null) return best;
    if (best == null || r.fastestLap < best.time) return { dn: r.driver.driver_number, time: r.fastestLap };
    return best;
  }, null);

  function raceGap(dn: number): string {
    if (dn === leaderDN) return '—';
    const driverLaps = lapsCompletedMap.get(dn) ?? 0;
    if (driverLaps < maxLaps - 0.5) {
      const lapsBehind = maxLaps - driverLaps;
      return `+${lapsBehind} LAP${lapsBehind > 1 ? 'S' : ''}`;
    }
    const dTime = cumTimeMap.get(dn)?.get(driverLaps) ?? null;
    if (dTime == null || leaderCumTime == null) return '—';
    const gap = dTime - leaderCumTime;
    return gap > 0 ? `+${gap.toFixed(3)}` : '—';
  }

  // Pit stops tab rows
  const pitRows = drivers
    .map(d => {
      const driverStints = stints.filter(s => s.driver_number === d.driver_number).sort((a, b) => a.stint_number - b.stint_number);
      const driverPits = pitStops.filter(p => p.driver_number === d.driver_number).sort((a, b) => a.lap_number - b.lap_number);
      const tyreHistory = driverStints.map((s, i) => ({
        compound: s.compound,
        laps: s.lap_end != null ? s.lap_end - s.lap_start + 1
          : driverStints[i + 1] ? driverStints[i + 1].lap_start - s.lap_start
          : Math.max(0, maxLaps - s.lap_start + 1),
      }));
      const lastPit = driverPits[driverPits.length - 1];
      return { driver: d, stops: driverPits.length, tyreHistory, lastLap: lastPit?.lap_number ?? null, lastDuration: lastPit?.pit_duration ?? null };
    })
    .sort((a, b) => (latestPosition.get(a.driver.driver_number) ?? 99) - (latestPosition.get(b.driver.driver_number) ?? 99));

  // Battle gap chart
  const driverA_b = drivers.find(d => d.driver_number === battleA);
  const driverB_b = drivers.find(d => d.driver_number === battleB);
  const gapData: { lap: number; gap: number }[] = [];
  if (battleA && battleB) {
    const cumA = cumTimeMap.get(battleA);
    const cumB = cumTimeMap.get(battleB);
    if (cumA && cumB) {
      const lastLap = Math.min(Math.max(...Array.from(cumA.keys()), 0), Math.max(...Array.from(cumB.keys()), 0));
      for (let lap = 1; lap <= lastLap; lap++) {
        const ta = cumA.get(lap), tb = cumB.get(lap);
        if (ta != null && tb != null) gapData.push({ lap, gap: tb - ta }); // positive = A ahead
      }
    }
  }

  // Avg pace for battle
  function avgPace(dn: number, n = 5): number | null {
    const dl = laps.filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap).slice(-n);
    if (!dl.length) return null;
    return dl.reduce((s, l) => s + l.lap_duration!, 0) / dl.length;
  }

  // Track map
  const transform = makeTransform(trackOutline, 600, 380, 34);

  // Telemetry drivers
  const driverA_tel = drivers.find(d => d.driver_number === telA);
  const driverB_tel = telB ? drivers.find(d => d.driver_number === telB) : undefined;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── header ── */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
            {session ? `${sessionLabel(session)} · Race` : 'Race History'}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
          <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
          {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
          <select
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {raceSessions.length > 0 && (
            <select
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', maxWidth: 220 }}
              value={session?.session_key ?? ''}
              onChange={e => {
                const s = raceSessions.find(r => r.session_key === Number(e.target.value));
                if (s) setSession(s);
              }}
            >
              {[...raceSessions].reverse().map(s => (
                <option key={s.session_key} value={s.session_key}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!session && !loading && (
        <div style={{ color: '#475569', textAlign: 'center', padding: '60px 0' }}>No race data available for {year}.</div>
      )}

      {loading && <div style={{ color: '#475569', padding: '40px 0', textAlign: 'center' }}>Loading race data…</div>}

      {!loading && session && (
        <>
          {/* tab bar */}
          <div className="glass" style={{ padding: '8px 12px' }}>
            <div className="tab-bar">
              {(['LEADERBOARD', 'PIT STOPS', 'BATTLE', 'TRACK MAP', 'TELEMETRY'] as Tab[]).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* ── LEADERBOARD ── */}
          {tab === 'LEADERBOARD' && (
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="timing-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>P</th>
                      <th style={{ minWidth: 110 }}>Driver</th>
                      <th>Gap</th>
                      <th>Tyre</th>
                      <th>Pits</th>
                      <th>Fastest Lap</th>
                      <th>Laps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoard.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>No classification data yet.</td></tr>
                    )}
                    {sortedBoard.map((row, i) => (
                      <tr key={row.driver.driver_number} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                        <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{row.pos < 99 ? row.pos : '—'}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${row.driver.team_colour || '444'}`, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{row.driver.name_acronym}</div>
                              <div style={{ fontSize: 10, color: '#475569' }}>{row.driver.team_name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: i === 0 ? '#facc15' : '#94a3b8' }}>
                            {i === 0 ? 'WINNER' : raceGap(row.driver.driver_number)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: TYRE_COLOUR[row.finalCompound] ?? '#64748b', fontSize: 13 }}>
                            {TYRE_LABEL[row.finalCompound] ?? '?'}
                          </span>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', color: row.pits > 0 ? '#f1f5f9' : '#334155' }}>{row.pits > 0 ? row.pits : '—'}</span></td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: overallFastestLap?.dn === row.driver.driver_number ? '#a855f7' : '#64748b', fontWeight: overallFastestLap?.dn === row.driver.driver_number ? 700 : 400 }}>
                            {fmtTime(row.fastestLap)}
                            {overallFastestLap?.dn === row.driver.driver_number && <span style={{ marginLeft: 4, fontSize: 9 }}>FL</span>}
                          </span>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{row.lapsCount}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* race control */}
              {rcMsgs.length > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', marginBottom: 8 }}>RACE CONTROL</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                    {[...rcMsgs].reverse().slice(0, 8).map((m, i) => (
                      <div key={i} style={{
                        background: m.flag === 'RED' ? 'rgba(239,68,68,0.08)' : m.flag?.includes('YELLOW') ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)',
                        borderRadius: 5, padding: '4px 8px', fontSize: 11,
                        color: m.flag === 'RED' ? '#f87171' : m.flag?.includes('YELLOW') ? '#facc15' : '#64748b',
                      }}>
                        <span style={{ color: '#334155', marginRight: 6, fontSize: 10 }}>{new Date(m.date).toLocaleTimeString()}</span>
                        {m.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PIT STOPS ── */}
          {tab === 'PIT STOPS' && (
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>PIT STOP HISTORY</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="timing-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 110 }}>Driver</th>
                      <th>Stops</th>
                      <th>Last Pit Lap</th>
                      <th>Stationary</th>
                      <th style={{ minWidth: 200 }}>Tyre History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pitRows.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>No pit stop data.</td></tr>
                    )}
                    {pitRows.map(row => (
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
                        <td><span style={{ color: '#64748b', fontSize: 12 }}>{row.lastLap != null ? `Lap ${row.lastLap}` : '—'}</span></td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{row.lastDuration != null ? `${row.lastDuration.toFixed(1)}s` : '—'}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {row.tyreHistory.length === 0 && <span style={{ color: '#334155', fontSize: 11 }}>—</span>}
                            {row.tyreHistory.map((t, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {i > 0 && <span style={{ color: '#334155', fontSize: 10 }}>→</span>}
                                <span style={{ fontWeight: 700, fontSize: 12, color: TYRE_COLOUR[t.compound] ?? '#64748b', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '2px 6px' }}>
                                  {TYRE_LABEL[t.compound] ?? '?'}
                                </span>
                                {t.laps > 0 && <span style={{ fontSize: 10, color: '#475569' }}>({t.laps}L)</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── BATTLE ── */}
          {tab === 'BATTLE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* driver selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {(['A', 'B'] as const).map(id => {
                  const sel = id === 'A' ? battleA : battleB;
                  const setSel = id === 'A' ? setBattleA : setBattleB;
                  const driver = id === 'A' ? driverA_b : driverB_b;
                  const pace = sel != null ? avgPace(sel) : null;
                  const row = sel != null ? sortedBoard.find(r => r.driver.driver_number === sel) : undefined;
                  return (
                    <div key={id} className="glass" style={{ padding: 16 }}>
                      <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, letterSpacing: '0.06em' }}>DRIVER {id}</div>
                      <select
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: driver ? 10 : 0 }}
                        value={sel ?? ''}
                        onChange={e => setSel(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">— Select —</option>
                        {sortedBoard.map(r => (
                          <option key={r.driver.driver_number} value={r.driver.driver_number}>
                            P{r.pos} · {r.driver.name_acronym} ({r.driver.team_name})
                          </option>
                        ))}
                      </select>
                      {driver && row && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>{driver.name_acronym} <span style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>P{row.pos}</span></div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                            <div><div style={{ color: '#334155' }}>Avg Pace (5L)</div><div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontWeight: 600 }}>{pace != null ? fmtTime(pace) : '—'}</div></div>
                            <div><div style={{ color: '#334155' }}>Fastest Lap</div><div style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 600 }}>{fmtTime(row.fastestLap)}</div></div>
                            <div><div style={{ color: '#334155' }}>Tyre (end)</div><div style={{ fontWeight: 700, color: TYRE_COLOUR[row.finalCompound] ?? '#64748b' }}>{TYRE_LABEL[row.finalCompound] ?? '?'}</div></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Gap chart */}
              {driverA_b && driverB_b && gapData.length > 0 && (
                <div className="glass" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 12 }}>
                    LAP-BY-LAP GAP &nbsp;·&nbsp;
                    <span style={{ color: `#${driverA_b.team_colour || '888'}` }}>{driverA_b.name_acronym}</span>
                    <span style={{ color: '#475569' }}> vs </span>
                    <span style={{ color: `#${driverB_b.team_colour || '888'}` }}>{driverB_b.name_acronym}</span>
                  </div>
                  {(() => {
                    const gapValues = gapData.map(d => d.gap);
                    const maxGap = Math.max(...gapValues.map(Math.abs), 10);
                    const paddedMax = maxGap * 1.15;
                    const plotW = GAP_W - GAP_PAD.l - GAP_PAD.r;
                    const plotH = GAP_H - GAP_PAD.t - GAP_PAD.b;
                    const totalLaps = gapData[gapData.length - 1]?.lap ?? 1;
                    const gx = (lap: number) => GAP_PAD.l + ((lap - 1) / (totalLaps - 1 || 1)) * plotW;
                    const gy = (gap: number) => GAP_PAD.t + plotH / 2 - (gap / paddedMax) * (plotH / 2);
                    const yZeroG = GAP_PAD.t + plotH / 2;

                    // Build polyline points string
                    const linePts = gapData.map(d => `${gx(d.lap)},${gy(d.gap)}`).join(' ');
                    // Polygon for fill (close to zero line)
                    const fillPts = [
                      `${gx(gapData[0].lap)},${yZeroG}`,
                      ...gapData.map(d => `${gx(d.lap)},${gy(d.gap)}`),
                      `${gx(gapData[gapData.length - 1].lap)},${yZeroG}`,
                    ].join(' ');

                    // Pit stop laps for each driver
                    const pitsA = pitStops.filter(p => p.driver_number === battleA).map(p => p.lap_number);
                    const pitsB = pitStops.filter(p => p.driver_number === battleB).map(p => p.lap_number);

                    return (
                      <svg viewBox={`0 0 ${GAP_W} ${GAP_H}`} style={{ width: '100%', display: 'block' }}>
                        {/* grid */}
                        {[-paddedMax * 0.5, 0, paddedMax * 0.5].map((v, i) => (
                          <g key={i}>
                            <line x1={GAP_PAD.l} y1={gy(v)} x2={GAP_W - GAP_PAD.r} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'} strokeWidth={v === 0 ? 1.5 : 1} />
                            {v !== 0 && <text x={GAP_PAD.l - 6} y={gy(v) + 4} textAnchor="end" fontSize={9} fill="#334155">{v > 0 ? `+${v.toFixed(0)}s` : `${v.toFixed(0)}s`}</text>}
                          </g>
                        ))}
                        {/* "A ahead" / "B ahead" labels */}
                        <text x={GAP_W - GAP_PAD.r - 4} y={GAP_PAD.t + 12} textAnchor="end" fontSize={9} fill={`#${driverA_b.team_colour || '888'}`} opacity={0.7}>{driverA_b.name_acronym} ahead ↑</text>
                        <text x={GAP_W - GAP_PAD.r - 4} y={GAP_H - GAP_PAD.b - 4} textAnchor="end" fontSize={9} fill={`#${driverB_b.team_colour || '888'}`} opacity={0.7}>{driverB_b.name_acronym} ahead ↓</text>
                        {/* Fill polygon */}
                        <polygon points={fillPts} fill="rgba(100,116,139,0.12)" />
                        {/* Gap line */}
                        <polyline points={linePts} fill="none" stroke="rgba(203,213,225,0.7)" strokeWidth={1.5} strokeLinejoin="round" />
                        {/* Pit stop markers */}
                        {pitsA.map(lap => <line key={`pa${lap}`} x1={gx(lap)} y1={GAP_PAD.t} x2={gx(lap)} y2={GAP_H - GAP_PAD.b} stroke={`#${driverA_b.team_colour || '888'}`} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />)}
                        {pitsB.map(lap => <line key={`pb${lap}`} x1={gx(lap)} y1={GAP_PAD.t} x2={gx(lap)} y2={GAP_H - GAP_PAD.b} stroke={`#${driverB_b.team_colour || '888'}`} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />)}
                        {/* X axis labels */}
                        {[1, Math.round(totalLaps / 4), Math.round(totalLaps / 2), Math.round(3 * totalLaps / 4), totalLaps].map(lap => (
                          <text key={lap} x={gx(lap)} y={GAP_H - GAP_PAD.b + 14} textAnchor="middle" fontSize={9} fill="#334155">{lap}</text>
                        ))}
                        <text x={GAP_W / 2} y={GAP_H} textAnchor="middle" fontSize={9} fill="#334155">Lap</text>
                      </svg>
                    );
                  })()}
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 6, textAlign: 'center' }}>
                    Dashed vertical lines = pit stops. Gap computed from cumulative lap times.
                  </div>
                </div>
              )}

              {(!driverA_b || !driverB_b) && (
                <div className="glass" style={{ padding: 32, textAlign: 'center', color: '#334155', fontSize: 13 }}>Select two drivers to compare.</div>
              )}
            </div>
          )}

          {/* ── TRACK MAP ── */}
          {tab === 'TRACK MAP' && (
            <div className="glass" style={{ padding: 12 }}>
              {trackOutline.length < 2 ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: '60px 0', fontSize: 13 }}>
                  Loading track outline from this weekend's sessions…
                </div>
              ) : (
                <svg viewBox="0 0 600 380" style={{ width: '100%', maxWidth: 700, display: 'block', margin: '0 auto' }}>
                  {(() => {
                    const scr = trackOutline.map(p => transform(p.x, p.y));
                    const n = scr.length;
                    const bounds = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n];
                    return [1, 2, 3].map(sector => {
                      const seg = scr.slice(bounds[sector - 1], bounds[sector] + 1);
                      if (seg.length < 2) return null;
                      return (
                        <polyline key={sector} points={seg.map(p => `${p.sx},${p.sy}`).join(' ')}
                          fill="none" stroke="rgba(100,116,139,0.6)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                      );
                    });
                  })()}
                </svg>
              )}
              <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 8 }}>
                {trackOutline.length > 1 ? `${session.circuit_short_name} circuit layout · ${trackOutline.length} GPS points` : ''}
              </div>
            </div>
          )}

          {/* ── TELEMETRY ── */}
          {tab === 'TELEMETRY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* driver selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {(['A', 'B'] as const).map(id => {
                  const sel = id === 'A' ? telA : telB;
                  const setSel = id === 'A' ? setTelA : setTelB;
                  const lap = id === 'A' ? telLapA : telLapB;
                  const driver = id === 'A' ? driverA_tel : driverB_tel;
                  return (
                    <div key={id} className="glass" style={{ padding: 16 }}>
                      <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, letterSpacing: '0.06em' }}>DRIVER {id}{id === 'B' ? ' (OPTIONAL COMPARISON)' : ''}</div>
                      <select
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        value={sel ?? ''}
                        onChange={e => { setSel(e.target.value ? Number(e.target.value) : null); setTelDataA([]); setTelDataB([]); setTelLapA(null); setTelLapB(null); }}
                      >
                        <option value="">— Select —</option>
                        {sortedBoard.map(r => (
                          <option key={r.driver.driver_number} value={r.driver.driver_number}>
                            P{r.pos} · {r.driver.name_acronym} ({r.driver.team_name})
                          </option>
                        ))}
                      </select>
                      {driver && lap && (
                        <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', marginBottom: 4 }}>{driver.name_acronym}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Fastest Lap · <span style={{ fontFamily: 'monospace', color: '#a855f7' }}>{fmtTime(lap.lap_duration)}</span>
                            <span style={{ marginLeft: 8, color: '#334155' }}>Lap {lap.lap_number}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* legend */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: '#475569', paddingLeft: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 20, height: 3, background: '#4ade80', display: 'inline-block', borderRadius: 2 }} /> Full throttle</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 20, height: 3, background: '#f87171', display: 'inline-block', borderRadius: 2 }} /> Braking zone</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 6, background: 'rgba(96,165,250,0.5)', display: 'inline-block', borderRadius: 1 }} /> DRS open</span>
                {driverB_tel && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 20, height: 2, background: `#${driverB_tel.team_colour || '888'}`, display: 'inline-block', borderRadius: 2, borderTop: '2px dashed' }} /> {driverB_tel.name_acronym}</span>}
              </div>

              {/* speed trace chart */}
              <div className="glass" style={{ padding: 12, overflow: 'hidden' }}>
                {!telA && <div style={{ color: '#334155', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>Select Driver A to load telemetry.</div>}
                {telA && telLoading && <div style={{ color: '#475569', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>Loading telemetry…</div>}
                {telA && !telLoading && telDataA.length === 0 && <div style={{ color: '#334155', textAlign: 'center', padding: '48px 0', fontSize: 13 }}>No telemetry data available for this session.</div>}
                {telA && !telLoading && telDataA.length > 0 && (() => {
                  const colorA = driverA_tel ? `#${driverA_tel.team_colour || '888'}` : '#94a3b8';
                  const colorB = driverB_tel ? `#${driverB_tel.team_colour || '888'}` : '#64748b';

                  const brakeZonesA = zones(telDataA, p => p.brake > 0);
                  const drsZonesA = zones(telDataA, p => p.drs >= 8);
                  const throttleZonesA = zones(telDataA, p => p.throttle >= 85);

                  const ptsA = telDataA.map(p => `${xPx(p.elapsed).toFixed(1)},${yPx(p.speed).toFixed(1)}`).join(' ');
                  const ptsB = telDataB.length
                    ? telDataB.map(p => `${xPx(p.elapsed).toFixed(1)},${yPx(p.speed).toFixed(1)}`).join(' ')
                    : null;

                  // Speed area fill for A (throttle zones only — green under speed line)
                  const areaA = telDataA.length > 1
                    ? [`${xPx(telDataA[0].elapsed).toFixed(1)},${yZero}`,
                       ...telDataA.map(p => `${xPx(p.elapsed).toFixed(1)},${yPx(p.speed).toFixed(1)}`),
                       `${xPx(telDataA[telDataA.length - 1].elapsed).toFixed(1)},${yZero}`].join(' ')
                    : '';

                  return (
                    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', display: 'block' }}>
                      {/* brake zones (red background) */}
                      {brakeZonesA.map((z, i) => (
                        <rect key={`bz${i}`} x={z.x1} y={SVG_PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={SVG_H - SVG_PAD_T - SVG_PAD_B}
                          fill="rgba(239,68,68,0.10)" />
                      ))}
                      {/* throttle zones (green background) */}
                      {throttleZonesA.map((z, i) => (
                        <rect key={`tz${i}`} x={z.x1} y={SVG_PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={SVG_H - SVG_PAD_T - SVG_PAD_B}
                          fill="rgba(74,222,128,0.06)" />
                      ))}
                      {/* grid lines */}
                      {[100, 200, 300].map(spd => (
                        <g key={spd}>
                          <line x1={SVG_PAD_L} y1={yPx(spd)} x2={SVG_W - SVG_PAD_R} y2={yPx(spd)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                          <text x={SVG_PAD_L - 6} y={yPx(spd) + 4} textAnchor="end" fontSize={9} fill="#334155">{spd}</text>
                        </g>
                      ))}
                      <text x={SVG_PAD_L - 6} y={yPx(0) + 4} textAnchor="end" fontSize={9} fill="#334155">0</text>
                      {/* speed area fill */}
                      {areaA && <polygon points={areaA} fill={`${colorA}12`} />}
                      {/* DRS bands at top */}
                      {drsZonesA.map((z, i) => (
                        <rect key={`dz${i}`} x={z.x1} y={SVG_PAD_T} width={Math.max(z.x2 - z.x1, 1)} height={8}
                          fill="rgba(96,165,250,0.55)" rx={1} />
                      ))}
                      {/* driver B speed line (dashed, behind A) */}
                      {ptsB && <polyline points={ptsB} fill="none" stroke={colorB} strokeWidth={1.5} strokeDasharray="6 3" strokeLinejoin="round" opacity={0.75} />}
                      {/* driver A speed line */}
                      <polyline points={ptsA} fill="none" stroke={colorA} strokeWidth={2} strokeLinejoin="round" />
                      {/* brake zone tick marks at bottom */}
                      {brakeZonesA.map((z, i) => (
                        <rect key={`bt${i}`} x={z.x1} y={SVG_H - SVG_PAD_B} width={Math.max(z.x2 - z.x1, 1)} height={5} fill="#f87171" opacity={0.8} />
                      ))}
                      {/* throttle tick marks */}
                      {throttleZonesA.map((z, i) => (
                        <rect key={`tt${i}`} x={z.x1} y={SVG_H - SVG_PAD_B + 6} width={Math.max(z.x2 - z.x1, 1)} height={4} fill="#4ade80" opacity={0.8} />
                      ))}
                      {/* X axis labels */}
                      <text x={SVG_PAD_L} y={SVG_H - 4} fontSize={9} fill="#334155">Lap start</text>
                      <text x={SVG_W - SVG_PAD_R} y={SVG_H - 4} textAnchor="end" fontSize={9} fill="#334155">Lap end</text>
                      {/* Y axis label */}
                      <text x={12} y={SVG_PAD_T + (SVG_H - SVG_PAD_T - SVG_PAD_B) / 2} textAnchor="middle" fontSize={9} fill="#334155"
                        transform={`rotate(-90, 12, ${SVG_PAD_T + (SVG_H - SVG_PAD_T - SVG_PAD_B) / 2})`}>Speed (km/h)</text>
                      {/* driver A label */}
                      {driverA_tel && (() => {
                        const maxSpeedPt = telDataA.reduce((m, p) => p.speed > m.speed ? p : m, telDataA[0]);
                        return <text x={xPx(maxSpeedPt.elapsed)} y={yPx(maxSpeedPt.speed) - 6} textAnchor="middle" fontSize={9} fontWeight="bold" fill={colorA}>{driverA_tel.name_acronym}</text>;
                      })()}
                      {/* driver B label */}
                      {driverB_tel && telDataB.length > 0 && (() => {
                        const maxSpeedPt = telDataB.reduce((m, p) => p.speed > m.speed ? p : m, telDataB[0]);
                        return <text x={xPx(maxSpeedPt.elapsed)} y={yPx(maxSpeedPt.speed) - 14} textAnchor="middle" fontSize={9} fontWeight="bold" fill={colorB}>{driverB_tel.name_acronym}</text>;
                      })()}
                    </svg>
                  );
                })()}
              </div>

              {/* top speed stat chips */}
              {!telLoading && (telDataA.length > 0 || telDataB.length > 0) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {([{ data: telDataA, driver: driverA_tel, lap: telLapA }, { data: telDataB, driver: driverB_tel, lap: telLapB }] as const).map(({ data, driver, lap }, i) => {
                    if (!data.length || !driver) return null;
                    const topSpeed = Math.max(...data.map(p => p.speed));
                    const avgThrottle = data.reduce((s, p) => s + p.throttle, 0) / data.length;
                    const brakeTime = data.filter(p => p.brake > 0).length / data.length * 100;
                    const drsTime = data.filter(p => p.drs >= 8).length / data.length * 100;
                    return (
                      <div key={i} className="glass" style={{ padding: '10px 14px', flex: '1 1 200px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', marginBottom: 8 }}>
                          {driver.name_acronym} <span style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>Lap {lap?.lap_number} · {fmtTime(lap?.lap_duration ?? null)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 11 }}>
                          <div><div style={{ color: '#334155' }}>Top Speed</div><div style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 700 }}>{topSpeed} km/h</div></div>
                          <div><div style={{ color: '#334155' }}>Avg Throttle</div><div style={{ fontFamily: 'monospace', color: '#4ade80', fontWeight: 600 }}>{avgThrottle.toFixed(0)}%</div></div>
                          <div><div style={{ color: '#334155' }}>Braking</div><div style={{ fontFamily: 'monospace', color: '#f87171' }}>{brakeTime.toFixed(0)}% of lap</div></div>
                          <div><div style={{ color: '#334155' }}>DRS</div><div style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{drsTime.toFixed(0)}% of lap</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
