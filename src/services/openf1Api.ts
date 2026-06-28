// Public OpenF1 API is the default so the GitHub Pages (HTTPS) build works without
// mixed-content issues. Override with VITE_OPENF1_BASE_URL once the VPS has TLS.
const OPENF1_BASE_URL =
  import.meta.env.VITE_OPENF1_BASE_URL ?? 'https://api.openf1.org/v1';

export const openf1Api = {
  async getSessions() {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      return [];
    }
  },

  async getSessionsByYear(year: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/sessions?year=${year}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch sessions by year:', error);
      return [];
    }
  },

  async getDrivers() {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/drivers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      return [];
    }
  },

  async getIntervals(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/intervals?session_key=${sessionKey}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch intervals:', error);
      return [];
    }
  },

  async getLaps(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/laps?session_key=${sessionKey}&limit=10000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch laps:', error);
      return [];
    }
  },

  async getPitStops(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/pit_stops?session_key=${sessionKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch pit stops:', error);
      return [];
    }
  },

  async getWeather(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/weather?session_key=${sessionKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      return [];
    }
  },

  async getRaceControlMessages(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/race_control?session_key=${sessionKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch race control messages:', error);
      return [];
    }
  },

  async getStints(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/stints?session_key=${sessionKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch stints:', error);
      return [];
    }
  },

  async getDriversBySession(sessionKey: number) {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/drivers?session_key=${sessionKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      console.error('Failed to fetch drivers for session:', error);
      return [];
    }
  },

  async getLatestSession(type: 'Practice' | 'Qualifying' | 'Race') {
    try {
      const res = await fetch(`${OPENF1_BASE_URL}/sessions?session_type=${type}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const sessions = await res.json();
      if (!sessions.length) return null;
      return sessions[sessions.length - 1];
    } catch (error) {
      console.error('Failed to fetch latest session:', error);
      return null;
    }
  },
};
