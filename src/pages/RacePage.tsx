import { useEffect, useState } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';
import { openf1Api } from '../services/openf1Api';
import { TYRE_COLOUR, TYRE_LABEL, fmtTime } from '../utils/timing';

interface Round {
  round: number;
  raceName: string;
  locality: string;
  country: string;
  date: string;
}

interface RaceResult {
  position: number;
  code: string;
  team: string;
  grid: number;
  laps: number;
  time: string | undefined;
  status: string;
  points: number;
  fastestLap: boolean;
}

interface LapRow { driver_number: number; lap_number: number; lap_duration: number | null; is_pit_out_lap: boolean; }
interface StintRow { driver_number: number; stint_number: number; compound: string; lap_start: number; lap_end: number | null; }
interface DriverRow { driver_number: number; name_acronym: string; team_colour: string; team_name: string; }

const YEARS = [2026, 2025, 2024, 2023];

export default function RacePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [raceName, setRaceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OpenF1 analysis tab
  const [tab, setTab] = useState<'RESULTS' | 'STRATEGY'>('RESULTS');
  const [of1SessionKey, setOf1SessionKey] = useState<number | null>(null);
  const [of1Laps, setOf1Laps] = useState<LapRow[]>([]);
  const [of1Stints, setOf1Stints] = useState<StintRow[]>([]);
  const [of1Drivers, setOf1Drivers] = useState<DriverRow[]>([]);
  const [of1Loading, setOf1Loading] = useState(false);

  // Load calendar for the selected year
  useEffect(() => {
    setRounds([]);
    setSelectedRound(null);
    setResults([]);
    setRaceName('');
    setError(null);
    setLoading(true);
    setOf1SessionKey(null);
    async function load() {
      try {
        const data = await jolpicaApi.getRaces(year);
        const now = new Date();
        const races: Round[] = (data?.MRData?.RaceTable?.Races ?? [])
          .filter((r: { date: string }) => new Date(r.date) <= now)
          .map((r: {
            round: string; raceName: string;
            Circuit?: { Location?: { locality?: string; country?: string } };
            date: string;
          }) => ({
            round: Number(r.round),
            raceName: r.raceName,
            locality: r.Circuit?.Location?.locality ?? '',
            country: r.Circuit?.Location?.country ?? '',
            date: r.date,
          }));
        if (!races.length) {
          setError(`No race results available for ${year} yet. Try selecting a previous year.`);
          setLoading(false);
          return;
        }
        setRounds(races);
        setSelectedRound(races[races.length - 1].round);
      } catch {
        setError('Failed to load race calendar.');
        setLoading(false);
      }
    }
    load();
  }, [year]);

  // Load Jolpica results for selected round
  useEffect(() => {
    if (selectedRound == null) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setOf1SessionKey(null);
    async function load() {
      try {
        const data = await jolpicaApi.getRaceResults(year, selectedRound!);
        const race = data?.MRData?.RaceTable?.Races?.[0];
        if (!race?.Results?.length) {
          setError('No results available yet for this race.');
          setLoading(false);
          return;
        }
        setRaceName(race.raceName);
        const mapped: RaceResult[] = race.Results.map((r: {
          position: string;
          Driver?: { code?: string; driverId?: string };
          Constructor?: { name?: string };
          grid?: string;
          laps?: string;
          Time?: { time?: string };
          status?: string;
          points?: string;
          FastestLap?: { rank?: string };
        }) => ({
          position: Number(r.position),
          code: r.Driver?.code ?? (r.Driver?.driverId ?? '???').toUpperCase().slice(0, 3),
          team: r.Constructor?.name ?? '—',
          grid: Number(r.grid ?? 0),
          laps: Number(r.laps ?? 0),
          time: r.Time?.time,
          status: r.status ?? '—',
          points: Number(r.points ?? 0),
          fastestLap: r.FastestLap?.rank === '1',
        }));
        setResults(mapped);
      } catch {
        setError('Failed to load race results.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedRound, year]);

  // Find matching OpenF1 session for strategy tab
  useEffect(() => {
    if (!rounds.length || selectedRound == null) return;
    const round = rounds.find(r => r.round === selectedRound);
    if (!round) return;
    async function findSession() {
      try {
        const sessions = await openf1Api.getSessionsByYear(year);
        const raceDate = new Date(round!.date);
        // Find a Race session from within 2 days of the Jolpica race date
        const match = (sessions as Array<{ session_key: number; session_type: string; date_start: string }>)
          .filter(s => s.session_type === 'Race')
          .find(s => {
            const d = new Date(s.date_start);
            return Math.abs(d.getTime() - raceDate.getTime()) < 2 * 86400_000;
          });
        if (match) setOf1SessionKey(match.session_key);
      } catch { /* no-op */ }
    }
    findSession();
  }, [selectedRound, rounds, year]);

  // Load OpenF1 analysis data when strategy tab is opened and session key is known
  useEffect(() => {
    if (tab !== 'STRATEGY' || !of1SessionKey) return;
    if (of1Laps.length || of1Loading) return;
    setOf1Loading(true);
    Promise.all([
      openf1Api.getLaps(of1SessionKey),
      openf1Api.getStints(of1SessionKey),
      openf1Api.getDriversBySession(of1SessionKey),
    ]).then(([laps, stints, drivers]) => {
      setOf1Laps(laps as LapRow[]);
      setOf1Stints(stints as StintRow[]);
      setOf1Drivers(drivers as DriverRow[]);
    }).finally(() => setOf1Loading(false));
  }, [tab, of1SessionKey, of1Laps.length, of1Loading]);

  // Reset OpenF1 data when round changes
  useEffect(() => {
    setOf1Laps([]);
    setOf1Stints([]);
    setOf1Drivers([]);
    setOf1Loading(false);
  }, [selectedRound, year]);

  const winner = results[0];
  const round = rounds.find(r => r.round === selectedRound);

  // Build strategy diagram: for each driver, stints as colored bars
  const maxLap = of1Laps.reduce((m, l) => Math.max(m, l.lap_number), 0);
  const driverMap = new Map(of1Drivers.map(d => [d.driver_number, d]));

  // Get sorted driver list by final position from results (or just from drivers)
  const strategyDrivers = of1Stints
    .reduce<number[]>((acc, s) => {
      if (!acc.includes(s.driver_number)) acc.push(s.driver_number);
      return acc;
    }, [])
    .sort((a, b) => {
      const posA = results.findIndex(r =>
        of1Drivers.find(d => d.driver_number === a)?.name_acronym === r.code
      );
      const posB = results.findIndex(r =>
        of1Drivers.find(d => d.driver_number === b)?.name_acronym === r.code
      );
      if (posA === -1 && posB === -1) return a - b;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
            {raceName || round?.raceName || 'Race Results'}
          </div>
          {round && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {round.locality} · {round.country} · {new Date(round.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Year selector */}
          <select
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Round selector */}
          {rounds.length > 0 && (
            <select
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
              value={selectedRound ?? ''}
              onChange={e => setSelectedRound(Number(e.target.value))}
            >
              {rounds.map(r => (
                <option key={r.round} value={r.round}>
                  Rd {r.round} · {r.raceName.replace(' Grand Prix', '')}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {winner && (
        <div style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#facc15', letterSpacing: '0.1em' }}>WINNER</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{winner.code}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{winner.team}</span>
          {winner.time && <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{winner.time}</span>}
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading race results…</div>}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* tab bar */}
          <div className="glass" style={{ padding: '8px 12px' }}>
            <div className="tab-bar">
              {(['RESULTS', 'STRATEGY'] as const).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* RESULTS tab */}
          {tab === 'RESULTS' && results.length > 0 && (
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>RACE RESULTS</span>
                <span style={{ fontSize: 11, color: '#334155' }}>{results.length} drivers</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="timing-table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>Pos</th>
                      <th style={{ minWidth: 120 }}>Driver</th>
                      <th>Team</th>
                      <th>Grid</th>
                      <th>Laps</th>
                      <th>Time / Status</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const isFinished = r.status === 'Finished' || r.status.startsWith('+');
                      const isDnf = !isFinished;
                      const timeOrStatus = i === 0 ? r.time : r.time ?? r.status;
                      return (
                        <tr key={r.position} className={`timing-row${i === 0 ? ' p1' : ''}`} style={{ opacity: isDnf ? 0.45 : 1 }}>
                          <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{r.position}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.code}</span>
                              {r.fastestLap && <span title="Fastest Lap" style={{ color: '#a855f7', fontSize: 10, fontWeight: 700 }}>FL</span>}
                            </div>
                          </td>
                          <td><span style={{ fontSize: 11, color: '#64748b' }}>{r.team}</span></td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.grid || 'PL'}</span></td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.laps}</span></td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#facc15' : isDnf ? '#f87171' : '#94a3b8' }}>
                              {timeOrStatus ?? '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: r.points > 0 ? '#f1f5f9' : '#334155', fontWeight: r.points > 0 ? 600 : 400 }}>
                              {r.points > 0 ? r.points : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STRATEGY tab */}
          {tab === 'STRATEGY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!of1SessionKey && (
                <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>
                  {of1Loading ? 'Finding session…' : 'No OpenF1 session found for this race.'}
                </div>
              )}
              {of1SessionKey && of1Loading && (
                <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>Loading strategy data…</div>
              )}
              {of1SessionKey && !of1Loading && of1Stints.length > 0 && (
                <>
                  {/* Tyre strategy bars */}
                  <div className="glass" style={{ padding: 16, overflowX: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: 14 }}>TYRE STRATEGY</div>
                    <div style={{ minWidth: 500 }}>
                      {strategyDrivers.map(dn => {
                        const d = driverMap.get(dn);
                        if (!d) return null;
                        const driverStints = of1Stints
                          .filter(s => s.driver_number === dn)
                          .sort((a, b) => a.stint_number - b.stint_number);
                        return (
                          <div key={dn} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 34, textAlign: 'right', fontSize: 11, fontWeight: 700, color: `#${d.team_colour || '888'}`, flexShrink: 0 }}>
                              {d.name_acronym}
                            </div>
                            <div style={{ flex: 1, position: 'relative', height: 18 }}>
                              {driverStints.map(s => {
                                const start = s.lap_start;
                                const end = s.lap_end ?? maxLap;
                                const left = ((start - 1) / maxLap) * 100;
                                const width = ((end - start + 1) / maxLap) * 100;
                                const col = TYRE_COLOUR[s.compound] ?? '#64748b';
                                return (
                                  <div
                                    key={s.stint_number}
                                    title={`${TYRE_LABEL[s.compound] ?? s.compound} · L${start}–${end}`}
                                    style={{
                                      position: 'absolute',
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      top: 0, bottom: 0,
                                      background: col,
                                      opacity: 0.85,
                                      borderRadius: 2,
                                      boxSizing: 'border-box',
                                      borderRight: '1px solid rgba(0,0,0,0.4)',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {/* lap axis */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <div style={{ width: 34 }} />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155' }}>
                          <span>1</span>
                          <span>{Math.round(maxLap / 2)}</span>
                          <span>{maxLap}</span>
                        </div>
                      </div>
                      {/* legend */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map(c => (
                          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 2, background: TYRE_COLOUR[c] ?? '#64748b', display: 'inline-block' }} />
                            <span style={{ fontSize: 10, color: '#475569' }}>{TYRE_LABEL[c] ?? c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Lap time table: fastest + avg per driver */}
                  <div className="glass" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>LAP TIMES (via OpenF1)</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="timing-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 100 }}>Driver</th>
                            <th>Fastest Lap</th>
                            <th>Avg Pace</th>
                            <th>Laps</th>
                          </tr>
                        </thead>
                        <tbody>
                          {strategyDrivers.map(dn => {
                            const d = driverMap.get(dn);
                            if (!d) return null;
                            const dLaps = of1Laps.filter(l => l.driver_number === dn && l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration > 50);
                            if (!dLaps.length) return null;
                            const fastest = Math.min(...dLaps.map(l => l.lap_duration!));
                            const avg = dLaps.reduce((s, l) => s + l.lap_duration!, 0) / dLaps.length;
                            return (
                              <tr key={dn} className="timing-row">
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 3, height: 18, borderRadius: 2, background: `#${d.team_colour || '444'}`, flexShrink: 0 }} />
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{d.name_acronym}</div>
                                      <div style={{ fontSize: 10, color: '#475569' }}>{d.team_name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#a855f7', fontWeight: 700 }}>{fmtTime(fastest)}</span></td>
                                <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{fmtTime(avg)}</span></td>
                                <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{dLaps.length}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
