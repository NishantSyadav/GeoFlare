import AppLayout from "../components/layout/appLayout";
import EmptyState from "../components/common/emptyState";
import { Download } from "lucide-react";
export default function ReportsPage() {
  return <AppLayout><div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-orange-400">Reports</p><h1 className="mt-2 text-3xl font-semibold">Exports and Reports</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose an export format when connected analysis results are available.</p>
    <section className="mt-6 rounded-xl border border-white/10 bg-[#0d1016] p-6" aria-label="Report download">
      <div className="mb-5 flex flex-wrap items-end gap-4"><label className="text-sm text-slate-300">Format<select className="mt-2 block rounded-md border border-white/10 bg-[#151a22] px-3 py-2" defaultValue="csv"><option value="csv">CSV observations</option><option value="geojson">GeoJSON observations</option><option value="pdf">PDF analysis report</option></select></label><button type="button" disabled aria-describedby="report-availability" className="flex cursor-not-allowed items-center gap-2 rounded-md bg-orange-500/20 px-4 py-2 text-sm text-orange-200/50"><Download size={16} />Download report</button></div>
      <p id="report-availability" className="mb-5 text-sm text-slate-400">Download is unavailable until real observations or calculated analysis results are supplied.</p>
      <EmptyState title="Nothing is ready to export" description="No report is generated without source data. Missing observations do not mean zero fire activity." />
    </section>
  </div></AppLayout>;
}
