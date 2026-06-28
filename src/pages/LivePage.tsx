import { useEffect, useState, useRef, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { isLiveSession, sessionLabel } from '../types/openf1';
import { TYRE_COLOUR, TYRE_LABEL, fmtTime, driverLapStats, currentStint, tyreAge } from '../utils/timing';
import WeatherChip from '../components/WeatherChip';

type Tab = 'LEADERBOARD' | 'PIT STOPS' | 'BATTLE' | 'TRACK MAP';

interface PitStop {
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  date: string;
}

interface Interval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}

interface RcMsg {
  date: string;
  message: string;
  flag?: string | null;
  category?: string;
  driver_number?: number | null;
  sector?: number | null;
}

interface LocationPt { driver_number: number; x: number; y: number; date: string; }

// ── helpers ──────────────────────────────────────────────────────────────────

function gapVal(g: number | string | null): number {
  if (g == null) return 0;
  if (typeof g === 'string') {
    if (g.includes('LAP')) return 1e6 + parseInt(g);
    return parseFloat(g.replace('+', ''));
  }
  return g;
}

function fmtGap(g: number | string | null, leader = false): string {
  if (leader) return '—';
  if (g == null) return '—';
  if (typeof g === 'string') return g.startsWith('+') ? g : `+${g}`;
  return `+${g.toFixed(3)}`;
}

function avgRecentPace(num: number, laps: OpenF1Lap[], n = 5): number | null {
  const valid = laps
    .filter(l => l.driver_number === num && l.lap_duration != null && !l.is_pit_out_lap)
    .slice(-n);
  if (!valid.length) return null;
  return valid.reduce((s, l) => s + l.lap_duration!, 0) / valid.length;
}

function getInvestigated(msgs: RcMsg[]): Set<number> {
  const inv = new Set<number>();
  for (const m of msgs) {
    if (!m.message?.toUpperCase().includes('UNDER INVESTIGATION')) continue;
    if (m.driver_number) {
      inv.add(m.driver_number);
    } else {
      const match = m.message.match(/CAR\s+(\d+)/i);
      if (match) inv.add(Number(match[1]));
    }
  }
  return inv;
}

function latestFlag(msgs: RcMsg[]): RcMsg | null {
  const flags = msgs.filter(m => m.flag && m.flag !== 'CLEAR');
  return flags.length ? flags[flags.length - 1] : null;
}

function sectorFlagMap(msgs: RcMsg[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const m of msgs) {
    if (m.flag && m.sector != null && m.sector > 0) {
      out[m.sector] = m.flag;
    }
  }
  return out;
}

function flagColor(flag: string | null | undefined): string {
  if (!flag) return '#4ade80';
  if (flag === 'RED') return '#ef4444';
  if (flag.includes('YELLOW')) return '#facc15';
  if (flag === 'SC' || flag === 'VSC') return '#facc15';
  if (flag === 'CHEQUERED') return '#f1f5f9';
  return '#4ade80';
}

// Normalize x/y points into SVG coordinate space
function makeTransform(pts: { x: number; y: number }[], svgW: number, svgH: number, pad: number) {
  if (!pts.length) return () => ({ sx: 0, sy: 0 });
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

// ── component ─────────────────────────────────────────────────────────────────

export default function LivePage() {
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [detecting, setDetecting] = useState(true);

  // race data
  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<OpenF1Stint[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [rcMsgs, setRcMsgs] = useState<RcMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);

  // track map
  const trailsRef = useRef<Map<number, { x: number; y: number }[]>>(new Map());
  const [trailSnapshot, setTrailSnapshot] = useState<Map<number, { x: number; y: number }[]>>(new Map());
  const lastLocFetch = useRef<string | null>(null);

  const [tab, setTab] = useState<Tab>('LEADERBOARD');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  // battle
  const [battleA, setBattleA] = useState<number | null>(null);
  const [battleB, setBattleB] = useState<number | null>(null);

  const pollRef = useRef<number | null>(null);

  // ── session detection ──

  const detectSession = useCallback(async () => {
    const s = await openf1Api.getLatestSession('Race');
    if (!s) { setDetecting(false); return; }
    setSession(s);
    setIsLive(isLiveSession(s));
    setDetecting(false);
  }, []);

  useEffect(() => {
    detectSession();
    const check = window.setInterval(detectSession, 30_000);
    return () => clearInterval(check);
  }, [detectSession]);

  // ── data fetching ──

  const fetchLocation = useCallback(async (key: number) => {
    const since = lastLocFetch.current
      ? new Date(new Date(lastLocFetch.current).getTime() - 1000).toISOString().replace('Z', '')
      : new Date(Date.now() - 90_000).toISOString().replace('Z', '');

    const pts: LocationPt[] = await openf1Api.getLocation(key, since);
    if (!pts.length) return;

    const latest = pts[pts.length - 1].date;
    lastLocFetch.current = latest;

    const trails = trailsRef.current;
    const updated = new Map(trails);
    for (const p of pts) {
      const arr = updated.get(p.driver_number) ?? [];
      arr.push({ x: p.x, y: p.y });
      // keep last 150 points per driver (~40 seconds at 3.7 Hz)
      if (arr.length > 150) arr.splice(0, arr.length - 150);
      updated.set(p.driver_number, arr);
    }
    trailsRef.current = updated;
    setTrailSnapshot(new Map(updated));
  }, []);

  const fetchAll = useCallback(async (key: number) => {
    const [l, st, d, pit, iv, rc, wx] = await Promise.all([
      openf1Api.getLaps(key),
      openf1Api.getStints(key),
      openf1Api.getDriversBySession(key),
      openf1Api.getPitStops(key),
      openf1Api.getIntervals(key),
      openf1Api.getRaceControlMessages(key),
      openf1Api.getWeather(key),
    ]);
    setLaps(l);
    setStints(st);
    if (d.length) setDrivers(d);
    setPitStops(pit);
    setIntervals(iv);
    setRcMsgs(rc);
    if (wx.length) setWeather(wx[wx.length - 1]);
    setUpdated(new Date());
    await fetchLocation(key);
  }, [fetchLocation]);

  useEffect(() => {
    if (!session || !isLive) {
      if (!detecting) setLoading(false);
      return;
    }
    const key = session.session_key;
    setLoading(true);
    fetchAll(key).finally(() => setLoading(false));
    pollRef.current = window.setInterval(() => fetchAll(key), 4_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, isLive, detecting, fetchAll]);

  // ── derived data ──

  const latestIntervals = new Map<number, Interval>();
  for (const iv of intervals) latestIntervals.set(iv.driver_number, iv);

  interface LBRow {
    pos: number;
    driver: OpenF1Driver;
    gapToLeader: string;
    interval: string;
    compound: string;
    tAge: number;
    pits: number;
    lastLap: number | null;
    investigated: boolean;
    currentLap: number;
  }

  const leaderboard: LBRow[] = drivers.map(d => {
    const stats = driverLapStats(d.driver_number, laps);
    const stint = currentStint(d.driver_number, stints);
    const iv = latestIntervals.get(d.driver_number);
    return {
      pos: 0,
      driver: d,
      gapRaw: iv?.gap_to_leader ?? null,
      intervalRaw: iv?.interval ?? null,
      compound: stint?.compound ?? 'UNKNOWN',
      tAge: tyreAge(stint, stats.lapsCount),
      pits: pitStops.filter(p => p.driver_number === d.driver_number).length,
      lastLap: stats.lastLap,
      investigated: false,
      currentLap: stats.lapsCount,
      gapToLeader: '',
      interval: '',
    };
  });

  const investigated = getInvestigated(rcMsgs);

  const sortedBoard: LBRow[] = leaderboard
    .sort((a, b) => gapVal((a as any).gapRaw) - gapVal((b as any).gapRaw))
    .map((r, i) => ({
      ...r,
      pos: i + 1,
      gapToLeader: fmtGap((r as any).gapRaw, i === 0),
      interval: fmtGap((r as any).intervalRaw, i === 0),
      investigated: investigated.has(r.driver.driver_number),
    }));

  const curFlag = latestFlag(rcMsgs);
  const secFlags = sectorFlagMap(rcMsgs);
  const leaderLap = sortedBoard[0]?.currentLap ?? 0;

  // ── pit stops tab data ──

  interface PitRow {
    driver: OpenF1Driver;
    stops: number;
    tyreHistory: { compound: string; laps: number }[];
    lastLap: number | null;
    lastDuration: number | null;
  }

  const pitRows: PitRow[] = drivers.map(d => {
    const driverStints = stints
      .filter(s => s.driver_number === d.driver_number)
      .sort((a, b) => a.stint_number - b.stint_number);
    const driverPits = pitStops
      .filter(p => p.driver_number === d.driver_number)
      .sort((a, b) => a.lap_number - b.lap_number);
    const tyreHistory = driverStints.map((s, i) => ({
      compound: s.compound,
      laps: s.lap_end != null ? s.lap_end - s.lap_start + 1
        : driverStints[i + 1] ? driverStints[i + 1].lap_start - s.lap_start
        : Math.max(0, leaderLap - s.lap_start + 1),
    }));
    const lastPit = driverPits[driverPits.length - 1];
    return {
      driver: d,
      stops: driverPits.length,
      tyreHistory,
      lastLap: lastPit?.lap_number ?? null,
      lastDuration: lastPit?.pit_duration ?? null,
    };
  }).sort((a, b) => b.stops - a.stops || a.driver.name_acronym.localeCompare(b.driver.name_acronym));

  // ── battle tab ──

  const driverA = drivers.find(d => d.driver_number === battleA);
  const driverB = drivers.find(d => d.driver_number === battleB);
  const paceA = battleA != null ? avgRecentPace(battleA, laps) : null;
  const paceB = battleB != null ? avgRecentPace(battleB, laps) : null;
  const ivA = battleA != null ? latestIntervals.get(battleA) : undefined;
  const ivB = battleB != null ? latestIntervals.get(battleB) : undefined;
  // Smaller gap-to-leader = further up the road. Positive gapAB → A is ahead of B.
  const gapAB = ivA && ivB
    ? gapVal(ivB.gap_to_leader) - gapVal(ivA.gap_to_leader)
    : null;

  let overtakeEst: string | null = null;
  if (paceA != null && paceB != null && gapAB != null && driverA && driverB) {
    const aAhead = gapAB > 0;
    const timeGap = Math.abs(gapAB);
    // The car that's behind needs to be the quicker one (lower lap time) to close in.
    const behindName = aAhead ? driverB.name_acronym : driverA.name_acronym;
    const behindPace = aAhead ? paceB : paceA;
    const aheadPace = aAhead ? paceA : paceB;
    const perLapGain = aheadPace - behindPace; // positive when the chasing car is faster
    if (perLapGain > 0.001) {
      const laps2catch = timeGap / perLapGain;
      overtakeEst = `${behindName} catches in ~${laps2catch.toFixed(1)} laps`;
    } else {
      overtakeEst = 'No catch-up at current pace';
    }
  }

  // ── track map ──

  const allPts: { x: number; y: number }[] = [];
  for (const pts of trailSnapshot.values()) allPts.push(...pts);
  const transform = makeTransform(allPts, 600, 380, 30);

  const latestPos = new Map<number, { x: number; y: number }>();
  for (const [dn, pts] of trailSnapshot.entries()) {
    if (pts.length) latestPos.set(dn, pts[pts.length - 1]);
  }

  const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

  // ── render ────────────────────────────────────────────────────────────────

  if (detecting) {
    return <div style={{ color: '#475569', padding: '80px 0', textAlign: 'center' }}>Checking for live session…</div>;
  }

  if (!isLive) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 48 }}>🏎</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>No live race right now</div>
        {session && (
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Last race: {sessionLabel(session)} — {new Date(session.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#334155', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
          This page connects automatically when a race is in progress. Check back on race day.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── header ── */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${sessionLabel(session)} · Race` : 'Live Race'}
            </span>
            <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
            {curFlag && (
              <span style={{ fontSize: 11, fontWeight: 700, color: flagColor(curFlag.flag), background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${flagColor(curFlag.flag)}44` }}>
                {curFlag.flag === 'SC' ? '🚗 SC' : curFlag.flag === 'VSC' ? '🚗 VSC' : `${curFlag.flag} FLAG`}
              </span>
            )}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {leaderLap > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '4px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#475569' }}>LAP</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#f1f5f9', lineHeight: 1 }}>{leaderLap}</div>
            </div>
          )}
          <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
          <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
          {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {loading && <div style={{ color: '#475569', padding: '40px 0', textAlign: 'center' }}>Connecting to OpenF1…</div>}

      {!loading && (
        <>
          {/* ── tab bar ── */}
          <div className="glass" style={{ padding: '8px 12px' }}>
            <div className="tab-bar">
              {(['LEADERBOARD', 'PIT STOPS', 'BATTLE', 'TRACK MAP'] as Tab[]).map(t => (
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
                      <th>Int</th>
                      <th>Tyre</th>
                      <th>Age</th>
                      <th>Pits</th>
                      <th>Last Lap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoard.map((row, i) => (
                      <tr key={row.driver.driver_number} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                        <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{row.pos}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${row.driver.team_colour || '444'}`, flexShrink: 0 }} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{row.driver.name_acronym}</span>
                                {row.investigated && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(245,158,11,0.3)' }}>INV</span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: '#475569' }}>{row.driver.team_name}</div>
                            </div>
                          </div>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: i === 0 ? '#facc15' : '#94a3b8' }}>{i === 0 ? 'LEAD' : row.gapToLeader}</span></td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{i === 0 ? '—' : row.interval}</span></td>
                        <td>
                          <span style={{ fontWeight: 700, color: TYRE_COLOUR[row.compound] ?? '#64748b', fontSize: 13 }}>
                            {TYRE_LABEL[row.compound] ?? '?'}
                          </span>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{row.tAge > 0 ? row.tAge : '—'}</span></td>
                        <td><span style={{ fontFamily: 'monospace', color: row.pits > 0 ? '#f1f5f9' : '#334155' }}>{row.pits > 0 ? row.pits : '—'}</span></td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{fmtTime(row.lastLap)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* race control messages */}
              {rcMsgs.length > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', marginBottom: 8 }}>RACE CONTROL</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {[...rcMsgs].reverse().slice(0, 6).map((m, i) => (
                      <div key={i} style={{
                        background: m.flag === 'RED' ? 'rgba(239,68,68,0.08)' : m.flag?.includes('YELLOW') ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)',
                        borderRadius: 5, padding: '5px 8px', fontSize: 11,
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
                      <th style={{ minWidth: 180 }}>Tyre History</th>
                    </tr>
                  </thead>
                  <tbody>
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
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: row.stops > 0 ? '#f1f5f9' : '#334155' }}>
                            {row.stops > 0 ? row.stops : '—'}
                          </span>
                        </td>
                        <td><span style={{ color: '#64748b', fontSize: 12 }}>{row.lastLap != null ? `Lap ${row.lastLap}` : '—'}</span></td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                            {row.lastDuration != null ? `${row.lastDuration.toFixed(1)}s` : '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {row.tyreHistory.length === 0 && <span style={{ color: '#334155', fontSize: 11 }}>—</span>}
                            {row.tyreHistory.map((t, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {i > 0 && <span style={{ color: '#334155', fontSize: 10 }}>→</span>}
                                <span style={{
                                  fontWeight: 700, fontSize: 12,
                                  color: TYRE_COLOUR[t.compound] ?? '#64748b',
                                  background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '2px 6px',
                                }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

              {/* driver selectors */}
              <div className="glass" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 12 }}>SELECT DRIVERS</div>
                {(['A', 'B'] as const).map(id => {
                  const sel = id === 'A' ? battleA : battleB;
                  const setSel = id === 'A' ? setBattleA : setBattleB;
                  const driver = id === 'A' ? driverA : driverB;
                  const pace = id === 'A' ? paceA : paceB;
                  return (
                    <div key={id} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>Driver {id}</div>
                      <select
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 8 }}
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
                      {driver && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid #${driver.team_colour || '444'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{driver.name_acronym}</div>
                              <div style={{ fontSize: 11, color: '#475569' }}>{driver.team_name}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: '#475569' }}>P{sortedBoard.find(r => r.driver.driver_number === driver.driver_number)?.pos}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                            <div>
                              <div style={{ color: '#334155' }}>Avg Pace (5L)</div>
                              <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontWeight: 600 }}>{pace != null ? fmtTime(pace) : '—'}</div>
                            </div>
                            <div>
                              <div style={{ color: '#334155' }}>Gap</div>
                              <div style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{fmtGap(latestIntervals.get(driver.driver_number)?.gap_to_leader ?? null, false)}</div>
                            </div>
                            <div>
                              <div style={{ color: '#334155' }}>Tyre</div>
                              <div style={{ fontWeight: 700, color: TYRE_COLOUR[currentStint(driver.driver_number, stints)?.compound ?? 'UNKNOWN'] ?? '#64748b' }}>
                                {TYRE_LABEL[currentStint(driver.driver_number, stints)?.compound ?? 'UNKNOWN'] ?? '?'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* analysis */}
              <div className="glass" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 12 }}>BATTLE ANALYSIS</div>
                {!driverA || !driverB ? (
                  <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>Select two drivers to compare</div>
                ) : (
                  <>
                    {/* pace comparison */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, letterSpacing: '0.06em' }}>AVG PACE LAST 5 LAPS</div>
                      {[driverA, driverB].map((d, i) => {
                        const pace = i === 0 ? paceA : paceB;
                        const other = i === 0 ? paceB : paceA;
                        const diff = pace != null && other != null ? pace - other : null;
                        return (
                          <div key={d.driver_number} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 3, height: 16, borderRadius: 1, background: `#${d.team_colour || '444'}` }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{d.name_acronym}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{pace != null ? fmtTime(pace) : '—'}</span>
                              {diff != null && diff !== 0 && (
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: diff < 0 ? '#4ade80' : '#f87171' }}>
                                  {diff < 0 ? `${Math.abs(diff).toFixed(3)}s faster` : `${diff.toFixed(3)}s slower`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* gap */}
                    {gapAB != null && (
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, letterSpacing: '0.06em' }}>CURRENT GAP</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: '#f1f5f9' }}>
                          {Math.abs(gapAB).toFixed(3)}s
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                          {gapAB > 0 ? `${driverA.name_acronym} is ahead` : `${driverB.name_acronym} is ahead`}
                        </div>
                      </div>
                    )}

                    {/* overtake estimate */}
                    {overtakeEst && (
                      <div style={{
                        background: overtakeEst.includes('~') ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.15)',
                        border: overtakeEst.includes('~') ? '1px solid rgba(250,204,21,0.25)' : '1px solid rgba(100,116,139,0.2)',
                        borderRadius: 8, padding: 12, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>OVERTAKE ESTIMATE</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: overtakeEst.includes('~') ? '#facc15' : '#64748b' }}>{overtakeEst}</div>
                        <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>Based on average of last 5 laps</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TRACK MAP ── */}
          {tab === 'TRACK MAP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* sector flags */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3].map(s => {
                  const f = secFlags[s] ?? 'CLEAR';
                  const col = flagColor(f);
                  return (
                    <div key={s} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '5px 12px', border: `1px solid ${col}44`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: col }}>S{s}</span>
                      <span style={{ fontSize: 10, color: '#475569' }}>{f === 'CLEAR' ? 'Clear' : f}</span>
                    </div>
                  );
                })}
                {curFlag?.message && (
                  <div style={{ fontSize: 11, color: '#64748b', padding: '5px 0', alignSelf: 'center' }}>{curFlag.message}</div>
                )}
              </div>

              <div className="glass" style={{ padding: 12 }}>
                {allPts.length === 0 ? (
                  <div style={{ color: '#475569', textAlign: 'center', padding: '60px 0', fontSize: 13 }}>
                    Waiting for position data…
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 600 380"
                    style={{ width: '100%', maxWidth: 700, display: 'block', margin: '0 auto' }}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* track outline from accumulated position history */}
                    {Array.from(trailSnapshot.values()).map((pts, di) => {
                      if (pts.length < 2) return null;
                      const points = pts.map(p => {
                        const { sx, sy } = transform(p.x, p.y);
                        return `${sx},${sy}`;
                      }).join(' ');
                      return (
                        <polyline
                          key={di}
                          points={points}
                          fill="none"
                          stroke="rgba(100,116,139,0.25)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}

                    {/* car positions */}
                    {Array.from(latestPos.entries()).map(([dn, pos]) => {
                      const d = driverMap.get(dn);
                      if (!d) return null;
                      const { sx, sy } = transform(pos.x, pos.y);
                      const color = `#${d.team_colour || '888'}`;
                      const lbRow = sortedBoard.find(r => r.driver.driver_number === dn);
                      return (
                        <g key={dn}>
                          <circle cx={sx} cy={sy} r={7} fill={color} stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
                          <text
                            x={sx}
                            y={sy - 10}
                            textAnchor="middle"
                            style={{ fontSize: 8, fontWeight: 'bold', fill: '#f1f5f9', fontFamily: 'monospace' }}
                          >
                            {lbRow ? `P${lbRow.pos}` : d.name_acronym}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              <div style={{ fontSize: 11, color: '#334155', textAlign: 'center' }}>
                Car trails show position history. Track shape emerges from accumulated position data.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
