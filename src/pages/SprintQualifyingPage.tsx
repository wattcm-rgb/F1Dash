import { useState, useCallback } from 'react';
import { openf1Api } from '../services/openf1Api';
import { sessionLabel } from '../types/openf1';
import type { Segment } from '../components/qualifying/types';
import { useQualifyingSession } from '../hooks/useQualifyingSession';
import QualifyingLeaderboard from '../components/qualifying/QualifyingLeaderboard';

const CURRENT_YEAR = new Date().getFullYear();
// Sprint weekends only exist from 2021 onward; OpenF1 coverage starts 2023.
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

// SQ1/SQ2/SQ3 displayed labels map to Q1/Q2/Q3 internally (same logic, different names).
const SQ_LABEL: Record<Segment, string> = { Q1: 'SQ1', Q2: 'SQ2', Q3: 'SQ3' };

const fetchSprintQualSessions = (year: number) =>
  openf1Api.getSprintQualifyingSessions(year);

export default function SprintQualifyingPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const fetchSessions = useCallback(fetchSprintQualSessions, []);

  const {
    liveSession, isLive, detecting,
    sessions, selectedSessionKey, setSelectedSessionKey, sessionsLoading,
    drivers, laps, dataLoading, dataError,
    q1Laps, q2Laps, q3Laps, segment, setSegment, segmentLaps,
    selectedSession,
  } = useQualifyingSession({ year, sessionNameFilter: 'Sprint Shootout', fetchSessions });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Filter bar */}
      <div className="filter-bar">
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={selectedSessionKey ?? ''}
          onChange={e => setSelectedSessionKey(Number(e.target.value))}
          disabled={sessionsLoading || !sessions.length}
          style={{ minWidth: 220 }}
        >
          {sessionsLoading && <option value="">Loading sessions…</option>}
          {!sessionsLoading && !sessions.length && <option value="">No sprint qualifying this year</option>}
          {sessions.map(s => (
            <option key={s.session_key} value={s.session_key}>
              {sessionLabel(s)} · Sprint Qualifying
            </option>
          ))}
        </select>
      </div>

      {/* Header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {selectedSession ? `${sessionLabel(selectedSession)} · Sprint Qualifying` : 'Sprint Qualifying'}
            </span>
            {detecting && (
              <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.2)', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>CHECKING</span>
            )}
            {!detecting && isLive && liveSession?.session_key === selectedSessionKey && (
              <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
            )}
          </div>
          {selectedSession && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {selectedSession.circuit_short_name} · {selectedSession.country_name}
            </div>
          )}
        </div>

        {/* SQ1/SQ2/SQ3 tabs */}
        {laps.length > 0 && (
          <div className="tab-bar">
            {(['Q1', 'Q2', 'Q3'] as Segment[]).map(seg => {
              const sl = seg === 'Q1' ? q1Laps : seg === 'Q2' ? q2Laps : q3Laps;
              return (
                <button key={seg} className={`tab-btn${segment === seg ? ' active' : ''}`}
                  onClick={() => setSegment(seg)} disabled={!sl.length}
                  style={{ opacity: sl.length ? 1 : 0.3 }}>
                  {SQ_LABEL[seg]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {dataLoading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading sprint qualifying data…</div>}
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
    </div>
  );
}
