import { useEffect, useState } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session } from '../types/openf1';
import { sessionLabel, isSprintQualifyingName } from '../types/openf1';

// Pretty session-type name for display (normalises the sprint-qualifying rename).
function sessionTypeName(s: OpenF1Session): string {
  if (isSprintQualifyingName(s.session_name)) return 'Sprint Qualifying';
  return s.session_name;
}

// Human-friendly "in 3d 4h" / "in 2h 15m" / "in 8m" countdown.
function fmtCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

// Full-width banner showing the next upcoming F1 session this season: what it is,
// where, and when (in the viewer's local timezone) with a countdown.
export default function NextSession() {
  const [next, setNext] = useState<OpenF1Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const all = await openf1Api.getSessionsByYear(new Date().getFullYear()) as OpenF1Session[];
        const current = Date.now();
        const upcoming = all
          .filter(s => s.date_start && new Date(s.date_start).getTime() > current)
          .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
        if (!cancelled) setNext(upcoming[0] ?? null);
      } catch { /* leave as null */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    // Refresh the countdown each minute.
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) {
    return (
      <div className="glass" style={{ padding: '14px 18px', color: '#475569', fontSize: 13 }}>
        Loading next session…
      </div>
    );
  }

  if (!next) {
    return (
      <div className="glass" style={{ padding: '14px 18px', color: '#64748b', fontSize: 13 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.12em' }}>NEXT SESSION</span>
        <span style={{ marginLeft: 12 }}>No upcoming sessions scheduled.</span>
      </div>
    );
  }

  const start = new Date(next.date_start);
  const countdown = fmtCountdown(start.getTime() - now);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="glass" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(6,182,212,0.06), rgba(168,85,247,0.06))', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.12em', marginBottom: 4 }}>NEXT SESSION</div>
        <div className="f1-heading" style={{ fontSize: 18, color: '#f1f5f9' }}>
          {sessionLabel(next)} · {sessionTypeName(next)}
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
          {next.circuit_short_name} · {next.country_name}
        </div>
      </div>
      <div style={{ position: 'relative', textAlign: 'right' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#e9d5ff' }}>{dateStr} · {timeStr}</div>
        <div style={{ fontSize: 12, color: '#22d3ee', marginTop: 2 }}>{countdown}</div>
      </div>
    </div>
  );
}
