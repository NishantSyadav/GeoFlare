import { useCallback, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Expand,
  Layers3,
  MapPin,
  Minimize,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import AppLayout from "../components/layout/appLayout";
import HotspotMap from "../components/map/hotspotMap";
import MapLegend from "../components/map/mapLegend";
import { emptyHotspotFeatureCollection, type HotspotFeature } from "../types/hotspotTypes";
import { isMockHotspotsEnabled } from "../dev/mockHotspotConfig";
import { useApi } from "../hooks/useApi";
import { fetchRegions } from "../services/apiClient";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof analysisTabs)[number]>("Activity Calendar");
  const [calendarPeriod, setCalendarPeriod] = useState<(typeof calendarPeriods)[number]>("Daily");
  const [mapError, setMapError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [observationSystem, setObservationSystem] = useState("all");
  const [layerVisibility, setLayerVisibility] = useState({ boundaries: true, observations: isMockHotspotsEnabled });
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotFeature | null>(null);

  const { data: regions } = useApi(fetchRegions);

  const handleMapError = useCallback((message: string) => setMapError(message), []);
  const toggleLayer = (layer: keyof typeof layerVisibility) => {
    setLayerVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <AppLayout fullHeight>
      <div className="relative flex h-full min-h-0 flex-col bg-[#090b0f]">

        {/* ── Top control bar ─────────────────────────────────────────── */}
        <section
          className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#10131a] px-3 py-2"
          aria-label="Map controls"
        >
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-300 sm:flex-none">
            <MapPin size={15} className="text-orange-400" />
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-36 sm:flex-none" aria-label="Region selection">
              <option value="">All regions</option>
              {regions?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="flex h-9 w-full items-center gap-1.5 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-400 sm:w-auto sm:gap-2">
            <CalendarRange size={15} className="text-orange-400" />
            <input type="date" aria-label="Start date" className="min-w-0 flex-1 bg-transparent text-xs outline-none [color-scheme:dark] sm:w-28 sm:flex-none" />
            <span className="text-slate-600">—</span>
            <input type="date" aria-label="End date" className="min-w-0 flex-1 bg-transparent text-xs outline-none [color-scheme:dark] sm:w-28 sm:flex-none" />
          </label>
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-sm text-slate-300 sm:flex-none">
            <span className="text-xs uppercase tracking-wide text-slate-500">System</span>
            <select value={observationSystem} onChange={(e) => setObservationSystem(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:flex-none" aria-label="Observation system">
              <option value="all">All sensors</option>
              <option>MODIS</option>
              <option>VIIRS</option>
            </select>
          </label>
          <label className="flex h-9 w-full items-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-2.5 text-slate-400 focus-within:border-orange-400/60 sm:ml-auto sm:w-auto">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search place" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600 sm:w-40 sm:flex-none" aria-label="Search places" />
          </label>
        </section>

        {/* ── Main body: map + side panel ─────────────────────────────── */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">

          {/* Map canvas — 2/3 width (or full when fullscreen) */}
          <div
            className={`relative flex-1 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}
          >
            <HotspotMap
              fireData={emptyHotspotFeatureCollection}
              boundariesVisible={layerVisibility.boundaries}
              observationsVisible={layerVisibility.observations}
              sensor={observationSystem}
              onError={handleMapError}
              onHotspotSelect={setSelectedHotspot}
            />

            {/* Map status badge */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-[#10131a]/90 px-3 py-2 backdrop-blur">
              <p className="text-xs font-medium text-slate-200">India overview</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {isMockHotspotsEnabled ? "SYNTHETIC DATA — interface testing only" : "Observation layer is awaiting real data"}
              </p>
            </div>

            {/* Error toast */}
            {mapError && (
              <div role="alert" className="absolute bottom-3 left-3 max-w-sm rounded-md border border-orange-400/30 bg-[#19120d]/95 px-3 py-2 text-xs text-orange-200">
                {mapError}
              </div>
            )}

            {/* Map overlay controls */}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
              {/* Full-screen toggle */}
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label={isFullscreen ? "Exit full-screen" : "Enter full-screen"}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#10131a]/95 text-slate-300 backdrop-blur hover:border-orange-400/50 hover:text-orange-200 transition"
              >
                {isFullscreen ? <Minimize size={16} /> : <Expand size={16} />}
              </button>
              {/* Panel toggle (only when NOT fullscreen) */}
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsPanelOpen((v) => !v)}
                  aria-label={isPanelOpen ? "Collapse side panel" : "Expand side panel"}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#10131a]/95 text-slate-300 backdrop-blur hover:border-orange-400/50 hover:text-orange-200 transition"
                >
                  <Layers3 size={16} />
                </button>
              )}
            </div>
          </div>

          {isPanelOpen && !isFullscreen && (
            <button
              type="button"
              aria-label="Close map workspace panel"
              onClick={() => setIsPanelOpen(false)}
              className="absolute inset-0 z-10 cursor-default bg-black/45 lg:hidden"
            />
          )}

          {/* Side panel — desktop 1/3 sidebar, mobile full-width bottom sheet */}
          <aside
            aria-label="Map workspace panel"
            className={`absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] flex-col overflow-hidden rounded-t-xl border-t border-white/10 bg-[#10131a] shadow-2xl transition-transform duration-300 lg:static lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none lg:transition-[width] ${isPanelOpen && !isFullscreen ? "translate-y-0 lg:w-1/3" : "translate-y-full lg:w-0 lg:translate-y-0"}`}
          >
            {isPanelOpen && (
              <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
                <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/20 lg:hidden" aria-hidden="true" />
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">Map Workspace</h2>
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                    aria-label="Collapse map panel"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                {/* Layer controls */}
                <section className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Visible layers</h3>
                  <div className="mt-3 space-y-3 text-sm text-slate-300">
                    <label className="flex items-center justify-between gap-3">
                      <span>Reference boundaries</span>
                      <input type="checkbox" checked={layerVisibility.boundaries} onChange={() => toggleLayer("boundaries")} className="accent-orange-500" />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span>Fire observations</span>
                      <input type="checkbox" checked={layerVisibility.observations} onChange={() => toggleLayer("observations")} className="accent-orange-500" />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">Observation layers remain empty until backend data is connected.</p>
                </section>

                <div className="my-5 border-t border-white/10" />
                <MapLegend />

                {/* Selected hotspot */}
                <div className="my-5 border-t border-white/10" />
                <section aria-live="polite">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected hotspot</h3>
                  {selectedHotspot ? (
                    <dl className="mt-3 space-y-2 text-xs">
                      {selectedHotspotDetails(selectedHotspot).map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="text-right text-slate-200">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Select a hotspot to view the values supplied by its observation record.</p>
                  )}
                </section>

                {/* ── Analysis tabs (relocated from bottom drawer) ──── */}
                <div className="my-5 border-t border-white/10" />
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <SlidersHorizontal size={14} className="text-orange-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Analysis</h3>
                  </div>
                  {/* Tab buttons */}
                  <div className="flex flex-col gap-1">
                    {analysisTabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-md px-3 py-2 text-left text-sm transition ${
                          activeTab === tab
                            ? "bg-orange-500/15 text-orange-200"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="mt-4 bg-[#0d1016] rounded-md p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-sm font-medium text-slate-200">{activeTab}</p>
                      {activeTab === "Activity Calendar" && (
                        <div className="flex rounded-md border border-white/10 p-0.5">
                          {calendarPeriods.map((period) => (
                            <button
                              key={period}
                              type="button"
                              onClick={() => setCalendarPeriod(period)}
                              className={`rounded px-2 py-1 text-xs transition ${calendarPeriod === period ? "bg-orange-500/15 text-orange-200" : "text-slate-500 hover:text-slate-200"}`}
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Select a region and date range to load{" "}
                      {activeTab === "Activity Calendar" ? `${calendarPeriod.toLowerCase()} burning activity` : activeTab.toLowerCase()} from the backend.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
