import { useEffect, useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';

type Tab = 'LAP' | 'SECTOR' | 'TYRE';

const TYRE_COLOUR: Record<string, string> = {
  SOFT: '#f87171', MEDIUM: '#facc15', HARD: '#e2e8f0',
  INTERMEDIATE: '#4ade80', WET: '#60a5fa', UNKNOWN: '#64748b',
};
const TYRE_LABEL: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
};

function fmtTime(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${rest}` : rest;
}

function sectorClass(v: number | null, pb: number | null, ob: number | null): string {
  if (v == null) return 'white';
  if (ob != null && v <= ob) return 'purple';
  if (pb != null && v <= pb) return 'green';
  return 'yellow';
}

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
  const obS1 = Math.min(...laps.map(l => l.duration_sector_1).filter((v): v is number => v != null));
  const obS2 = Math.min(...laps.map(l => l.duration_sector_2).filter((v): v is number => v != null));
  const obS3 = Math.min(...laps.map(l => l.duration_sector_3).filter((v): v is number => v != null));

  const rows: Row[] = drivers.map(d => {
    const dl = laps.filter(l => l.driver_number === d.driver_number);
    const valid = dl.filter(l => l.lap_duration != null && !l.is_pit_out_lap);
    const best = valid.length ? Math.min(...valid.map(l => l.lap_duration!)) : null;
    const last = dl[dl.length - 1];
    const myS1s = valid.map(l => l.duration_sector_1).filter((v): v is number => v != null);
    const myS2s = valid.map(l => l.duration_sector_2).filter((v): v is number => v != null);
    const myS3s = valid.map(l => l.duration_sector_3).filter((v): v is number => v != null);
    const pbS1 = myS1s.length ? Math.min(...myS1s) : null;
    const pbS2 = myS2s.length ? Math.min(...myS2s) : null;
    const pbS3 = myS3s.length ? Math.min(...myS3s) : null;
    const s1 = last?.duration_sector_1 ?? null;
    const s2 = last?.duration_sector_2 ?? null;
    const s3 = last?.duration_sector_3 ?? null;
    const ds = stints.filter(s => s.driver_number === d.driver_number).sort((a, b) => b.stint_number - a.stint_number);
    const cur = ds[0];
    return {
      pos: 0, driver: d, bestLap: best, lastLap: last?.lap_duration ?? null, gap: null,
      s1, s2, s3,
      s1c: sectorClass(s1, pbS1, isFinite(obS1) ? obS1 : null),
      s2c: sectorClass(s2, pbS2, isFinite(obS2) ? obS2 : null),
      s3c: sectorClass(s3, pbS3, isFinite(obS3) ? obS3 : null),
      pbS1, pbS2, pbS3,
      compound: cur?.compound ?? 'UNKNOWN',
      tyreAge: cur ? cur.tyre_age_at_start + (dl.length - (cur.lap_start - 1)) : 0,
      laps: dl.length,
      inPit: last?.is_pit_out_lap ?? false,
    };
  });

  rows.sort((a, b) => { if (a.bestLap == null) return 1; if (b.bestLap == null) return -1; return a.bestLap - b.bestLap; });
  const leader = rows[0]?.bestLap ?? null;
  rows.forEach((r, i) => { r.pos = i + 1; r.gap = i > 0 && r.bestLap != null && leader != null ? r.bestLap - leader : null; });
  return rows;
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* session header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              {session ? `${session.meeting_name} · ${session.session_name}` : 'Practice Session'}
            </span>
            {isLive && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {weather && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <WeatherChip label="Air" value={`${weather.air_temperature.toFixed(1)}°C`} />
              <WeatherChip label="Track" value={`${weather.track_temperature.toFixed(1)}°C`} />
              <WeatherChip label="Humidity" value={`${weather.humidity.toFixed(0)}%`} />
              {weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
            </div>
          )}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* fastest lap banner */}
      {rows[0]?.bestLap && (
        <div style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>FASTEST LAP</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{fmtTime(rows[0].bestLap)}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{rows[0].driver.name_acronym} · {rows[0].driver.team_name}</span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Connecting to OpenF1…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && rows.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {/* tab bar */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tab-bar">
              {(['LAP', 'SECTOR', 'TYRE'] as Tab[]).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#334155' }}>{rows.length} drivers</span>
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
                {rows.map((row, i) => (
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

      {!loading && !error && rows.length === 0 && (
        <div style={{ color: '#334155', padding: '60px 0', textAlign: 'center', fontSize: 13 }}>No timing data — session may not have started.</div>
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
