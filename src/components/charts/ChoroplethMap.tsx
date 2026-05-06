import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useAppContext } from "../../context/AppContext";
import type { AppData } from "../../services/DataService";
import { getMetricDirection } from "../../services/DataService";

const GEO_URL = "/data/estados.geojson";

type Props = {
  appData: AppData;
};

function interpolateColor(t: number, direction: "higher_better" | "lower_better"): string {
  // t in [0,1]: 0=worst, 1=best
  const clamped = Math.max(0, Math.min(1, t));
  if (direction === "higher_better") {
    // low → grayish-blue, high → vibrant blue
    const r = Math.round(210 - clamped * 150);
    const g = Math.round(220 - clamped * 100);
    const b = Math.round(235 - clamped * 10);
    return `rgb(${r},${g},${b})`;
  } else {
    // low → good (blue), high → bad (red)
    const flipped = 1 - clamped;
    const r = Math.round(210 - flipped * 150);
    const g = Math.round(220 - flipped * 100);
    const b = Math.round(235 - flipped * 10);
    return `rgb(${r},${g},${b})`;
  }
}

export default function ChoroplethMap({ appData }: Props) {
  const { state: appState, dispatch } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset, variablesCatalog } = appData;

  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const effectiveVarId =
    selectedVarId && activeVariableIds.includes(selectedVarId)
      ? selectedVarId
      : (activeVariableIds[0] ?? null);

  useEffect(() => {
    if (effectiveVarId && !activeVariableIds.includes(effectiveVarId)) {
      setSelectedVarId(null);
    }
  }, [activeVariableIds, effectiveVarId]);

  const direction = effectiveVarId
    ? getMetricDirection(effectiveVarId, variablesCatalog)
    : "higher_better";

  const metricDef = effectiveVarId
    ? dataset.metricCatalog.find((m) => m.id === effectiveVarId)
    : null;

  const stateValues = useMemo(() => {
    if (!effectiveVarId) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const r of dataset.records) {
      const v = r.metrics[effectiveVarId];
      if (typeof v === "number" && !isNaN(v) && r.stateCode) {
        map.set(r.stateCode, v);
      }
    }
    return map;
  }, [effectiveVarId, dataset.records]);

  // Map cve_ent → value for color lookup
  const cveToValue = useMemo(() => {
    if (!effectiveVarId) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const r of dataset.records) {
      const v = r.metrics[effectiveVarId];
      if (typeof v === "number" && !isNaN(v) && r.cveEnt) {
        map.set(r.cveEnt, v);
      }
    }
    return map;
  }, [effectiveVarId, dataset.records]);

  const cveToState = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of dataset.records) {
      if (r.cveEnt) map.set(r.cveEnt, r.state);
    }
    return map;
  }, [dataset.records]);

  const { minVal, maxVal } = useMemo(() => {
    const vals = [...cveToValue.values()];
    if (!vals.length) return { minVal: 0, maxVal: 1 };
    return { minVal: Math.min(...vals), maxVal: Math.max(...vals) };
  }, [cveToValue]);

  const primaryCveEnt = useMemo(
    () => dataset.records.find((r) => r.state === primaryState)?.cveEnt ?? null,
    [dataset.records, primaryState]
  );

  if (!effectiveVarId) {
    return (
      <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: "24px 0" }}>
        Activa al menos una variable en el panel lateral.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {activeVariableIds.length > 1 && (
        <div className="ranking-panel-header" style={{ marginBottom: 8 }}>
          <select
            className="ranking-var-select"
            value={effectiveVarId}
            onChange={(e) => setSelectedVarId(e.target.value)}
          >
            {activeVariableIds.map((varId) => {
              const lbl = dataset.metricCatalog.find((m) => m.id === varId)?.label ?? varId;
              return <option key={varId} value={varId}>{lbl}</option>;
            })}
          </select>
        </div>
      )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [-102, 24], scale: 1200 }}
        style={{ width: "100%", height: 420 }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const cve = String(geo.id ?? geo.properties?.cve_ent ?? "").padStart(2, "0");
                const value = cveToValue.get(cve);
                const stateName = cveToState.get(cve) ?? geo.properties?.estado ?? cve;
                const isPrimary = cve === primaryCveEnt;

                const t =
                  value !== undefined && maxVal !== minVal
                    ? (value - minVal) / (maxVal - minVal)
                    : 0.5;
                const fill = value !== undefined ? interpolateColor(t, direction) : "var(--border)";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isPrimary ? "var(--blue)" : "var(--surface)"}
                    strokeWidth={isPrimary ? 2 : 0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", opacity: 0.8, cursor: "pointer" },
                      pressed: { outline: "none" },
                    }}
                    onClick={() => dispatch({ type: "SET_PRIMARY_STATE", stateName })}
                    onMouseEnter={(e: any) => {
                      const label =
                        value !== undefined
                          ? `${stateName}: ${value.toFixed(1)}${metricDef?.unit ? " " + metricDef.unit : ""}`
                          : `${stateName}: sin datos`;
                      setTooltip({ x: e.clientX, y: e.clientY, content: label });
                    }}
                    onMouseMove={(e: any) => {
                      if (tooltip) setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--text-1)",
            pointerEvents: "none",
            zIndex: 1000,
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.content}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {direction === "higher_better" ? "Menor" : "Mejor"}
        </span>
        <div style={{
          width: 140, height: 10, borderRadius: 5,
          background: direction === "higher_better"
            ? "linear-gradient(to right, rgb(60,120,225), rgb(210,220,235))"
            : "linear-gradient(to right, rgb(60,120,225), rgb(210,220,235))",
        }} />
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {direction === "higher_better" ? "Mayor" : "Peor"}
        </span>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-3)", margin: "4px 0 0" }}>
        {metricDef?.label ?? effectiveVarId} — haz clic en un estado para seleccionarlo
      </p>
    </div>
  );
}
