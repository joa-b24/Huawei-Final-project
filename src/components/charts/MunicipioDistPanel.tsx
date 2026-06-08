import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import InfoTooltip from "../feedback/InfoTooltip";
import InlineBoxplot from "./InlineBoxplot";
import ChartWrapper from "./ChartWrapper";

type GeoFeature = { properties: Record<string, any> };
type VarRecord = { cve_mun: string; value: number };
type CombinedVar = {
  year: number;
  records: VarRecord[];
  stats?: { count: number; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number };
};
type CombinedData = { state_code: string; variables: Record<string, CombinedVar> };
export type MunVar = { id: string; label: string; unit: string; direction?: string };

type Props = {
  features: GeoFeature[];
  combined: CombinedData;
  munVars: MunVar[];
  varId: string;
  primaryState?: string;
};

const MAX_TOOLTIP_ITEMS = 10;

function MunBinTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const muns: string[] = d.muns ?? [];
  const shown = muns.slice(0, MAX_TOOLTIP_ITEMS);
  const extra = muns.length - MAX_TOOLTIP_ITEMS;
  const twoCol = shown.length > 5;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 12px", fontSize: 12,
      maxWidth: twoCol ? 300 : 200,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      <p style={{ margin: "0 0 1px", fontWeight: 700, color: "var(--text-1)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Intervalo: {d.lo.toFixed(1)} – {d.hi.toFixed(1)}
      </p>
      <p style={{ margin: "0 0 8px", color: "var(--text-3)", fontSize: 11 }}>
        {d.count} municipio{d.count !== 1 ? "s" : ""}
      </p>
      {shown.length > 0 && (
        <div style={twoCol ? { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 10, rowGap: 1 } : {}}>
          {shown.map((m) => (
            <span key={m} style={{ display: "block", fontSize: 11, lineHeight: 1.7, color: "var(--text-2)" }}>{m}</span>
          ))}
        </div>
      )}
      {extra > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
          y {extra} municipio{extra !== 1 ? "s" : ""} más
        </p>
      )}
    </div>
  );
}

export default function MunicipioDistPanel({ features, combined, munVars, varId, primaryState }: Props) {
  const currentVar = munVars.find((v) => v.id === varId) ?? munVars[0];
  const unit = currentVar?.unit;
  const varLabel = currentVar?.label ?? varId;

  const nameMap = useMemo(
    () => new Map(features.map((f) => [f.properties.cvegeo as string, (f.properties.nom_mun ?? f.properties.cvegeo ?? "—") as string])),
    [features]
  );

  const validRecords = useMemo(() => {
    const records = combined.variables[varId]?.records ?? [];
    return records.filter((r) => r.value !== null && r.value !== undefined && !isNaN(r.value));
  }, [combined, varId]);

  const { bins, domainMin, domainMax } = useMemo(() => {
    if (!validRecords.length) return { bins: [], domainMin: 0, domainMax: 1 };
    const vals = validRecords.map((r) => r.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) {
      return {
        bins: [{ lo: min, hi: max, center: min, count: validRecords.length, muns: validRecords.map((r) => nameMap.get(r.cve_mun) ?? r.cve_mun) }],
        domainMin: min, domainMax: max,
      };
    }
    const step = (max - min) / 10;
    const b = Array.from({ length: 10 }, (_, i) => ({
      lo: min + i * step,
      hi: min + (i + 1) * step,
      center: min + (i + 0.5) * step,
      count: 0,
      muns: [] as string[],
    }));
    for (const r of validRecords) {
      const idx = Math.min(Math.floor((r.value - min) / step), 9);
      b[idx].count++;
      b[idx].muns.push(nameMap.get(r.cve_mun) ?? r.cve_mun);
    }
    return { bins: b, domainMin: min, domainMax: max };
  }, [validRecords, nameMap]);

  const boxplotValues = useMemo(
    () => validRecords.map((r) => ({ state: nameMap.get(r.cve_mun) ?? r.cve_mun, value: r.value })),
    [validRecords, nameMap]
  );

  const preStats = combined.variables[varId]?.stats;
  const mean = preStats?.mean ?? (validRecords.length ? validRecords.reduce((s, r) => s + r.value, 0) / validRecords.length : null);

  return (
    <ChartWrapper
      panelTitle="Distribución municipal"
      tooltip={<InfoTooltip wide text={
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
          <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Distribución municipal</p>
          <p style={{ margin: "0 0 8px" }}>
            Histograma de los municipios del estado para la variable seleccionada. Cada barra muestra cuántos municipios caen en ese rango de valores. Pasa el cursor sobre una barra para ver los nombres.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            El <strong>boxplot</strong> debajo resume la distribución: la caja cubre el 50&nbsp;% central de los municipios, la línea sólida es la mediana y los puntos naranjas son municipios atípicos.
          </p>
          <p style={{ margin: 0, color: "var(--text-3)" }}>
            Una distribución muy dispersa o bimodal indica polarización interna significativa. Usa el botón <strong>«← Vista nacional»</strong> para regresar al análisis comparativo entre estados.
          </p>
        </div>
      } />}
      title={varLabel}
      description={`Distribución entre municipios del estado${unit ? ` (${unit})` : ""}.`}
      chartType="Histograma municipal"
      municipalState={primaryState}
    >
      {!validRecords.length ? (
        <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
          Sin datos para esta variable.
        </p>
      ) : (
        <>
          <div className="chart-rc-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bins} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="center" tickFormatter={(v: number) => v.toFixed(0)} tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<MunBinTooltip />} />
              {mean !== null && (
                <ReferenceLine x={mean} stroke="var(--text-3)" strokeDasharray="4 4" />
              )}
              <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {bins.map((_, i) => <Cell key={i} fill="var(--blue-mid)" opacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          {boxplotValues.length >= 4 && (
            <div style={{ padding: "0 16px 0 28px", marginTop: 2 }}>
              <InlineBoxplot stateValues={boxplotValues} domainMin={domainMin} domainMax={domainMax} nationalMean={mean ?? undefined} />
            </div>
          )}
        </>
      )}
    </ChartWrapper>
  );
}
