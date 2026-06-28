import { useEffect, useState } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session } from '../types/openf1';
import { isLiveSession } from '../types/openf1';

export interface LiveSessionState {
  session: OpenF1Session | null;
  isLive: boolean;
  loading: boolean;
}

// Polls OpenF1 for the single most-recent session and reports whether it is live
// right now (i.e. the current time falls inside its scheduled window — "cars on
// track"). Shared by the sidebar indicator and the Live page so both agree.
export function useLiveSession(pollMs = 30_000): LiveSessionState {
  const [state, setState] = useState<LiveSessionState>({ session: null, isLive: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await openf1Api.getCurrentSession();
      if (cancelled) return;
      setState({ session, isLive: session ? isLiveSession(session) : false, loading: false });
    }
    check();
    const id = window.setInterval(check, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [pollMs]);

  return state;
}
