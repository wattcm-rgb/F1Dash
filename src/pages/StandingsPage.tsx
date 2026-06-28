import { useState, useEffect, Fragment } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';

type Tab = 'drivers' | 'constructors';

interface DriverStanding {
  position: number;
  code: string;
  driverId: string;
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

interface RaceResult { round: number; race: string; pos: string; points: number; }

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);
const LAST_5 = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function StandingsPage() {
  const [tab, setTab] = useState<Tab>('drivers');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState('');

  // expandable per-driver season results
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resultsCache, setResultsCache] = useState<Record<string, RaceResult[]>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null); setDrivers([]); setConstructors([]);
    setExpanded(null); setResultsCache({});

    async function load() {
      try {
        if (tab === 'drivers') {
          const data = await jolpicaApi.getDriverStandings(year);
          const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
          if (!list?.DriverStandings?.length) { setError('No driver standings available for this season.'); setLoading(false); return; }
          setRound(list.round ?? '');
          setDrivers(list.DriverStandings.map((s: {
            position: string; points: string; wins: string;
            Driver?: { code?: string; driverId?: string; givenName?: string; familyName?: string };
            Constructors?: { name?: string }[];
          }) => ({
            position: Number(s.position),
            code: s.Driver?.code ?? (s.Driver?.driverId ?? '???').toUpperCase().slice(0, 3),
            driverId: s.Driver?.driverId ?? '',
            name: `${s.Driver?.givenName ?? ''} ${s.Driver?.familyName ?? ''}`.trim(),
            team: s.Constructors?.[0]?.name ?? '—',
            points: Number(s.points),
            wins: Number(s.wins),
          })));
        } else {
          const data = await jolpicaApi.getConstructorStandings(year);
          const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
          if (!list?.ConstructorStandings?.length) { setError('No constructor standings available for this season.'); setLoading(false); return; }
          setRound(list.round ?? '');
          setConstructors(list.ConstructorStandings.map((s: {
            position: string; points: string; wins: string; Constructor?: { name?: string };
          }) => ({ position: Number(s.position), name: s.Constructor?.name ?? '—', points: Number(s.points), wins: Number(s.wins) })));
        }
      } catch { setError('Failed to load standings.'); }
      finally { setLoading(false); }
    }
    load();
  }, [year, tab]);

  async function toggleDriver(driverId: string) {
    if (expanded === driverId) { setExpanded(null); return; }
    setExpanded(driverId);
    if (resultsCache[driverId]) return;
    setResultsLoading(true);
    try {
      const data = await jolpicaApi.getDriverSeasonResults(year, driverId);
      const races = data?.MRData?.RaceTable?.Races ?? [];
      const mapped: RaceResult[] = races.map((r: {
        round: string; raceName: string; Results?: { position?: string; points?: string }[];
      }) => ({
        round: Number(r.round),
        race: r.raceName.replace(' Grand Prix', ''),
        pos: r.Results?.[0]?.position ?? '—',
        points: Number(r.Results?.[0]?.points ?? 0),
      }));
      setResultsCache(prev => ({ ...prev, [driverId]: mapped }));
    } catch { setResultsCache(prev => ({ ...prev, [driverId]: [] })); }
    finally { setResultsLoading(false); }
  }

  const driverLeader = drivers[0];
  const constructorLeader = constructors[0];
  const leader = tab === 'drivers' ? driverLeader : constructorLeader;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* prominent year filter above the header */}
      <div className="filter-bar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LAST_5.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: year === y ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(255,255,255,0.1)',
                background: year === y ? 'rgba(168,85,247,0.18)' : 'rgba(0,0,0,0.4)',
                color: year === y ? '#c084fc' : '#94a3b8',
              }}
            >
              {y}
            </button>
          ))}
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="glass" style={{ padding: '12px 16px' }}>
        <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>Championship Standings</div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{year} Season{round ? ` · After Round ${round}` : ''}</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['drivers', 'constructors'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', cursor: 'pointer',
            border: tab === t ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.06)',
            background: tab === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
            color: tab === t ? '#c084fc' : '#475569',
          }}>
            {t === 'drivers' ? 'Drivers' : 'Constructors'}
          </button>
        ))}
      </div>

      {leader && (
        <div style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#facc15', letterSpacing: '0.1em' }}>LEADER</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#fff' }}>{tab === 'drivers' ? driverLeader!.code : constructorLeader!.name}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {leader.points} pts{leader.wins > 0 ? ` · ${leader.wins} win${leader.wins !== 1 ? 's' : ''}` : ''}{tab === 'drivers' && ` · ${driverLeader!.team}`}
          </span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading standings…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {/* DRIVERS — compact, left-aligned, mobile-fit, expandable */}
      {!loading && !error && tab === 'drivers' && drivers.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="timing-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 26, textAlign: 'left' }}>P</th>
                <th style={{ width: 52, textAlign: 'left' }}>Drv</th>
                <th style={{ textAlign: 'left' }}>Team</th>
                <th style={{ width: 30, textAlign: 'left' }}>W</th>
                <th style={{ width: 42, textAlign: 'left' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <Fragment key={d.driverId || d.position}>
                  <tr
                    className={`timing-row${i === 0 ? ' p1' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleDriver(d.driverId)}
                  >
                    <td style={{ textAlign: 'left' }}><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{d.position}</span></td>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{d.code}</span>
                      <span style={{ color: expanded === d.driverId ? '#c084fc' : '#334155', fontSize: 9, marginLeft: 4 }}>{expanded === d.driverId ? '▾' : '▸'}</span>
                    </td>
                    <td style={{ textAlign: 'left', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{d.team}</span>
                    </td>
                    <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{d.wins > 0 ? d.wins : '—'}</span></td>
                    <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? '#facc15' : '#cbd5e1' }}>{d.points}</span></td>
                  </tr>
                  {expanded === d.driverId && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: 'rgba(0,0,0,0.25)' }}>
                        {resultsLoading && !resultsCache[d.driverId]
                          ? <div style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>Loading {d.code}'s season…</div>
                          : (resultsCache[d.driverId]?.length
                            ? (
                              <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {resultsCache[d.driverId].map(r => {
                                  const p = Number(r.pos);
                                  const col = p === 1 ? '#facc15' : p <= 3 ? '#fb923c' : p <= 10 ? '#94a3b8' : '#475569';
                                  return (
                                    <div key={r.round} title={`${r.race}: P${r.pos} (${r.points} pts)`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: '4px 6px' }}>
                                      <span style={{ fontSize: 9, color: '#475569' }}>{r.race.slice(0, 3).toUpperCase()}</span>
                                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: col }}>{isNaN(p) ? '—' : `P${p}`}</span>
                                      <span style={{ fontSize: 9, color: '#334155' }}>{r.points}pt</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                            : <div style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>No race results found.</div>)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONSTRUCTORS — left-aligned, compact */}
      {!loading && !error && tab === 'constructors' && constructors.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="timing-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 26, textAlign: 'left' }}>P</th>
                <th style={{ textAlign: 'left' }}>Constructor</th>
                <th style={{ width: 30, textAlign: 'left' }}>W</th>
                <th style={{ width: 42, textAlign: 'left' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {constructors.map((c, i) => (
                <tr key={c.position} className={`timing-row${i === 0 ? ' p1' : ''}`}>
                  <td style={{ textAlign: 'left' }}><span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{c.position}</span></td>
                  <td style={{ textAlign: 'left' }}><span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{c.name}</span></td>
                  <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{c.wins > 0 ? c.wins : '—'}</span></td>
                  <td style={{ textAlign: 'left' }}><span style={{ fontFamily: 'monospace', fontSize: i === 0 ? 13 : 12, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? '#facc15' : '#cbd5e1' }}>{c.points}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
