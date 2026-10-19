/**
 * GeoFlare API Service Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Set VITE_API_BASE_URL in your .env file to point to the backend.
 * Without it, all calls gracefully return empty data (no crashes, no mocks).
 *
 *   VITE_API_BASE_URL=http://localhost:8000
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// ─── Generic fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

/** Triggers a file download from a binary/blob endpoint */
async function apiDownload(path: string, filename: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`, window.location.href);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Accept: "*/*" } });
  if (!res.ok) throw new Error(`Export failed ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Shared query param builder ───────────────────────────────────────────────

function buildQuery(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version?: string;
  timestamp?: string;
}

export interface Region {
  id: string;
  name: string;
  bbox?: [number, number, number, number];
}

export interface HotspotRecord {
  id: string;
  latitude: number;
  longitude: number;
  acqDatetimeUtc: string;
  sensor: string;
  confidence: string;
  frpMw?: number;
  region?: string;
}

export interface CalendarDay {
  date: string;      // "YYYY-MM-DD"
  count: number;
}

export interface TrendPoint {
  date: string;
  modis?: number;
  viirs?: number;
  total: number;
}

export interface AnomalyRecord {
  id: string;
  date: string;
  region: string;
  sensor: string;
  hotspotCount: number;
  baselineCount: number;
  status: "normal" | "elevated" | "extreme";
}

export interface ReportRow {
  id: string;
  date: string;
  region: string;
  sensor: string;
  hotspotCount: number;
  anomalyStatus: "normal" | "elevated" | "extreme" | "pending";
}

// ─── Filter params shared by most endpoints ───────────────────────────────────

export interface CommonFilters {
  region?: string;
  startDate?: string;
  endDate?: string;
  sensor?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** GET /api/health */
export const fetchHealth = () => apiFetch<HealthStatus>("/api/health");

/** GET /api/regions */
export const fetchRegions = () => apiFetch<Region[]>("/api/regions");

/** GET /api/hotspots */
export const fetchHotspots = (filters: CommonFilters = {}) =>
  apiFetch<HotspotRecord[]>(`/api/hotspots${buildQuery(filters)}`);

/** GET /api/calendar */
export const fetchCalendar = (filters: CommonFilters = {}) =>
  apiFetch<CalendarDay[]>(`/api/calendar${buildQuery(filters)}`);

/** GET /api/analytics/trends */
export const fetchTrends = (filters: CommonFilters = {}) =>
  apiFetch<TrendPoint[]>(`/api/analytics/trends${buildQuery(filters)}`);

/** GET /api/analytics/anomalies */
export const fetchAnomalies = (filters: CommonFilters = {}) =>
  apiFetch<AnomalyRecord[]>(`/api/analytics/anomalies${buildQuery(filters)}`);

/** GET /api/reports  (composite view: date + region + hotspot count + status) */
export const fetchReports = (filters: CommonFilters = {}) =>
  apiFetch<ReportRow[]>(`/api/reports${buildQuery(filters)}`);

/** GET /api/exports/hotspots  — triggers CSV download */
export const downloadHotspotsCsv = (filters: CommonFilters = {}) =>
  apiDownload("/api/exports/hotspots", "geoflare_hotspots.csv", filters as Record<string, string>);

/** GET /api/exports/summary  — triggers CSV download */
export const downloadSummaryCsv = (filters: CommonFilters = {}) =>
  apiDownload("/api/exports/summary", "geoflare_summary.csv", filters as Record<string, string>);
