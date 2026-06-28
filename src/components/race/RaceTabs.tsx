import { useState } from 'react';
import type { OpenF1Session, OpenF1Driver, OpenF1Lap, OpenF1Stint } from '../../types/openf1';
import type { PitStop, PositionRow, Interval, RcMsg } from './types';
import { investigatedSet } from './derive';
import Leaderboard from './Leaderboard';
import RaceControlTab from './RaceControlTab';
import PitStopsTab from './PitStopsTab';
import BattleTab from './BattleTab';
import TrackMapTab from './TrackMapTab';
import TelemetryTab from './TelemetryTab';

type Tab = 'LEADERBOARD' | 'RACE CONTROL' | 'PIT STOPS' | 'BATTLE' | 'TRACK MAP' | 'TELEMETRY';
const TABS: Tab[] = ['LEADERBOARD', 'RACE CONTROL', 'PIT STOPS', 'BATTLE', 'TRACK MAP', 'TELEMETRY'];

interface Props {
  mode: 'live' | 'historical';
  session: OpenF1Session | null;
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
  stints: OpenF1Stint[];
  pitStops: PitStop[];
  positions: PositionRow[];
  intervals: Interval[];
  rcMsgs: RcMsg[];
  liveTrails?: Map<number, { x: number; y: number }[]>;
}

export default function RaceTabs(props: Props) {
  const { mode, session, drivers, laps, stints, pitStops, positions, intervals, rcMsgs, liveTrails } = props;
  const [tab, setTab] = useState<Tab>('LEADERBOARD');
  const investigated = investigatedSet(rcMsgs);

  return (
    <>
      <div className="glass" style={{ padding: '8px 12px' }}>
        <div className="tab-bar" style={{ overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t} className={`tab-btn tab-btn--scroll${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'LEADERBOARD' && (
        <Leaderboard mode={mode} drivers={drivers} laps={laps} stints={stints} pitStops={pitStops} positions={positions} intervals={intervals} investigated={investigated} />
      )}
      {tab === 'RACE CONTROL' && <RaceControlTab rcMsgs={rcMsgs} />}
      {tab === 'PIT STOPS' && <PitStopsTab drivers={drivers} stints={stints} pitStops={pitStops} positions={positions} laps={laps} />}
      {tab === 'BATTLE' && <BattleTab drivers={drivers} laps={laps} stints={stints} pitStops={pitStops} positions={positions} />}
      {tab === 'TRACK MAP' && <TrackMapTab session={session} rcMsgs={rcMsgs} liveTrails={liveTrails} drivers={drivers} />}
      {tab === 'TELEMETRY' && <TelemetryTab sessionKey={session?.session_key ?? null} drivers={drivers} laps={laps} positions={positions} />}
    </>
  );
}
