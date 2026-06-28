import type { ReactNode } from 'react';

type Tone = 'grey' | 'amber' | 'red';

const TONES: Record<Tone, { bg: string; bd: string; dot: string; tx: string; pulse: boolean }> = {
  grey:  { bg: 'rgba(255,255,255,0.04)', bd: 'rgba(255,255,255,0.1)',  dot: '#64748b', tx: '#94a3b8', pulse: true },
  amber: { bg: 'rgba(234,179,8,0.1)',    bd: 'rgba(234,179,8,0.3)',    dot: '#facc15', tx: '#fde68a', pulse: false },
  red:   { bg: 'rgba(239,68,68,0.1)',    bd: 'rgba(239,68,68,0.3)',    dot: '#f87171', tx: '#fca5a5', pulse: false },
};

export default function StatusBanner({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = TONES[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: '10px 16px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0, animation: c.pulse ? 'pulse 1.6s ease-in-out infinite' : 'none' }} />
      <span style={{ fontSize: 13, color: c.tx }}>{children}</span>
    </div>
  );
}
