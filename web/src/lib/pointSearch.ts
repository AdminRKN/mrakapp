/* Finding a СДЭК pickup point the way people type it: «проспект Победы 206», «побед», «Коньково». */
import type { CdekPoint } from '@mrak8/shared';

// street types and filler words say nothing about which point it is: «проспект» vs CDEK's «пр-кт» must not matter
const FILLER = new Set([
  'проспект', 'пр-кт', 'пр-т', 'просп', 'пр', 'улица', 'ул', 'бульвар', 'б-р', 'бул', 'шоссе', 'ш', 'переулок', 'пер',
  'площадь', 'пл', 'набережная', 'наб', 'проезд', 'пр-д', 'микрорайон', 'мкр', 'мкрн', 'мкр-н', 'тупик', 'аллея',
  'дом', 'д', 'корпус', 'корп', 'строение', 'стр', 'город', 'г', 'метро', 'м', 'ст',
]);
const tokens = (s: string) => s.toLowerCase().replace(/ё/g, 'е').split(/[\s,.;:()«»"'/\\№#]+/).filter(Boolean);

/** every typed word must start some word of the address, metro or name; street types are ignored */
export function matchPoints(points: CdekPoint[], query: string) {
  const q = tokens(query).filter((w) => !FILLER.has(w));
  if (!q.length) return points;
  return points.filter((p) => {
    const hay = tokens(`${p.address} ${p.metro} ${p.name}`).flatMap((t) => (t.includes('-') ? [t, ...t.split('-')] : [t]));
    return q.every((w) => hay.some((h) => h.startsWith(w)));
  });
}

/** straight-line distance, km (haversine); points without coordinates go last */
export function distanceKm(from: { lat: number; lon: number }, p: CdekPoint) {
  if (p.lat == null || p.lon == null) return Infinity;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(p.lat - from.lat), dLon = rad(p.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(p.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} км`);
