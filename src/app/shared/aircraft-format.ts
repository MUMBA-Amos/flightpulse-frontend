import { AircraftState } from '../models/aircraft.model';

const FEET_PER_METRE = 3.28084;
const KNOTS_PER_MPS = 1.94384;
const FPM_PER_MPS = 196.85;

export interface Climb {
  label: string;
  tone: 'up' | 'down' | 'level';
}

export function callsign(a: AircraftState): string {
  return a.callsign?.trim() || '—';
}

/** Barometric altitude (falls back to geometric), in feet. */
export function altitudeFt(a: AircraftState): number | null {
  const metres = a.baro_altitude ?? a.geo_altitude;
  return metres == null ? null : metres * FEET_PER_METRE;
}

/** Ground speed in knots. */
export function speedKt(a: AircraftState): number | null {
  return a.velocity == null ? null : a.velocity * KNOTS_PER_MPS;
}

export function climb(a: AircraftState): Climb | null {
  if (a.vertical_rate == null) return null;
  const fpm = Math.round(a.vertical_rate * FPM_PER_MPS);
  if (Math.abs(fpm) < 100) return { label: 'Level', tone: 'level' };
  return fpm > 0
    ? { label: `▲ ${fpm.toLocaleString()} ft/min`, tone: 'up' }
    : { label: `▼ ${Math.abs(fpm).toLocaleString()} ft/min`, tone: 'down' };
}

export function lastSeen(a: AircraftState): Date | null {
  return a.time_position == null ? null : new Date(a.time_position * 1000);
}
