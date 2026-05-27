import { useEffect, useState } from "react";
import MunicipioMapPanel from "./MunicipioMapPanel";
import MunicipioRankingPanel from "./MunicipioRankingPanel";
import MunicipioDistPanel from "./MunicipioDistPanel";

type GeoFeature = { type: string; geometry: any; properties: Record<string, any> };

export type MunVar = { id: string; label: string; unit: string; direction?: string };

type VarRecord = { cve_mun: string; value: number };

type CombinedData = {
  state_code: string;
  variables: Record<string, { year: number; records: VarRecord[] }>;
};

type Props = {
  stateCode: string;
  primaryState: string;
  munVars: MunVar[];
  varId: string;
};

export default function MunicipalModeView({ stateCode, primaryState, munVars, varId }: Props) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [combined, setCombined] = useState<CombinedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setFeatures([]);
    setBbox(null);
    setCombined(null);

    Promise.all([
      fetch(`/data/geo/municipios/${stateCode}.geojson`).then((r) => {
        if (!r.ok) throw new Error(`GeoJSON ${stateCode}: ${r.status}`);
        return r.json();
      }),
      fetch("/data/geo/municipios/bboxes.json").then((r) => r.json()),
      fetch(`/data/outputs/municipal/${stateCode}.json`).then((r) => {
        if (!r.ok) throw new Error(`Municipal data ${stateCode}: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([geo, bboxes, combinedData]) => {
        setFeatures(geo.features ?? []);
        setBbox(bboxes[stateCode] ?? null);
        setCombined(combinedData);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [stateCode]);

  if (!munVars.length) return null;

  if (loading) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: 13, padding: "32px 0", textAlign: "center" }}>
        Cargando municipios…
      </p>
    );
  }

  if (error) {
    return (
      <p style={{ color: "var(--red)", fontSize: 13, padding: "16px 0" }}>
        Error al cargar datos municipales: {error}
      </p>
    );
  }

  if (!features.length || !combined) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: 13, padding: "16px 0" }}>
        Sin datos municipales para {primaryState}.
      </p>
    );
  }

  return (
    <>
      <div className="two-col" style={{ marginTop: 8 }}>
        <MunicipioDistPanel features={features} combined={combined} munVars={munVars} varId={varId} />
        {bbox ? (
          <MunicipioMapPanel
            features={features}
            combined={combined}
            bbox={bbox}
            munVars={munVars}
            varId={varId}
            primaryState={primaryState}
          />
        ) : (
          <section className="panel">
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>Sin bbox disponible.</p>
          </section>
        )}
      </div>

      <MunicipioRankingPanel features={features} combined={combined} munVars={munVars} varId={varId} />
    </>
  );
}
