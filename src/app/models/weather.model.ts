/** One METAR observation from aviationweather.gov (the fields the UI uses). */
export interface Metar {
  icaoId: string;
  name?: string | null;
  /** Unix seconds. */
  obsTime?: number | null;
  /** °C */
  temp?: number | null;
  dewp?: number | null;
  /** Degrees, or "VRB" for variable. */
  wdir?: number | string | null;
  /** Knots. */
  wspd?: number | null;
  wgst?: number | null;
  /** Statute miles; may be a string such as "10+". */
  visib?: number | string | null;
  /** Present weather codes, e.g. "-RA BR". */
  wxString?: string | null;
  cover?: string | null;
  /** VFR | MVFR | IFR | LIFR */
  fltCat?: string | null;
  rawOb: string;
}

/** Response of GET /weather/?ids=A,B: each airport's latest METAR, or null if none. */
export interface WeatherBatchResponse {
  weather: Record<string, Metar | null>;
}

/** Response of GET /weather/{airport_icao} */
export interface WeatherResponse {
  airport_icao: string;
  weather: Metar[] | null;
  message?: string;
}
