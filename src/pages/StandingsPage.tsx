import { useState, useEffect } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';

type Tab = 'drivers' | 'constructors';

interface DriverStanding {
  position: number;
  code: string;
  name: string;
  team: string;
  points: number;
  wins: number;
}

interface ConstructorStanding {
  position: number;
  name: string;
  points: number;
  wins: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);

export default function StandingsPage() {
  const [tab, setTab] = useState<Tab>('drivers');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrivers([]);
    setConstructors([]);

    async function load() {
      try {
        if (tab === 'drivers') {
          const data = await jolpicaApi.getDriverStandings(year);
          const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
          if (!list?.DriverStandings?.length) {
            setError('No driver standings available for this season.');
            setLoading(false);
            return;
          }
          setRound(list.round ?? '');
          setDrivers(list.DriverStandings.map((s: {
            position: string; points: string; wins: string;
            Driver?: { code?: string; driverId?: string; givenName?: string; familyName?: string };
            Constructors?: { name?: string }[];
          }) => ({
            position: Number(s.position),
            code: s.Driver?.code ?? (s.Driver?.driverId ?? '???').toUpperCase().slice(0, 3),
            name: `${s.Driver?.givenName ?? ''} ${s.Driver?.familyName ?? ''}`.trim(),
            team: s.Constructors?.[0]?.name ?? '—',
            points: Number(s.points),
            wins: Number(s.wins),
          })));
        } else {
          const data = await jolpicaApi.getConstructorStandings(year);
          const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
          if (!list?.ConstructorStandings?.length) {
            setError('No constructor standings available for this season.');
            setLoading(false);
            return;
          }
          setRound(list.round ?? '');
          setConstructors(list.ConstructorStandings.map((s: {
            position: string; points: string; wins: string;
            Constructor?: { name?: string };
          }) => ({
            position: Number(s.position),
            name: s.Constructor?.name ?? '—',
            points: Number(s.points),
            wins: Number(s.wins),
          })));
        }
      } catch {
        setError('Failed to load standings.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, tab]);

  const driverLeader = drivers[0];
  const constructorLeader = constructors[0];
  const leader = tab === 'drivers' ? driverLeader : constructorLeader;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>Championship Standings</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {year} Season{round ? ` · After Round ${round}` : ''}
          </div>
        </div>
        <select
          value={year}
          onChange={e => { setYear(Number(e.target.value)); }}
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['drivers', 'constructors'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 7,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              border: tab === t ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.06)',
              background: tab === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
              color: tab === t ? '#c084fc' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {t === 'drivers' ? 'Drivers' : 'Constructors'}
          </button>
        ))}
      </div>

      {leader && (
        <div style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#facc15', letterSpacing: '0.1em' }}>LEADER</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>
            {tab === 'drivers' ? driverLeader!.code : constructorLeader!.name}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {leader.points} pts{leader.wins > 0 ? ` · ${leader.wins} win${leader.wins !== 1 ? 's' : ''}` : ''}
            {tab === 'drivers' && ` · ${driverLeader!.team}`}
          </span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading standings…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && tab === 'drivers' && drivers.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>DRIVERS CHAMPIONSHIP</span>
            <span style={{ fontSize: 11, color: '#334155' }}>{drivers.length} drivers</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Pos</th>
                  <th style={{ minWidth: 130 }}>Driver</th>
                  <th>Team</th>
                  <th style={{ width: 50 }}>Wins</th>
                  <th style={{ width: 60 }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <tr key={d.position} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                    <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{d.position}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{d.code}</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>{d.name}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 11, color: '#64748b' }}>{d.team}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{d.wins > 0 ? d.wins : '—'}</span></td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#facc15' : '#94a3b8' }}>
                        {d.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'constructors' && constructors.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>CONSTRUCTORS CHAMPIONSHIP</span>
            <span style={{ fontSize: 11, color: '#334155' }}>{constructors.length} teams</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>Pos</th>
                  <th>Constructor</th>
                  <th style={{ width: 50 }}>Wins</th>
                  <th style={{ width: 60 }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {constructors.map((c, i) => (
                  <tr key={c.position} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                    <td><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{c.position}</span></td>
                    <td><span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{c.name}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{c.wins > 0 ? c.wins : '—'}</span></td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#facc15' : '#94a3b8' }}>
                        {c.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
