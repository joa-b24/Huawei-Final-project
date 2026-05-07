import type { StateAnalyticsRow } from "../types/analytics";

export function giniPercentileAmongStates(states: StateAnalyticsRow[], cveEnt: string): number | null {
  const g = states.find((s) => s.cve_ent === cveEnt)?.gini_pob_pct_4g;
  if (g === undefined || !states.length) {
    return null;
  }
  const vals = states.map((s) => s.gini_pob_pct_4g).sort((a, b) => a - b);
  const below = vals.filter((v) => v < g).length;
  return Math.round((below / vals.length) * 100);
}

export function formatSpearman(r: number | null | undefined): string {
  if (r === null || r === undefined || Number.isNaN(r)) {
    return "no disponible (muestra muy pequeña o sin varianza)";
  }
  return r.toFixed(3);
}

export function strengthLabel(r: number): "débil" | "moderada" | "fuerte" {
  const a = Math.abs(r);
  if (a < 0.25) {
    return "débil";
  }
  if (a < 0.5) {
    return "moderada";
  }
  return "fuerte";
}
