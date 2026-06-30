const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

async function get(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jolpica ${res.status}: ${url}`);
  return res.json();
}

export const jolpicaApi = {
  async getSeasons() {
    return get(`${BASE_URL}/seasons.json?limit=1000`);
  },

  async getRaces(season: number) {
    return get(`${BASE_URL}/${season}/races.json?limit=100`);
  },

  async getDrivers() {
    return get(`${BASE_URL}/drivers.json?limit=1000`);
  },

  async getConstructors() {
    return get(`${BASE_URL}/constructors.json?limit=1000`);
  },

  async getDriverStandings(season: number) {
    return get(`${BASE_URL}/${season}/driverStandings.json`);
  },

  async getConstructorStandings(season: number) {
    return get(`${BASE_URL}/${season}/constructorStandings.json`);
  },

  async getRaceResults(season: number, round: number) {
    return get(`${BASE_URL}/${season}/${round}/results.json`);
  },

  async getQualifyingResults(season: number, round: number) {
    return get(`${BASE_URL}/${season}/${round}/qualifying.json`);
  },

  // Every race result for one driver in a season (used for expandable standings rows).
  async getDriverSeasonResults(season: number, driverId: string) {
    return get(`${BASE_URL}/${season}/drivers/${driverId}/results.json?limit=100`);
  },
};
