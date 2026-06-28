import { useEffect, useState } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { sessionLabel, isPastSession } from '../types/openf1';
import WeatherChip from '../components/WeatherChip';
import RaceTabs from '../components/race/RaceTabs';
import type { PitStop, PositionRow, RcMsg } from '../components/race/types';

const YEARS = [2026, 2025, 2024, 2023];

export default function RacePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [raceSessions, setRaceSessions] = useState<OpenF1Session[]>([]);
  const [session, setSession] = useState<OpenF1Session | null>(null);

  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<OpenF1Stint[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [rcMsgs, setRcMsgs] = useState<RcMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [loading, setLoading] = useState(false);

  // Load race sessions for the selected year. Only "Race" (not Sprint), so the
  // dropdown has one entry per Grand Prix; label by meeting name to keep Imola
  // and Monza (both "Italy") distinct.
  useEffect(() => {
    setRaceSessions([]); setSession(null);
    async function load() {
      const all = await openf1Api.getSessionsByYear(year) as OpenF1Session[];
      const races = all
        .filter(s => s.session_name === 'Race' && isPastSession(s))
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      // de-dupe by meeting_key (guard against any repeated session rows)
      const seen = new Set<number>();
      const unique = races.filter(s => (seen.has(s.meeting_key) ? false : (seen.add(s.meeting_key), true)));
      setRaceSessions(unique);
      if (unique.length) setSession(unique[unique.length - 1]);
    }
    load();
  }, [year]);

  // Load all data for the chosen race.
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setDrivers([]); setLaps([]); setStints([]); setPitStops([]); setPositions([]); setRcMsgs([]); setWeather(null);
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
      setRcMsgs(rc as RcMsg[]);
      const wxArr = wx as OpenF1Weather[];
      if (wxArr.length) setWeather(wxArr[wxArr.length - 1]);
    }).finally(() => setLoading(false));
  }, [session]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── prominent filter bar (above the title) ── */}
      <div className="filter-bar">
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {raceSessions.length > 0 && (
          <select
            value={session?.session_key ?? ''}
            onChange={e => { const s = raceSessions.find(r => r.session_key === Number(e.target.value)); if (s) setSession(s); }}
            style={{ minWidth: 220 }}
          >
            {[...raceSessions].reverse().map(s => (
              <option key={s.session_key} value={s.session_key}>{sessionLabel(s)}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── title / weather header ── */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
            {session ? `${sessionLabel(session)} · Race` : 'Race History'}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
          <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
          {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
        </div>
      </div>

      {!session && !loading && <div style={{ color: '#475569', textAlign: 'center', padding: '60px 0' }}>No race data available for {year}.</div>}
      {loading && <div style={{ color: '#475569', padding: '40px 0', textAlign: 'center' }}>Loading race data…</div>}

      {!loading && session && (
        <RaceTabs
          mode="historical"
          session={session}
          drivers={drivers}
          laps={laps}
          stints={stints}
          pitStops={pitStops}
          positions={positions}
          intervals={[]}
          rcMsgs={rcMsgs}
        />
      )}
    </div>
  );
}
