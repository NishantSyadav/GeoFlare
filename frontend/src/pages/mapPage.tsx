import { useCallback, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers3,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import AppLayout from "../components/layout/appLayout";
import HotspotMap from "../components/map/hotspotMap";
import MapLegend from "../components/map/mapLegend";
import { emptyHotspotFeatureCollection, type HotspotFeature } from "../types/hotspotTypes";
import { isMockHotspotsEnabled } from "../dev/mockHotspotConfig";

const analysisTabs = ["Activity Calendar", "Historical Baseline", "Anomalies"] as const;
const calendarPeriods = ["Daily", "Weekly", "Seasonal"] as const;

function formatValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function selectedHotspotDetails(feature: HotspotFeature) {
  const properties = feature.properties;
  const coordinates = feature.geometry.coordinates;
  const observedDate = formatValue(properties.acqDatetimeUtc ?? properties.acq_date ?? properties.acquisitionDate);
  const observedTime = formatValue(properties.acq_time ?? properties.acquisitionTime);
  const observedAt = [observedDate, observedTime].filter((value): value is string => value !== null).join(" ");
  const frp = formatValue(properties.frpMw ?? properties.frp);
  return [
    ["Observed (UTC)", observedAt || null],
    ["Latitude", formatValue(properties.latitude) ?? String(coordinates[1])],
    ["Longitude", formatValue(properties.longitude) ?? String(coordinates[0])],
    ["Sensor", formatValue(properties.sensor) ?? formatValue(properties.satellite)],
    ["Confidence", formatValue(properties.confidence)],
    ["FRP", frp === null ? null : `${frp} MW`],
  ].filter((detail): detail is [string, string] => detail[1] !== null);
}

export default function MapPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [isDrawerOpen, setIsDrawerOpen] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const [activeTab, setActiveTab] = useState<(typeof analysisTabs)[number]>("Activity Calendar");
  const [calendarPeriod, setCalendarPeriod] = useState<(typeof calendarPeriods)[number]>("Daily");
  const [mapError, setMapError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [observationSystem, setObservationSystem] = useState("all");
  const [layerVisibility, setLayerVisibility] = useState({ boundaries: true, observations: isMockHotspotsEnabled });
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotFeature | null>(null);

  const handleMapError = useCallback((message: string) => setMapError(message), []);
  const toggleLayer = (layer: keyof typeof layerVisibility) => {
    setLayerVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <AppLayout fullHeight>
      <div className="relative flex h-full min-h-0 flex-col bg-[#090b0f]">
        <section className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#10131a] px-3 py-2.5" aria-label="Map controls">
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-300">
            <MapPin size={15} className="text-orange-400" />
            <select className="max-w-35 bg-transparent text-sm outline-none" aria-label="Region selection" defaultValue="">
              <option value="" disabled>Select region</option>
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-400">
            <CalendarRange size={15} className="text-orange-400" />
            <input type="date" aria-label="Start date" className="w-24 bg-transparent text-xs outline-none [color-scheme:dark] sm:w-28" />
            <span className="text-slate-600">—</span>
            <input type="date" aria-label="End date" className="w-24 bg-transparent text-xs outline-none [color-scheme:dark] sm:w-28" />
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wide text-slate-500">System</span>
            <select value={observationSystem} onChange={(event) => setObservationSystem(event.target.value)} className="bg-transparent text-sm outline-none" aria-label="Observation system">
              <option value="all">All sensors</option>
              <option>MODIS</option>
              <option>VIIRS</option>
            </select>
          </label>
          <button type="button" onClick={() => setIsPanelOpen((open) => !open)} className="flex h-9 items-center gap-2 rounded-md border border-white/10 px-2.5 text-sm text-slate-300 hover:border-orange-400/50 hover:text-orange-200">
            <Layers3 size={15} /> Layers
          </button>
          <label className="ml-auto flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-slate-400 focus-within:border-orange-400/60">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search place" className="w-28 bg-transparent text-sm outline-none placeholder:text-slate-600 sm:w-40" aria-label="Search places" />
          </label>
        </section>

        <div className="relative min-h-0 flex-1">
          <HotspotMap fireData={emptyHotspotFeatureCollection} boundariesVisible={layerVisibility.boundaries} observationsVisible={layerVisibility.observations} sensor={observationSystem} onError={handleMapError} onHotspotSelect={setSelectedHotspot} />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-[#10131a]/90 px-3 py-2 backdrop-blur">
            <p className="text-xs font-medium text-slate-200">India overview</p>
            <p className="mt-0.5 text-xs text-slate-500">{isMockHotspotsEnabled ? "SYNTHETIC DATA — interface testing only" : "Observation layer is awaiting real data"}</p>
          </div>
          {mapError && <div role="alert" className="absolute bottom-3 left-3 max-w-sm rounded-md border border-orange-400/30 bg-[#19120d]/95 px-3 py-2 text-xs text-orange-200">{mapError}</div>}

          {isPanelOpen ? (
            <aside className="absolute right-3 top-3 bottom-3 z-10 flex w-72 flex-col overflow-auto rounded-lg border border-white/10 bg-[#10131a]/95 p-4 shadow-xl backdrop-blur" aria-label="Map layers and context">
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-semibold text-slate-100">Map workspace</h1>
                <button type="button" onClick={() => setIsPanelOpen(false)} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Collapse map panel"><ChevronRight size={17} /></button>
              </div>
              <section className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visible layers</h2>
                <div className="mt-3 space-y-3 text-sm text-slate-300">
                  <label className="flex items-center justify-between gap-3"><span>Reference boundaries</span><input type="checkbox" checked={layerVisibility.boundaries} onChange={() => toggleLayer("boundaries")} className="accent-orange-500" /></label>
                  <label className="flex items-center justify-between gap-3"><span>Fire observations</span><input type="checkbox" checked={layerVisibility.observations} onChange={() => toggleLayer("observations")} className="accent-orange-500" /></label>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Observation layers remain empty until backend data is connected.</p>
              </section>
              <div className="my-5 border-t border-white/10" />
              <MapLegend />
              <div className="my-5 border-t border-white/10" />
              <section aria-live="polite">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected hotspot</h2>
                {selectedHotspot ? <dl className="mt-3 space-y-2 text-xs">{selectedHotspotDetails(selectedHotspot).map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-200">{value}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-500">Select a hotspot to view the values supplied by its observation record.</p>}
              </section>
            </aside>
          ) : (
            <button type="button" onClick={() => setIsPanelOpen(true)} className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border border-white/10 bg-[#10131a]/95 px-3 py-2 text-sm text-slate-300 backdrop-blur hover:text-white"><ChevronLeft size={16} /> Panel</button>
          )}
        </div>

        <section className={`z-10 shrink-0 border-t border-white/10 bg-[#10131a] transition-[height] ${isDrawerOpen ? "h-52" : "h-11"}`} aria-label="Map analysis drawer">
          <div className="flex h-11 items-center gap-1 overflow-x-auto px-3">
            <SlidersHorizontal size={15} className="text-orange-400" />
            {analysisTabs.map((tab) => <button key={tab} type="button" onClick={() => { setActiveTab(tab); setIsDrawerOpen(true); }} className={`h-full border-b-2 px-2 text-xs font-medium sm:px-3 sm:text-sm ${activeTab === tab && isDrawerOpen ? "border-orange-400 text-orange-200" : "border-transparent text-slate-500 hover:text-slate-200"}`}>{tab}</button>)}
            <button type="button" onClick={() => setIsDrawerOpen((open) => !open)} className="ml-auto rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={isDrawerOpen ? "Collapse analysis drawer" : "Expand analysis drawer"}>{isDrawerOpen ? <ChevronDown size={18} /> : <ChevronDown size={18} className="rotate-180" />}</button>
          </div>
          {isDrawerOpen && <div className="border-t border-white/10 px-4 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-medium text-slate-200">{activeTab}</h2>
              {activeTab === "Activity Calendar" && <div className="flex rounded-md border border-white/10 p-0.5">{calendarPeriods.map((period) => <button key={period} type="button" onClick={() => setCalendarPeriod(period)} className={`rounded px-2 py-1 text-xs ${calendarPeriod === period ? "bg-orange-500/15 text-orange-200" : "text-slate-500 hover:text-slate-200"}`}>{period}</button>)}</div>}
            </div>
            <p className="mt-2 text-sm text-slate-500">Select a region and date range to load {activeTab === "Activity Calendar" ? `${calendarPeriod.toLowerCase()} burning activity` : activeTab.toLowerCase()} from the backend.</p>
          </div>}
        </section>
      </div>
    </AppLayout>
  );
}
