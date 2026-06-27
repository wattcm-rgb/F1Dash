import { useEffect, useState, useCallback, useRef } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';

type Tab = 'LAP' | 'SECTOR' | 'TYRE' | 'PIT';

const TYRE_COLOUR: Record<string, string> = { SOFT: '#f87171', MEDIUM: '#facc15', HARD: '#e2e8f0', INTERMEDIATE: '#4ade80', WET: '#60a5fa', UNKNOWN: '#64748b' };
const TYRE_LABEL: Record<string, string> = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?' };

function fmtTime(s: number | null) { if (s == null) return '—'; const m = Math.floor(s / 60); return m > 0 ? `${m}:${(s % 60).toFixed(3).padStart(6, '0')}` : (s % 60).toFixed(3); }
function sectorClass(v: number | null, pb: number | null, ob: number | null) { if (v == null) return 'white'; if (ob != null && v <= ob) return 'purple'; if (pb != null && v <= pb) return 'green'; return 'yellow'; }

interface PitStop { driver_number: number; lap_number: number; pit_duration: number | null; }
interface RaceControlMsg { date: string; message: string; flag?: string; category?: string; }
interface Interval { driver_number: number; gap_to_leader: number | string | null; interval: number | string | null; }

interface Row {
  pos: number; driver: OpenF1Driver;
  gapToLeader: string; gapAhead: string;
  currentLap: number; lastLap: number | null; bestLap: number | null;
  s1: number | null; s2: number | null; s3: number | null;
  s1c: string; s2c: string; s3c: string;
  compound: string; tyreAge: number;
  pitCount: number; lastPitLap: number | null; lastPitDuration: number | null;
  inPit: boolean;
}

function buildRows(drivers: OpenF1Driver[], laps: OpenF1Lap[], stints: OpenF1Stint[], pits: PitStop[], intervals: Interval[]): Row[] {
  const obS1 = Math.min(...laps.map(l => l.duration_sector_1).filter((v): v is number => v != null));
  const obS2 = Math.min(...laps.map(l => l.duration_sector_2).filter((v): v is number => v != null));
  const obS3 = Math.min(...laps.map(l => l.duration_sector_3).filter((v): v is number => v != null));
  const latestIv = new Map(intervals.map(iv => [iv.driver_number, iv]));

  return drivers.map(d => {
    const dl = laps.filter(l => l.driver_number === d.driver_number);
    const valid = dl.filter(l => l.lap_duration != null && !l.is_pit_out_lap);
    const best = valid.length ? Math.min(...valid.map(l => l.lap_duration!)) : null;
    const last = dl[dl.length - 1];
    const myS1s = valid.map(l => l.duration_sector_1).filter((v): v is number => v != null);
    const myS2s = valid.map(l => l.duration_sector_2).filter((v): v is number => v != null);
    const myS3s = valid.map(l => l.duration_sector_3).filter((v): v is number => v != null);
    const s1 = last?.duration_sector_1 ?? null; const s2 = last?.duration_sector_2 ?? null; const s3 = last?.duration_sector_3 ?? null;
    const ds = stints.filter(s => s.driver_number === d.driver_number).sort((a, b) => b.stint_number - a.stint_number);
    const cur = ds[0];
    const dp = pits.filter(p => p.driver_number === d.driver_number).sort((a, b) => b.lap_number - a.lap_number);
    const iv = latestIv.get(d.driver_number);
    const fmt = (v: number | string | null) => v == null ? '—' : typeof v === 'number' ? `+${v.toFixed(3)}` : String(v);
    return {
      pos: 0, driver: d,
      gapToLeader: fmt(iv?.gap_to_leader ?? null), gapAhead: fmt(iv?.interval ?? null),
      currentLap: dl.length, lastLap: last?.lap_duration ?? null, bestLap: best,
      s1, s2, s3,
      s1c: sectorClass(s1, myS1s.length ? Math.min(...myS1s) : null, isFinite(obS1) ? obS1 : null),
      s2c: sectorClass(s2, myS2s.length ? Math.min(...myS2s) : null, isFinite(obS2) ? obS2 : null),
      s3c: sectorClass(s3, myS3s.length ? Math.min(...myS3s) : null, isFinite(obS3) ? obS3 : null),
      compound: cur?.compound ?? 'UNKNOWN',
      tyreAge: cur ? cur.tyre_age_at_start + (dl.length - (cur.lap_start - 1)) : 0,
      pitCount: dp.length, lastPitLap: dp[0]?.lap_number ?? null, lastPitDuration: dp[0]?.pit_duration ?? null,
      inPit: last?.is_pit_out_lap ?? false,
    };
  }).sort((a, b) => b.currentLap - a.currentLap).map((r, i) => ({ ...r, pos: i + 1 }));
}

interface Meeting { label: string; sessionKey: number; }

export default function RacePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rcMsgs, setRcMsgs] = useState<RaceControlMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [totalLaps, setTotalLaps] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('LAP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [battleA, setBattleA] = useState<number | null>(null);
  const [battleB, setBattleB] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const year = new Date().getFullYear();
        const sessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const opts = sessions.filter(s => s.session_type === 'Race' && s.session_name === 'Race').map(s => ({ label: s.meeting_name, sessionKey: s.session_key }));
        setMeetings(opts);
        if (opts.length) setSelectedKey(opts[opts.length - 1].sessionKey);
      } catch { setError('Failed to load race list.'); setLoading(false); }
    }
    init();
  }, []);

  const fetchData = useCallback(async (key: number) => {
    const [laps, stints, drivers, pits, wx, rc, ivs] = await Promise.all([
      openf1Api.getLaps(key), openf1Api.getStints(key), openf1Api.getDriversBySession(key),
      openf1Api.getPitStops(key), openf1Api.getWeather(key),
      openf1Api.getRaceControlMessages(key), openf1Api.getIntervals(key),
    ]);
    if (drivers.length) {
      setRows(buildRows(drivers, laps, stints, pits, ivs));
      const max = laps.length ? Math.max(...laps.map((l: OpenF1Lap) => l.lap_number)) : 0;
      if (max > 0) setTotalLaps(prev => prev ?? max);
    }
    if (wx.length) setWeather(wx[wx.length - 1]);
    if (rc.length) setRcMsgs([...rc].reverse().slice(0, 8));
    setUpdated(new Date());
  }, []);

  useEffect(() => {
    if (selectedKey == null) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRows([]); setRcMsgs([]); setTotalLaps(null); setLoading(true); setError(null); setIsLive(false);
    async function load() {
      try {
        const year = new Date().getFullYear();
        const all: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const s = all.find(sess => sess.session_key === selectedKey);
        if (!s) { setError('Session not found.'); setLoading(false); return; }
        setSession(s);
        const key = selectedKey as number;
        await fetchData(key);
        const live = s.date_end ? new Date(s.date_end) > new Date() : false;
        setIsLive(live);
        if (live) intervalRef.current = window.setInterval(() => fetchData(key), 4000);
      } catch { setError('Failed to load race data.'); }
      finally { setLoading(false); }
    }
    load();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedKey, fetchData]);

  const dA = rows.find(r => r.driver.driver_number === battleA);
  const dB = rows.find(r => r.driver.driver_number === battleB);
  const delta = dA?.bestLap != null && dB?.bestLap != null ? dA.bestLap - dB.bestLap : null;
  const lapsLeft = totalLaps != null ? Math.max(0, totalLaps - (rows[0]?.currentLap ?? 0)) : null;
  const latestFlag = rcMsgs.find(m => m.flag || m.category === 'Flag');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${session.meeting_name} · Race` : 'Race'}
            </span>
            {isLive && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>LIVE</span>}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {meetings.length > 0 && (
            <select
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
              value={selectedKey ?? ''}
              onChange={e => setSelectedKey(Number(e.target.value))}
            >
              {meetings.map(m => <option key={m.sessionKey} value={m.sessionKey}>{m.label}</option>)}
            </select>
          )}
          {weather && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <WeatherChip label="Air" value={`${weather.air_temperature.toFixed(1)}°C`} />
              <WeatherChip label="Track" value={`${weather.track_temperature.toFixed(1)}°C`} />
              {weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
            </div>
          )}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>{isLive ? 'Live · ' : ''}Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* status strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {lapsLeft != null && (
          <div className="glass" style={{ padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em' }}>LAPS LEFT</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#f1f5f9', lineHeight: 1.2 }}>{lapsLeft}</div>
            {totalLaps && <div style={{ fontSize: 10, color: '#334155' }}>of {totalLaps}</div>}
          </div>
        )}
        {latestFlag?.flag && (
          <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, background: latestFlag.flag === 'RED' ? 'rgba(239,68,68,0.15)' : latestFlag.flag === 'YELLOW' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.1)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: latestFlag.flag === 'RED' ? '#f87171' : latestFlag.flag === 'YELLOW' ? '#facc15' : '#4ade80' }}>
              {latestFlag.flag === 'SC' ? '🚗 Safety Car' : latestFlag.flag === 'VSC' ? '🚗 Virtual SC' : `${latestFlag.flag} FLAG`}
            </span>
          </div>
        )}
        {rows[0] && (
          <div className="glass" style={{ padding: '8px 16px' }}>
            <div style={{ fontSize: 10, color: '#475569' }}>LEADER</div>
            <div style={{ fontWeight: 700, color: '#facc15' }}>{rows[0].driver.name_acronym}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{rows[0].driver.team_name}</div>
          </div>
        )}
      </div>

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading race data…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'start' }}>

          {/* timing table */}
          <div className="glass" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="tab-bar">
                {(['LAP', 'SECTOR', 'TYRE', 'PIT'] as Tab[]).map(t => (
                  <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#334155' }}>{rows.length} drivers</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="timing-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>P</th>
                    <th style={{ minWidth: 110 }}>Driver</th>
                    <th>Gap</th>
                    <th>Int</th>
                    {tab === 'LAP' && <><th>Last</th><th>Best</th><th>Lap</th></>}
                    {tab === 'SECTOR' && <><th>S1</th><th>S2</th><th>S3</th></>}
                    {tab === 'TYRE' && <><th>Tyre</th><th>Age</th><th>Lap</th></>}
                    {tab === 'PIT' && <><th>Stops</th><th>Last Lap</th><th>Duration</th></>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.driver.driver_number} className={`timing-row${i === 0 ? ' p1' : ''}`} style={{ opacity: row.inPit ? 0.6 : 1 }}>
                      <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{row.pos}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 3, height: 20, borderRadius: 2, background: `#${row.driver.team_colour || '444'}`, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{row.driver.name_acronym}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{row.driver.team_name}</div>
                          </div>
                          {row.inPit && <span className="badge-pit">PIT</span>}
                        </div>
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: i === 0 ? '#facc15' : '#94a3b8' }}>{i === 0 ? 'LEAD' : row.gapToLeader}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{i === 0 ? '—' : row.gapAhead}</span></td>
                      {tab === 'LAP' && (
                        <>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{fmtTime(row.lastLap)}</span></td>
                          <td><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{fmtTime(row.bestLap)}</span></td>
                          <td><span style={{ color: '#475569', fontSize: 12 }}>{row.currentLap}</span></td>
                        </>
                      )}
                      {tab === 'SECTOR' && (
                        <>
                          <td><span className={`sector-pill ${row.s1c}`}>{row.s1 != null ? row.s1.toFixed(3) : '—'}</span></td>
                          <td><span className={`sector-pill ${row.s2c}`}>{row.s2 != null ? row.s2.toFixed(3) : '—'}</span></td>
                          <td><span className={`sector-pill ${row.s3c}`}>{row.s3 != null ? row.s3.toFixed(3) : '—'}</span></td>
                        </>
                      )}
                      {tab === 'TYRE' && (
                        <>
                          <td>
                            <span style={{ fontWeight: 700, color: TYRE_COLOUR[row.compound] ?? '#64748b' }}>{TYRE_LABEL[row.compound]}</span>
                            <span style={{ fontSize: 10, color: '#475569', marginLeft: 5 }}>{row.compound}</span>
                          </td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{row.tyreAge > 0 ? row.tyreAge : '—'}</span></td>
                          <td><span style={{ color: '#475569', fontSize: 12 }}>{row.currentLap}</span></td>
                        </>
                      )}
                      {tab === 'PIT' && (
                        <>
                          <td><span style={{ fontFamily: 'monospace', color: row.pitCount > 0 ? '#f1f5f9' : '#334155' }}>{row.pitCount > 0 ? row.pitCount : '—'}</span></td>
                          <td><span style={{ color: '#64748b', fontSize: 12 }}>{row.lastPitLap != null ? `Lap ${row.lastPitLap}` : '—'}</span></td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{row.lastPitDuration != null ? `${row.lastPitDuration.toFixed(1)}s` : '—'}</span></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* battle analysis */}
            <div className="glass" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 10 }}>BATTLE ANALYSIS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {(['A', 'B'] as const).map((id, idx) => (
                  <div key={id}>
                    <div style={{ fontSize: 10, color: '#334155', marginBottom: 4 }}>Driver {id}</div>
                    <select
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12, padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }}
                      value={(idx === 0 ? battleA : battleB) ?? ''}
                      onChange={e => idx === 0 ? setBattleA(e.target.value ? Number(e.target.value) : null) : setBattleB(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Select</option>
                      {rows.map(r => <option key={r.driver.driver_number} value={r.driver.driver_number}>P{r.pos} {r.driver.name_acronym}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {dA && dB ? (
                <>
                  {[dA, dB].map(d => (
                    <div key={d.driver.driver_number} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 7, padding: '8px 10px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 3, height: 16, borderRadius: 2, background: `#${d.driver.team_colour || '444'}` }} />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{d.driver.name_acronym}</span>
                          <span style={{ fontSize: 11, color: '#475569' }}>P{d.pos}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: TYRE_COLOUR[d.compound] ?? '#64748b', fontSize: 13 }}>{TYRE_LABEL[d.compound]}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
                        <div><div style={{ color: '#334155' }}>Best</div><div style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{fmtTime(d.bestLap)}</div></div>
                        <div><div style={{ color: '#334155' }}>Last</div><div style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{fmtTime(d.lastLap)}</div></div>
                        <div><div style={{ color: '#334155' }}>Pits</div><div style={{ color: '#cbd5e1' }}>{d.pitCount || '—'}</div></div>
                      </div>
                    </div>
                  ))}
                  {delta != null && (
                    <div style={{ background: Math.abs(delta) < 0.3 ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.2)', border: Math.abs(delta) < 0.3 ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Pace delta (best lap)</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: Math.abs(delta) < 0.3 ? '#facc15' : '#f1f5f9' }}>
                        {delta > 0 ? `${dA?.driver.name_acronym} +${delta.toFixed(3)}s slower` : `${dA?.driver.name_acronym} ${Math.abs(delta).toFixed(3)}s faster`}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '8px 0' }}>Select two drivers to compare</div>
              )}
            </div>

            {/* race control */}
            {rcMsgs.length > 0 && (
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 10 }}>RACE CONTROL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {rcMsgs.map((msg, i) => (
                    <div key={i} style={{
                      background: msg.flag === 'RED' ? 'rgba(239,68,68,0.1)' : msg.flag === 'YELLOW' || msg.message?.includes('SAFETY CAR') ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${msg.flag === 'RED' ? 'rgba(239,68,68,0.25)' : msg.flag === 'YELLOW' ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 6, padding: '6px 8px',
                    }}>
                      <div style={{ fontSize: 10, color: '#334155', marginBottom: 2 }}>{new Date(msg.date).toLocaleTimeString()}</div>
                      <div style={{ fontSize: 11, color: msg.flag === 'RED' ? '#f87171' : msg.flag === 'YELLOW' ? '#facc15' : '#94a3b8', lineHeight: 1.4 }}>{msg.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* weather */}
            {weather && (
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 10 }}>WEATHER</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['Air Temp', `${weather.air_temperature.toFixed(1)}°C`], ['Track Temp', `${weather.track_temperature.toFixed(1)}°C`], ['Humidity', `${weather.humidity.toFixed(0)}%`], ['Wind', `${weather.wind_speed.toFixed(1)} m/s`], ['Rainfall', weather.rainfall > 0 ? `${weather.rainfall.toFixed(1)}mm` : 'None'], ['Pressure', `${weather.pressure.toFixed(0)} hPa`]].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ fontSize: 10, color: '#334155' }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeatherChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#475569' }}>{label}</div>
      <div style={{ fontWeight: 600, color: accent ? '#60a5fa' : '#cbd5e1' }}>{value}</div>
    </div>
  );
}
