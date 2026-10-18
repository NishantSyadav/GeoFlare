import type { HotspotFeature, HotspotFeatureCollection } from "../types/hotspotTypes";

export function hotspotDate(feature: HotspotFeature) {
  const value = feature.properties.acqDatetimeUtc ?? feature.properties.acq_date ?? feature.properties.acquisitionDate;
  return typeof value === "string" ? value.slice(0, 10) : null;
}

export function hotspotRegion(feature: HotspotFeature) {
  return typeof feature.properties.region === "string" ? feature.properties.region : "Unspecified region";
}

export function filterHotspotsBySensor(data: HotspotFeatureCollection, sensor: string) {
  return sensor === "all" ? data : { ...data, features: data.features.filter((feature) => feature.properties.sensor === sensor) };
}

export function filterHotspotsByRegion(data: HotspotFeatureCollection, region: string) {
  return region === "all" ? data : { ...data, features: data.features.filter((feature) => hotspotRegion(feature) === region) };
}
