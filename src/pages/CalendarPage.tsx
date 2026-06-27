import { useState, useEffect } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';
import { commonTimezones } from '../utils/timezone';

interface Session { date: string; time?: string; }

interface RaceData {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit?: {
    circuitName: string;
    Location?: { locality: string; country: string };
  };
  FirstPractice?: Session;
  SecondPractice?: Session;
  ThirdPractice?: Session;
  SprintQualifying?: Session;
  SprintShootout?: Session;
  Sprint?: Session;
  Qualifying?: Session;
}

// "Fri 13:30" in the chosen timezone, 24h
function fmtSession(s: Session | undefined, tz: string): string {
  if (!s?.date) return '—';
  const iso = s.time ? `${s.date}T${s.time}` : `${s.date}T00:00:00Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const wd = parts.find(p => p.type === 'weekday')?.value ?? '';
    const hh = parts.find(p => p.type === 'hour')?.value ?? '';
    const mm = parts.find(p => p.type === 'minute')?.value ?? '';
    return s.time ? `${wd} ${hh}:${mm}` : wd;
  } catch {
    return '—';
  }
}

// "27–29 Jun" or "30 May – 1 Jun"
function weekendRange(race: RaceData): string {
  const startStr = race.FirstPractice?.date ?? race.date;
  const endStr = race.date;
  const s = new Date(`${startStr}T00:00:00Z`);
  const e = new Date(`${endStr}T00:00:00Z`);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return endStr;
  const mon = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' }).format(d);
  const day = (d: Date) => d.getUTCDate();
  return mon(s) === mon(e) ? `${day(s)}–${day(e)} ${mon(e)}` : `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)}`;
}

export default function CalendarPage() {
  const [races, setRaces] = useState<RaceData[]>([]);
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
        if (list?.length) setRaces(list);
        else setError('No race data returned. The Jolpica API may be temporarily unavailable.');
      } catch {
        setError('Failed to fetch calendar. Check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentYear]);

  const raceDate = (r: RaceData) => new Date(`${r.date}T${r.time ?? '00:00:00Z'}`);
  const nextRace = races.find(r => raceDate(r) > today);
  const anySprint = races.some(r => r.Sprint);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* header */}
      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>F1 Calendar {currentYear}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{races.length} race weekends</div>
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

      {/* next race */}
      {nextRace && (
        <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em' }}>NEXT RACE</span>
          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Round {nextRace.round} · {nextRace.raceName}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c084fc', marginLeft: 'auto' }}>
            Lights out {fmtSession({ date: nextRace.date, time: nextRace.time }, timezone)}
          </span>
        </div>
      )}

      {loading && <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading calendar…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && races.length > 0 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#334155' }}>
            All times shown in {timezone} (24h)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="timing-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>Rnd</th>
                  <th style={{ minWidth: 150, textAlign: 'left' }}>Grand Prix</th>
                  <th style={{ minWidth: 140, textAlign: 'left' }}>Circuit</th>
                  <th style={{ textAlign: 'left' }}>Weekend</th>
                  <th>FP1</th>
                  <th>FP2</th>
                  <th>FP3</th>
                  {anySprint && <th>Sprint</th>}
                  <th>Quali</th>
                  <th>Race</th>
                </tr>
              </thead>
              <tbody>
                {races.map(race => {
                  const isPast = raceDate(race) < today;
                  const isNext = race.round === nextRace?.round;
                  const sessionCell = (s: Session | undefined) => (
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1' }}>
                        {fmtSession(s, timezone)}
                      </span>
                    </td>
                  );
                  return (
                    <tr
                      key={race.round}
                      className="timing-row"
                      style={{
                        opacity: isPast ? 0.5 : 1,
                        background: isNext ? 'rgba(168,85,247,0.08)' : undefined,
                        borderLeft: isNext ? '2px solid #a855f7' : '2px solid transparent',
                      }}
                    >
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontFamily: 'monospace', color: isNext ? '#c084fc' : '#475569', fontWeight: isNext ? 700 : 400 }}>{race.round}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: 13 }}>{race.raceName}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 500 }}>{race.Circuit?.circuitName ?? '—'}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{weekendRange(race)}</span>
                      </td>
                      {sessionCell(race.FirstPractice)}
                      {sessionCell(race.SecondPractice)}
                      {sessionCell(race.ThirdPractice)}
                      {anySprint && sessionCell(race.Sprint)}
                      {sessionCell(race.Qualifying)}
                      {sessionCell({ date: race.date, time: race.time })}
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
