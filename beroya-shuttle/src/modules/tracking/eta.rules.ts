export type EtaStopInput = { id: string };
export type EtaLegInput = { durationSeconds: number };

export function accumulateStopEtas(
  remaining: EtaStopInput[],
  legs: Array<EtaLegInput | undefined>,
  now: Date,
): Array<{ id: string; etaAt: Date }> {
  let accumulated = 0;
  return remaining.map((stop, index) => {
    accumulated += legs[index]?.durationSeconds ?? 0;
    return {
      id: stop.id,
      etaAt: new Date(now.getTime() + accumulated * 1000),
    };
  });
}

export function parseCachedEta(raw: string): {
  etaToNextStopAt: Date | null;
  etaToFinishAt: Date | null;
  stops: Array<{ id: string; etaAt: Date }>;
} {
  const parsed = JSON.parse(raw) as {
    etaToNextStopAt: string | null;
    etaToFinishAt: string | null;
    stops: Array<{ id: string; etaAt: string }>;
  };
  return {
    etaToNextStopAt: parsed.etaToNextStopAt
      ? new Date(parsed.etaToNextStopAt)
      : null,
    etaToFinishAt: parsed.etaToFinishAt ? new Date(parsed.etaToFinishAt) : null,
    stops: parsed.stops.map((stop) => ({
      id: stop.id,
      etaAt: new Date(stop.etaAt),
    })),
  };
}
