import { decodePolyline, encodePolyline } from './polyline';

describe('polyline encoding', () => {
  it('round-trips coordinates at precision 5', () => {
    const points = [
      { lat: 33.51, lng: 36.29 },
      { lat: 33.512, lng: 36.295 },
      { lat: 33.52, lng: 36.3 },
    ];
    const encoded = encodePolyline(points, 5);
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodePolyline(encoded, 5);
    expect(decoded).toHaveLength(points.length);
    for (let i = 0; i < points.length; i += 1) {
      expect(decoded[i]!.lat).toBeCloseTo(points[i]!.lat, 5);
      expect(decoded[i]!.lng).toBeCloseTo(points[i]!.lng, 5);
    }
  });

  it('returns empty string / array for empty input', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
  });
});
