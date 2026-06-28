import { useEffect, useState } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Lap } from '../types/openf1';
import { isPastSession } from '../types/openf1';

interface Pt { x: number; y: number; }

// Builds the circuit outline from one clean flying lap of GPS location data.
// Prefers another session of the same meeting (practice/quali) then the race
// itself. Works for any circuit/year with zero per-track assets.
export function useTrackOutline(session: OpenF1Session | null): Pt[] {
  const [outline, setOutline] = useState<Pt[]>([]);

  useEffect(() => {
    if (!session) { setOutline([]); return; }
    let cancelled = false;
    setOutline([]);
    const { meeting_key, session_key, year } = session;

    async function build() {
      try {
        const all = await openf1Api.getSessionsByYear(year) as OpenF1Session[];
        const candidates = all
          .filter(s => s.meeting_key === meeting_key && s.session_key !== session_key && isPastSession(s))
          .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
        candidates.push(session!);
        for (const cand of candidates) {
          if (cancelled) return;
          const lapData = await openf1Api.getLaps(cand.session_key) as OpenF1Lap[];
          const valid = lapData.filter(l => l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration! > 50 && l.lap_duration! < 200 && l.date_start);
          if (!valid.length) continue;
          valid.sort((a, b) => a.lap_duration! - b.lap_duration!);
          const lap = valid[0];
          const t0 = new Date(lap.date_start).getTime();
          const gt = new Date(t0 - 500).toISOString().replace('Z', '');
          const lt = new Date(t0 + lap.lap_duration! * 1000 + 1500).toISOString().replace('Z', '');
          const pts = await openf1Api.getLocationRange(cand.session_key, lap.driver_number, gt, lt) as Array<{ x: number; y: number }>;
          const clean = pts.filter(p => p.x != null && p.y != null && !(p.x === 0 && p.y === 0));
          if (clean.length > 30 && !cancelled) { setOutline(clean.map(p => ({ x: p.x, y: p.y }))); return; }
        }
      } catch { /* leave empty */ }
    }
    build();
    return () => { cancelled = true; };
  }, [session]);

  return outline;
}
