import { Metar } from '../models/weather.model';
import { compassPoint } from './compass';

const KMH_PER_KNOT = 1.852;
const KM_PER_MILE = 1.609;

const PHENOMENA: Record<string, string> = {
  TS: 'thunderstorm',
  RA: 'rain',
  DZ: 'drizzle',
  SN: 'snow',
  SG: 'snow grains',
  GR: 'hail',
  GS: 'small hail',
  PL: 'ice pellets',
  FG: 'fog',
  BR: 'mist',
  HZ: 'haze',
  FU: 'smoke',
  DU: 'dust',
  SA: 'sand',
  SQ: 'squalls',
  UP: 'precipitation',
};

/** "-RA BR" → "Light rain, mist" */
export function describeWx(wx: string | null | undefined): string | null {
  if (!wx) return null;
  const parts = wx.split(/\s+/).map((token) => {
    const intensity = token.startsWith('-') ? 'light ' : token.startsWith('+') ? 'heavy ' : '';
    const code = token.replace(/^[-+]|^VC/, '');
    const shower = code.includes('SH') ? ' showers' : '';
    const freezing = code.includes('FZ') ? 'freezing ' : '';
    const names = (code.replace(/SH|FZ|MI|BC|PR|DR|BL/g, '').match(/.{2}/g) ?? [])
      .map((c) => PHENOMENA[c])
      .filter(Boolean);
    if (!names.length) return null;
    return `${intensity}${freezing}${names.join(' and ')}${shower}`;
  });
  const text = parts.filter(Boolean).join(', ');
  return text ? text[0].toUpperCase() + text.slice(1) : null;
}

export function wind(m: Metar): string | null {
  if (m.wspd == null) return null;
  if (m.wspd === 0) return 'Calm';
  const speed = `${Math.round(m.wspd * KMH_PER_KNOT)} km/h`;
  const from = typeof m.wdir === 'number' ? ` from ${compassPoint(m.wdir)}` : ', changing direction';
  const gusts = m.wgst ? `, gusts ${Math.round(m.wgst * KMH_PER_KNOT)}` : '';
  return `${speed}${from}${gusts}`;
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';

/** Picks an icon for the observation from present weather first, then cloud cover. */
export function weatherKind(m: Metar): WeatherKind {
  const wx = m.wxString ?? '';
  if (/TS/.test(wx)) return 'storm';
  if (/SN|SG|PL|GR|GS/.test(wx)) return 'snow';
  if (/RA|DZ|SH|UP/.test(wx)) return 'rain';
  if (/FG|BR|HZ|FU|DU|SA/.test(wx)) return 'fog';
  if (m.cover === 'OVC' || m.cover === 'BKN' || m.cover === 'OVX') return 'cloudy';
  if (m.cover === 'SCT' || m.cover === 'FEW') return 'partly';
  return 'clear';
}

export function visibility(m: Metar): string | null {
  if (m.visib == null) return null;
  // Reported in miles; "10+" means 10 miles or more.
  const miles = parseFloat(String(m.visib));
  if (Number.isNaN(miles)) return null;
  const km = miles * KM_PER_MILE;
  if (String(m.visib).endsWith('+') || km >= 10) return '10+ km';
  return `${km < 5 ? km.toFixed(1) : Math.round(km)} km`;
}

const FLYING_CONDITIONS: Record<string, string> = {
  VFR: 'Good',
  MVFR: 'Fair',
  IFR: 'Poor',
  LIFR: 'Very poor',
};

/** Aviation flight category (VFR, IFR, …) → a plain rating of flying conditions. */
export function flyingConditions(category: string | null | undefined): string | null {
  return category ? (FLYING_CONDITIONS[category.toUpperCase()] ?? null) : null;
}
