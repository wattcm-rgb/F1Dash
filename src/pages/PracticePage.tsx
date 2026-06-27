import { useEffect, useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { TYRE_COLOUR, TYRE_LABEL, fmtTime, overallSectorBests, driverLapStats, sectorClasses, currentStint, tyreAge, rankByBestLap, placeholderDriver } from '../utils/timing';
import WeatherChip from '../components/WeatherChip';

type Tab = 'LAP' | 'SECTOR' | 'TYRE';

interface Row {
  pos: number;
  driver: OpenF1Driver;
  bestLap: number | null;
  lastLap: number | null;
  gap: number | null;
  s1: number | null; s2: number | null; s3: number | null;
  s1c: string; s2c: string; s3c: string;
  pbS1: number | null; pbS2: number | null; pbS3: number | null;
  compound: string;
  tyreAge: number;
  laps: number;
  inPit: boolean;
}

function buildRows(drivers: OpenF1Driver[], laps: OpenF1Lap[], stints: OpenF1Stint[]): Row[] {
  const ob = overallSectorBests(laps);
  const rows: Row[] = drivers.map(d => {
    const st = driverLapStats(d.driver_number, laps);
    const cur = currentStint(d.driver_number, stints);
    const sc = sectorClasses(st, ob);
    return {
      pos: 0, driver: d, bestLap: st.bestLap, lastLap: st.lastLap, gap: null,
      s1: st.s1, s2: st.s2, s3: st.s3,
      s1c: sc.s1c, s2c: sc.s2c, s3c: sc.s3c,
      pbS1: st.pbS1, pbS2: st.pbS2, pbS3: st.pbS3,
      compound: cur?.compound ?? 'UNKNOWN',
      tyreAge: tyreAge(cur, st.lapsCount),
      laps: st.lapsCount,
      inPit: st.inPit,
    };
  });
  return rankByBestLap(rows);
}

// Empty rows so the table layout is visible outside of a live session.
const PREVIEW_ROWS: Row[] = Array.from({ length: 10 }, (_, i) => ({
  pos: i + 1, driver: placeholderDriver(i + 1), bestLap: null, lastLap: null, gap: null,
  s1: null, s2: null, s3: null, s1c: 'white', s2c: 'white', s3c: 'white',
  pbS1: null, pbS2: null, pbS3: null, compound: 'UNKNOWN', tyreAge: 0, laps: 0, inPit: false,
}));

export default function PracticePage() {
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [tab, setTab] = useState<Tab>('LAP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchData = useCallback(async (key: number) => {
    const [laps, stints, drivers, wx] = await Promise.all([
      openf1Api.getLaps(key), openf1Api.getStints(key),
      openf1Api.getDriversBySession(key), openf1Api.getWeather(key),
    ]);
    if (drivers.length) setRows(buildRows(drivers, laps, stints));
    if (wx.length) setWeather(wx[wx.length - 1]);
    setUpdated(new Date());
  }, []);

  useEffect(() => {
    let interval: number;
    async function init() {
      setLoading(true); setError(null);
      try {
        const s = await openf1Api.getLatestSession('Practice');
        if (!s) { setError('No practice session found.'); setLoading(false); return; }
        setSession(s);
        await fetchData(s.session_key);
        const live = s.date_end ? new Date(s.date_end) > new Date() : false;
        setIsLive(live);
        if (live) interval = window.setInterval(() => fetchData(s.session_key), 4000);
      } catch { setError('Failed to connect to OpenF1 server.'); }
      finally { setLoading(false); }
    }
    init();
    return () => clearInterval(interval);
  }, [fetchData]);

  const isPreview = !loading && !error && rows.length === 0;
  const display = rows.length ? rows : PREVIEW_ROWS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* session header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${session.meeting_name} · ${session.session_name}` : 'Practice Session'}
            </span>
            {isLive && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!error && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
              <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
              <WeatherChip label="Humidity" value={weather ? `${weather.humidity.toFixed(0)}%` : '—'} />
              {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
            </div>
          )}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* fastest lap banner */}
      {!error && (
        <div style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>FASTEST LAP</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{fmtTime(display[0]?.bestLap ?? null)}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{display[0]?.driver.name_acronym} · {display[0]?.driver.team_name}</span>
        </div>
      )}

      {isPreview && (
        <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', fontSize: 12 }}>
          Layout preview — no live session data right now. These boxes populate automatically during a session.
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Connecting to OpenF1…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && (
        <div className="glass" style={{ overflow: 'hidden', opacity: isPreview ? 0.55 : 1 }}>
          {/* tab bar */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tab-bar">
              {(['LAP', 'SECTOR', 'TYRE'] as Tab[]).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#334155' }}>{isPreview ? 'Preview' : `${rows.length} drivers`}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Pos</th>
                  <th style={{ minWidth: 110 }}>Driver</th>
                  <th>Best Lap</th>
                  <th>Gap</th>
                  {tab === 'LAP' && <><th>Last Lap</th><th>Laps</th></>}
                  {tab === 'SECTOR' && <><th>S1</th><th>S2</th><th>S3</th></>}
                  {tab === 'TYRE' && <><th>Tyre</th><th>Age</th><th>Laps</th></>}
                </tr>
              </thead>
              <tbody>
                {display.map((row, i) => (
                  <tr key={row.driver.driver_number} className={`timing-row${i === 0 ? ' p1' : ''}`}>
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
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: i === 0 ? '#c084fc' : '#f1f5f9', fontSize: 13 }}>{fmtTime(row.bestLap)}</span></td>
                    <td>
                      {i === 0
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7' }}>LEADER</span>
                        : <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{row.gap != null ? `+${row.gap.toFixed(3)}` : '—'}</span>}
                    </td>
                    {tab === 'LAP' && (
                      <>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{fmtTime(row.lastLap)}</span></td>
                        <td><span style={{ color: '#475569', fontSize: 12 }}>{row.laps}</span></td>
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
                          <span style={{ fontWeight: 700, fontSize: 13, color: TYRE_COLOUR[row.compound] ?? '#64748b' }}>
                            {TYRE_LABEL[row.compound] ?? '?'}
                          </span>
                          <span style={{ fontSize: 10, color: '#475569', marginLeft: 5 }}>{row.compound}</span>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{row.tyreAge > 0 ? row.tyreAge : '—'}</span></td>
                        <td><span style={{ color: '#475569', fontSize: 12 }}>{row.laps}</span></td>
                      </>
                    )}
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
