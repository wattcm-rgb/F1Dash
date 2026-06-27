import { useEffect, useState, useCallback, useRef } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather } from '../types/openf1';

// ─── helpers ────────────────────────────────────────────────────────────────

const TYRE_COLOUR: Record<string, string> = {
  SOFT: 'text-red-400', MEDIUM: 'text-yellow-400', HARD: 'text-gray-200',
  INTERMEDIATE: 'text-green-400', WET: 'text-blue-400', UNKNOWN: 'text-slate-500',
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

function fmtGap(delta: number | null): string {
  if (delta == null || delta === 0) return '';
  return `+${delta.toFixed(3)}`;
}

// Q segment a lap belongs to based on timing (lap_number heuristic via date)
// OpenF1 sessions for qualifying are separate session_keys (Q1/Q2/Q3)
// so we just use the session_name.

// ─── types ──────────────────────────────────────────────────────────────────

interface QualRow {
  pos: number;
  driver: OpenF1Driver;
  bestLap: number | null;
  gap: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s1Colour: string;
  s2Colour: string;
  s3Colour: string;
  compound: string;
  laps: number;
  eliminated: boolean; // knocked out in this segment
}

interface MeetingOption {
  label: string;         // "Round 1 — Bahrain GP"
  sessionKeys: {         // one per Q segment present
    name: string;        // "Qualifying" | "Sprint Qualifying"
    key: number;
  }[];
}

// ─── sector colour logic ────────────────────────────────────────────────────

function sectorColour(
  value: number | null,
  personalBest: number | null,
  overallBest: number | null,
): string {
  if (value == null) return 'text-slate-400';
  if (overallBest != null && value <= overallBest) return 'text-purple-400 font-bold';
  if (personalBest != null && value <= personalBest) return 'text-green-400';
  return 'text-yellow-400';
}

// ─── build leaderboard from raw laps ────────────────────────────────────────

function buildRows(
  drivers: OpenF1Driver[],
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
  eliminatedNums: Set<number>,
): QualRow[] {
  // overall best sectors across all drivers
  const allS1 = laps.map(l => l.duration_sector_1).filter((v): v is number => v != null);
  const allS2 = laps.map(l => l.duration_sector_2).filter((v): v is number => v != null);
  const allS3 = laps.map(l => l.duration_sector_3).filter((v): v is number => v != null);
  const bestS1 = allS1.length ? Math.min(...allS1) : null;
  const bestS2 = allS2.length ? Math.min(...allS2) : null;
  const bestS3 = allS3.length ? Math.min(...allS3) : null;

  const rows: QualRow[] = drivers.map(driver => {
    const dLaps = laps.filter(l => l.driver_number === driver.driver_number && l.lap_duration != null && !l.is_pit_out_lap);
    const bestLap = dLaps.length ? Math.min(...dLaps.map(l => l.lap_duration!)) : null;
    const lastLap = laps.filter(l => l.driver_number === driver.driver_number).slice(-1)[0];

    const myS1 = dLaps.map(l => l.duration_sector_1).filter((v): v is number => v != null);
    const myS2 = dLaps.map(l => l.duration_sector_2).filter((v): v is number => v != null);
    const myS3 = dLaps.map(l => l.duration_sector_3).filter((v): v is number => v != null);
    const pbS1 = myS1.length ? Math.min(...myS1) : null;
    const pbS2 = myS2.length ? Math.min(...myS2) : null;
    const pbS3 = myS3.length ? Math.min(...myS3) : null;

    const curS1 = lastLap?.duration_sector_1 ?? null;
    const curS2 = lastLap?.duration_sector_2 ?? null;
    const curS3 = lastLap?.duration_sector_3 ?? null;

    const driverStints = stints.filter(s => s.driver_number === driver.driver_number);
    const currentStint = driverStints.sort((a, b) => b.stint_number - a.stint_number)[0];

    return {
      pos: 0,
      driver,
      bestLap,
      gap: null,
      s1: curS1,
      s2: curS2,
      s3: curS3,
      s1Colour: sectorColour(curS1, pbS1, bestS1),
      s2Colour: sectorColour(curS2, pbS2, bestS2),
      s3Colour: sectorColour(curS3, pbS3, bestS3),
      compound: currentStint?.compound ?? 'UNKNOWN',
      laps: laps.filter(l => l.driver_number === driver.driver_number).length,
      eliminated: eliminatedNums.has(driver.driver_number),
    };
  });

  rows.sort((a, b) => {
    if (a.bestLap == null) return 1;
    if (b.bestLap == null) return -1;
    return a.bestLap - b.bestLap;
  });

  const leaderTime = rows[0]?.bestLap ?? null;
  rows.forEach((r, i) => {
    r.pos = i + 1;
    r.gap = r.bestLap != null && leaderTime != null && i > 0 ? r.bestLap - leaderTime : null;
  });

  return rows;
}

// ─── component ───────────────────────────────────────────────────────────────

const CUT_LINES: Record<string, number> = { 'Q1': 15, 'Q2': 10 };

export default function QualifyingPage() {
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingOption | null>(null);
  const [activeSession, setActiveSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<QualRow[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // ── fetch all qualifying sessions this year, group by meeting ─────────────
  useEffect(() => {
    async function loadMeetings() {
      try {
        const year = new Date().getFullYear();
        const sessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const qualSessions = sessions.filter(s =>
          s.session_type === 'Qualifying' || s.session_name?.toLowerCase().includes('qualifying')
        );

        // group by meeting_name
        const map = new Map<string, MeetingOption>();
        for (const s of qualSessions) {
          const key = s.meeting_name;
          if (!map.has(key)) map.set(key, { label: s.meeting_name, sessionKeys: [] });
          map.get(key)!.sessionKeys.push({ name: s.session_name, key: s.session_key });
        }

        const opts = Array.from(map.values());
        setMeetings(opts);
        if (opts.length) {
          // default to most recent
          setSelectedMeeting(opts[opts.length - 1]);
        }
      } catch {
        setError('Failed to load sessions from OpenF1 server.');
      }
    }
    loadMeetings();
  }, []);

  // ── fetch timing for selected meeting ─────────────────────────────────────
  const fetchSessionData = useCallback(async (session: OpenF1Session) => {
    const [laps, stints, drivers, weatherData] = await Promise.all([
      openf1Api.getLaps(session.session_key),
      openf1Api.getStints(session.session_key),
      openf1Api.getDriversBySession(session.session_key),
      openf1Api.getWeather(session.session_key),
    ]);

    if (!drivers.length) return;

    // Determine eliminated drivers: those ranked below cut line
    const allRows = buildRows(drivers, laps, stints, new Set());
    const cutLine = CUT_LINES[session.session_name] ?? 0;
    const eliminated = new Set(
      cutLine > 0 ? allRows.slice(cutLine).map(r => r.driver.driver_number) : []
    );

    setRows(buildRows(drivers, laps, stints, eliminated));
    if (weatherData.length) setWeather(weatherData[weatherData.length - 1]);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!selectedMeeting) return;

    // clear previous poll
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRows([]);
    setLoading(true);
    setError(null);
    setIsLive(false);

    async function load() {
      try {
        // Get full session objects for this meeting
        const year = new Date().getFullYear();
        const allSessions: OpenF1Session[] = await openf1Api.getSessionsByYear(year);
        const meetingSessions = allSessions.filter(
          s => s.meeting_name === selectedMeeting!.label &&
            (s.session_type === 'Qualifying' || s.session_name?.toLowerCase().includes('qualifying'))
        );
        if (!meetingSessions.length) {
          setError('No qualifying data found for this event.');
          setLoading(false);
          return;
        }

        // Use the last qualifying session (Q3 if available, else what exists)
        const session = meetingSessions[meetingSessions.length - 1];
        setActiveSession(session);

        await fetchSessionData(session);

        // Check if live: date_end is in the future
        const isSessionLive = session.date_end ? new Date(session.date_end) > new Date() : false;
        setIsLive(isSessionLive);

        if (isSessionLive) {
          intervalRef.current = window.setInterval(() => fetchSessionData(session), 4000);
        }
      } catch {
        setError('Failed to load qualifying data.');
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedMeeting, fetchSessionData]);

  const sessionName = activeSession?.session_name ?? 'Qualifying';
  const cutLine = CUT_LINES[sessionName] ?? 0;
  const fastestLap = rows[0]?.bestLap ?? null;

  return (
    <div className="p-4 space-y-4">

      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Qualifying
            {isLive && (
              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-normal animate-pulse">
                LIVE
              </span>
            )}
          </h1>
          {activeSession && (
            <p className="text-slate-400 text-sm mt-1">
              {activeSession.meeting_name} · {activeSession.circuit_short_name} · {activeSession.country_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* meeting selector */}
          {meetings.length > 0 && (
            <select
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-1.5 cursor-pointer"
              value={selectedMeeting?.label ?? ''}
              onChange={e => setSelectedMeeting(meetings.find(m => m.label === e.target.value) ?? null)}
            >
              {meetings.map(m => (
                <option key={m.label} value={m.label}>{m.label}</option>
              ))}
            </select>
          )}

          {/* weather */}
          {weather && (
            <div className="text-xs text-slate-300 text-right leading-5">
              <div>Air <span className="text-white font-medium">{weather.air_temperature.toFixed(1)}°C</span></div>
              <div>Track <span className="text-white font-medium">{weather.track_temperature.toFixed(1)}°C</span></div>
            </div>
          )}

          {lastUpdated && (
            <div className="text-xs text-slate-500">
              {isLive ? 'Live · ' : ''}Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* ── fastest lap banner ── */}
      {fastestLap != null && (
        <div className="bg-purple-900/40 border border-purple-700 rounded px-4 py-2 flex items-center gap-3">
          <span className="text-purple-400 font-bold text-xs uppercase tracking-wide">Fastest</span>
          <span className="text-white font-mono font-bold">{fmtTime(fastestLap)}</span>
          <span className="text-slate-300 text-sm">{rows[0]?.driver.name_acronym}</span>
          <span className="text-slate-500 text-xs">{rows[0]?.driver.team_name}</span>
        </div>
      )}

      {/* ── states ── */}
      {loading && <div className="text-slate-400 py-16 text-center">Loading qualifying data…</div>}
      {error && <div className="bg-red-900/40 border border-red-700 rounded p-4 text-red-300">{error}</div>}

      {/* ── sector legend ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="text-purple-400 font-bold">■</span> Overall best
          <span className="text-green-400 font-bold">■</span> Personal best
          <span className="text-yellow-400 font-bold">■</span> No improvement
        </div>
      )}

      {/* ── timing table ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700 bg-slate-900">
                <th className="px-3 py-2 text-left w-8">Pos</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-right">Best Lap</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2 text-right">S1</th>
                <th className="px-3 py-2 text-right">S2</th>
                <th className="px-3 py-2 text-right">S3</th>
                <th className="px-3 py-2 text-center">Tyre</th>
                <th className="px-3 py-2 text-right">Laps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isCutRow = cutLine > 0 && i === cutLine - 1;
                const eliminated = row.eliminated;
                return (
                  <>
                    <tr
                      key={row.driver.driver_number}
                      className={[
                        'border-b border-slate-800 transition-colors',
                        i === 0 ? 'bg-purple-950/30' : '',
                        eliminated ? 'opacity-50' : 'hover:bg-slate-800/40',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2 font-mono text-slate-400">{row.pos}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-1 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `#${row.driver.team_colour || '555'}` }}
                          />
                          <span className="font-bold text-white">{row.driver.name_acronym}</span>
                          <span className="text-slate-400 text-xs hidden md:inline">{row.driver.team_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-white">{fmtTime(row.bestLap)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300 text-xs">
                        {row.gap != null ? fmtGap(row.gap) : <span className="text-purple-400 font-bold text-xs">POLE</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${row.s1Colour}`}>{row.s1 != null ? row.s1.toFixed(3) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${row.s2Colour}`}>{row.s2 != null ? row.s2.toFixed(3) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${row.s3Colour}`}>{row.s3 != null ? row.s3.toFixed(3) : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${TYRE_COLOUR[row.compound] ?? 'text-slate-500'}`}>
                          {TYRE_LABEL[row.compound] ?? '?'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">{row.laps}</td>
                    </tr>
                    {/* cut line separator */}
                    {isCutRow && (
                      <tr key={`cut-${i}`} className="border-b-2 border-red-800">
                        <td colSpan={9}>
                          <div className="px-3 py-0.5 text-xs text-red-500 font-medium">
                            ── Eliminated below ──
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-slate-400 py-16 text-center">No qualifying data available for this event.</div>
      )}
    </div>
  );
}
