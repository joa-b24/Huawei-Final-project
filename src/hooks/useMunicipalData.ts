import { useEffect, useRef, useState } from "react";
import type { MunicipalAnalytics, MunicipalManifest } from "../services/DataService";

type Status = "idle" | "loading" | "ready" | "error" | "unavailable";

type UseMunicipalDataResult = {
  data: MunicipalAnalytics | null;
  status: Status;
};

const cache = new Map<string, MunicipalAnalytics>();

/**
 * Lazy-fetches municipal analytics for the given state when:
 *   - stateCode is non-null
 *   - manifest confirms analytics_available for that state
 *
 * Results are cached in memory for the session lifetime.
 */
export function useMunicipalData(
  stateCode: string | null,
  manifest: MunicipalManifest | null
): UseMunicipalDataResult {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<MunicipalAnalytics | null>(null);
  const lastFetched = useRef<string | null>(null);

  useEffect(() => {
    if (!stateCode) {
      setData(null);
      setStatus("idle");
      return;
    }

    const manifestEntry = manifest?.states[stateCode];
    if (!manifestEntry?.analytics_available) {
      setData(null);
      setStatus("unavailable");
      return;
    }

    // Already fetched this state in this session
    if (lastFetched.current === stateCode && cache.has(stateCode)) {
      setData(cache.get(stateCode)!);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    lastFetched.current = stateCode;

    fetch(`/data/outputs/municipal/${stateCode}/analytics.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MunicipalAnalytics>;
      })
      .then((d) => {
        cache.set(stateCode, d);
        setData(d);
        setStatus("ready");
      })
      .catch(() => {
        setData(null);
        setStatus("error");
      });
  }, [stateCode, manifest]);

  return { data, status };
}
