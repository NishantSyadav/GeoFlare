export default function MapLegend() {
  return (
    <section aria-labelledby="map-legend-title">
      <h2 id="map-legend-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Map legend</h2>
      <div className="mt-3 rounded-md border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm leading-5 text-slate-500">
        Fire-observation symbols will appear here when MODIS or VIIRS data is available.
      </div>
    </section>
  );
}
