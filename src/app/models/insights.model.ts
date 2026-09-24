/** Headline figures for one airport, from gold_insights_summary. */
export interface InsightSummary {
  airport: string;
  flights: number;
  days: number;
  first_day: string;
  last_day: string;
  on_time_pct: number;
  avg_delay_min: number;
  most_punctual_airline: string | null;
  most_punctual_on_time_pct: number | null;
  least_punctual_airline: string | null;
  least_punctual_on_time_pct: number | null;
  /** Local hour (0–23) with the lowest on-time rate, among hours with 5+ flights. */
  worst_hour: number | null;
}

/** Shared by the per-airline, per-hour, per-route and per-day rows. */
interface Punctuality {
  flights: number;
  on_time_pct: number;
  avg_delay_min: number;
}

export interface AirlineInsight extends Punctuality {
  airline_name: string;
  over_60_min: number;
}

export interface HourInsight extends Punctuality {
  local_hour: number;
}

export interface RouteInsight extends Punctuality {
  arrival_iata: string;
  arrival_airport: string | null;
}

export interface DayInsight extends Punctuality {
  flight_date: string;
}

export interface DelayBandInsight {
  delay_band: 'On time' | '16-30 min' | '31-60 min' | 'Over 60 min';
  flights: number;
  share_pct: number;
}

/** Response of GET /insights/{airport} */
export interface AirportInsights {
  airport: string;
  name: string;
  summary: InsightSummary | null;
  airlines: AirlineInsight[];
  hours: HourInsight[];
  routes: RouteInsight[];
  daily: DayInsight[];
  delay_bands: DelayBandInsight[];
}

/** One entry of GET /insights/ */
export interface TrackedAirport {
  airport: string;
  name: string;
  summary: InsightSummary | null;
}
