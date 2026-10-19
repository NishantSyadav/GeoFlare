import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import AppLayout from "../components/layout/appLayout";
import { SkeletonRow, InlineError } from "../components/common/loadingState";
import EmptyState from "../components/common/emptyState";
import { useApi } from "../hooks/useApi";
import {
  fetchReports,
  downloadHotspotsCsv,
  downloadSummaryCsv,
  type ReportRow,
  type CommonFilters,
} from "../services/apiClient";

const SENSORS = ["All sensors", "MODIS", "VIIRS"];

const STATUS_STYLE: Record<ReportRow["anomalyStatus"], string> = {
  normal: "text-emerald-400",
  elevated: "text-amber-400",
  extreme: "text-red-400",
  pending: "text-slate-500",
};

export default function ReportsPage() {
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sensor, setSensor] = useState("All sensors");
  const [downloading, setDownloading] = useState(false);

  const filters: CommonFilters = {
    region: region || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sensor: sensor === "All sensors" ? undefined : sensor,
  };

  const { data: rows, loading, error, refetch } = useApi(
    () => fetchReports(filters),
    [region, startDate, endDate, sensor],
  );

  async function handleDownload(type: "hotspots" | "summary") {
    setDownloading(true);
    try {
      if (type === "hotspots") await downloadHotspotsCsv(filters);
      else await downloadSummaryCsv(filters);
    } catch {
      /* silently handle — user sees browser error or nothing */
    } finally {
      setDownloading(false);
    }
  }

  const apiReady = !!import.meta.env.VITE_API_BASE_URL;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Exports &amp; Reports</h1>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              disabled={!apiReady || downloading}
              onClick={() => handleDownload("hotspots")}
              title={apiReady ? "Download filtered hotspot CSV" : "Connect API to enable export"}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-3 py-2 text-sm text-slate-300 transition hover:border-orange-400/50 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <Download size={15} /> Hotspots CSV
            </button>
            <button
              type="button"
              disabled={!apiReady || downloading}
              onClick={() => handleDownload("summary")}
              title={apiReady ? "Download regional summary CSV" : "Connect API to enable export"}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-[#151a22] px-3 py-2 text-sm text-slate-300 transition hover:border-orange-400/50 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <Download size={15} /> Summary CSV
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-sm text-slate-400 sm:flex-row sm:items-center">
            Region
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Rajasthan"
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 sm:ml-2 sm:w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400 sm:flex-row sm:items-center">
            From
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-sm text-slate-200 [color-scheme:dark] outline-none sm:ml-2 sm:w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400 sm:flex-row sm:items-center">
            To
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-sm text-slate-200 [color-scheme:dark] outline-none sm:ml-2 sm:w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400 sm:flex-row sm:items-center">
            Sensor
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#151a22] px-2 py-1.5 text-sm text-slate-200 outline-none sm:ml-2 sm:w-auto"
            >
              {SENSORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#151a22] px-3 py-1.5 text-sm text-slate-400 transition hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* ── Data table ──────────────────────────────────────────────── */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[45rem] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Sensor</th>
                <th className="px-4 py-3">Hotspot Count</th>
                <th className="px-4 py-3">Anomaly Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading &&
                Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} cols={6} />)}

              {!loading && error && (
                <tr>
                  <td colSpan={6}><InlineError message={error} /></td>
                </tr>
              )}

              {!loading && !error && (!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={apiReady ? "No records match the current filters" : "No data — API not connected"}
                      description={
                        apiReady
                          ? "Adjust the region, date range, or sensor filters and refresh."
                          : "Set VITE_API_BASE_URL in your .env file to load live report data."
                      }
                    />
                  </td>
                </tr>
              )}

              {!loading && !error && rows && rows.map((row) => (
                <tr key={row.id} className="text-slate-300 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 tabular-nums text-slate-200">{row.date}</td>
                  <td className="px-4 py-3">{row.region}</td>
                  <td className="px-4 py-3 text-slate-400">{row.sensor}</td>
                  <td className="px-4 py-3 tabular-nums">{row.hotspotCount.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-medium capitalize ${STATUS_STYLE[row.anomalyStatus]}`}>
                    {row.anomalyStatus}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={!apiReady}
                      onClick={() => handleDownload("hotspots")}
                      className="text-xs text-orange-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        {!apiReady && (
          <p className="mt-6 text-xs text-slate-600">
            Export buttons are active once <code className="text-slate-500">VITE_API_BASE_URL</code> is configured.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
