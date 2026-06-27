import { Outlet, Link, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import practiceIcon from '../icons/practice_icon.png';
import qualifyingIcon from '../icons/qualifying_icon.png';
import raceIcon from '../icons/race_icon.png';
import calendarIcon from '../icons/calendar_icon.png';

const NAV = [
  { to: '/practice',   label: 'Practice',   icon: practiceIcon },
  { to: '/qualifying', label: 'Qualifying', icon: qualifyingIcon },
  { to: '/race',       label: 'Race',       icon: raceIcon },
  { to: '/calendar',   label: 'Calendar',   icon: calendarIcon },
];

export default function Layout() {
  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || pathname.startsWith(to);

  return (
    <div className="app-shell">

      {/* ── desktop sidebar ── */}
      <aside className="sidebar">
        <div style={{ padding: '0 20px 24px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div className="f1-heading" style={{ fontSize: 18, background: 'linear-gradient(90deg, #06b6d4, #a855f7, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
              F1 Dashboard
            </div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 5 }}>
              Live Timing Dashboard
            </div>
          </Link>
        </div>

        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em' }}>LIVE</span>
          </div>
        </div>

        <nav style={{ padding: '0 8px', flex: 1 }}>
          {NAV.map(({ to, label, icon }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 12px', borderRadius: 7,
                  background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                  borderLeft: active ? '2px solid #a855f7' : '2px solid transparent',
                  color: active ? '#fff' : '#64748b',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  <img src={icon} alt="" style={{ width: 24, height: 24, opacity: active ? 1 : 0.75, filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 'auto' }}>
          <div style={{ fontSize: 10, color: '#334155' }}>Self-hosted OpenF1</div>
          <div style={{ fontSize: 10, color: '#1e293b', marginTop: 2 }}>167.233.76.227:8000</div>
        </div>
      </aside>

      {/* ── main area ── */}
      <div className="main-area">
        <main style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── mobile bottom nav ── */}
      <nav className="bottom-nav">
        {NAV.map(({ to, label, icon }) => (
          <Link key={to} to={to} className={`bottom-nav-item${isActive(to) ? ' active' : ''}`}>
            <img src={icon} alt="" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
