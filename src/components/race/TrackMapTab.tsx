import type { OpenF1Session, OpenF1Driver } from '../../types/openf1';
import type { RcMsg } from './types';
import { useTrackOutline } from '../../hooks/useTrackOutline';
import { sectorFlagMap, flagColor } from './derive';

interface Props {
  session: OpenF1Session | null;
  rcMsgs: RcMsg[];
  // Live-only overlay: comet trails + latest dot per driver.
  liveTrails?: Map<number, { x: number; y: number }[]>;
  drivers?: OpenF1Driver[];
}

function makeTransform(pts: { x: number; y: number }[], w: number, h: number, pad: number) {
  if (!pts.length) return (_x: number, _y: number) => ({ sx: 0, sy: 0 });
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rX = maxX - minX || 1, rY = maxY - minY || 1;
  const scale = Math.min((w - 2 * pad) / rX, (h - 2 * pad) / rY);
  const offX = pad + ((w - 2 * pad) - rX * scale) / 2;
  const offY = pad + ((h - 2 * pad) - rY * scale) / 2;
  return (x: number, y: number) => ({ sx: offX + (x - minX) * scale, sy: h - (offY + (y - minY) * scale) });
}

export default function TrackMapTab({ session, rcMsgs, liveTrails, drivers }: Props) {
  const outline = useTrackOutline(session);
  const secFlags = sectorFlagMap(rcMsgs);
  const transform = makeTransform(outline, 600, 380, 34);
  const driverMap = new Map((drivers ?? []).map(d => [d.driver_number, d]));

  const latestPos = new Map<number, { x: number; y: number }>();
  if (liveTrails) for (const [dn, pts] of liveTrails.entries()) if (pts.length) latestPos.set(dn, pts[pts.length - 1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[1, 2, 3].map(s => {
          const f = secFlags[s] ?? 'CLEAR';
          const col = flagColor(f === 'CLEAR' ? null : f);
          return (
            <div key={s} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '5px 12px', border: `1px solid ${col}44`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: col }}>S{s}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>{f === 'CLEAR' ? 'Clear' : f}</span>
            </div>
          );
        })}
      </div>

      <div className="glass" style={{ padding: 12 }}>
        {outline.length < 2 ? (
          <div style={{ color: '#475569', textAlign: 'center', padding: '60px 0', fontSize: 13 }}>
            Loading circuit outline from this weekend's GPS data…
          </div>
        ) : (
          <svg viewBox="0 0 600 380" style={{ width: '100%', maxWidth: 700, display: 'block', margin: '0 auto' }}>
            {(() => {
              const scr = outline.map(p => transform(p.x, p.y));
              const n = scr.length;
              const bounds = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n];
              return [1, 2, 3].map(sector => {
                const seg = scr.slice(bounds[sector - 1], bounds[sector] + 1);
                if (seg.length < 2) return null;
                const flag = secFlags[sector];
                const col = flag ? flagColor(flag) : 'rgba(100,116,139,0.55)';
                return <polyline key={sector} points={seg.map(p => `${p.sx},${p.sy}`).join(' ')} fill="none" stroke={col} strokeWidth={flag ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" />;
              });
            })()}

            {liveTrails && Array.from(liveTrails.entries()).map(([dn, pts]) => {
              if (pts.length < 2) return null;
              const d = driverMap.get(dn); if (!d) return null;
              const points = pts.map(p => { const { sx, sy } = transform(p.x, p.y); return `${sx},${sy}`; }).join(' ');
              return <polyline key={`t${dn}`} points={points} fill="none" stroke={`#${d.team_colour || '888'}`} strokeWidth={2} strokeOpacity={0.45} strokeLinecap="round" />;
            })}

            {Array.from(latestPos.entries()).map(([dn, pos]) => {
              const d = driverMap.get(dn); if (!d) return null;
              const { sx, sy } = transform(pos.x, pos.y);
              return (
                <g key={dn}>
                  <circle cx={sx} cy={sy} r={7} fill={`#${d.team_colour || '888'}`} stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
                  <text x={sx} y={sy - 10} textAnchor="middle" style={{ fontSize: 8, fontWeight: 'bold', fill: '#f1f5f9', fontFamily: 'monospace' }}>{d.name_acronym}</text>
                </g>
              );
            })}
          </svg>
        )}
        <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 8 }}>
          {outline.length > 1
            ? `${session?.circuit_short_name ?? ''} circuit · drawn from ${outline.length} GPS points${liveTrails ? ' · live car positions overlaid' : ''}`
            : ''}
        </div>
      </div>
    </div>
  );
}
