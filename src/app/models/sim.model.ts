/** Flight-sim briefing for a live flight, from GET /sim/{callsign}. */
export interface SimBriefing {
  callsign: string;
  airline: string | null;
  /** "flights" = our Aviationstack data, "adsbdb" = the callsign's usual route, null = unknown. */
  route_source: 'flights' | 'adsbdb' | null;
  aircraft: SimAircraft | null;
  origin: SimAirport | null;
  destination: SimAirport | null;
  /** e.g. "FL370", when the aircraft is level at cruise. */
  cruise_level: string | null;
  /** SimBrief dispatch page with the flight filled in; null without both airports. */
  simbrief_url: string | null;
  /** What the SimBrief link fills in, e.g. { label: "Aircraft type", value: "A320" }. */
  simbrief_fields: { label: string; value: string }[];
}

export interface SimAircraft {
  /** e.g. "A320 216SL" */
  type: string | null;
  /** ICAO type designator, e.g. "A320", as simulators use it. */
  icao_type: string | null;
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  photo: string | null;
}

export interface SimAirport {
  icao: string | null;
  iata: string | null;
  name: string | null;
  city: string | null;
  elevation_ft: number | null;
  /** e.g. ["14L/32R", "15/33"] */
  runways: string[];
  frequencies: { name: string; mhz: string }[];
  /** Raw METAR report. */
  metar: string | null;
  flight_category: string | null;
  wind: { direction: number | null; variable: boolean; speed_kt: number; gust_kt: number | null } | null;
  /** Raw TAF forecast. */
  taf: string | null;
  likely_runway: {
    ends: string[];
    headwind_kt: number | null;
    crosswind_kt: number | null;
    /** Set when the wind favours no runway. */
    note: string | null;
  } | null;
}
