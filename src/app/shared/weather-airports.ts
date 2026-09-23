import { Flight } from '../models/flight.model';

export interface WeatherAirport {
  icao: string;
  iata: string | null;
  name: string | null;
  /** Departures + arrivals in the given flights. */
  flights: number;
}

/** Every airport (with an ICAO code) in the given flights, busiest first. */
export function airportsByActivity(flights: Flight[]): WeatherAirport[] {
  const airports = new Map<string, WeatherAirport>();
  for (const f of flights) {
    for (const [icao, iata, name] of [
      [f.departure_icao, f.departure_iata, f.departure_airport],
      [f.arrival_icao, f.arrival_iata, f.arrival_airport],
    ]) {
      if (!icao) continue;
      const airport = airports.get(icao);
      if (airport) airport.flights++;
      else airports.set(icao, { icao, iata, name, flights: 1 });
    }
  }
  return [...airports.values()].sort((a, b) => b.flights - a.flights);
}
