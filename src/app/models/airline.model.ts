/** One row of gold_airline_performance, as returned by GET /airlines/ */
export interface AirlinePerformance {
  airline_name: string | null;
  airline_iata: string | null;
  airline_icao: string | null;
  total_flights: number;
  delayed_departures: number | null;
  /** Minutes. */
  average_departure_delay: number | null;
  delayed_arrivals: number | null;
  /** Minutes. */
  average_arrival_delay: number | null;
}
