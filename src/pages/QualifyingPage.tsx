export default function QualifyingPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">Qualifying Session</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Segment Timer</h2>
          <p className="text-gray-400">Q1, Q2, Q3 time remaining</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Leaderboard</h2>
          <p className="text-gray-400">Current standings</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Sector Times</h2>
          <p className="text-gray-400">Color-coded improvements</p>
        </div>
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-bold">Pit Status</h2>
          <p className="text-gray-400">Pit lane activity</p>
        </div>
      </div>
    </div>
  );
}
