import { Outlet, Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/practice', label: 'Practice' },
  { to: '/qualifying', label: 'Qualifying' },
  { to: '/race', label: 'Race' },
];

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col min-h-screen text-white">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-md" style={{ backgroundColor: 'rgba(5,5,20,0.75)' }}>
        <nav className="max-w-7xl mx-auto flex items-center gap-1 px-4 h-14">
          <Link to="/" className="text-lg font-bold mr-4" style={{ background: 'linear-gradient(90deg, #06b6d4, #a855f7, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            F1 Dash
          </Link>
          {NAV_LINKS.map(({ to, label }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={[
                  'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* page content — semi-transparent dark panel so text is readable over bg */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(5,5,20,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
