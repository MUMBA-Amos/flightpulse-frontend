import { Metar } from '../models/weather.model';

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
  const dir = typeof m.wdir === 'number' ? `${String(m.wdir).padStart(3, '0')}°` : 'VRB';
  return `${dir} ${m.wspd}${m.wgst ? `G${m.wgst}` : ''} kt`;
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
  return `${m.visib} mi`;
}
