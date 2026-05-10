import { useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useAppContext } from "../../context/AppContext";
import type { AppData } from "../../services/DataService";

const GEO_URL = "/data/estados.geojson";

type Props = {
  appData: AppData;
};

function interpolateColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(210 - clamped * 150);
  const g = Math.round(220 - clamped * 100);
  const b = Math.round(235 - clamped * 10);
  return `rgb(${r},${g},${b})`;
}

export default function ChoroplethMap({ appData }: Props) {
  const { state: appState, dispatch } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset } = appData;

  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveVarId =
    selectedVarId && activeVariableIds.includes(selectedVarId)
      ? selectedVarId
      : (activeVariableIds[0] ?? null);

  useEffect(() => {
    if (effectiveVarId && !activeVariableIds.includes(effectiveVarId)) {
      setSelectedVarId(null);
    }
  }, [activeVariableIds, effectiveVarId]);


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

  function getRelativePos(e: any) {
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
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
        projectionConfig={{ center: [-102, 24], scale: 1600 }}
        style={{ width: "100%", height: 420 }}
      >
        <defs>
          <filter id="primary-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.11  0 0 0 0 0.26  0 0 0 0 0.86  0 0 0 1.2 0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) => {
              const primaryGeo = geographies.find((g: any) => {
                const cve = String(g.id ?? g.properties?.cve_ent ?? "").padStart(2, "0");
                return cve === primaryCveEnt;
              });
              return (
                <>
                  {geographies.map((geo: any) => {
                    const cve = String(geo.id ?? geo.properties?.cve_ent ?? "").padStart(2, "0");
                    const value = cveToValue.get(cve);
                    const stateName = cveToState.get(cve) ?? geo.properties?.estado ?? cve;
                    const t =
                      value !== undefined && maxVal !== minVal
                        ? (value - minVal) / (maxVal - minVal)
                        : 0.5;
                    const fill = value !== undefined ? interpolateColor(t) : "var(--border)";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="var(--surface)"
                        strokeWidth={0.5}
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
                          setTooltip({ ...getRelativePos(e), content: label });
                        }}
                        onMouseMove={(e: any) => {
                          if (tooltip) setTooltip((t) => t ? { ...t, ...getRelativePos(e) } : null);
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                  {primaryGeo && (
                    <Geography
                      key="primary-highlight"
                      geography={primaryGeo}
                      fill="none"
                      stroke="#1b46ba"
                      strokeWidth={2}
                      style={{
                        default: { outline: "none", filter: "url(#primary-glow)", pointerEvents: "none" },
                        hover: { outline: "none", filter: "url(#primary-glow)", pointerEvents: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  )}
                </>
              );
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (() => {
        return (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y - 40,
              transform: "translateX(-50%)",
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
        );
      })()}

      <div className="legend-map" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Menor</span>
        <div style={{
          width: 140, height: 10, borderRadius: 5,
          background: "linear-gradient(to right, rgb(210,220,235), rgb(60,120,225))",
        }} />
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Mayor</span>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-3)", margin: "4px 0 0" }}>
      </p>
    </div>
  );
}
