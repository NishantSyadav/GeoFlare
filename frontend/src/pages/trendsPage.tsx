import { useState } from "react";
import AppLayout from "../components/layout/appLayout";
import EmptyState from "../components/common/emptyState";
import { InlineError, Spinner } from "../components/common/loadingState";
import { useApi } from "../hooks/useApi";
import { fetchTrends, fetchRegions, type CommonFilters } from "../services/apiClient";

const periods = ["Daily", "Weekly", "Seasonal"] as const;

export default function TrendsPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("Daily");
  const [sensor, setSensor] = useState("All sensors");
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");

  const { data: regions } = useApi(fetchRegions);

  const filters: CommonFilters = {
    region: region || undefined,
    startDate: startDate || undefined,
    sensor: sensor === "All sensors" ? undefined : sensor,
  };

  const { data: trends, loading, error } = useApi(
    () => fetchTrends(filters),
    [period, region, startDate, sensor],
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Burning Activity Trends</h1>

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
            Sensor
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-slate-200 outline-none sm:ml-2 sm:w-auto"
            >
              <option>All sensors</option>
              <option>MODIS</option>
              <option>VIIRS</option>
            </select>
          </label>
          <div className="grid grid-cols-3 rounded-md border border-white/10 p-0.5 sm:flex">
            {periods.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${period === item ? "bg-orange-500/20 text-orange-100" : "text-slate-400 hover:text-slate-200"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <section className="mt-5 bg-[#0d1016] py-6 px-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-slate-200">{period} activity</h2>
            {loading && <Spinner size={16} />}
          </div>

          {error && <InlineError message={error} />}

          {!loading && !error && (!trends || trends.length === 0) && (
            <EmptyState
              title="Trend data is not connected"
              description="This chart will show time-series observations, clearly separated by sensor. Historical overlays require an appropriate harmonized baseline; no values are shown until then."
            />
          )}

          {!loading && !error && trends && trends.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-[34rem] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">MODIS</th>
                    <th className="px-3 py-2 text-right">VIIRS</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {trends.map((row) => (
                    <tr key={row.date} className="text-slate-300 hover:bg-white/[0.03]">
                      <td className="px-3 py-2 tabular-nums text-slate-200">{row.date}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{row.modis ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{row.viirs ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-right font-medium text-orange-300">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Summary cards */}
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="bg-[#10131a] p-4">
            <h2 className="text-base font-medium text-slate-200">Selected range summary</h2>
            <p className="mt-2 text-sm text-slate-500">
              {trends && trends.length > 0
                ? `${trends.length} data points loaded.`
                : "No observation summary is available."}
            </p>
          </div>
          <div className="bg-[#10131a] p-4">
            <h2 className="text-base font-medium text-slate-200">Sensor note</h2>
            <p className="mt-2 text-sm text-slate-500">MODIS and VIIRS observations are not raw-count equivalents because their spatial resolutions differ.</p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
