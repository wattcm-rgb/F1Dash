import { useEffect, useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import { jolpicaApi } from '../services/jolpicaApi';
import type { OpenF1Session } from '../types/openf1';
import { sessionLabel } from '../types/openf1';
import type { Segment } from '../components/qualifying/types';
import { useQualifyingSession } from '../hooks/useQualifyingSession';
import QualifyingLeaderboard from '../components/qualifying/QualifyingLeaderboard';

// ─── Jolpica fallback (years < 2023) ──────────────────────────────────────────

interface JolpicaRound { round: number; raceName: string; locality: string; country: string; date: string; }
interface JolpicaResult { position: number; code: string; team: string; q1: string; q2: string | undefined; q3: string | undefined; }

function toSecs(t: string): number {
  const parts = t.split(':');
  return parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(t);
}
function fmtGapJolpica(pole: string, time: string | undefined): string {
  if (!time || time === '—') return '—';
  const gap = toSecs(time) - toSecs(pole);
  return gap > 0 ? `+${gap.toFixed(3)}` : '—';
}

type JolpicaTab = 'Q1' | 'Q2' | 'Q3';

function JolpicaQualPage({ year }: { year: number }) {
  const [rounds, setRounds] = useState<JolpicaRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [results, setResults] = useState<JolpicaResult[]>([]);
  const [raceName, setRaceName] = useState('');
  const [tab, setTab] = useState<JolpicaTab>('Q3');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRounds([]); setSelectedRound(null); setResults([]); setRaceName(''); setError(null); setLoading(true);
    jolpicaApi.getRaces(year)
      .then(data => {
        const cutoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const races: JolpicaRound[] = (data?.MRData?.RaceTable?.Races ?? [])
          .filter((r: { date: string }) => new Date(r.date) <= cutoff)
          .map((r: { round: string; raceName: string; Circuit?: { Location?: { locality?: string; country?: string } }; date: string }) => ({
            round: Number(r.round), raceName: r.raceName,
            locality: r.Circuit?.Location?.locality ?? '', country: r.Circuit?.Location?.country ?? '', date: r.date,
          }));
        setRounds(races);
        if (races.length) setSelectedRound(races[races.length - 1].round);
        else setLoading(false);
      })
      .catch(() => { setError('Failed to load race calendar.'); setLoading(false); });
  }, [year]);

  useEffect(() => {
    if (selectedRound == null) return;
    setLoading(true); setError(null); setResults([]);
    jolpicaApi.getQualifyingResults(year, selectedRound)
      .then(data => {
        const race = data?.MRData?.RaceTable?.Races?.[0];
        if (!race?.QualifyingResults?.length) { setError('No qualifying results available yet.'); setLoading(false); return; }
        setRaceName(race.raceName);
        const mapped: JolpicaResult[] = race.QualifyingResults.map((r: {
          position: string; Driver?: { code?: string; driverId?: string };
          Constructor?: { name?: string }; Q1?: string; Q2?: string; Q3?: string;
        }) => ({
          position: Number(r.position),
          code: r.Driver?.code ?? (r.Driver?.driverId ?? '???').toUpperCase().slice(0, 3),
          team: r.Constructor?.name ?? '—',
          q1: r.Q1 ?? '—', q2: r.Q2, q3: r.Q3,
        }));
        setResults(mapped);
        if (mapped.some(r => r.q3)) setTab('Q3');
        else if (mapped.some(r => r.q2)) setTab('Q2');
        else setTab('Q1');
      })
      .catch(() => { setError('Failed to load qualifying results.'); })
      .finally(() => setLoading(false));
  }, [year, selectedRound]);

  const round = rounds.find(r => r.round === selectedRound);
  const pole = results[0];
  const hasQ2 = results.some(r => r.q2);
  const hasQ3 = results.some(r => r.q3);
  const timeForTab = (r: JolpicaResult) => tab === 'Q3' ? r.q3 : tab === 'Q2' ? r.q2 : r.q1;
  const getPoleTime = () => { if (!pole) return undefined; return tab === 'Q3' ? pole.q3 : tab === 'Q2' ? pole.q2 : pole.q1; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rounds.length > 0 && (
        <select value={selectedRound ?? ''} onChange={e => setSelectedRound(Number(e.target.value))}
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 13, padding: '7px 10px', borderRadius: 6 }}>
          {rounds.map(r => <option key={r.round} value={r.round}>Rd {r.round} · {r.raceName.replace(' Grand Prix', '')}</option>)}
        </select>
      )}
      <div className="glass" style={{ padding: '12px 16px' }}>
        <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>{raceName || round?.raceName || 'Qualifying'}</div>
        {round && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{round.locality} · {round.country}</div>}
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
              {(['Q1', 'Q2', 'Q3'] as JolpicaTab[]).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}
                  disabled={(t === 'Q2' && !hasQ2) || (t === 'Q3' && !hasQ3)}
                  style={{ opacity: ((t === 'Q2' && !hasQ2) || (t === 'Q3' && !hasQ3)) ? 0.3 : 1 }}>{t}</button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: '#334155' }}>{results.length} drivers</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Pos</th><th style={{ minWidth: 120 }}>Driver</th><th>Time</th><th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const time = timeForTab(r);
                  const gap = i === 0 ? null : fmtGapJolpica(getPoleTime() ?? '', time);
                  const dnp = (tab === 'Q3' && !r.q3) || (tab === 'Q2' && !r.q2);
                  return (
                    <tr key={r.position} className={`timing-row${i === 0 ? ' p1' : ''}`} style={{ opacity: dnp ? 0.4 : 1 }}>
                      <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{r.position}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{r.code}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{r.team}</span>
                        </div>
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: i === 0 ? '#c084fc' : '#f1f5f9' }}>{time ?? '—'}</span></td>
                      <td>{i === 0
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

// ─── OpenF1 qualifying (years >= 2023) ────────────────────────────────────────

const OPENF1_START_YEAR = 2023;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2017 }, (_, i) => CURRENT_YEAR - i);

const fetchQualSessions = (year: number) =>
  openf1Api.getQualifyingSessions(year).then((sessions: OpenF1Session[]) =>
    sessions.filter(s => s.session_name === 'Qualifying'),
  );

export default function QualifyingPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const useOpenF1 = year >= OPENF1_START_YEAR;

  const fetchSessions = useCallback(fetchQualSessions, []);

  const {
    liveSession, isLive, detecting,
    sessions, selectedSessionKey, setSelectedSessionKey, sessionsLoading,
    drivers, laps, dataLoading, dataError,
    q1Laps, q2Laps, q3Laps, segment, setSegment, segmentLaps,
    selectedSession,
  } = useQualifyingSession({ year: useOpenF1 ? year : 0, sessionNameFilter: 'Qualifying', fetchSessions });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Filter bar */}
      <div className="filter-bar">
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {useOpenF1 && (
          <select
            value={selectedSessionKey ?? ''}
            onChange={e => setSelectedSessionKey(Number(e.target.value))}
            disabled={sessionsLoading || !sessions.length}
            style={{ minWidth: 220 }}
          >
            {sessionsLoading && <option value="">Loading sessions…</option>}
            {!sessionsLoading && !sessions.length && <option value="">No sessions found</option>}
            {sessions.map(s => (
              <option key={s.session_key} value={s.session_key}>
                {sessionLabel(s)} · Qualifying
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {useOpenF1
                ? (selectedSession ? `${sessionLabel(selectedSession)} · Qualifying` : 'Qualifying')
                : 'Qualifying'}
            </span>
            {useOpenF1 && detecting && (
              <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.2)', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>CHECKING</span>
            )}
            {useOpenF1 && !detecting && isLive && liveSession?.session_key === selectedSessionKey && (
              <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
            )}
          </div>
          {selectedSession && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {selectedSession.circuit_short_name} · {selectedSession.country_name}
            </div>
          )}
        </div>

        {/* Q1/Q2/Q3 tabs */}
        {useOpenF1 && laps.length > 0 && (
          <div className="tab-bar">
            {(['Q1', 'Q2', 'Q3'] as Segment[]).map(seg => {
              const sl = seg === 'Q1' ? q1Laps : seg === 'Q2' ? q2Laps : q3Laps;
              return (
                <button key={seg} className={`tab-btn${segment === seg ? ' active' : ''}`}
                  onClick={() => setSegment(seg)} disabled={!sl.length}
                  style={{ opacity: sl.length ? 1 : 0.3 }}>
                  {seg}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* OpenF1 leaderboard */}
      {useOpenF1 && (
        <>
          {dataLoading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading qualifying data…</div>}
          {dataError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{dataError}</div>}
          {!dataLoading && !dataError && laps.length === 0 && selectedSessionKey && (
            <div style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '24px 16px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No lap data available for this session yet.
            </div>
          )}
          {!dataLoading && laps.length > 0 && (
            <QualifyingLeaderboard
              drivers={drivers}
              segmentLaps={segmentLaps}
              allLaps={laps}
              segment={segment}
            />
          )}
        </>
      )}

      {/* Jolpica fallback */}
      {!useOpenF1 && <JolpicaQualPage year={year} />}
    </div>
  );
}
