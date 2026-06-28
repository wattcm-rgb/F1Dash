import { useEffect, useState, useRef, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';
import { isLiveSession, sessionLabel } from '../types/openf1';
import WeatherChip from '../components/WeatherChip';
import StatusBanner from '../components/StatusBanner';
import RaceTabs from '../components/race/RaceTabs';
import { latestFlag, flagColor } from '../components/race/derive';
import type { PitStop, PositionRow, Interval, RcMsg, LocationPt } from '../components/race/types';

export default function LivePage() {
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [detecting, setDetecting] = useState(true);

  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<OpenF1Stint[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [rcMsgs, setRcMsgs] = useState<RcMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);

  // live track trails (driver -> recent points)
  const trailsRef = useRef<Map<number, { x: number; y: number }[]>>(new Map());
  const [trailSnapshot, setTrailSnapshot] = useState<Map<number, { x: number; y: number }[]>>(new Map());
  const lastLocFetch = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const pollRef = useRef<number | null>(null);

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

  const fetchLocation = useCallback(async (key: number) => {
    const since = lastLocFetch.current
      ? new Date(new Date(lastLocFetch.current).getTime() - 1000).toISOString().replace('Z', '')
      : new Date(Date.now() - 90_000).toISOString().replace('Z', '');
    const pts = await openf1Api.getLocation(key, since) as LocationPt[];
    if (!pts.length) return;
    lastLocFetch.current = pts[pts.length - 1].date;
    const updated = new Map(trailsRef.current);
    for (const p of pts) {
      const arr = updated.get(p.driver_number) ?? [];
      arr.push({ x: p.x, y: p.y });
      if (arr.length > 12) arr.splice(0, arr.length - 12);
      updated.set(p.driver_number, arr);
    }
    trailsRef.current = updated;
    setTrailSnapshot(new Map(updated));
  }, []);

  const fetchAll = useCallback(async (key: number) => {
    const [l, st, d, pit, iv, rc, wx, pos] = await Promise.all([
      openf1Api.getLaps(key),
      openf1Api.getStints(key),
      openf1Api.getDriversBySession(key),
      openf1Api.getPitStops(key),
      openf1Api.getIntervals(key),
      openf1Api.getRaceControlMessages(key),
      openf1Api.getWeather(key),
      openf1Api.getPositions(key),
    ]);
    setLaps(l as OpenF1Lap[]);
    setStints(st as OpenF1Stint[]);
    if ((d as OpenF1Driver[]).length) setDrivers(d as OpenF1Driver[]);
    setPitStops(pit as PitStop[]);
    setIntervals(iv as Interval[]);
    setPositions(pos as PositionRow[]);
    setRcMsgs(rc as RcMsg[]);
    const wxArr = wx as OpenF1Weather[];
    if (wxArr.length) setWeather(wxArr[wxArr.length - 1]);
    setUpdated(new Date());
    await fetchLocation(key);
  }, [fetchLocation]);

  useEffect(() => {
    if (!session || !isLive) { if (!detecting) setLoading(false); return; }
    const key = session.session_key;
    setLoading(true);
    fetchAll(key).finally(() => setLoading(false));
    pollRef.current = window.setInterval(() => fetchAll(key), 4_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, isLive, detecting, fetchAll]);

  const curFlag = latestFlag(rcMsgs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${sessionLabel(session)} · Race` : 'Live Race'}
            </span>
            {isLive
              ? <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
              : <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.15)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>OFFLINE</span>}
            {curFlag && (
              <span style={{ fontSize: 11, fontWeight: 700, color: flagColor(curFlag.flag), background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${flagColor(curFlag.flag)}44` }}>
                {curFlag.flag === 'SC' ? '🚗 SC' : curFlag.flag === 'VSC' ? '🚗 VSC' : `${curFlag.flag} FLAG`}
              </span>
            )}
          </div>
          {session && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{session.circuit_short_name} · {session.country_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <WeatherChip label="Air" value={weather ? `${weather.air_temperature.toFixed(1)}°C` : '—'} />
          <WeatherChip label="Track" value={weather ? `${weather.track_temperature.toFixed(1)}°C` : '—'} />
          {weather && weather.rainfall > 0 && <WeatherChip label="Rain" value={`${weather.rainfall.toFixed(1)}mm`} accent />}
          {updated && <span style={{ fontSize: 11, color: '#334155' }}>Updated {updated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {detecting ? (
        <StatusBanner tone="grey">Checking for a live session…</StatusBanner>
      ) : !isLive ? (
        <StatusBanner tone="amber">
          No live race right now — live timing populates automatically when a race goes green.
          {session && ` Last race: ${sessionLabel(session)}.`}
        </StatusBanner>
      ) : null}

      {loading && isLive && <div style={{ color: '#475569', padding: '40px 0', textAlign: 'center' }}>Connecting to OpenF1…</div>}

      {(!loading || !isLive) && session && (
        <RaceTabs
          mode="live"
          session={session}
          drivers={drivers}
          laps={laps}
          stints={stints}
          pitStops={pitStops}
          positions={positions}
          intervals={intervals}
          rcMsgs={rcMsgs}
          liveTrails={trailSnapshot}
        />
      )}
    </div>
  );
}
