// Shared data shapes for the race/live tab components.

export interface PitStop {
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  date: string;
}

export interface PositionRow {
  driver_number: number;
  position: number;
  date: string;
}

export interface Interval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
}

export interface RcMsg {
  date: string;
  message: string;
  flag?: string | null;
  category?: string;
  driver_number?: number | null;
  sector?: number | null;
}

export interface LocationPt {
  driver_number: number;
  x: number;
  y: number;
  date: string;
}

export interface CarDataPt {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  drs: number;
}
