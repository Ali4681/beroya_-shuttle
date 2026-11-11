import { accumulateStopEtas, parseCachedEta } from './eta.rules';

describe('EtaService accumulation', () => {
  const now = new Date('2026-10-03T07:30:00.000Z');

  it('accumulates remaining-stop ETAs from routing legs', () => {
    const stops = accumulateStopEtas(
      [{ id: 's1' }, { id: 's2' }],
      [{ durationSeconds: 60 }, { durationSeconds: 120 }],
      now,
    );
    expect(stops[0].etaAt.toISOString()).toBe('2026-10-03T07:31:00.000Z');
    expect(stops[1].etaAt.toISOString()).toBe('2026-10-03T07:33:00.000Z');
  });

  it('treats a missing leg as zero seconds', () => {
    const stops = accumulateStopEtas([{ id: 's1' }], [undefined], now);
    expect(stops[0].etaAt.toISOString()).toBe(now.toISOString());
  });

  it('rehydrates a cached ETA payload', () => {
    const parsed = parseCachedEta(
      JSON.stringify({
        etaToNextStopAt: '2026-10-03T07:31:00.000Z',
        etaToFinishAt: '2026-10-03T07:40:00.000Z',
        stops: [{ id: 's1', etaAt: '2026-10-03T07:31:00.000Z' }],
      }),
    );
    expect(parsed.etaToNextStopAt?.toISOString()).toBe(
      '2026-10-03T07:31:00.000Z',
    );
    expect(parsed.stops[0].id).toBe('s1');
  });

  it('keeps null cached ETAs as null', () => {
    const parsed = parseCachedEta(
      JSON.stringify({
        etaToNextStopAt: null,
        etaToFinishAt: null,
        stops: [],
      }),
    );
    expect(parsed.etaToNextStopAt).toBeNull();
    expect(parsed.etaToFinishAt).toBeNull();
    expect(parsed.stops).toEqual([]);
  });
});
