import type { HotspotFeatureCollection } from "../types/hotspotTypes";

function isHotspotFeatureCollection(value: unknown): value is HotspotFeatureCollection {
  return typeof value === "object" && value !== null
    && "type" in value && value.type === "FeatureCollection"
    && "features" in value && Array.isArray(value.features);
}

/**
 * Reads the Git-ignored src/dev/mock-hotspots.local.json fixture in development.
 * Replace this loader call in hotspotMap.tsx with the backend GeoJSON request later.
 */
export async function loadMockHotspots(): Promise<HotspotFeatureCollection> {
  const response = await fetch("/src/dev/mock-hotspots.local.json");
  if (!response.ok) throw new Error("Synthetic hotspot fixture could not be loaded.");
  const data: unknown = await response.json();
  if (!isHotspotFeatureCollection(data)) throw new Error("Synthetic hotspot fixture is not a GeoJSON FeatureCollection.");
  return data;
}
