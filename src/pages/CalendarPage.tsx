import { useState, useEffect } from 'react';
import { jolpicaApi } from '../services/jolpicaApi';
import { formatTimeInTimezone, commonTimezones } from '../utils/timezone';

interface Race {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  circuit: {
    circuitName: string;
    location: {
      country: string;
    };
  };
}

export default function CalendarPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('UTC');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchRaces = async () => {
      setLoading(true);
      const data = await jolpicaApi.getRaces(currentYear);
      if (data?.MRData?.RaceTable?.Races) {
        setRaces(data.MRData.RaceTable.Races);
      }
      setLoading(false);
    };

    fetchRaces();
  }, []);

  const formatRaceTime = (date: string, time?: string) => {
    if (!time) return date;
    const isoTime = `${date}T${time}`;
    return formatTimeInTimezone(isoTime, timezone);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-4xl font-bold mb-4">F1 Calendar {currentYear}</h1>
        <p className="text-gray-400">Loading races...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">F1 Calendar {currentYear}</h1>
          <p className="text-gray-400">{races.length} races scheduled</p>
        </div>
        <div className="bg-slate-800 p-3 rounded">
          <label className="text-sm text-gray-400 block mb-2">Timezone:</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="bg-slate-700 text-white px-3 py-2 rounded text-sm"
          >
            {commonTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-gray-300">Round</th>
              <th className="px-4 py-3 text-left text-gray-300">Race</th>
              <th className="px-4 py-3 text-left text-gray-300">Circuit</th>
              <th className="px-4 py-3 text-left text-gray-300">Country</th>
              <th className="px-4 py-3 text-left text-gray-300">Date</th>
              <th className="px-4 py-3 text-left text-gray-300">Race Time ({timezone})</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race) => (
              <tr key={race.round} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="px-4 py-3 text-red-500 font-bold">{race.round}</td>
                <td className="px-4 py-3">{race.raceName}</td>
                <td className="px-4 py-3">{race.circuit.circuitName}</td>
                <td className="px-4 py-3">{race.circuit.location.country}</td>
                <td className="px-4 py-3 text-gray-400">{race.date}</td>
                <td className="px-4 py-3 text-yellow-400 font-mono">
                  {formatRaceTime(race.date, race.time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-slate-800 p-4 rounded text-sm text-gray-400">
        <p>💡 Times shown are in UTC unless converted. Check your local timezone for practice, qualifying, and race session times.</p>
      </div>
    </div>
  );
}
