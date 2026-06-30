import { useCallback } from 'react';
import { openf1Api } from '../../services/openf1Api';
import type { OpenF1Session } from '../../types/openf1';
import { sessionLabel } from '../../types/openf1';
import StatusBanner from '../StatusBanner';
import type { Segment } from './types';
import { useQualifyingSession } from '../../hooks/useQualifyingSession';
import QualifyingLeaderboard from './QualifyingLeaderboard';

interface Props {
  // 'Qualifying' = standard qualifying, 'Sprint Shootout' = sprint qualifying.
  kind: 'Qualifying' | 'Sprint Shootout';
}

const CURRENT_YEAR = new Date().getFullYear();

const fetchQualSessions = (year: number) =>
  openf1Api.getQualifyingSessions(year).then((sessions: OpenF1Session[]) =>
    sessions.filter(s => s.session_name === 'Qualifying'),
  );
const fetchSprintQualSessions = (year: number) =>
  openf1Api.getSprintQualifyingSessions(year);

// Live qualifying leaderboard view (standard or sprint shootout). Detects the
// current live session via the shared hook and auto-selects it; shows a waiting
// banner when nothing is live. Used by the Live hub's Qualifying and
// Sprint Qual sub-tabs.
export default function LiveQualView({ kind }: Props) {
  const isSprint = kind === 'Sprint Shootout';
  const displayLabel = isSprint ? 'Sprint Qualifying' : 'Qualifying';
  const segLabel: Record<Segment, string> = isSprint
    ? { Q1: 'SQ1', Q2: 'SQ2', Q3: 'SQ3' }
    : { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3' };

  const fetchSessions = useCallback(
    isSprint ? fetchSprintQualSessions : fetchQualSessions,
    [isSprint],
  );

  const {
    liveSession, isLive, detecting,
    drivers, laps, dataLoading, dataError,
    q1Laps, q2Laps, q3Laps, segment, setSegment, segmentLaps,
    selectedSessionKey,
  } = useQualifyingSession({ year: CURRENT_YEAR, sessionNameFilter: kind, fetchSessions });

  const showLive = isLive && liveSession?.session_key === selectedSessionKey;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>
              {liveSession ? `${sessionLabel(liveSession)} · ${displayLabel}` : `Live ${displayLabel}`}
            </span>
            {detecting
              ? <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.2)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>CHECKING</span>
              : showLive
                ? <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
                : <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.15)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>OFFLINE</span>}
          </div>
          {liveSession && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {liveSession.circuit_short_name} · {liveSession.country_name}
            </div>
          )}
        </div>

        {/* Segment tabs */}
        {laps.length > 0 && (
          <div className="tab-bar">
            {(['Q1', 'Q2', 'Q3'] as Segment[]).map(seg => {
              const sl = seg === 'Q1' ? q1Laps : seg === 'Q2' ? q2Laps : q3Laps;
              return (
                <button key={seg} className={`tab-btn${segment === seg ? ' active' : ''}`}
                  onClick={() => setSegment(seg)} disabled={!sl.length}
                  style={{ opacity: sl.length ? 1 : 0.3 }}>
                  {segLabel[seg]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {detecting && <StatusBanner tone="grey">Checking for a live session…</StatusBanner>}
      {!detecting && !showLive && (
        <StatusBanner tone="amber">
          No live {displayLabel.toLowerCase()} right now — live timing populates automatically when the session goes green.
        </StatusBanner>
      )}

      {dataLoading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading {displayLabel.toLowerCase()} data…</div>}
      {dataError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{dataError}</div>}

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
