import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AircraftRoute, AircraftState } from '../models/aircraft.model';
import { AirlinePerformance } from '../models/airline.model';
import { AirportActivity } from '../models/airport.model';
import { Flight } from '../models/flight.model';
import { AirportInsights, TrackedAirport } from '../models/insights.model';
import { SimBriefing } from '../models/sim.model';
import { FlightPulseStats } from '../models/stats.model';
import { WeatherBatchResponse, WeatherResponse } from '../models/weather.model';

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

  /** Latest METAR for several airports in one request (up to 100). */
  getWeatherBatch(icaos: string[]): Observable<WeatherBatchResponse> {
    return this.http.get<WeatherBatchResponse>(`${this.baseUrl}/weather/`, { params: { ids: icaos.join(',') } });
  }

  /** Airports with delay insights, with their headline figures. */
  getTrackedAirports(): Observable<TrackedAirport[]> {
    return this.http.get<TrackedAirport[]>(`${this.baseUrl}/insights/`);
  }

  /** Everything the Insights page shows for one airport (IATA code, e.g. KUL). */
  getInsights(airport: string): Observable<AirportInsights> {
    return this.http.get<AirportInsights>(`${this.baseUrl}/insights/${encodeURIComponent(airport)}`);
  }

  /** The 500 most recently seen aircraft; `airborne: true` returns only those in the air. */
  getAircraft(airborne?: boolean): Observable<AircraftState[]> {
    const params: Record<string, string> = airborne === undefined ? {} : { airborne: String(airborne) };
    return this.http.get<AircraftState[]>(`${this.baseUrl}/aircraft/`, { params });
  }

  /** Origin and destination for a callsign (all null when unknown). */
  getAircraftRoute(callsign: string): Observable<AircraftRoute> {
    return this.http.get<AircraftRoute>(`${this.baseUrl}/aircraft/route/${encodeURIComponent(callsign)}`);
  }

  /** Flight-sim briefing for a live flight: aircraft, both airports' weather and runways, and a SimBrief link. */
  getSimBriefing(callsign: string, icao24: string, cruiseFt: number | null): Observable<SimBriefing> {
    const params: Record<string, string> = { icao24 };
    if (cruiseFt != null) params['cruise_ft'] = String(Math.round(cruiseFt));
    return this.http.get<SimBriefing>(`${this.baseUrl}/sim/${encodeURIComponent(callsign)}`, { params });
  }
}
