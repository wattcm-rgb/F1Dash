export default function RacePage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">Race</h1>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Laps Remaining</h2>
          <p className="text-gray-400">Race progress</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Leaderboard</h2>
          <p className="text-gray-400">Positions & gaps</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Pit Stops</h2>
          <p className="text-gray-400">Stop counts & times</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Battle Analysis</h2>
          <p className="text-gray-400">Driver comparisons</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Weather</h2>
          <p className="text-gray-400">Track conditions</p>
        </div>
      </div>
    </div>
  );
}
