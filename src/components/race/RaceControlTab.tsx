import type { RcMsg } from './types';
import { flagColor } from './derive';

// Dedicated Race Control feed (own sub-page). Newest first.
export default function RaceControlTab({ rcMsgs }: { rcMsgs: RcMsg[] }) {
  if (!rcMsgs.length) {
    return (
      <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
        No race control messages for this session.
      </div>
    );
  }
  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>RACE CONTROL</span>
        <span style={{ fontSize: 11, color: '#334155' }}>{rcMsgs.length} messages</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 520, overflowY: 'auto' }}>
        {[...rcMsgs].reverse().map((m, i) => {
          const col = m.flag ? flagColor(m.flag) : '#64748b';
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '8px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              background: m.flag === 'RED' ? 'rgba(239,68,68,0.06)' : m.flag?.includes('YELLOW') ? 'rgba(234,179,8,0.05)' : 'transparent',
            }}>
              <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', minWidth: 64, flexShrink: 0, paddingTop: 1 }}>
                {new Date(m.date).toLocaleTimeString()}
              </span>
              {m.flag && (
                <span style={{ fontSize: 9, fontWeight: 700, color: col, border: `1px solid ${col}55`, borderRadius: 3, padding: '1px 5px', height: 'fit-content', flexShrink: 0, letterSpacing: '0.04em' }}>
                  {m.flag}
                </span>
              )}
              <span style={{ fontSize: 12, color: m.flag === 'RED' ? '#f87171' : '#94a3b8', lineHeight: 1.4 }}>{m.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
