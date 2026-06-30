import { useEffect, useState, useRef, useCallback } from 'react';
import { openf1Api, isRateLimited } from '../../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../../types/openf1';
import { isLiveSession, sessionLabel } from '../../types/openf1';
import WeatherChip from '../WeatherChip';
import StatusBanner from '../StatusBanner';
import RaceTabs from './RaceTabs';
import { latestFlag, flagColor } from './derive';
import type { PitStop, PositionRow, Interval, RcMsg, LocationPt } from './types';

// Merge incoming rows into existing array by dedup key, newest wins.
function mergeLaps(prev: OpenF1Lap[], next: OpenF1Lap[]): OpenF1Lap[] {
  const map = new Map(prev.map(l => [`${l.driver_number}_${l.lap_number}`, l]));
  for (const l of next) map.set(`${l.driver_number}_${l.lap_number}`, l);
  return Array.from(map.values());
}
function mergePositions(prev: PositionRow[], next: PositionRow[]): PositionRow[] {
  return [...prev, ...next]; // append — no dedup needed, we only fetch new ones
}
function mergeIntervals(prev: Interval[], next: Interval[]): Interval[] {
  const map = new Map(prev.map(iv => [iv.driver_number, iv]));
  for (const iv of next) map.set(iv.driver_number, iv);
  return Array.from(map.values());
}

// Fast poll — intervals, positions, location (change every few seconds during race)
const FAST_INTERVAL = 8_000;
// Slow poll — laps, stints, pit stops, race control, weather, drivers (change infrequently)
const SLOW_INTERVAL = 30_000;

interface Props {
  // 'Race' = Grand Prix, 'Sprint' = sprint race. Both have session_type 'Race';
  // the session_name distinguishes them.
  kind: 'Race' | 'Sprint';
}

// Live race timing view. Detects the latest live race/sprint session, then polls
// OpenF1 with staggered intervals and delta-merges new rows into state. Shared by
// the Live hub's Race and Sprint sub-tabs.
export default function LiveRaceView({ kind }: Props) {
  const lower = kind.toLowerCase(); // 'race' | 'sprint'

  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);

  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<OpenF1Stint[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [rcMsgs, setRcMsgs] = useState<RcMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);

  const trailsRef = useRef<Map<number, { x: number; y: number }[]>>(new Map());
  const [trailSnapshot, setTrailSnapshot] = useState<Map<number, { x: number; y: number }[]>>(new Map());
  const lastLocFetch = useRef<string | null>(null);

  // Delta-fetch cursors — date of latest row seen per endpoint
  const lastLapDate = useRef<string | null>(null);
  const lastPosDate = useRef<string | null>(null);
  const lastIvDate = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const fastPollRef = useRef<number | null>(null);
  const slowPollRef = useRef<number | null>(null);

  const detectSession = useCallback(async () => {
    try {
      const s = await openf1Api.getLatestSession('Race', kind);
      setSession(s);
      setIsLive(s ? isLiveSession(s) : false);
    } catch { /* non-fatal — try again next interval */ }
    finally { setDetecting(false); }
  }, [kind]);

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
    const upd = new Map(trailsRef.current);
    for (const p of pts) {
      const arr = upd.get(p.driver_number) ?? [];
      arr.push({ x: p.x, y: p.y });
      if (arr.length > 12) arr.splice(0, arr.length - 12);
      upd.set(p.driver_number, arr);
    }
    trailsRef.current = upd;
    setTrailSnapshot(new Map(upd));
  }, []);

  // Fast poll: intervals, positions, location — changes every few seconds
  const fetchFast = useCallback(async (key: number) => {
    setRateLimited(isRateLimited());
    if (isRateLimited()) return;

    const sincePosStr = lastPosDate.current
      ? new Date(new Date(lastPosDate.current).getTime() + 1).toISOString().replace('Z', '')
      : undefined;
    const sinceIvStr = lastIvDate.current
      ? new Date(new Date(lastIvDate.current).getTime() + 1).toISOString().replace('Z', '')
      : undefined;

    const [newIv, newPos] = await Promise.all([
      sinceIvStr
        ? openf1Api.getIntervalsSince(key, sinceIvStr)
        : openf1Api.getIntervals(key),
      sincePosStr
        ? openf1Api.getPositionsSince(key, sincePosStr)
        : openf1Api.getPositions(key),
    ]);

    const ivArr = newIv as Interval[];
    const posArr = newPos as PositionRow[];

    if (ivArr.length) {
      setIntervals(prev => mergeIntervals(prev, ivArr));
    }
    if (posArr.length) {
      setPositions(prev => mergePositions(prev, posArr));
      const lastPos = posArr[posArr.length - 1] as unknown as { date?: string };
      if (lastPos.date) lastPosDate.current = lastPos.date;
    }

    await fetchLocation(key);
    setUpdated(new Date());
  }, [fetchLocation]);

  // Slow poll: laps, stints, pit stops, race control, weather, drivers
  const fetchSlow = useCallback(async (key: number) => {
    if (isRateLimited()) return;

    const sinceLapStr = lastLapDate.current
      ? new Date(new Date(lastLapDate.current).getTime() + 1).toISOString().replace('Z', '')
      : undefined;

    const [newLaps, st, d, pit, rc, wx] = await Promise.all([
      sinceLapStr
        ? openf1Api.getLapsSince(key, sinceLapStr)
        : openf1Api.getLaps(key),
      openf1Api.getStints(key),
      openf1Api.getDriversBySession(key),
      openf1Api.getPitStops(key),
      openf1Api.getRaceControlMessages(key),
      openf1Api.getWeather(key),
    ]);

    const lapArr = newLaps as OpenF1Lap[];
    if (lapArr.length) {
      setLaps(prev => (sinceLapStr ? mergeLaps(prev, lapArr) : lapArr));
      const last = lapArr[lapArr.length - 1];
      if (last?.date_start) lastLapDate.current = last.date_start;
    }

    setStints(st as OpenF1Stint[]);
    if ((d as OpenF1Driver[]).length) setDrivers(d as OpenF1Driver[]);
    setPitStops(pit as PitStop[]);
    setRcMsgs(rc as RcMsg[]);
    const wxArr = wx as OpenF1Weather[];
    if (wxArr.length) setWeather(wxArr[wxArr.length - 1]);
  }, []);

  // Initial full load then set up staggered polling
  useEffect(() => {
    if (!session || !isLive) { if (!detecting) setLoading(false); return; }
    const key = session.session_key;

    // Reset delta cursors when session changes
    lastLapDate.current = null;
    lastPosDate.current = null;
    lastIvDate.current = null;

    setLoading(true);
    Promise.all([fetchFast(key), fetchSlow(key)]).finally(() => setLoading(false));

    fastPollRef.current = window.setInterval(() => fetchFast(key), FAST_INTERVAL);
    slowPollRef.current = window.setInterval(() => fetchSlow(key), SLOW_INTERVAL);

    return () => {
      if (fastPollRef.current) clearInterval(fastPollRef.current);
      if (slowPollRef.current) clearInterval(slowPollRef.current);
    };
  }, [session, isLive, detecting, fetchFast, fetchSlow]);

  const curFlag = latestFlag(rcMsgs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {session ? `${sessionLabel(session)} · ${kind}` : `Live ${kind}`}
            </span>
            {detecting
              ? <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.2)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>CHECKING</span>
              : isLive
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

      {rateLimited && (
        <StatusBanner tone="amber">
          OpenF1 rate limit reached — requests paused for 30 s. Data will resume automatically.
        </StatusBanner>
      )}

      {detecting ? (
        <StatusBanner tone="grey">Checking for a live session…</StatusBanner>
      ) : !isLive ? (
        <StatusBanner tone="amber">
          No live {lower} right now — live timing populates automatically when a {lower} goes green.
          {session && ` Last ${lower}: ${sessionLabel(session)}.`}
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
