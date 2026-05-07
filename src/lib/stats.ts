import type { OutlierEntry } from "../types/dataStandard";
import type { StateMetricRecord } from "../types/dataset";

export function minMaxNormalize(values: (number | null)[]): (number | null)[] {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return values.map(() => null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return values.map((v) => (v === null ? null : 50));
  return values.map((v) =>
    v === null || isNaN(v) ? null : ((v - min) / (max - min)) * 100
  );
}

export function calcDelta(value: number, benchmark: number): number {
  return value - benchmark;
}

export function isOutlier(value: number, entry: OutlierEntry): boolean {
  return value < entry.bounds.lower || value > entry.bounds.upper;
}

export function isStateOutlier(stateCode: string, entry: OutlierEntry): boolean {
  return entry.outlier_states.includes(stateCode);
}

export function calcNationalMean(records: StateMetricRecord[], metricId: string): number | null {
  const vals = records
    .map((r) => r.metrics[metricId])
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Two-tailed p-value for a Pearson correlation with n observations. */
export function corrPValue(r: number, n: number): number {
  if (n <= 2) return 1;
  const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  const df = n - 2;
  // Normal approximation (accurate for df >= 20)
  const z = Math.abs(t) * (1 - 1 / (4 * df));
  const p = 2 * (1 - 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI))));
  return Math.min(1, Math.max(0, p));
}

/** Returns normalized [0–100] values per state per metric for radar charts. */
export function normalizeForRadar(
  records: StateMetricRecord[],
  metricIds: string[]
): Map<string, Record<string, number | null>> {
  const result = new Map<string, Record<string, number | null>>();

  for (const metricId of metricIds) {
    const values = records.map((r) => r.metrics[metricId] ?? null);
    const normalized = minMaxNormalize(values);
    records.forEach((r, i) => {
      if (!result.has(r.state)) result.set(r.state, {});
      result.get(r.state)![metricId] = normalized[i];
    });
  }

  return result;
}
