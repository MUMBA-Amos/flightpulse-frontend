import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AircraftRoute, AircraftState } from '../models/aircraft.model';
import { AirlinePerformance } from '../models/airline.model';
import { AirportActivity } from '../models/airport.model';
import { Flight } from '../models/flight.model';
import { FlightPulseStats } from '../models/stats.model';
import { WeatherResponse } from '../models/weather.model';

/** All HTTP access to the FlightPulse FastAPI backend. */
@Injectable({ providedIn: 'root' })
export class FlightPulseApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getStats(): Observable<FlightPulseStats> {
    return this.http.get<FlightPulseStats>(`${this.baseUrl}/stats/`);
  }

  getFlights(): Observable<Flight[]> {
    return this.http.get<Flight[]>(`${this.baseUrl}/flights/`);
  }

  /** Flights with a departure or arrival delay, most delayed first. */
  getDelayedFlights(): Observable<Flight[]> {
    // No trailing slash: this route is declared as /flights/delayed.
    return this.http.get<Flight[]>(`${this.baseUrl}/flights/delayed`);
  }

  getAirlines(): Observable<AirlinePerformance[]> {
    return this.http.get<AirlinePerformance[]>(`${this.baseUrl}/airlines/`);
  }

  getAirports(): Observable<AirportActivity[]> {
    return this.http.get<AirportActivity[]>(`${this.baseUrl}/airports/`);
  }

  /** Latest METAR for an airport, by ICAO code (e.g. RJTT). */
  getWeather(icao: string): Observable<WeatherResponse> {
    return this.http.get<WeatherResponse>(`${this.baseUrl}/weather/${encodeURIComponent(icao)}`);
  }

  getAircraft(): Observable<AircraftState[]> {
    return this.http.get<AircraftState[]>(`${this.baseUrl}/aircraft/`);
  }

  /** Origin and destination for a callsign (all null when unknown). */
  getAircraftRoute(callsign: string): Observable<AircraftRoute> {
    return this.http.get<AircraftRoute>(`${this.baseUrl}/aircraft/route/${encodeURIComponent(callsign)}`);
  }
}
