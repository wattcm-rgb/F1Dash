import { Link } from 'react-router-dom';
import type { JSX } from 'react';
import { LiveIcon, PodiumIcon, SprintIcon, SprintQualIcon, NewsIcon } from '../components/NavIcons';
import qualifyingIcon from '../icons/qualifying_icon.png';
import raceIcon from '../icons/race_icon.png';
import calendarIcon from '../icons/calendar_icon.png';

interface CardDef {
  to: string;
  title: string;
  desc: string;
  sub: string;
  img?: string;                                   // PNG icon
  Icon?: (p: { size: number; active: boolean }) => JSX.Element; // SVG icon
  iconColor?: string;                             // wrapper colour for SVG icons
}

// Row 1: Live, Qualifying, Race, Calendar
// Row 2: Standings, Sprint Qual, Sprint, News
const CARDS: CardDef[] = [
  { to: '/live',              Icon: LiveIcon,       iconColor: '#ef4444', title: 'Live',        desc: 'Real-time session data', sub: 'Sprint Qual · Sprint · Quali · Race' },
  { to: '/qualifying',        img: qualifyingIcon,  title: 'Qualifying',  desc: 'Q1 · Q2 · Q3 sessions',  sub: 'Sector times · Eliminations' },
  { to: '/race',              img: raceIcon,        title: 'Race',        desc: 'Race results',           sub: 'Positions · Times · Points' },
  { to: '/calendar',          img: calendarIcon,    title: 'Calendar',    desc: 'Season schedule',        sub: 'Timezones · Session times' },
  { to: '/standings',         Icon: PodiumIcon,     iconColor: '#c084fc', title: 'Standings',   desc: 'Championship tables',    sub: 'Drivers · Constructors' },
  { to: '/sprint-qualifying', Icon: SprintQualIcon, iconColor: '#c084fc', title: 'Sprint Qual', desc: 'Sprint shootout',        sub: 'SQ1 · SQ2 · SQ3 segments' },
  { to: '/sprint',            Icon: SprintIcon,     iconColor: '#c084fc', title: 'Sprint',      desc: 'Sprint race results',    sub: 'Positions · Tyres · Pace' },
  { to: '/news',              Icon: NewsIcon,       iconColor: '#c084fc', title: 'News',        desc: 'Latest F1 headlines',    sub: 'Stories · Updates' },
];

export default function HomePage() {
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

      {/* card grid — 4 columns, two rows on wide screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {CARDS.map(card => (
          <Link key={card.to} to={card.to} style={{ textDecoration: 'none' }}>
            <div className="glass home-card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', gap: 4, transition: 'transform 0.15s, border-color 0.15s' }}>
              {card.img ? (
                <img src={card.img} alt="" className="home-card-icon" style={{ width: 96, height: 96, marginBottom: 14 }} />
              ) : card.Icon ? (
                <div style={{ width: 96, height: 96, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.iconColor ?? '#c084fc' }}>
                  <card.Icon size={56} active />
                </div>
              ) : null}
              <h2 className="f1-heading" style={{ fontSize: 18, margin: 0, color: '#f1f5f9' }}>{card.title}</h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{card.desc}</p>
              <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>{card.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
