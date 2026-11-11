import {
  haversineEta,
  haversineMeters,
  nearestNeighborOrder,
  pathDistance,
  twoOptImprove,
} from './haversine';

describe('haversine routing helpers', () => {
  const origin = { lat: 33.51, lng: 36.29 };
  const stops = [
    { id: 'c', point: { lat: 33.53, lng: 36.31 } },
    { id: 'a', point: { lat: 33.515, lng: 36.292 } },
    { id: 'b', point: { lat: 33.52, lng: 36.3 } },
  ];

  it('computes eta and path length', () => {
    expect(
      haversineEta(origin, stops[0].point).durationSeconds,
    ).toBeGreaterThan(0);
    expect(pathDistance([origin, stops[0].point])).toBeGreaterThan(0);
    expect(pathDistance([origin])).toBe(0);
    expect(nearestNeighborOrder(origin, [])).toEqual([]);
  });

  it('breaks nearest-neighbor ties by id', () => {
    const same = [
      { id: 'z', point: { lat: 33.52, lng: 36.3 } },
      { id: 'a', point: { lat: 33.52, lng: 36.3 } },
    ];
    expect(nearestNeighborOrder(origin, same).map((stop) => stop.id)).toEqual([
      'a',
      'z',
    ]);
  });

  it('orders nearest neighbor deterministically', () => {
    const first = nearestNeighborOrder(origin, stops).map((stop) => stop.id);
    const second = nearestNeighborOrder(origin, stops).map((stop) => stop.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe('a');
  });

  it('improves a crossed path with 2-opt', () => {
    const crossed = [
      { id: 'far', point: { lat: 33.56, lng: 36.35 } },
      { id: 'near', point: { lat: 33.512, lng: 36.291 } },
    ];
    const improved = twoOptImprove(crossed);
    expect(improved.map((stop) => stop.id)).toEqual(['far', 'near']);
    const distance = haversineMeters(crossed[0].point, crossed[1].point);
    expect(distance).toBeGreaterThan(0);
  });
});
