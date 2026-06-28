import { useEffect, useState, useCallback, useRef } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { sessionLabel, isLiveSession, isPastSession } from '../types/openf1';
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

interface PracticeMeeting {
  meetingKey: number;
  label: string;
  sessions: { sessionKey: number; name: string }[];
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

const PREVIEW_ROWS: Row[] = Array.from({ length: 10 }, (_, i) => ({
  pos: i + 1, driver: placeholderDriver(i + 1), bestLap: null, lastLap: null, gap: null,
  s1: null, s2: null, s3: null, s1c: 'white', s2c: 'white', s3c: 'white',
  pbS1: null, pbS2: null, pbS3: null, compound: 'UNKNOWN', tyreAge: 0, laps: 0, inPit: false,
}));

export default function PracticePage() {
  const [meetings, setMeetings] = useState<PracticeMeeting[]>([]);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<number | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [tab, setTab] = useState<Tab>('LAP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const year = new Date().getFullYear();
        const sessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const practiceSessions = sessions.filter(
          s => s.session_type === 'Practice' && isPastSession(s)
        );

        // Group by meeting_key
        const meetingMap = new Map<number, PracticeMeeting>();
        for (const s of practiceSessions) {
          const key = s.meeting_key;
          if (!meetingMap.has(key)) {
            meetingMap.set(key, {
              meetingKey: key,
              label: sessionLabel(s),
              sessions: [],
            });
          }
          meetingMap.get(key)!.sessions.push({
            sessionKey: s.session_key,
            name: s.session_name,
          });
        }

        const mtgs = Array.from(meetingMap.values());
        setMeetings(mtgs);

        if (mtgs.length) {
          const lastMtg = mtgs[mtgs.length - 1];
          setSelectedMeetingKey(lastMtg.meetingKey);
          // Default to last session within the meeting (FP3 > FP2 > FP1)
          const lastSession = lastMtg.sessions[lastMtg.sessions.length - 1];
          setSelectedSessionKey(lastSession.sessionKey);
        } else {
          setLoading(false);
        }
      } catch {
        setError('Failed to load practice sessions.');
        setLoading(false);
      }
    }
    init();
  }, []);

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
    if (selectedSessionKey == null) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRows([]); setWeather(null); setLoading(true); setError(null); setIsLive(false);

    async function load() {
      try {
        const year = new Date().getFullYear();
        const all: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const s = all.find(sess => sess.session_key === selectedSessionKey);
        if (s) setSession(s);
        const key = selectedSessionKey as number;
        await fetchData(key);
        const live = s ? isLiveSession(s) : false;
        setIsLive(live);
        if (live) intervalRef.current = window.setInterval(() => fetchData(key), 4000);
      } catch {
        setError('Failed to load session data.');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedSessionKey, fetchData]);

  const currentMeeting = meetings.find(m => m.meetingKey === selectedMeetingKey);
  const isPreview = !loading && !error && rows.length === 0;
  const display = rows.length ? rows : PREVIEW_ROWS;
  const noData = !loading && !error && !isLive && rows.length === 0;

  function handleMeetingChange(key: number) {
    setSelectedMeetingKey(key);
    const mtg = meetings.find(m => m.meetingKey === key);
    if (mtg?.sessions.length) {
      setSelectedSessionKey(mtg.sessions[mtg.sessions.length - 1].sessionKey);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${sessionLabel(session)} · ${session.session_name}` : 'Practice Session'}
            </span>
            {isLive && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {meetings.length > 0 && (
            <select
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
              value={selectedMeetingKey ?? ''}
              onChange={e => handleMeetingChange(Number(e.target.value))}
            >
              {meetings.map(m => (
                <option key={m.meetingKey} value={m.meetingKey}>{m.label}</option>
              ))}
            </select>
          )}
          {currentMeeting && currentMeeting.sessions.length > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {currentMeeting.sessions.map(s => (
                <button
                  key={s.sessionKey}
                  onClick={() => setSelectedSessionKey(s.sessionKey)}
                  className={`tab-btn${selectedSessionKey === s.sessionKey ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {s.name.replace('Practice ', 'FP')}
                </button>
              ))}
            </div>
          )}
          {!error && (
            <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
              <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
              <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
              {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
            </div>
          )}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>{isLive ? 'Live · ' : ''}Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {!error && rows.length > 0 && (
        <div style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>FASTEST LAP</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{fmtTime(display[0]?.bestLap ?? null)}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{display[0]?.driver.name_acronym} · {display[0]?.driver.team_name}</span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading practice data…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {noData && (
        <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 8, padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
          No lap data available for this session yet. Practice timing data from the public OpenF1 API typically appears 24–48 hours after a session ends.
        </div>
      )}

      {!loading && !error && (rows.length > 0 || isPreview) && (
        <div className="glass" style={{ overflow: 'hidden', opacity: isPreview ? 0.55 : 1 }}>
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
