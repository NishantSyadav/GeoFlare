/**
 * useApi — lightweight generic data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi(fetchRegions);
 *   const { data, loading } = useApi(() => fetchReports({ region, startDate }), [region, startDate]);
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use a counter to allow manual refetch
  const [tick, setTick] = useState(0);
  const cancelled = useRef(false);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    // Skip fetch when no API base URL is configured
    if (!import.meta.env.VITE_API_BASE_URL) {
      setLoading(false);
      setData(null);
      return;
    }
    cancelled.current = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!cancelled.current) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled.current) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refetch };
}
