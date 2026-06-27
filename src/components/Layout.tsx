import { Outlet, Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/practice',   label: 'Practice',   icon: '⏱' },
  { to: '/qualifying', label: 'Qualifying',  icon: '⚡' },
  { to: '/race',       label: 'Race',        icon: '🏁' },
  { to: '/calendar',   label: 'Calendar',    icon: '📅' },
];

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── sidebar ── */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        background: 'rgba(5,5,20,0.82)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* logo */}
        <div style={{ padding: '0 20px 24px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', background: 'linear-gradient(90deg, #06b6d4, #a855f7, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              F1 Dash
            </div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
              Live Timing Dashboard
            </div>
          </Link>
        </div>

        {/* live indicator */}
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em' }}>LIVE</span>
          </div>
        </div>

        {/* nav links */}
        <nav style={{ padding: '0 8px', flex: 1 }}>
          {NAV.map(({ to, label, icon }) => {
            const active = pathname === to || pathname.startsWith(to);
            return (
              <Link key={to} to={to} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 7,
                  background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                  borderLeft: active ? '2px solid #a855f7' : '2px solid transparent',
                  color: active ? '#fff' : '#64748b',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* footer */}
        <div style={{ padding: '16px 20px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 'auto' }}>
          <div style={{ fontSize: 10, color: '#334155' }}>Self-hosted OpenF1</div>
          <div style={{ fontSize: 10, color: '#1e293b', marginTop: 2 }}>167.233.76.227:8000</div>
        </div>
      </aside>

      {/* ── main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* top bar */}
        <header style={{
          background: 'rgba(5,5,20,0.82)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 20px',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 24,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* weather placeholder — pages inject weather via context if needed */}
          <WeatherBar />
        </header>

        {/* page content */}
        <main style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function WeatherBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 12, color: '#94a3b8' }}>
      <WeatherItem icon="🌡" label="Air" value="—°C" />
      <WeatherItem icon="🔥" label="Track" value="—°C" />
      <WeatherItem icon="💧" label="Humidity" value="—%" />
      <WeatherItem icon="🌬" label="Wind" value="— km/h" />
    </div>
  );
}

function WeatherItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: '#475569', lineHeight: 1 }}>{label}</div>
        <div style={{ fontWeight: 600, color: '#cbd5e1', lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}
