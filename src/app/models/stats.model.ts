/** Response of GET /stats/ */
export interface FlightPulseStats {
  total_flights: number;
  total_airlines: number;
  total_airports: number;
  /** Every aircraft in the latest OpenSky snapshot, worldwide, including on the ground. */
  total_aircraft: number;
  /** Of those, how many are in the air. */
  airborne_aircraft: number;
}
