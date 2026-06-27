export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">F1 Calendar</h1>
      <p className="text-gray-300">Race weekends with timezone conversions</p>
      <div className="bg-slate-800 p-4 rounded mt-6">
        <p className="text-gray-400">Loading calendar data...</p>
      </div>
    </div>
  );
}
