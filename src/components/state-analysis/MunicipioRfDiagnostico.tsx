import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MunicipioAnalyticsRecord, RfFeatureImportance } from "../../types/analytics";
import InterpretationHelp from "./InterpretationHelp";

type SortKey = "nom_mun" | "pob_pct_4g_garantizada" | "rf_4g_esperada" | "rf_brecha_4g_pp";

type Props = {
  municipios: MunicipioAnalyticsRecord[];
  featureImportances: RfFeatureImportance[];
};

function brechaColor(gap: number | undefined): string {
  if (gap == null || !Number.isFinite(gap)) return "#64748b";
  if (gap < -5) return "#dc2626";
  if (gap < 0) return "#f97316";
  if (gap > 5) return "#16a34a";
  return "#64748b";
}

export default function MunicipioRfDiagnostico({ municipios, featureImportances }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rf_brecha_4g_pp");
  const [asc, setAsc] = useState(true);

  const hasRf = municipios.some((m) => m.rf_4g_esperada != null);

  const sorted = useMemo(() => {
    const copy = [...municipios];
    copy.sort((a, b) => {
      if (sortKey === "nom_mun") {
        return asc
          ? a.nom_mun.localeCompare(b.nom_mun, "es")
          : b.nom_mun.localeCompare(a.nom_mun, "es");
      }
      const va = (a[sortKey] as number | undefined) ?? (sortKey === "rf_brecha_4g_pp" ? Infinity : -Infinity);
      const vb = (b[sortKey] as number | undefined) ?? (sortKey === "rf_brecha_4g_pp" ? Infinity : -Infinity);
      return asc ? va - vb : vb - va;
    });
    return copy;
  }, [municipios, sortKey, asc]);

  const barData = useMemo(
    () =>
      [...featureImportances]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 8)
        .map((f) => ({
          label: f.label.length > 32 ? `${f.label.slice(0, 32)}…` : f.label,
          importance: f.importance,
        })),
    [featureImportances]
  );

  const toggle = (k: SortKey) => {
    if (k === sortKey) {
      setAsc(!asc);
    } else {
      setSortKey(k);
      setAsc(k === "nom_mun" || k === "rf_brecha_4g_pp");
    }
  };

  const topFeature = featureImportances[0]?.label ?? "—";

  return (
    <div>
      <div className="section-heading">
        <h2>Diagnóstico municipal (Random Forest)</h2>
        <p>
          Compara la cobertura 4G observada con la esperada según el perfil socioeconómico del municipio.
          Brecha negativa: cobertura por debajo de lo que sugieren municipios con perfil similar.
        </p>
      </div>

      <InterpretationHelp
        topic="Diagnóstico RF de cobertura 4G por municipio"
        caption="Ayuda: diagnóstico RF"
        heading="Interpretación posible"
      >
        <p>
          Un modelo Random Forest estima la cobertura esperada a partir de escolaridad, rezago social,
          estructura demográfica y población. La <strong>brecha</strong> es cobertura real menos esperada.
        </p>
        <p>
          Brecha negativa: el municipio quedaría por debajo de lo que el modelo asocia a su perfil.
          Brecha positiva: por encima. El <strong>factor principal</strong> señala la variable donde el
          municipio más se aparta del patrón típico.
        </p>
        {topFeature !== "—" ? (
          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
            En este estado, la variable con mayor peso global en el modelo es{" "}
            <strong>{topFeature}</strong>.
          </p>
        ) : null}
      </InterpretationHelp>

      {barData.length > 0 ? (
        <div className="chart-frame" style={{ height: Math.max(220, barData.length * 32), marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, "auto"]} tickFormatter={(v) => v.toFixed(2)} />
              <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v.toFixed(3), "Importancia"]} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]} fill="#2563eb" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {!hasRf ? (
        <p style={{ padding: 16, color: "#64748b", background: "#f8fafc", borderRadius: 8 }}>
          Ejecuta <code>python3 scripts/enrich_rf_diagnostics.py</code> o{" "}
          <code>npm run data:build:analytics</code> para generar las columnas de diagnóstico RF.
        </p>
      ) : null}

      <div
        style={{
          overflowX: "auto",
          maxHeight: 420,
          overflowY: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
            <tr>
              {(
                [
                  ["nom_mun", "Municipio"],
                  ["pob_pct_4g_garantizada", "Cobertura real"],
                  ["rf_4g_esperada", "Cobertura esperada"],
                  ["rf_brecha_4g_pp", "Brecha (pp)"],
                  ["rf_factor_principal", "Factor principal"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderBottom: "1px solid #e2e8f0",
                    cursor: key !== "rf_factor_principal" ? "pointer" : "default",
                  }}
                  onClick={() => (key !== "rf_factor_principal" ? toggle(key as SortKey) : undefined)}
                >
                  {label}
                  {key !== "rf_factor_principal" && sortKey === key ? (asc ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.cvegeo} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>{m.nom_mun}</td>
                <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>
                  {m.pob_pct_4g_garantizada?.toFixed(1) ?? "—"}%
                </td>
                <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>
                  {m.rf_4g_esperada != null ? `${m.rf_4g_esperada.toFixed(1)}%` : "—"}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: brechaColor(m.rf_brecha_4g_pp),
                  }}
                >
                  {m.rf_brecha_4g_pp != null
                    ? `${m.rf_brecha_4g_pp >= 0 ? "+" : ""}${m.rf_brecha_4g_pp.toFixed(1)}`
                    : "—"}
                </td>
                <td style={{ padding: "6px 10px", color: "#475569", maxWidth: 180 }}>
                  {m.rf_factor_principal ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
