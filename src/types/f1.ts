export interface Driver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  surname: string;
  forename: string;
  dob?: string;
  nationality: string;
}

export interface Constructor {
  constructorId: string;
  name: string;
  nationality: string;
}

export interface Circuit {
  circuitId: string;
  circuitName: string;
  location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface Race {
  season: string;
  round: string;
  url?: string;
  raceName: string;
  date: string;
  time?: string;
  circuit: Circuit;
}

export interface LapTime {
  driverId: string;
  lap: number;
  position: number;
  time: string;
}

export interface PitStop {
  driverId: string;
  lap: number;
  stop: number;
  time: string;
  duration: string;
}

export interface SessionData {
  drivers: Driver[];
  timings: LapTime[];
  pitStops: PitStop[];
  weather?: WeatherData;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity?: number;
}
