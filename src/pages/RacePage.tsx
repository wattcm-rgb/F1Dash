import { useEffect, useState, useCallback, useRef } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';

// ─── types ───────────────────────────────────────────────────────────────────

interface PitStop {
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  date: string;
}

interface RaceControlMsg {
  date: string;
  category: string;
  message: string;
  flag?: string;
}

interface RaceRow {
  pos: number;
  driver: OpenF1Driver;
  gapToLeader: string;
  gapAhead: string;
  currentLap: number;
  lastLapTime: number | null;
  bestLap: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s1Colour: string;
  s2Colour: string;
  s3Colour: string;
  compound: string;
  tyreAge: number;
  pitCount: number;
  lastPitLap: number | null;
  lastPitDuration: number | null;
  inPit: boolean;
}

interface MeetingOption {
  label: string;
  sessionKey: number;
  totalLaps: number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const TYRE_COLOUR: Record<string, string> = {
  SOFT: 'text-red-400', MEDIUM: 'text-yellow-400', HARD: 'text-gray-200',
  INTERMEDIATE: 'text-green-400', WET: 'text-blue-400', UNKNOWN: 'text-slate-500',
};
const TYRE_LABEL: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
};
const FLAG_COLOUR: Record<string, string> = {
  GREEN: 'bg-green-700 text-white',
  YELLOW: 'bg-yellow-500 text-black',
  RED: 'bg-red-600 text-white',
  SC: 'bg-yellow-400 text-black',
  VSC: 'bg-yellow-300 text-black',
  CHEQUERED: 'bg-white text-black',
};

function fmtTime(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${rest}` : rest;
}

function fmtGap(s: number | null): string {
  if (s == null) return '—';
  return `+${s.toFixed(3)}`;
}

function sectorColour(v: number | null, pb: number | null, ob: number | null): string {
  if (v == null) return 'text-slate-500';
  if (ob != null && v <= ob) return 'text-purple-400 font-bold';
  if (pb != null && v <= pb) return 'text-green-400';
  return 'text-yellow-400';
}

function buildRaceRows(
  drivers: OpenF1Driver[],
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
  pitStops: PitStop[],
  intervals: { driver_number: number; gap_to_leader: number | string | null; interval: number | string | null }[],
): RaceRow[] {
  const allS1 = laps.map(l => l.duration_sector_1).filter((v): v is number => v != null);
  const allS2 = laps.map(l => l.duration_sector_2).filter((v): v is number => v != null);
  const allS3 = laps.map(l => l.duration_sector_3).filter((v): v is number => v != null);
  const obS1 = allS1.length ? Math.min(...allS1) : null;
  const obS2 = allS2.length ? Math.min(...allS2) : null;
  const obS3 = allS3.length ? Math.min(...allS3) : null;

  // latest interval per driver
  const latestInterval = new Map<number, typeof intervals[0]>();
  for (const iv of intervals) latestInterval.set(iv.driver_number, iv);

  const rows: RaceRow[] = drivers.map(driver => {
    const dn = driver.driver_number;
    const dLaps = laps.filter(l => l.driver_number === dn);
    const validLaps = dLaps.filter(l => l.lap_duration != null && !l.is_pit_out_lap);
    const lastLap = dLaps[dLaps.length - 1];
    const bestLap = validLaps.length ? Math.min(...validLaps.map(l => l.lap_duration!)) : null;

    const myS1 = validLaps.map(l => l.duration_sector_1).filter((v): v is number => v != null);
    const myS2 = validLaps.map(l => l.duration_sector_2).filter((v): v is number => v != null);
    const myS3 = validLaps.map(l => l.duration_sector_3).filter((v): v is number => v != null);
    const pbS1 = myS1.length ? Math.min(...myS1) : null;
    const pbS2 = myS2.length ? Math.min(...myS2) : null;
    const pbS3 = myS3.length ? Math.min(...myS3) : null;

    const curS1 = lastLap?.duration_sector_1 ?? null;
    const curS2 = lastLap?.duration_sector_2 ?? null;
    const curS3 = lastLap?.duration_sector_3 ?? null;

    const driverStints = stints.filter(s => s.driver_number === dn).sort((a, b) => b.stint_number - a.stint_number);
    const currentStint = driverStints[0];
    const tyreAge = currentStint
      ? currentStint.tyre_age_at_start + (dLaps.length - (currentStint.lap_start - 1))
      : 0;

    const driverPits = pitStops.filter(p => p.driver_number === dn).sort((a, b) => b.lap_number - a.lap_number);
    const lastPit = driverPits[0] ?? null;

    const iv = latestInterval.get(dn);
    const gapToLeader = iv?.gap_to_leader != null
      ? (typeof iv.gap_to_leader === 'number' ? fmtGap(iv.gap_to_leader) : String(iv.gap_to_leader))
      : '—';
    const gapAhead = iv?.interval != null
      ? (typeof iv.interval === 'number' ? fmtGap(iv.interval) : String(iv.interval))
      : '—';

    return {
      pos: 0,
      driver,
      gapToLeader,
      gapAhead,
      currentLap: dLaps.length,
      lastLapTime: lastLap?.lap_duration ?? null,
      bestLap,
      s1: curS1,
      s2: curS2,
      s3: curS3,
      s1Colour: sectorColour(curS1, pbS1, obS1),
      s2Colour: sectorColour(curS2, pbS2, obS2),
      s3Colour: sectorColour(curS3, pbS3, obS3),
      compound: currentStint?.compound ?? 'UNKNOWN',
      tyreAge,
      pitCount: driverPits.length,
      lastPitLap: lastPit?.lap_number ?? null,
      lastPitDuration: lastPit?.pit_duration ?? null,
      inPit: lastLap?.is_pit_out_lap ?? false,
    };
  });

  // sort by laps completed desc, then gap to leader asc
  rows.sort((a, b) => {
    if (b.currentLap !== a.currentLap) return b.currentLap - a.currentLap;
    return 0; // intervals API handles ordering when available
  });

  rows.forEach((r, i) => { r.pos = i + 1; });
  return rows;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function RacePage() {
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<RaceRow[]>([]);
  const [raceControl, setRaceControl] = useState<RaceControlMsg[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [totalLaps, setTotalLaps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [battleA, setBattleA] = useState<number | null>(null);
  const [battleB, setBattleB] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // ── load all race meetings this year ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const year = new Date().getFullYear();
        const sessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const raceSessions = sessions.filter(s => s.session_type === 'Race' && s.session_name === 'Race');
        const opts: MeetingOption[] = raceSessions.map(s => ({
          label: s.meeting_name,
          sessionKey: s.session_key,
          totalLaps: null,
        }));
        setMeetings(opts);
        if (opts.length) setSelectedKey(opts[opts.length - 1].sessionKey);
      } catch {
        setError('Failed to load race list from OpenF1 server.');
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── fetch race data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (sessionKey: number) => {
    const [laps, stints, drivers, pitStops, weatherData, rcMsgs, intervals] = await Promise.all([
      openf1Api.getLaps(sessionKey),
      openf1Api.getStints(sessionKey),
      openf1Api.getDriversBySession(sessionKey),
      openf1Api.getPitStops(sessionKey),
      openf1Api.getWeather(sessionKey),
      openf1Api.getRaceControlMessages(sessionKey),
      openf1Api.getIntervals(sessionKey),
    ]);

    if (drivers.length) {
      setRows(buildRaceRows(drivers, laps, stints, pitStops, intervals));
      const maxLap = laps.length ? Math.max(...laps.map((l: OpenF1Lap) => l.lap_number)) : 0;
      setTotalLaps(prev => prev ?? (maxLap > 0 ? maxLap : null));
    }
    if (weatherData.length) setWeather(weatherData[weatherData.length - 1]);
    if (rcMsgs.length) {
      setRaceControl([...rcMsgs].reverse().slice(0, 10));
    }
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (selectedKey == null) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRows([]);
    setRaceControl([]);
    setTotalLaps(null);
    setLoading(true);
    setError(null);
    setIsLive(false);

    async function load() {
      try {
        const year = new Date().getFullYear();
        const allSessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const s = allSessions.find(sess => sess.session_key === selectedKey);
        if (!s) { setError('Session not found.'); setLoading(false); return; }
        setSession(s);
        const key = selectedKey as number;
        await fetchData(key);
        const live = s.date_end ? new Date(s.date_end) > new Date() : false;
        setIsLive(live);
        if (live) intervalRef.current = window.setInterval(() => fetchData(key), 4000);
      } catch {
        setError('Failed to load race data.');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedKey, fetchData]);

  // ── battle analysis ──────────────────────────────────────────────────────────
  const battleDriverA = rows.find(r => r.driver.driver_number === battleA);
  const battleDriverB = rows.find(r => r.driver.driver_number === battleB);
  const lapDelta = battleDriverA && battleDriverB
    ? (battleDriverA.bestLap != null && battleDriverB.bestLap != null
        ? battleDriverA.bestLap - battleDriverB.bestLap
        : null)
    : null;

  // ── flag from latest race control ────────────────────────────────────────────
  const latestFlag = raceControl.find(m => m.flag || m.category === 'Flag');
  const flagLabel = latestFlag?.flag ?? latestFlag?.message?.split(' ')[0] ?? null;

  const leaderLap = rows[0]?.currentLap ?? 0;
  const lapsLeft = totalLaps != null ? Math.max(0, totalLaps - leaderLap) : null;

  return (
    <div className="p-4 space-y-4">

      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Race
            {isLive && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-normal animate-pulse">LIVE</span>}
          </h1>
          {session && (
            <p className="text-slate-400 text-sm mt-1">
              {session.meeting_name} · {session.circuit_short_name} · {session.country_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {meetings.length > 0 && (
            <select
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-1.5 cursor-pointer"
              value={selectedKey ?? ''}
              onChange={e => setSelectedKey(Number(e.target.value))}
            >
              {meetings.map(m => (
                <option key={m.sessionKey} value={m.sessionKey}>{m.label}</option>
              ))}
            </select>
          )}
          {weather && (
            <div className="text-xs text-slate-300 leading-5 text-right">
              <div>Air <span className="text-white font-medium">{weather.air_temperature.toFixed(1)}°C</span></div>
              <div>Track <span className="text-white font-medium">{weather.track_temperature.toFixed(1)}°C</span></div>
              {weather.rainfall > 0 && <div className="text-blue-400 font-medium">Rain</div>}
            </div>
          )}
          {lastUpdated && (
            <div className="text-xs text-slate-500">{isLive ? 'Live · ' : ''}Updated {lastUpdated.toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      {/* ── status bar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        {lapsLeft != null && (
          <div className="bg-slate-800 rounded px-4 py-2 text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Laps Left</div>
            <div className="text-2xl font-bold text-white font-mono">{lapsLeft}</div>
            {totalLaps && <div className="text-xs text-slate-500">of {totalLaps}</div>}
          </div>
        )}
        {flagLabel && (
          <div className={`rounded px-4 py-2 font-bold text-sm ${FLAG_COLOUR[flagLabel] ?? 'bg-slate-700 text-white'}`}>
            {flagLabel === 'SC' ? '🚗 Safety Car' : flagLabel === 'VSC' ? '🚗 Virtual SC' : `${flagLabel} FLAG`}
          </div>
        )}
        {rows[0] && (
          <div className="bg-slate-800 rounded px-4 py-2">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Leader</div>
            <div className="text-white font-bold">{rows[0].driver.name_acronym}</div>
            <div className="text-xs text-slate-400">{rows[0].driver.team_name}</div>
          </div>
        )}
        {rows[0]?.bestLap && (
          <div className="bg-purple-900/40 border border-purple-700 rounded px-4 py-2">
            <div className="text-xs text-purple-400 uppercase tracking-wide">Fastest Lap</div>
            <div className="text-white font-bold font-mono">{fmtTime(rows[0].bestLap)}</div>
          </div>
        )}
      </div>

      {loading && <div className="text-slate-400 py-16 text-center">Loading race data…</div>}
      {error && <div className="bg-red-900/40 border border-red-700 rounded p-4 text-red-300">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── timing table ── */}
        {!loading && !error && rows.length > 0 && (
          <div className="xl:col-span-2 overflow-x-auto rounded border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-slate-700 bg-slate-900">
                  <th className="px-2 py-2 text-left w-6">P</th>
                  <th className="px-2 py-2 text-left">Driver</th>
                  <th className="px-2 py-2 text-right">Gap</th>
                  <th className="px-2 py-2 text-right">Int</th>
                  <th className="px-2 py-2 text-right">Last</th>
                  <th className="px-2 py-2 text-right">Best</th>
                  <th className="px-2 py-2 text-right hidden lg:table-cell">S1</th>
                  <th className="px-2 py-2 text-right hidden lg:table-cell">S2</th>
                  <th className="px-2 py-2 text-right hidden lg:table-cell">S3</th>
                  <th className="px-2 py-2 text-center">Tyre</th>
                  <th className="px-2 py-2 text-right hidden md:table-cell">Age</th>
                  <th className="px-2 py-2 text-right hidden md:table-cell">Pits</th>
                  <th className="px-2 py-2 text-right hidden lg:table-cell">Pit Time</th>
                  <th className="px-2 py-2 text-right">Lap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.driver.driver_number}
                    className={[
                      'border-b border-slate-800 transition-colors cursor-pointer',
                      i === 0 ? 'bg-yellow-950/20' : 'hover:bg-slate-800/40',
                      row.inPit ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <td className="px-2 py-1.5 font-mono text-slate-400 text-xs">{row.pos}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: `#${row.driver.team_colour || '555'}` }} />
                        <span className="font-bold text-white text-sm">{row.driver.name_acronym}</span>
                        {row.inPit && <span className="text-xs text-orange-400 font-medium">PIT</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-300 text-xs">
                      {i === 0 ? <span className="text-yellow-400 font-bold text-xs">LEAD</span> : row.gapToLeader}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400 text-xs">{i === 0 ? '—' : row.gapAhead}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-300 text-xs">{fmtTime(row.lastLapTime)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-white text-xs">{fmtTime(row.bestLap)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono text-xs hidden lg:table-cell ${row.s1Colour}`}>{row.s1 != null ? row.s1.toFixed(3) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-mono text-xs hidden lg:table-cell ${row.s2Colour}`}>{row.s2 != null ? row.s2.toFixed(3) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-mono text-xs hidden lg:table-cell ${row.s3Colour}`}>{row.s3 != null ? row.s3.toFixed(3) : '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`font-bold text-xs ${TYRE_COLOUR[row.compound] ?? 'text-slate-500'}`}>{TYRE_LABEL[row.compound] ?? '?'}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-400 text-xs hidden md:table-cell">{row.tyreAge > 0 ? row.tyreAge : '—'}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300 text-xs hidden md:table-cell">{row.pitCount > 0 ? row.pitCount : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-400 text-xs hidden lg:table-cell">
                      {row.lastPitDuration != null ? `${row.lastPitDuration.toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-400 text-xs">{row.currentLap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── right column ── */}
        {!loading && !error && rows.length > 0 && (
          <div className="space-y-4">

            {/* battle analysis */}
            <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Battle Analysis</h2>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Driver A</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1.5 cursor-pointer"
                    value={battleA ?? ''}
                    onChange={e => setBattleA(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select</option>
                    {rows.map(r => (
                      <option key={r.driver.driver_number} value={r.driver.driver_number}>
                        P{r.pos} {r.driver.name_acronym}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Driver B</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1.5 cursor-pointer"
                    value={battleB ?? ''}
                    onChange={e => setBattleB(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select</option>
                    {rows.map(r => (
                      <option key={r.driver.driver_number} value={r.driver.driver_number}>
                        P{r.pos} {r.driver.name_acronym}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {battleDriverA && battleDriverB && (
                <div className="space-y-2 pt-1">
                  {[battleDriverA, battleDriverB].map((d) => (
                    <div key={d.driver.driver_number} className="bg-slate-800 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-4 rounded-full" style={{ backgroundColor: `#${d.driver.team_colour || '555'}` }} />
                          <span className="font-bold text-white">{d.driver.name_acronym}</span>
                          <span className="text-xs text-slate-400">P{d.pos}</span>
                        </div>
                        <span className={`text-xs font-bold ${TYRE_COLOUR[d.compound]}`}>{TYRE_LABEL[d.compound]}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-slate-500">Best</div><div className="text-white font-mono">{fmtTime(d.bestLap)}</div></div>
                        <div><div className="text-slate-500">Last</div><div className="text-white font-mono">{fmtTime(d.lastLapTime)}</div></div>
                        <div><div className="text-slate-500">Pits</div><div className="text-white">{d.pitCount || '—'}</div></div>
                      </div>
                    </div>
                  ))}

                  {lapDelta != null && (
                    <div className="bg-slate-800 rounded p-3 text-center">
                      <div className="text-xs text-slate-400 mb-1">Pace delta (best lap)</div>
                      <div className={`text-lg font-bold font-mono ${Math.abs(lapDelta) < 0.3 ? 'text-yellow-400' : 'text-white'}`}>
                        {lapDelta > 0
                          ? `${battleDriverA?.driver.name_acronym} +${lapDelta.toFixed(3)}s slower`
                          : `${battleDriverA?.driver.name_acronym} ${Math.abs(lapDelta).toFixed(3)}s faster`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(!battleDriverA || !battleDriverB) && (
                <p className="text-xs text-slate-500">Select two drivers to compare pace</p>
              )}
            </div>

            {/* race control messages */}
            {raceControl.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-2">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Race Control</h2>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {raceControl.map((msg, i) => (
                    <div key={i} className={[
                      'text-xs rounded px-2 py-1.5',
                      msg.flag === 'RED' ? 'bg-red-900/40 text-red-300' :
                      msg.flag === 'YELLOW' || msg.message?.includes('SAFETY CAR') ? 'bg-yellow-900/40 text-yellow-300' :
                      msg.flag === 'GREEN' ? 'bg-green-900/40 text-green-300' :
                      'bg-slate-800 text-slate-300'
                    ].join(' ')}>
                      <span className="text-slate-500 mr-2">{new Date(msg.date).toLocaleTimeString()}</span>
                      {msg.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* weather detail */}
            {weather && (
              <div className="bg-slate-900 border border-slate-700 rounded p-4">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">Weather</h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Air Temp', `${weather.air_temperature.toFixed(1)}°C`],
                    ['Track Temp', `${weather.track_temperature.toFixed(1)}°C`],
                    ['Humidity', `${weather.humidity.toFixed(0)}%`],
                    ['Wind', `${weather.wind_speed.toFixed(1)} m/s`],
                    ['Rainfall', weather.rainfall > 0 ? `${weather.rainfall.toFixed(1)} mm` : 'None'],
                    ['Pressure', `${weather.pressure.toFixed(0)} mbar`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-800 rounded px-3 py-2">
                      <div className="text-slate-500">{label}</div>
                      <div className="text-white font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && !error && rows.length === 0 && (
        <div className="text-slate-400 py-16 text-center">No race data available for this event.</div>
      )}
    </div>
  );
}
