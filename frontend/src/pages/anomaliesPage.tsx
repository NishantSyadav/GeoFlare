import AppLayout from "../components/layout/appLayout";
import EmptyState from "../components/common/emptyState";
import { InlineError, SkeletonRow, Spinner } from "../components/common/loadingState";
import { useApi } from "../hooks/useApi";
import { fetchAnomalies, fetchRegions, type AnomalyRecord, type CommonFilters } from "../services/apiClient";
import { useState } from "react";

const STATUS_STYLE: Record<AnomalyRecord["status"], string> = {
  normal: "text-emerald-400",
  elevated: "text-amber-400",
  extreme: "text-red-400",
};

export default function AnomaliesPage() {
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const { data: regions } = useApi(fetchRegions);

  const filters: CommonFilters = {
    region: region || undefined,
    startDate: startDate || undefined,
  };

  const { data: anomalies, loading, error } = useApi(
    () => fetchAnomalies(filters),
    [region, startDate, statusFilter],
  );

  const visible = anomalies?.filter(
    (a) => statusFilter === "All statuses" || a.status === statusFilter.toLowerCase(),
  ) ?? null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Fire Activity Anomalies</h1>
          {loading && <Spinner size={18} />}
        </div>

        {/* Filter bar */}
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
          <label className="flex flex-col gap-1 text-sm text-slate-300 sm:flex-row sm:items-center">
            Region
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-slate-200 outline-none sm:ml-2 sm:w-auto"
            >
              <option value="">All regions</option>
              {regions?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300 sm:flex-row sm:items-center">
            Date range
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1 text-slate-200 [color-scheme:dark] outline-none sm:ml-2 sm:w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300 sm:flex-row sm:items-center">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-slate-200 outline-none sm:ml-2 sm:w-auto"
            >
              <option>All statuses</option>
              <option>Normal</option>
              <option>Elevated</option>
              <option>Extreme</option>
            </select>
          </label>
        </div>

        {/* Results table */}
        <section className="mt-5 bg-[#0d1016] py-4">
          <h2 className="px-4 text-lg font-semibold text-slate-200">Anomaly results</h2>

          {error && <InlineError message={error} />}

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[40rem] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Sensor</th>
                  <th className="px-4 py-3">Hotspot Count</th>
                  <th className="px-4 py-3">Baseline</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} cols={6} />)}

                {!loading && !error && (!visible || visible.length === 0) && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No anomaly analysis is available"
                        description="Results will appear here when observations, baseline comparisons, sensor information, and a calculated status have been supplied by the analysis service."
                      />
                    </td>
                  </tr>
                )}

                {!loading && !error && visible && visible.map((row) => (
                  <tr key={row.id} className="text-slate-300 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 tabular-nums text-slate-200">{row.date}</td>
                    <td className="px-4 py-3">{row.region}</td>
                    <td className="px-4 py-3 text-slate-400">{row.sensor}</td>
                    <td className="px-4 py-3 tabular-nums">{row.hotspotCount.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{row.baselineCount.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-medium capitalize ${STATUS_STYLE[row.status]}`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
