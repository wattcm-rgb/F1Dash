import { create } from 'zustand';
import type { SessionData } from '../types/f1';

interface SessionStore {
  sessionData: SessionData | null;
  currentRound: number;
  currentSeason: number;
  setSessionData: (data: SessionData) => void;
  setCurrentRound: (round: number) => void;
  setCurrentSeason: (season: number) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionData: null,
  currentRound: 1,
  currentSeason: new Date().getFullYear(),
  setSessionData: (data) => set({ sessionData: data }),
  setCurrentRound: (round) => set({ currentRound: round }),
  setCurrentSeason: (season) => set({ currentSeason: season }),
  clearSession: () => set({ sessionData: null }),
}));
