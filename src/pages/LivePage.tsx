import { useEffect, useState, useRef } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session } from '../types/openf1';
import { isLiveSession } from '../types/openf1';
import LiveRaceView from '../components/race/LiveRaceView';
import LiveQualView from '../components/qualifying/LiveQualView';

type LiveTab = 'sprint-qual' | 'sprint' | 'qualifying' | 'race';

const TABS: { id: LiveTab; label: string }[] = [
  { id: 'sprint-qual', label: 'Sprint Qual' },
  { id: 'sprint',      label: 'Sprint' },
  { id: 'qualifying',  label: 'Qualifying' },
  { id: 'race',        label: 'Race' },
];

// Map an OpenF1 session to its corresponding live sub-tab, or null if it is not
// one of the four session types the Live hub displays (e.g. Practice).
function tabForSession(s: OpenF1Session): LiveTab | null {
  if (s.session_type === 'Qualifying' && s.session_name === 'Sprint Shootout') return 'sprint-qual';
  if (s.session_type === 'Race' && s.session_name === 'Sprint') return 'sprint';
  if (s.session_type === 'Qualifying' && s.session_name === 'Qualifying') return 'qualifying';
  if (s.session_type === 'Race' && s.session_name === 'Race') return 'race';
  return null;
}

export default function LivePage() {
  // Default tab resolves from session detection; until then we hold off rendering
  // a sub-view so we don't flash the wrong session.
  const [tab, setTab] = useState<LiveTab | null>(null);
  const manualRef = useRef(false); // true once the user clicks a tab

  // Resolve the default tab: the session live right now, else the soonest
  // upcoming session among the four types we show, else Race.
  useEffect(() => {
    let cancelled = false;
    async function resolveDefault() {
      let chosen: LiveTab = 'race';
      try {
        const all = await openf1Api.getSessionsByYear(new Date().getFullYear()) as OpenF1Session[];
        const relevant = all.filter(s => tabForSession(s) !== null);
        const live = relevant.find(isLiveSession);
        if (live) {
          chosen = tabForSession(live)!;
        } else {
          const now = Date.now();
          const upcoming = relevant
            .filter(s => new Date(s.date_start).getTime() > now)
            .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
          if (upcoming.length) chosen = tabForSession(upcoming[0])!;
        }
      } catch { /* fall back to Race */ }
      if (!cancelled && !manualRef.current) setTab(chosen);
    }
    resolveDefault();
    return () => { cancelled = true; };
  }, []);

  const pick = (id: LiveTab) => { manualRef.current = true; setTab(id); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Sub-tab nav */}
      <div className="glass" style={{ padding: '8px 12px' }}>
        <div className="tab-bar" style={{ overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn tab-btn--scroll${tab === t.id ? ' active' : ''}`}
              onClick={() => pick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === null && (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Finding the next session…</div>
      )}
      {tab === 'sprint-qual' && <LiveQualView kind="Sprint Shootout" />}
      {tab === 'sprint'      && <LiveRaceView kind="Sprint" />}
      {tab === 'qualifying'  && <LiveQualView kind="Qualifying" />}
      {tab === 'race'        && <LiveRaceView kind="Race" />}
    </div>
  );
}
