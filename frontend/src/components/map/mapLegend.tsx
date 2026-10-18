export default function MapLegend() {
  return (
    <section aria-labelledby="map-legend-title">
      <h2 id="map-legend-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Map legend</h2>
      <div className="mt-3 rounded-md border border-orange-500/15 bg-black/10 px-3 py-3 text-xs leading-5 text-slate-400">
        <div className="flex items-center gap-2 text-slate-200"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-[#ff5938] bg-[#fff1cf] shadow-[0_0_10px_4px_rgba(255,59,31,0.45)]" />Satellite-observed hotspot</div>
        <p className="mt-2">The glow makes observations easier to locate. It does not indicate measured fire intensity, size, or severity.</p>
        <p className="mt-2 text-slate-500">Symbols appear when a real MODIS or VIIRS dataset is supplied.</p>
      </div>
    </section>
  );
}
