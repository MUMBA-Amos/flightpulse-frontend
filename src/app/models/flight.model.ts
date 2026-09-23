/** Flight status values reported by Aviationstack. */
export type FlightStatus =
  | 'scheduled'
  | 'active'
  | 'landed'
  | 'cancelled'
  | 'incident'
  | 'diverted';

/** One row of the gold_flight_summary table, as returned by GET /flights. */
export interface Flight {
  flight_date: string | null;
  flight_status: FlightStatus | string | null;
  flight_iata: string | null;
  flight_icao: string | null;
  flight_number: string | null;

  airline_name: string | null;
  airline_iata: string | null;
  airline_icao: string | null;

  departure_airport: string | null;
  departure_iata: string | null;
  departure_icao: string | null;

  arrival_airport: string | null;
  arrival_iata: string | null;
  arrival_icao: string | null;

  /** Delay in minutes. */
  departure_delay: number | null;
  /** Delay in minutes. */
  arrival_delay: number | null;

  scheduled_departure: string | null;
  estimated_departure: string | null;
  actual_departure: string | null;
  scheduled_arrival: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;

  /** e.g. "HND → SIN" */
  route: string | null;
  is_departure_delayed: boolean | null;
  is_arrival_delayed: boolean | null;
}
