import { useState, useEffect } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';
import { formatTimeInTimezone, commonTimezones } from '../utils/timezone';

interface Race {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  circuit?: {
    circuitName: string;
    location?: { country: string; locality: string; };
  };
}

export default function CalendarPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('Europe/London');
  const currentYear = new Date().getFullYear();
  const today = new Date();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await jolpicaApi.getRaces(currentYear);
        const list = data?.MRData?.RaceTable?.Races;
        if (list?.length) {
          setRaces(list);
        } else {
          setError('No race data returned. The Jolpica API may be temporarily unavailable.');
        }
      } catch {
        setError('Failed to fetch calendar. Check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentYear]);

  function raceDate(race: Race): Date {
    return new Date(`${race.date}T${race.time ?? '00:00:00'}`);
  }

  function formatRaceTime(race: Race): string {
    if (!race.time) return race.date;
    return formatTimeInTimezone(`${race.date}T${race.time}`, timezone);
  }

  const nextRace = races.find(r => raceDate(r) > today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>F1 Calendar {currentYear}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{races.length} races scheduled</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Timezone</span>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
          >
            {commonTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      {/* next race banner */}
      {nextRace && (
        <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>NEXT RACE</span>
          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Round {nextRace.round} · {nextRace.raceName}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{nextRace.circuit?.location?.locality ?? ''}{nextRace.circuit?.location?.country ? `, ${nextRace.circuit.location.country}` : ''}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c084fc', marginLeft: 'auto' }}>{formatRaceTime(nextRace)}</span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading calendar…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && races.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Rnd</th>
                  <th style={{ minWidth: 180, textAlign: 'left' }}>Race</th>
                  <th style={{ textAlign: 'left' }}>Circuit</th>
                  <th style={{ textAlign: 'left' }}>Country</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                  <th style={{ textAlign: 'right' }}>Race Time ({timezone})</th>
                </tr>
              </thead>
              <tbody>
                {races.map(race => {
                  const isPast = raceDate(race) < today;
                  const isNext = race.round === nextRace?.round;
                  return (
                    <tr
                      key={race.round}
                      className="timing-row"
                      style={{
                        opacity: isPast ? 0.45 : 1,
                        background: isNext ? 'rgba(168,85,247,0.08)' : undefined,
                        borderLeft: isNext ? '2px solid #a855f7' : '2px solid transparent',
                      }}
                    >
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontFamily: 'monospace', color: isNext ? '#c084fc' : '#475569', fontWeight: isNext ? 700 : 400 }}>
                          {race.round}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontWeight: 600, color: isNext ? '#f1f5f9' : isPast ? '#64748b' : '#cbd5e1', fontSize: 13 }}>
                          {race.raceName}
                        </span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 12, color: '#475569' }}>{race.circuit?.circuitName ?? '—'}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 12, color: '#475569' }}>{race.circuit?.location?.country ?? '—'}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{race.date}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: isNext ? '#c084fc' : isPast ? '#334155' : '#94a3b8' }}>
                          {formatRaceTime(race)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
