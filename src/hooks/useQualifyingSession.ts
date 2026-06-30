import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { openf1Api } from '../services/openf1Api';
import type { OpenF1Session, OpenF1Driver } from '../types/openf1';
import { isLiveSession } from '../types/openf1';
import type { QualLap, Segment } from '../components/qualifying/types';
import { detectSegments } from '../components/qualifying/derive';

interface Options {
  year: number;
  // Used to filter getLatestSession results by session_name (e.g. 'Qualifying', 'Sprint Shootout').
  sessionNameFilter: string;
  // Fetches the list of sessions for the year selector (historical mode).
  fetchSessions: (year: number) => Promise<OpenF1Session[]>;
}

export interface UseQualifyingSessionResult {
  // Live detection
  liveSession: OpenF1Session | null;
  isLive: boolean;
  detecting: boolean;
  // Session list (historical mode)
  sessions: OpenF1Session[];
  selectedSessionKey: number | null;
  setSelectedSessionKey: (key: number) => void;
  sessionsLoading: boolean;
  // Lap + driver data
  drivers: OpenF1Driver[];
  laps: QualLap[];
  dataLoading: boolean;
  dataError: string | null;
  // Segments
  q1Laps: QualLap[];
  q2Laps: QualLap[];
  q3Laps: QualLap[];
  segment: Segment;
  setSegment: (s: Segment) => void;
  segmentLaps: QualLap[];
  selectedSession: OpenF1Session | undefined;
}

export function useQualifyingSession({ year, sessionNameFilter, fetchSessions }: Options): UseQualifyingSessionResult {
  // ── Live detection ─────────────────────────────────────────────────────────
  const [liveSession, setLiveSession] = useState<OpenF1Session | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [detecting, setDetecting] = useState(true);

  const detectSession = useCallback(async () => {
    try {
      // getLatestSession uses session_type; pass session_name as the nameFilter.
      // For standard qualifying: type='Qualifying', nameFilter='Qualifying'
      // For sprint qualifying: type='Qualifying', nameFilter='Sprint Shootout'
      const apiType = sessionNameFilter === 'Sprint' ? 'Race' : 'Qualifying';
      const s = await openf1Api.getLatestSession(apiType, sessionNameFilter);
      setLiveSession(s);
      setIsLive(s ? isLiveSession(s) : false);
    } catch { /* non-fatal — API may be temporarily down */ }
    finally { setDetecting(false); }
  }, [sessionNameFilter]);

  useEffect(() => {
    detectSession();
    const t = window.setInterval(detectSession, 30_000);
    return () => clearInterval(t);
  }, [detectSession]);

  // ── Session list ───────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<OpenF1Session[]>([]);
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    setSessions([]); setSelectedSessionKey(null); setSessionsLoading(true);
    fetchSessions(year)
      .then((raw: OpenF1Session[]) => {
        const sorted = [...raw].sort(
          (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
        );
        setSessions(sorted);
        if (isLive && liveSession && liveSession.year === year) {
          setSelectedSessionKey(liveSession.session_key);
        } else if (sorted.length) {
          setSelectedSessionKey(sorted[sorted.length - 1].session_key);
        }
      })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, [year, fetchSessions, isLive, liveSession]);

  // ── Lap + driver data ──────────────────────────────────────────────────────
  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [laps, setLaps] = useState<QualLap[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadSession = useCallback(async (key: number) => {
    setDataError(null);
    try {
      const [rawLaps, rawDrivers] = await Promise.all([
        openf1Api.getLaps(key),
        openf1Api.getDriversBySession(key),
      ]);
      const mappedLaps: QualLap[] = (rawLaps as Record<string, unknown>[]).map(l => ({
        driver_number: l.driver_number as number,
        lap_number: l.lap_number as number,
        lap_duration: l.lap_duration as number | null,
        sector_1: l.duration_sector_1 as number | null,
        sector_2: l.duration_sector_2 as number | null,
        sector_3: l.duration_sector_3 as number | null,
        is_pit_out_lap: l.is_pit_out_lap as boolean,
        date_start: l.date_start as string,
      }));
      setLaps(mappedLaps);
      if ((rawDrivers as OpenF1Driver[]).length) setDrivers(rawDrivers as OpenF1Driver[]);
    } catch {
      setDataError('Failed to load qualifying data.');
    }
  }, []);

  useEffect(() => {
    if (!selectedSessionKey) { setLaps([]); setDrivers([]); return; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setDataLoading(true);
    loadSession(selectedSessionKey).finally(() => setDataLoading(false));
    if (isLive && liveSession?.session_key === selectedSessionKey) {
      pollRef.current = window.setInterval(() => loadSession(selectedSessionKey), 4_000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [selectedSessionKey, isLive, liveSession, loadSession]);

  // ── Segment detection ──────────────────────────────────────────────────────
  const [q1Laps, q2Laps, q3Laps] = useMemo(() => detectSegments(laps), [laps]);
  const [segment, setSegment] = useState<Segment>('Q3');

  useEffect(() => {
    if (q3Laps.length) setSegment('Q3');
    else if (q2Laps.length) setSegment('Q2');
    else setSegment('Q1');
  }, [q3Laps.length, q2Laps.length]);

  const segmentLaps = segment === 'Q1' ? q1Laps : segment === 'Q2' ? q2Laps : q3Laps;
  const selectedSession = sessions.find(s => s.session_key === selectedSessionKey);

  return {
    liveSession, isLive, detecting,
    sessions, selectedSessionKey, setSelectedSessionKey, sessionsLoading,
    drivers, laps, dataLoading, dataError,
    q1Laps, q2Laps, q3Laps, segment, setSegment, segmentLaps,
    selectedSession,
  };
}
