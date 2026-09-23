/** One OpenSky state vector from silver_aircraft, as returned by GET /aircraft/ */
export interface AircraftState {
  icao24: string;
  /** May contain trailing spaces. */
  callsign: string | null;
  origin_country: string | null;
  /** Unix seconds of the last position update. */
  time_position: number | null;
  longitude: number | null;
  latitude: number | null;
  /** Metres. */
  baro_altitude: number | null;
  on_ground: boolean | null;
  /** Metres per second. */
  velocity: number | null;
  /** Degrees clockwise from north. */
  true_track: number | null;
  /** Metres per second. */
  vertical_rate: number | null;
  sensors: number[] | null;
  /** Metres. */
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean | null;
  position_source: number | null;
  position_time: string | null;
  contact_time: string | null;
}
