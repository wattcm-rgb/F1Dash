import { useEffect, useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint, OpenF1Weather, DriverTimingRow } from '../types/openf1';

const TYRE_COLOURS: Record<string, string> = {
  SOFT: 'text-red-400',
  MEDIUM: 'text-yellow-400',
  HARD: 'text-gray-300',
  INTERMEDIATE: 'text-green-400',
  WET: 'text-blue-400',
  UNKNOWN: 'text-gray-500',
};

const TYRE_LABEL: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
};

function formatTime(seconds: number | null): string {
  if (seconds == null) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${secs}` : `${secs}`;
}

function formatGap(gap: number | null): string {
  if (gap == null) return '—';
  return `+${gap.toFixed(3)}`;
}

function buildTimingRows(
  drivers: OpenF1Driver[],
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
): DriverTimingRow[] {
  const rows: DriverTimingRow[] = [];

  for (const driver of drivers) {
    const driverLaps = laps.filter(l => l.driver_number === driver.driver_number);
    const validLaps = driverLaps.filter(l => l.lap_duration != null && !l.is_pit_out_lap);
    const bestLap = validLaps.length
      ? Math.min(...validLaps.map(l => l.lap_duration!))
      : null;
    const lastLap = driverLaps.length
      ? driverLaps[driverLaps.length - 1].lap_duration
      : null;
    const lastLapData = driverLaps[driverLaps.length - 1] ?? null;

    const driverStints = stints
      .filter(s => s.driver_number === driver.driver_number)
      .sort((a, b) => a.stint_number - b.stint_number);
    const currentStint = driverStints[driverStints.length - 1];

    rows.push({
      driver,
      position: 0,
      bestLap,
      lastLap: lastLap ?? null,
      gap: '',
      s1: lastLapData?.duration_sector_1 ?? null,
      s2: lastLapData?.duration_sector_2 ?? null,
      s3: lastLapData?.duration_sector_3 ?? null,
      compound: currentStint?.compound ?? 'UNKNOWN',
      tyreAge: currentStint
        ? (currentStint.tyre_age_at_start + (driverLaps.length - (currentStint.lap_start - 1)))
        : 0,
      lapsCompleted: driverLaps.length,
    });
  }

  rows.sort((a, b) => {
    if (a.bestLap == null) return 1;
    if (b.bestLap == null) return -1;
    return a.bestLap - b.bestLap;
  });

  const leader = rows[0]?.bestLap ?? null;
  rows.forEach((r, i) => {
    r.position = i + 1;
    r.gap = i === 0 ? 'LEADER' : formatGap(r.bestLap != null && leader != null ? r.bestLap - leader : null);
  });

  return rows;
}

export default function PracticePage() {
  const [session, setSession] = useState<OpenF1Session | null>(null);
  const [rows, setRows] = useState<DriverTimingRow[]>([]);
  const [weather, setWeather] = useState<OpenF1Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (sessionKey: number) => {
    const [laps, stints, drivers, weatherData] = await Promise.all([
      openf1Api.getLaps(sessionKey),
      openf1Api.getStints(sessionKey),
      openf1Api.getDriversBySession(sessionKey),
      openf1Api.getWeather(sessionKey),
    ]);

    if (drivers.length) {
      setRows(buildTimingRows(drivers, laps, stints));
    }
    if (weatherData.length) {
      setWeather(weatherData[weatherData.length - 1]);
    }
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    let interval: number;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const s = await openf1Api.getLatestSession('Practice');
        if (!s) {
          setError('No practice session found. Check back during an F1 race weekend.');
          setLoading(false);
          return;
        }
        setSession(s);
        await fetchData(s.session_key);
        setLoading(false);
        interval = window.setInterval(() => fetchData(s.session_key), 4000);
      } catch {
        setError('Failed to connect to OpenF1 server. Make sure the VPS is running.');
        setLoading(false);
      }
    }

    init();
    return () => clearInterval(interval);
  }, [fetchData]);

  const overallBest = rows.length ? rows[0].bestLap : null;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {session ? `${session.meeting_name} — ${session.session_name}` : 'Practice Session'}
          </h1>
          {session && (
            <p className="text-slate-400 text-sm mt-1">
              {session.circuit_short_name} · {session.country_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {weather && (
            <div className="text-sm text-slate-300 text-right">
              <div>Air: <span className="text-white font-medium">{weather.air_temperature.toFixed(1)}°C</span></div>
              <div>Track: <span className="text-white font-medium">{weather.track_temperature.toFixed(1)}°C</span></div>
              <div>Rain: <span className={weather.rainfall > 0 ? 'text-blue-400 font-medium' : 'text-white font-medium'}>{weather.rainfall > 0 ? 'Yes' : 'No'}</span></div>
            </div>
          )}
          {lastUpdated && (
            <div className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Overall fastest lap banner */}
      {overallBest != null && (
        <div className="bg-purple-900/40 border border-purple-700 rounded px-4 py-2 flex items-center gap-3">
          <span className="text-purple-400 font-bold text-sm">FASTEST LAP</span>
          <span className="text-white font-mono font-bold">{formatTime(overallBest)}</span>
          <span className="text-slate-400 text-sm">{rows[0]?.driver.name_acronym}</span>
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="text-slate-400 py-16 text-center">Connecting to OpenF1...</div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded p-4 text-red-300">{error}</div>
      )}

      {/* Timing table */}
      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700 bg-slate-900">
                <th className="px-3 py-2 text-left w-8">Pos</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-right">Best Lap</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2 text-right">Last Lap</th>
                <th className="px-3 py-2 text-right">S1</th>
                <th className="px-3 py-2 text-right">S2</th>
                <th className="px-3 py-2 text-right">S3</th>
                <th className="px-3 py-2 text-center">Tyre</th>
                <th className="px-3 py-2 text-right">Age</th>
                <th className="px-3 py-2 text-right">Laps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.driver.driver_number}
                  className={`border-b border-slate-800 transition-colors ${i === 0 ? 'bg-purple-950/30' : 'hover:bg-slate-800/40'}`}
                >
                  <td className="px-3 py-2 text-slate-400 font-mono">{row.position}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1 h-5 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: `#${row.driver.team_colour || '666'}` }}
                      />
                      <span className="font-bold text-white">{row.driver.name_acronym}</span>
                      <span className="text-slate-400 text-xs hidden md:inline">{row.driver.full_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300 text-xs hidden md:table-cell">{row.driver.team_name}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-white">{formatTime(row.bestLap)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${row.gap === 'LEADER' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                    {row.gap}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{formatTime(row.lastLap)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{row.s1 != null ? row.s1.toFixed(3) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{row.s2 != null ? row.s2.toFixed(3) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{row.s3 != null ? row.s3.toFixed(3) : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-bold ${TYRE_COLOURS[row.compound] ?? 'text-gray-500'}`}>
                      {TYRE_LABEL[row.compound] ?? '?'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 text-xs">{row.tyreAge > 0 ? row.tyreAge : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{row.lapsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-slate-400 py-16 text-center">
          No timing data yet — session may not have started.
        </div>
      )}
    </div>
  );
}
