import { useEffect, useState } from "react";
import GeoMap, { satelliteStyle, type FireFeatureCollection } from "./geoMap";
import { emptyHotspotFeatureCollection, type HotspotFeature } from "../../types/hotspotTypes";
import { isMockHotspotsEnabled } from "../../dev/mockHotspotConfig";
import { loadMockHotspots } from "../../dev/mockHotspotLoader";
import { filterHotspotsBySensor } from "../../utils/hotspotUtils";

type HotspotMapProps = {
  boundariesVisible?: boolean;
  fireData?: FireFeatureCollection;
  observationsVisible?: boolean;
  sensor?: string;
  onError?: (message: string) => void;
  onHotspotSelect?: (feature: HotspotFeature) => void;
};

/** Keeps satellite-observation wiring separate from the reusable basemap. */
export default function HotspotMap({ fireData, boundariesVisible = true, observationsVisible = true, sensor = "all", onError, onHotspotSelect }: HotspotMapProps) {
  const [mockData, setMockData] = useState<FireFeatureCollection>(emptyHotspotFeatureCollection);

  useEffect(() => {
    if (!isMockHotspotsEnabled) return;
    // Replace this local fixture loader with backend GeoJSON plumbing when the API is connected.
    void loadMockHotspots().then(setMockData).catch((error: unknown) => onError?.(error instanceof Error ? error.message : "Synthetic hotspot fixture could not be loaded."));
  }, []);

  const sourceData = isMockHotspotsEnabled ? mockData : fireData ?? emptyHotspotFeatureCollection;
  const filteredData = filterHotspotsBySensor(sourceData, sensor);
  const visibleData = observationsVisible ? filteredData : emptyHotspotFeatureCollection;
  const diagnostic = !isMockHotspotsEnabled
    ? "Mock mode disabled"
    : mockData.features.length === 0
      ? "Loading synthetic hotspot fixture…"
      : !observationsVisible
        ? "Observation layer hidden"
        : filteredData.features.length === 0
          ? "Current sensor filter excludes all synthetic hotspots"
          : `${visibleData.features.length} synthetic hotspots rendered`;

  return (
    <div className="relative h-full w-full">
      <GeoMap boundariesVisible={boundariesVisible} zoom={4.35} basemapStyle={satelliteStyle} fireData={visibleData} fitToData={isMockHotspotsEnabled} onError={onError} onHotspotSelect={onHotspotSelect} />
      {isMockHotspotsEnabled && <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded border border-orange-400/30 bg-[#10131a]/90 px-2 py-1 text-[11px] text-orange-200 backdrop-blur" aria-live="polite">SYNTHETIC DATA · {diagnostic}</div>}
    </div>
  );
}
