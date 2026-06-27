import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900 border-b border-slate-800 p-4">
        <nav className="max-w-7xl mx-auto flex gap-6">
          <Link to="/" className="text-xl font-bold text-red-500">F1 Dash</Link>
          <Link to="/calendar" className="hover:text-red-400">Calendar</Link>
          <Link to="/practice" className="hover:text-red-400">Practice</Link>
          <Link to="/qualifying" className="hover:text-red-400">Qualifying</Link>
          <Link to="/race" className="hover:text-red-400">Race</Link>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <Outlet />
      </main>
    </div>
  );
}
