import { LatLng } from './routing.types';

/** Google Encoded Polyline Algorithm (default precision 5). */
export function encodePolyline(
  points: LatLng[],
  precision = 5,
): string {
  if (points.length === 0) {
    return '';
  }
  const factor = 10 ** precision;
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * factor);
    const lng = Math.round(point.lng * factor);
    output += encodeSigned(lat - prevLat);
    output += encodeSigned(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return output;
}

export function decodePolyline(
  encoded: string,
  precision = 5,
): LatLng[] {
  if (!encoded) {
    return [];
  }
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latChange = decodeSigned(encoded, index);
    index = latChange.nextIndex;
    lat += latChange.value;
    const lngChange = decodeSigned(encoded, index);
    index = lngChange.nextIndex;
    lng += lngChange.value;
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

function encodeSigned(value: number): string {
  let v = value << 1;
  if (value < 0) {
    v = ~v;
  }
  let output = '';
  while (v >= 0x20) {
    output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  output += String.fromCharCode(v + 63);
  return output;
}

function decodeSigned(
  encoded: string,
  startIndex = 0,
): { value: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;
  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: index };
}
