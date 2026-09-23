/** One row of gold_airport_activity, as returned by GET /airports/ */
export interface AirportActivity {
  airport_iata: string | null;
  airport_name: string | null;
  total_activity: number;
  scheduled_departures: number;
  scheduled_arrivals: number;
}
