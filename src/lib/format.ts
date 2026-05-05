import type { MetricDirection, TipoValor } from "../types/dataStandard";

export function formatValue(val: number | null | undefined, tipoValor: TipoValor = "number"): string {
  if (val === null || val === undefined || isNaN(val)) return "N/D";
  switch (tipoValor) {
    case "percentage":
      return `${val.toFixed(1)} %`;
    case "currency":
      return `$${val.toLocaleString("es-MX", { maximumFractionDigits: 0 })} M`;
    case "integer":
      return val.toLocaleString("es-MX", { maximumFractionDigits: 0 });
    case "number":
    default:
      return val.toFixed(2);
  }
}

export type DeltaDisplay = {
  text: string;
  color: string;
  arrow: "▲" | "▼" | "";
};

export function formatDelta(
  delta: number | null | undefined,
  direction: MetricDirection,
  tipoValor?: TipoValor
): DeltaDisplay {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return { text: "", color: "var(--text-3)", arrow: "" };
  }
  const isPositive = delta > 0;
  const isGood = direction === "higher_better" ? isPositive : !isPositive;
  const suffix = tipoValor === "percentage" ? " pp" : "";
  return {
    text: `${isPositive ? "+" : ""}${delta.toFixed(1)}${suffix}`,
    color: isGood ? "var(--green)" : "var(--red)",
    arrow: isPositive ? "▲" : "▼",
  };
}

export function formatPValue(p: number): string {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}

export function formatCorrelation(r: number): string {
  return r.toFixed(2);
}
