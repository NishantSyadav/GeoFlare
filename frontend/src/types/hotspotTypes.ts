import type { Feature, FeatureCollection, Point } from "geojson";

export type HotspotProperties = {
  id?: string | number;
  acq_date?: string;
  acq_time?: string | number;
  acquisitionDate?: string;
  acquisitionTime?: string | number;
  acqDatetimeUtc?: string;
  latitude?: number;
  longitude?: number;
  sensor?: string;
  satellite?: string;
  confidence?: string | number;
  frp?: number;
  frpMw?: number;
  region?: string;
  intensity?: number;
  [key: string]: unknown;
};

export type HotspotFeature = Feature<Point, HotspotProperties>;
export type HotspotFeatureCollection = FeatureCollection<Point, HotspotProperties>;
export const emptyHotspotFeatureCollection: HotspotFeatureCollection = { type: "FeatureCollection", features: [] };
