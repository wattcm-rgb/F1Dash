import { useEffect, useState } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';

interface Round {
  round: number;
  raceName: string;
  locality: string;
  country: string;
  date: string;
}

interface QualResult {
  position: number;
  code: string;
  team: string;
  q1: string;
  q2: string | undefined;
  q3: string | undefined;
}

function fmtGap(pole: string, time: string | undefined): string {
  if (!time || time === '—') return '—';
  const toSecs = (t: string) => {
    const parts = t.split(':');
    return parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(t);
  };
  const gap = toSecs(time) - toSecs(pole);
  return gap > 0 ? `+${gap.toFixed(3)}` : '—';
}

type Tab = 'Q1' | 'Q2' | 'Q3';

export default function QualifyingPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [results, setResults] = useState<QualResult[]>([]);
  const [raceName, setRaceName] = useState('');
  const [tab, setTab] = useState<Tab>('Q3');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const year = new Date().getFullYear();
        const data = await jolpicaApi.getRaces(year);
        // include races up to 2 days from now so a current race weekend shows qualifying
        const cutoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const races: Round[] = (data?.MRData?.RaceTable?.Races ?? [])
          .filter((r: { date: string }) => new Date(r.date) <= cutoff)
          .map((r: { round: string; raceName: string; Circuit?: { Location?: { locality?: string; country?: string } }; date: string }) => ({
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
        const data = await jolpicaApi.getQualifyingResults(year, selectedRound!);
        const race = data?.MRData?.RaceTable?.Races?.[0];
        if (!race?.QualifyingResults?.length) {
          setError('No qualifying results available yet for this round.');
          setLoading(false);
          return;
        }
        setRaceName(race.raceName);
        const mapped: QualResult[] = race.QualifyingResults.map((r: {
          position: string;
          Driver?: { code?: string; driverId?: string };
          Constructor?: { name?: string };
          Q1?: string; Q2?: string; Q3?: string;
        }) => ({
          position: Number(r.position),
          code: r.Driver?.code ?? (r.Driver?.driverId ?? '???').toUpperCase().slice(0, 3),
          team: r.Constructor?.name ?? '—',
          q1: r.Q1 ?? '—',
          q2: r.Q2,
          q3: r.Q3,
        }));
        setResults(mapped);
        if (mapped.some(r => r.q3)) setTab('Q3');
        else if (mapped.some(r => r.q2)) setTab('Q2');
        else setTab('Q1');
      } catch {
        setError('Failed to load qualifying results.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedRound]);

  const round = rounds.find(r => r.round === selectedRound);
  const pole = results[0];
  const hasQ2 = results.some(r => r.q2);
  const hasQ3 = results.some(r => r.q3);
  const timeForTab = (r: QualResult) =>
    tab === 'Q3' ? r.q3 : tab === 'Q2' ? r.q2 : r.q1;
  const getPoleTime = () => {
    if (!pole) return undefined;
    return tab === 'Q3' ? pole.q3 : tab === 'Q2' ? pole.q2 : pole.q1;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
            {raceName || round?.raceName || 'Qualifying'}
          </div>
          {round && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {round.locality} · {round.country}
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

      {pole && (
        <div style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>POLE POSITION</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{pole.q3 ?? pole.q1}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{pole.code} · {pole.team}</span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading qualifying results…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && results.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tab-bar">
              {(['Q1', 'Q2', 'Q3'] as Tab[]).map(t => (
                <button
                  key={t}
                  className={`tab-btn${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                  disabled={(t === 'Q2' && !hasQ2) || (t === 'Q3' && !hasQ3)}
                  style={{ opacity: ((t === 'Q2' && !hasQ2) || (t === 'Q3' && !hasQ3)) ? 0.3 : 1 }}
                >
                  {t}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#334155' }}>{results.length} drivers</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Pos</th>
                  <th style={{ minWidth: 120 }}>Driver</th>
                  <th>Time</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const time = timeForTab(r);
                  const pt = getPoleTime();
                  const gap = i === 0 ? null : fmtGap(pt ?? '', time);
                  const didNotParticipate =
                    (tab === 'Q3' && !r.q3) || (tab === 'Q2' && !r.q2);
                  return (
                    <tr key={r.position} className={`timing-row${i === 0 ? ' p1' : ''}`} style={{ opacity: didNotParticipate ? 0.4 : 1 }}>
                      <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{r.position}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.code}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{r.team}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: i === 0 ? '#c084fc' : (time ?? '—') === '—' ? '#334155' : '#f1f5f9' }}>
                          {time ?? '—'}
                        </span>
                      </td>
                      <td>
                        {i === 0
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7' }}>POLE</span>
                          : <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{gap ?? '—'}</span>}
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
