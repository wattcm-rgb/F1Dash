import { Link } from 'react-router-dom';
import practiceIcon from '../icons/practice_icon.png';
import qualifyingIcon from '../icons/qualifying_icon.png';
import raceIcon from '../icons/race_icon.png';
import calendarIcon from '../icons/calendar_icon.png';

const CARDS = [
  { to: '/calendar',   icon: calendarIcon,   title: 'Calendar',   desc: 'Season schedule', sub: 'Timezones · Session times' },
  { to: '/practice',   icon: practiceIcon,   title: 'Practice',   desc: 'Live timing data', sub: 'Driver times · Tyre strategies' },
  { to: '/qualifying', icon: qualifyingIcon, title: 'Qualifying', desc: 'Q1 · Q2 · Q3 sessions', sub: 'Sector times · Eliminations' },
  { to: '/race',       icon: raceIcon,       title: 'Race',       desc: 'Live race tracking', sub: 'Gaps · Pit stops · Battles' },
];

const FEATURES = [
  'Real-time timing from self-hosted OpenF1',
  'Sector times colour-coded (yellow / green / purple)',
  'Pit stops and tyre strategy monitoring',
  'Driver battle analysis with pace comparison',
  'Weather data for every circuit',
  'Fully responsive — desktop and mobile',
];

export default function HomePage() {
  const year = new Date().getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* hero */}
      <div className="glass" style={{ padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(6,182,212,0.08), rgba(168,85,247,0.08) 50%, rgba(239,68,68,0.06))', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <h1 className="f1-heading" style={{ fontSize: 40, margin: 0, lineHeight: 1.05, background: 'linear-gradient(90deg, #22d3ee, #a855f7, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            F1 Dashboard
          </h1>
          <p style={{ fontSize: 15, color: '#cbd5e1', margin: '10px 0 4px' }}>Live Formula 1 timing &amp; telemetry</p>
          <p style={{ fontSize: 12, color: '#475569', margin: 0, letterSpacing: '0.03em' }}>
            Real-time data · Lap timing · Pit stops · Tyre strategies · Weather
          </p>
        </div>
      </div>

      {/* 4-card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {CARDS.map(card => (
          <Link key={card.to} to={card.to} style={{ textDecoration: 'none' }}>
            <div className="glass home-card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', gap: 4, transition: 'transform 0.15s, border-color 0.15s' }}>
              <img src={card.icon} alt="" className="home-card-icon" style={{ width: 56, height: 56, marginBottom: 12 }} />
              <h2 className="f1-heading" style={{ fontSize: 18, margin: 0, color: '#f1f5f9' }}>{card.title}</h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{card.desc}</p>
              <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>{card.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* two-column: features + getting started */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="glass" style={{ padding: 20 }}>
          <h2 className="f1-heading" style={{ fontSize: 16, margin: '0 0 14px', color: '#f1f5f9' }}>Features</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {FEATURES.map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#cbd5e1' }}>
                <span style={{ color: '#a855f7', flexShrink: 0, marginTop: 1 }}>▸</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <h2 className="f1-heading" style={{ fontSize: 16, margin: '0 0 14px', color: '#f1f5f9' }}>Getting Started</h2>
          <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 12px' }}>
            This dashboard connects to a self-hosted OpenF1 instance on a dedicated VPS. During F1 sessions, live timing data is captured and displayed in real time.
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
            Check the{' '}
            <Link to="/calendar" style={{ color: '#c084fc', textDecoration: 'none', fontWeight: 600 }}>Calendar</Link>
            {' '}for the {year} season, then tune in during a session for live data.
          </p>
        </div>
      </div>
    </div>
  );
}
