import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import type { MunVar } from "./MunicipioDistPanel";

type GeoFeature = { type: string; geometry: any; properties: Record<string, any> };
type VarRecord = { cve_mun: string; value: number };
type CombinedData = { state_code: string; variables: Record<string, { year: number; records: VarRecord[] }> };

type Props = {
  features: GeoFeature[];
  combined: CombinedData;
  bbox: [number, number, number, number];
  munVars: MunVar[];
  primaryState?: string;
};

function interpolateColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(210 - c * 150)},${Math.round(220 - c * 100)},${Math.round(235 - c * 10)})`;
}

export default function MunicipioMapPanel({ features, combined, bbox, munVars, primaryState }: Props) {
  const [varId, setVarId] = useState(munVars[0]?.id ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const currentVar = munVars.find((v) => v.id === varId) ?? munVars[0];
  const unit = currentVar?.unit;

  const enrichedFeatures = useMemo(() => {
    const records = combined.variables[varId]?.records ?? [];
    const valueMap = new Map(records.map((r) => [r.cve_mun, r.value]));
    return features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        [varId]: valueMap.get(f.properties.cvegeo) ?? null,
      },
    }));
  }, [features, combined, varId]);

  const values = enrichedFeatures
    .map((f) => f.properties[varId])
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 1;

  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const zoom = Math.max(2, Math.min(16, 18 / Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1])));

  function getRelativePos(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top };
  }

  const geojson = { type: "FeatureCollection" as const, features: enrichedFeatures };
  const varYear = combined.variables[varId]?.year;

  return (
    <section className="panel">
      <div className="panel-title-row">
        <p className="panel-title" style={{ margin: 0 }}>
          Mapa municipal{primaryState ? ` — ${primaryState}` : ""}
          {varYear ? <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: 11 }}>{" "}· {varYear}</span> : null}
        </p>
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

      <div ref={containerRef} style={{ position: "relative" }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [-102, 24], scale: 1600 }}
          style={{ width: "100%", height: 340 }}
        >
          <ZoomableGroup center={[centerLon, centerLat]} zoom={zoom}>
            <Geographies geography={geojson}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const value = geo.properties[varId];
                  const munName: string = geo.properties.nom_mun ?? geo.properties.cvegeo ?? "—";
                  const t =
                    typeof value === "number" && maxVal !== minVal
                      ? (value - minVal) / (maxVal - minVal)
                      : undefined;
                  const fill = t !== undefined ? interpolateColor(t) : "var(--border)";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="white"
                      strokeWidth={0.3}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", opacity: 0.75 },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e: any) => {
                        const label =
                          typeof value === "number"
                            ? `${munName}: ${value.toFixed(1)}${unit ? " " + unit : ""}`
                            : `${munName}: sin datos`;
                        setTooltip({ ...getRelativePos(e), content: label });
                      }}
                      onMouseMove={(e: any) => {
                        setTooltip((prev) => (prev ? { ...prev, ...getRelativePos(e) } : null));
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
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{minVal.toFixed(1)}</span>
          <div
            style={{
              width: 120,
              height: 8,
              borderRadius: 4,
              background: "linear-gradient(to right, rgb(210,220,235), rgb(60,120,225))",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {maxVal.toFixed(1)}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
