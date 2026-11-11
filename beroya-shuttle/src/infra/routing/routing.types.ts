export type LatLng = {
  lat: number;
  lng: number;
};

export type EtaLeg = {
  durationSeconds: number;
  distanceMeters: number;
};

export interface RoutingProvider {
  getEta(from: LatLng, to: LatLng[]): Promise<EtaLeg[]>;
}

export const CITY_SPEED_KMH = 25;
export const CITY_SPEED_MPS = (CITY_SPEED_KMH * 1000) / 3600;
