import type { RcMsg } from './types';

// Flags and categories we want to surface. Blue flags are deliberately excluded.
const INCLUDED_FLAGS = new Set(['YELLOW', 'DOUBLE YELLOW', 'RED', 'BLACK AND WHITE']);

function isRelevant(m: RcMsg): boolean {
  const flag = m.flag?.toUpperCase() ?? '';
  const cat = m.category?.toUpperCase() ?? '';
  const msg = m.message?.toUpperCase() ?? '';

  if (flag === 'BLUE') return false;
  if (INCLUDED_FLAGS.has(flag)) return true;
  if (cat === 'SAFETYCAR' || cat === 'VIRTUALSAFETYCAR') return true;
  if (msg.includes('SAFETY CAR') || msg.includes('VIRTUAL SAFETY CAR')) return true;
  if (msg.includes('INVESTIGATION') || msg.includes('PENALTY') || msg.includes('DRIVE THROUGH') || msg.includes('STOP AND GO')) return true;
  if (flag === 'BLACK AND WHITE' || msg.includes('BLACK AND WHITE')) return true;
  return false;
}

function flagColor(flag: string | null | undefined): string {
  switch (flag?.toUpperCase()) {
    case 'RED': return '#ef4444';
    case 'YELLOW': return '#facc15';
    case 'DOUBLE YELLOW': return '#facc15';
    case 'BLACK AND WHITE': return '#e2e8f0';
    case 'GREEN': return '#22c55e';
    case 'CHEQUERED': return '#ffffff';
    default: return '#64748b';
  }
}

function FlagIcon({ flag, size = 16 }: { flag: string | null | undefined; size?: number }) {
  const f = flag?.toUpperCase();
  const col = flagColor(flag);

  if (f === 'RED') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#ef4444" />
        <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">R</text>
      </svg>
    );
  }
  if (f === 'DOUBLE YELLOW') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <rect x="1" y="1" width="6" height="14" rx="1.5" fill="#facc15" />
        <rect x="9" y="1" width="6" height="14" rx="1.5" fill="#facc15" />
      </svg>
    );
  }
  if (f === 'YELLOW') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#facc15" />
      </svg>
    );
  }
  if (f === 'BLACK AND WHITE') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <rect x="1" y="1" width="7" height="7" rx="1" fill="white" />
        <rect x="8" y="1" width="7" height="7" rx="1" fill="#1e293b" />
        <rect x="1" y="8" width="7" height="7" rx="1" fill="#1e293b" />
        <rect x="8" y="8" width="7" height="7" rx="1" fill="white" />
      </svg>
    );
  }
  // Safety car / VSC / investigation — no flag field but show a relevant icon
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={col} strokeWidth="2" />
      <text x="8" y="11.5" textAnchor="middle" fontSize="8" fontWeight="700" fill={col}>!</text>
    </svg>
  );
}

function msgColor(m: RcMsg): string {
  const f = m.flag?.toUpperCase();
  if (f === 'RED') return '#f87171';
  if (f === 'DOUBLE YELLOW' || f === 'YELLOW') return '#fde68a';
  if (f === 'BLACK AND WHITE') return '#e2e8f0';
  return '#94a3b8';
}

function rowBg(m: RcMsg): string {
  const f = m.flag?.toUpperCase();
  if (f === 'RED') return 'rgba(239,68,68,0.08)';
  if (f === 'DOUBLE YELLOW' || f === 'YELLOW') return 'rgba(234,179,8,0.06)';
  if (f === 'BLACK AND WHITE') return 'rgba(226,232,240,0.04)';
  return 'transparent';
}

export default function RaceControlTab({ rcMsgs }: { rcMsgs: RcMsg[] }) {
  const filtered = rcMsgs.filter(isRelevant);

  if (!filtered.length) {
    return (
      <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
        No notable race control messages for this session.
      </div>
    );
  }

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em' }}>RACE CONTROL</span>
        <span style={{ fontSize: 11, color: '#334155' }}>{filtered.length} alerts</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 520, overflowY: 'auto' }}>
        {[...filtered].reverse().map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, padding: '9px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            background: rowBg(m),
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', minWidth: 64, flexShrink: 0, paddingTop: 2 }}>
              {new Date(m.date).toLocaleTimeString()}
            </span>
            <span style={{ flexShrink: 0, paddingTop: 1 }}>
              <FlagIcon flag={m.flag} size={16} />
            </span>
            {m.flag && (
              <span style={{ fontSize: 9, fontWeight: 700, color: flagColor(m.flag), border: `1px solid ${flagColor(m.flag)}55`, borderRadius: 3, padding: '1px 5px', height: 'fit-content', flexShrink: 0, letterSpacing: '0.04em', marginTop: 1 }}>
                {m.flag.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 12, color: msgColor(m), lineHeight: 1.4 }}>{m.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
