import type { HotspotFeature } from "../../types/hotspotTypes";
import { hotspotRegion } from "../../utils/hotspotUtils";
import { readableDate } from "../../utils/calendarUtils";

type SelectedDayDetailsProps = { date: string; hotspots: HotspotFeature[]; synthetic: boolean };

export default function SelectedDayDetails({ date, hotspots, synthetic }: SelectedDayDetailsProps) {
  return <aside className="rounded-lg border border-white/10 bg-[#10131a] p-4" aria-live="polite">
    <h2 className="text-sm font-semibold text-slate-100">{readableDate(date)}</h2>
    <p className="mt-1 text-xs text-slate-500">{synthetic ? "Synthetic interface fixture" : "Available observation records"}</p>
    {hotspots.length === 0 ? <p className="mt-5 text-sm text-slate-400">No recorded sample data for this date and region.</p> : <><p className="mt-4 text-sm text-orange-200">{hotspots.length} {synthetic ? "synthetic " : ""}detection{hotspots.length === 1 ? "" : "s"}</p><ul className="mt-3 space-y-2">{hotspots.map((hotspot) => <li key={String(hotspot.id ?? hotspot.properties.id)} className="rounded border border-white/8 bg-black/15 p-2 text-xs"><p className="text-slate-200">{hotspotRegion(hotspot)}</p><p className="mt-1 text-slate-500">{String(hotspot.properties.sensor ?? hotspot.properties.satellite ?? "Sensor unavailable")}</p></li>)}</ul></>}
  </aside>;
}
