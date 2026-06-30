export interface QualLap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  sector_1: number | null;
  sector_2: number | null;
  sector_3: number | null;
  is_pit_out_lap: boolean;
  date_start: string;
}

export type SectorColour = 'purple' | 'green' | 'yellow' | 'grey';

export type Segment = 'Q1' | 'Q2' | 'Q3';

export interface DriverQualBest {
  driver_number: number;
  best_lap: number | null;
  best_s1: number | null;
  best_s2: number | null;
  best_s3: number | null;
  laps_done: number;
}
