import { create } from 'zustand';

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

interface CalendarStore {
  races: Race[];
  setRaces: (races: Race[]) => void;
  currentSeason: number;
  setCurrentSeason: (season: number) => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
  races: [],
  setRaces: (races) => set({ races }),
  currentSeason: new Date().getFullYear(),
  setCurrentSeason: (season) => set({ currentSeason: season }),
}));
