import type { SectorColour } from './types';
import { fmtTime } from '../../utils/timing';

const STYLE: Record<SectorColour, { color: string; bg: string; border: string }> = {
  purple: { color: '#a855f7', bg: 'rgba(168,85,247,0.18)', border: 'rgba(168,85,247,0.45)' },
  green:  { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)' },
  yellow: { color: '#facc15', bg: 'rgba(250,204,21,0.1)',   border: 'rgba(250,204,21,0.3)'  },
  grey:   { color: '#334155', bg: 'transparent',             border: 'transparent'            },
};

interface Props {
  time: number | null;
  colour: SectorColour;
}

export default function SectorCell({ time, colour }: Props) {
  const s = STYLE[colour];
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: colour === 'grey' ? 400 : 700,
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 4,
      padding: '1px 6px',
      minWidth: 62,
      textAlign: 'right',
    }}>
      {time != null ? fmtTime(time) : '—'}
    </span>
  );
}
