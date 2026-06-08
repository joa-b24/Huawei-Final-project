import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import type { MunVar } from "./MunicipioDistPanel";
import ChartWrapper from "./ChartWrapper";
import InfoTooltip from "../feedback/InfoTooltip";

type GeoFeature = { type: string; geometry: any; properties: Record<string, any> };
type VarRecord = { cve_mun: string; value: number };
type CombinedData = { state_code: string; variables: Record<string, { year: number; records: VarRecord[] }> };

type Props = {
  features: GeoFeature[];
  combined: CombinedData;
  bbox: [number, number, number, number];
  munVars: MunVar[];
  varId: string;
  primaryState?: string;
};

function interpolateColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(210 - c * 150)},${Math.round(220 - c * 100)},${Math.round(235 - c * 10)})`;
}

export default function MunicipioMapPanel({ features, combined, bbox, munVars, varId, primaryState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const currentVar = munVars.find((v) => v.id === varId) ?? munVars[0];
  const unit = currentVar?.unit;
  const varLabel = currentVar?.label ?? varId;
  const varYear = combined.variables[varId]?.year;

  const enrichedFeatures = useMemo(() => {
    const records = combined.variables[varId]?.records ?? [];
    const valueMap = new Map(records.map((r) => [r.cve_mun, r.value]));
    return features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        [varId]: valueMap.get(f.properties.cvegeo ?? "") ?? null,
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
  const dLon = bbox[2] - bbox[0];
  const dLat = bbox[3] - bbox[1];
  const LAT_COS = Math.cos(centerLat * Math.PI / 180);
  const PADDING = 1.3;
  const scaleByLon = 800 / (dLon * Math.PI / 180) / PADDING;
  const scaleByLat = 600 / (dLat * Math.PI / 180 / Math.max(LAT_COS, 0.1)) / PADDING;
  const projScale = Math.round(Math.min(scaleByLon, scaleByLat));

  function getRelativePos(e: React.MouseEvent) {
    const node = containerRef.current;
    const container: HTMLElement | null =
      node && document.contains(node)
        ? node
        : (e.target as Element).closest(".choropleth-container");
    const rect = container?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top };
  }

  const geojson = { type: "FeatureCollection" as const, features: enrichedFeatures };

  return (
    <ChartWrapper
      panelTitle="Mapa municipal"
      title={varLabel}
      description={`Distribución geográfica de la variable entre los municipios del estado.${varYear ? ` · ${varYear}` : ""}`}
      chartType="Mapa municipal"
      municipalState={primaryState}
      tooltip={<InfoTooltip wide text={
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
          <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>Mapa municipal</p>
          <p style={{ margin: "0 0 8px" }}>
            Cada municipio se colorea según su valor en la variable seleccionada: tono más claro = valor menor, más oscuro = valor mayor. Pasa el cursor sobre un municipio para ver su nombre y valor exacto.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Busca patrones geográficos internos: si el rezago o la ventaja se concentra en zonas específicas (norte/sur, sierra/costa, cabeceras municipales), eso orienta dónde focalizar intervenciones.
          </p>
          <p style={{ margin: 0, color: "var(--text-3)" }}>
            Usa el scroll o los controles de zoom para ampliar zonas de interés. El botón <strong>«← Vista nacional»</strong> regresa al análisis comparativo entre estados.
          </p>
        </div>
      } />}
    >
      <div ref={containerRef} style={{ position: "relative" }} className="choropleth-container">
        <ComposableMap
          width={800}
          height={600}
          projection="geoMercator"
          projectionConfig={{ center: [centerLon, centerLat], scale: projScale }}
          style={{ width: "100%", height: 340 }}
        >
          <ZoomableGroup>
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
                        hover: { outline: "none", opacity: 0.75, cursor: "pointer" },
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
    </ChartWrapper>
  );
}
