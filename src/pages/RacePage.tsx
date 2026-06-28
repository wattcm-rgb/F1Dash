import { useEffect, useState } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';

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

export default function RacePage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [raceName, setRaceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const year = new Date().getFullYear();
        const data = await jolpicaApi.getRaces(year);
        const now = new Date();
        const races: Round[] = (data?.MRData?.RaceTable?.Races ?? [])
          .filter((r: { date: string }) => new Date(r.date) < now)
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
        setRounds(races);
        if (races.length) setSelectedRound(races[races.length - 1].round);
        else setLoading(false);
      } catch {
        setError('Failed to load race calendar.');
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedRound == null) return;
    setLoading(true);
    setError(null);
    setResults([]);
    async function load() {
      try {
        const year = new Date().getFullYear();
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
  }, [selectedRound]);

  const winner = results[0];
  const round = rounds.find(r => r.round === selectedRound);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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

      {winner && (
        <div style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#facc15', letterSpacing: '0.1em' }}>WINNER</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{winner.time ?? '—'}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{winner.code} · {winner.team}</span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading race results…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && results.length > 0 && (
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
                  const timeOrStatus = i === 0
                    ? r.time
                    : r.time
                      ? r.time
                      : isFinished ? r.status : r.status;
                  const isDnf = !isFinished;
                  return (
                    <tr
                      key={r.position}
                      className={`timing-row${i === 0 ? ' p1' : ''}`}
                      style={{ opacity: isDnf ? 0.45 : 1 }}
                    >
                      <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{r.position}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.code}</span>
                          {r.fastestLap && (
                            <span title="Fastest Lap" style={{ color: '#a855f7', fontSize: 10, fontWeight: 700 }}>FL</span>
                          )}
                        </div>
                      </td>
                      <td><span style={{ fontSize: 11, color: '#64748b' }}>{r.team}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.grid || 'PL'}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{r.laps}</span></td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12,
                          fontWeight: i === 0 ? 700 : 400,
                          color: i === 0 ? '#facc15' : isDnf ? '#f87171' : '#94a3b8',
                        }}>
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
    </div>
  );
}
