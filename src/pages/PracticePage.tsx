export default function PracticePage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">Practice Session</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Live Timing</h2>
          <p className="text-gray-400">Driver times and positions</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Fastest Lap</h2>
          <p className="text-gray-400">Session best time</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Tyre Sets</h2>
          <p className="text-gray-400">Compound usage per driver</p>
        </div>
      </div>
    </div>
  );
}
