export default function HomePage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">F1 Dash</h1>
      <p className="text-gray-300 mb-6">Live Formula 1 Timing & Telemetry Dashboard</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold text-lg mb-2">Calendar</h2>
          <p>View race weekends with timezone conversions</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold text-lg mb-2">Live Timing</h2>
          <p>Track live race data during sessions</p>
        </div>
      </div>
    </div>
  );
}
