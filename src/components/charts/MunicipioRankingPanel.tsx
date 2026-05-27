import { useMemo, useState } from "react";
import InfoTooltip from "../feedback/InfoTooltip";
import type { MunVar } from "./MunicipioDistPanel";

type GeoFeature = { properties: Record<string, any> };
type VarRecord = { cve_mun: string; value: number };
type CombinedData = { state_code: string; variables: Record<string, { year: number; records: VarRecord[] }> };

type Props = {
  features: GeoFeature[];
  combined: CombinedData;
  munVars: MunVar[];
};

type Row = { rank: number; name: string; value: number; pct: number };

export default function MunicipioRankingPanel({ features, combined, munVars }: Props) {
  const [varId, setVarId] = useState(munVars[0]?.id ?? "");
  const [view, setView] = useState<"top" | "bottom">("top");

  const currentVar = munVars.find((v) => v.id === varId) ?? munVars[0];
  const unit = currentVar?.unit;
  const varLabel = currentVar?.label ?? varId;
  const direction = currentVar?.direction ?? "higher_better";

  const nameMap = useMemo(
    () => new Map(features.map((f) => [f.properties.cvegeo as string, (f.properties.nom_mun ?? f.properties.cvegeo ?? "—") as string])),
    [features]
  );

  const { top, bottom } = useMemo(() => {
    const records = combined.variables[varId]?.records ?? [];
    const withData = records
      .filter((r) => r.value !== null && r.value !== undefined && !isNaN(r.value))
      .map((r) => ({ name: nameMap.get(r.cve_mun) ?? r.cve_mun, value: r.value }));

    if (!withData.length) return { top: [], bottom: [] };

    const sorted =
      direction === "lower_better"
        ? [...withData].sort((a, b) => a.value - b.value)
        : [...withData].sort((a, b) => b.value - a.value);

    const avg = sorted.reduce((s, r) => s + r.value, 0) / sorted.length;

    const toRow = (r: { name: string; value: number }, i: number): Row => ({
      rank: i + 1,
      name: r.name,
      value: r.value,
      pct: avg !== 0 ? ((r.value - avg) / Math.abs(avg)) * 100 : 0,
    });

    return {
      top: sorted.slice(0, 10).map(toRow),
      bottom: sorted
        .slice(-10)
        .reverse()
        .map((r, i) => toRow(r, sorted.length - 10 + i)),
    };
  }, [combined, varId, direction, nameMap]);

  const isGood = (pct: number) =>
    (direction === "higher_better" && pct >= 0) ||
    (direction === "lower_better" && pct <= 0);

  const rows = view === "top" ? top : bottom;

  return (
    <section className="panel ranking-panel">
      <div className="ranking-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <p className="panel-title" style={{ margin: 0 }}>Ranking municipal</p>
          <InfoTooltip
            wide
            text={
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
                <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Posición relativa</p>
                <p style={{ margin: 0 }}>
                  Municipios ordenados de <strong>mejor a peor</strong> desempeño según la dirección de la variable. El <strong>% vs media</strong> indica cuánto se aleja el municipio del promedio estatal: verde = favorable, rojo = desfavorable.
                </p>
              </div>
            }
          />
        </div>
        {munVars.length > 1 && (
          <select
            className="ranking-var-select"
            value={varId}
            onChange={(e) => setVarId(e.target.value)}
          >
            {munVars.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}
      </div>

      <div
        className="toggle-pill ranking-panel__toggle"
        role="group"
        aria-label="Vista del ranking"
      >
        <button
          type="button"
          className={`toggle-pill__btn${view === "top" ? " active" : ""}`}
          onClick={() => setView("top")}
        >
          Mejor desempeño
        </button>
        <button
          type="button"
          className={`toggle-pill__btn${view === "bottom" ? " active" : ""}`}
          onClick={() => setView("bottom")}
        >
          Menor desempeño
        </button>
      </div>

      {!rows.length ? (
        <p style={{ color: "var(--text-3)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Sin datos para esta variable.
        </p>
      ) : (
        <table className="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Municipio</th>
              <th>{varLabel}{unit ? ` (${unit})` : ""}</th>
              <th>vs media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rank}>
                <td style={{ color: "var(--text-3)", width: 32 }}>{row.rank}</td>
                <td>{row.name}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.value.toFixed(1)}</td>
                <td
                  style={{
                    color: isGood(row.pct) ? "var(--green)" : "var(--red)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.pct >= 0 ? "+" : ""}
                  {row.pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
