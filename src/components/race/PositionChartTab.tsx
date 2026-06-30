import { useState, useMemo } from 'react';
import type { OpenF1Driver, OpenF1Lap } from '../../types/openf1';
import { cumulativeTimes } from './derive';

interface Props {
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
}

export default function PositionChartTab({ drivers, laps }: Props) {
  const [hoveredDn, setHoveredDn] = useState<number | null>(null);

  const { cumTimeMap, maxLaps } = useMemo(
    () => cumulativeTimes(drivers, laps),
    [drivers, laps],
  );

  // Build position-by-lap for every driver using cumulative race time.
  // At each lap, sort drivers by their cumulative time. Drivers who haven't
  // completed that lap yet are placed at the bottom in their last known order.
  const positionsByLap = useMemo((): Map<number, number[]> => {
    // map: lap number → ordered array of driver_numbers (index+1 = position)
    const result = new Map<number, number[]>();
    if (!maxLaps || !drivers.length) return result;

    for (let lap = 1; lap <= maxLaps; lap++) {
      const withTime: { dn: number; cum: number }[] = [];
      const withoutTime: number[] = [];
      for (const d of drivers) {
        const cum = cumTimeMap.get(d.driver_number)?.get(lap);
        if (cum != null) withTime.push({ dn: d.driver_number, cum });
        else withoutTime.push(d.driver_number);
      }
      withTime.sort((a, b) => a.cum - b.cum);
      result.set(lap, [...withTime.map(w => w.dn), ...withoutTime]);
    }
    return result;
  }, [drivers, cumTimeMap, maxLaps]);

  // Chart dimensions
  const W = 640;
  const H = 380;
  const PAD = { top: 16, right: 56, bottom: 32, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const numDrivers = drivers.length;
  const numLaps = maxLaps;

  if (!numLaps || !numDrivers) {
    return (
      <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
        No race data yet.
      </div>
    );
  }

  function xForLap(lap: number) {
    return PAD.left + ((lap - 1) / Math.max(numLaps - 1, 1)) * chartW;
  }

  function yForPos(pos: number) {
    // pos 1 = top, numDrivers = bottom
    return PAD.top + ((pos - 1) / Math.max(numDrivers - 1, 1)) * chartH;
  }

  // Build polylines for each driver
  const lines = drivers.map(d => {
    const dn = d.driver_number;
    const colour = `#${d.team_colour || '334155'}`;
    const points: string[] = [];
    for (let lap = 1; lap <= numLaps; lap++) {
      const ordered = positionsByLap.get(lap);
      if (!ordered) continue;
      const posIdx = ordered.indexOf(dn);
      if (posIdx === -1) continue;
      const pos = posIdx + 1;
      points.push(`${xForLap(lap).toFixed(1)},${yForPos(pos).toFixed(1)}`);
    }
    // Final position label
    const lastOrdered = positionsByLap.get(numLaps);
    const finalPos = lastOrdered ? lastOrdered.indexOf(dn) + 1 : null;

    return { dn, colour, pointsStr: points.join(' '), finalPos, driver: d };
  }).filter(l => l.pointsStr.length > 0);

  const isHovered = (dn: number) => hoveredDn === null || hoveredDn === dn;

  // Y-axis labels (positions)
  const yLabels = [1, 5, 10, 15, numDrivers].filter((v, i, arr) => arr.indexOf(v) === i && v <= numDrivers);
  // X-axis labels (lap numbers)
  const xLabels = [1, ...Array.from({ length: Math.floor(numLaps / 10) }, (_, i) => (i + 1) * 10).filter(l => l <= numLaps)];

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', marginBottom: 12 }}>
        RACE POSITIONS BY LAP
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg
          width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', maxWidth: '100%', cursor: 'crosshair' }}
        >
          {/* Grid lines */}
          {yLabels.map(pos => (
            <line key={pos}
              x1={PAD.left} y1={yForPos(pos)}
              x2={PAD.left + chartW} y2={yForPos(pos)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1}
            />
          ))}

          {/* Y-axis labels */}
          {yLabels.map(pos => (
            <text key={pos} x={PAD.left - 6} y={yForPos(pos) + 4}
              textAnchor="end" fill="#334155" fontSize={10} fontFamily="monospace">
              P{pos}
            </text>
          ))}

          {/* X-axis labels */}
          {xLabels.map(lap => (
            <text key={lap} x={xForLap(lap)} y={H - 6}
              textAnchor="middle" fill="#334155" fontSize={10} fontFamily="monospace">
              {lap}
            </text>
          ))}

          {/* X-axis label */}
          <text x={PAD.left + chartW / 2} y={H - 0} textAnchor="middle" fill="#1e293b" fontSize={9} fontFamily="sans-serif">
            LAP
          </text>

          {/* Driver lines */}
          {lines.map(l => (
            <polyline
              key={l.dn}
              points={l.pointsStr}
              fill="none"
              stroke={l.colour}
              strokeWidth={hoveredDn === l.dn ? 2.5 : 1.5}
              opacity={isHovered(l.dn) ? 1 : 0.15}
              style={{ transition: 'opacity 0.15s, stroke-width 0.1s' }}
              onMouseEnter={() => setHoveredDn(l.dn)}
              onMouseLeave={() => setHoveredDn(null)}
            />
          ))}

          {/* Driver labels at right edge */}
          {lines.map(l => {
            if (l.finalPos == null) return null;
            const x = xForLap(numLaps) + 4;
            const y = yForPos(l.finalPos) + 4;
            return (
              <text key={l.dn} x={x} y={y}
                fill={l.colour} fontSize={9} fontFamily="monospace"
                fontWeight={hoveredDn === l.dn ? 700 : 400}
                opacity={isHovered(l.dn) ? 1 : 0.2}
                style={{ transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHoveredDn(l.dn)}
                onMouseLeave={() => setHoveredDn(null)}
              >
                {l.driver.name_acronym}
              </text>
            );
          })}
        </svg>
      </div>
      <div style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>
        Hover a line to highlight. Positions computed from cumulative race time.
      </div>
    </div>
  );
}
