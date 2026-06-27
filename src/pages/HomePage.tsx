import { Link } from 'react-router-dom';

export default function HomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-5xl font-bold mb-2 text-red-500">F1 Dash</h1>
        <p className="text-gray-300 text-lg">Live Formula 1 Timing & Telemetry Dashboard</p>
        <p className="text-gray-500 text-sm mt-2">Real-time race data • Lap timing • Pit stops • Tyre strategies • Weather</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link to="/calendar">
          <div className="bg-slate-800 p-6 rounded hover:bg-slate-700 transition cursor-pointer h-full">
            <h2 className="font-bold text-lg mb-2 text-yellow-400">📅 Calendar</h2>
            <p className="text-gray-300">Race weekends for {currentYear}</p>
            <p className="text-gray-500 text-sm mt-3">Timezone conversions • Session times</p>
          </div>
        </Link>

        <Link to="/practice">
          <div className="bg-slate-800 p-6 rounded hover:bg-slate-700 transition cursor-pointer h-full">
            <h2 className="font-bold text-lg mb-2 text-blue-400">🏁 Practice</h2>
            <p className="text-gray-300">Live timing data</p>
            <p className="text-gray-500 text-sm mt-3">Driver times • Tyre strategies</p>
          </div>
        </Link>

        <Link to="/qualifying">
          <div className="bg-slate-800 p-6 rounded hover:bg-slate-700 transition cursor-pointer h-full">
            <h2 className="font-bold text-lg mb-2 text-purple-400">⚡ Qualifying</h2>
            <p className="text-gray-300">Q1, Q2, Q3 sessions</p>
            <p className="text-gray-500 text-sm mt-3">Sector times • Eliminations • Leaderboard</p>
          </div>
        </Link>

        <Link to="/race">
          <div className="bg-slate-800 p-6 rounded hover:bg-slate-700 transition cursor-pointer h-full">
            <h2 className="font-bold text-lg mb-2 text-red-400">🏆 Race</h2>
            <p className="text-gray-300">Live race tracking</p>
            <p className="text-gray-500 text-sm mt-3">Positions • Gaps • Pit stops • Weather</p>
          </div>
        </Link>
      </div>

      <div className="bg-slate-800 p-6 rounded mb-8">
        <h2 className="font-bold text-lg mb-3">✨ Features</h2>
        <ul className="text-gray-300 space-y-2 text-sm">
          <li>✅ Real-time timing updates from self-hosted OpenF1 API</li>
          <li>✅ Sector times with color coding (Yellow/Green/Purple)</li>
          <li>✅ Pit stop tracking and tyre strategy monitoring</li>
          <li>✅ Driver battle analysis with pace comparisons</li>
          <li>✅ Weather information for all F1 circuits</li>
          <li>✅ Fully responsive dark theme UI</li>
        </ul>
      </div>

      <div className="bg-slate-900 border border-slate-700 p-6 rounded">
        <h2 className="font-bold text-lg mb-3">🚀 Getting Started</h2>
        <p className="text-gray-300 mb-4">
          This dashboard connects to a self-hosted OpenF1 instance running on a dedicated VPS. During F1 sessions, live timing data is captured and displayed in real-time.
        </p>
        <p className="text-gray-400 text-sm">
          Start by checking the <Link to="/calendar" className="text-yellow-400 hover:text-yellow-300">Calendar</Link> to see upcoming races, then tune in during sessions to see live data!
        </p>
      </div>
    </div>
  );
}
