import { TYRE_COLOUR, TYRE_LABEL } from '../../utils/timing';
import type { TyreStint } from './derive';

// Compact "S → H → S" tyre-history row with optional lap counts.
export default function TyreChips({ history, showLaps = true }: { history: TyreStint[]; showLaps?: boolean }) {
  if (!history.length) return <span style={{ color: '#334155', fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflowX: 'auto' }}>
      {history.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <span style={{ color: '#334155', fontSize: 10 }}>→</span>}
          <span style={{
            fontWeight: 700, fontSize: 12,
            color: TYRE_COLOUR[t.compound] ?? '#64748b',
            background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '2px 6px',
          }}>
            {TYRE_LABEL[t.compound] ?? '?'}
          </span>
          {showLaps && t.laps > 0 && <span style={{ fontSize: 10, color: '#475569' }}>({t.laps}L)</span>}
        </div>
      ))}
    </div>
  );
}
