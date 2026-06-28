export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  year: number;
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string;
  country_name: string;
  location?: string;
}

export function sessionLabel(s: OpenF1Session): string {
  return s.meeting_name || s.location || s.circuit_short_name || s.country_name || 'Unknown';
}

export function isLiveSession(s: OpenF1Session): boolean {
  const now = new Date();
  return !!s.date_start && new Date(s.date_start) <= now && !!s.date_end && new Date(s.date_end) > now;
}

export function isPastSession(s: OpenF1Session): boolean {
  return !!s.date_start && new Date(s.date_start) <= new Date();
}

export interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url?: string;
}

export interface OpenF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
  date_start: string;
}

export interface OpenF1Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number | null;
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | 'UNKNOWN';
  tyre_age_at_start: number;
}

export interface OpenF1Weather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
}
