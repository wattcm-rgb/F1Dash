const BASE_URL = 'https://api.jolpi.ca/ergast/f1';

export const jolpicaApi = {
  async getSeasons() {
    const res = await fetch(`${BASE_URL}/seasons.json?limit=1000`);
    return res.json();
  },

  async getRaces(season: number) {
    const res = await fetch(`${BASE_URL}/${season}/races.json?limit=100`);
    return res.json();
  },

  async getDrivers() {
    const res = await fetch(`${BASE_URL}/drivers.json?limit=1000`);
    return res.json();
  },

  async getConstructors() {
    const res = await fetch(`${BASE_URL}/constructors.json?limit=1000`);
    return res.json();
  },

  async getDriverStandings(season: number) {
    const res = await fetch(`${BASE_URL}/${season}/driverStandings.json`);
    return res.json();
  },

  async getConstructorStandings(season: number) {
    const res = await fetch(`${BASE_URL}/${season}/constructorStandings.json`);
    return res.json();
  },

  async getRaceResults(season: number, round: number) {
    const res = await fetch(`${BASE_URL}/${season}/${round}/results.json`);
    return res.json();
  },

  async getQualifyingResults(season: number, round: number) {
    const res = await fetch(`${BASE_URL}/${season}/${round}/qualifying.json`);
    return res.json();
  },
};
