import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { AppData } from "../services/DataService";
import { loadStateMunicipalAnalytics } from "../services/DataService";
import type { MunicipioAnalyticsRecord } from "../types/analytics";
import StateTerritorialAnalysis from "../components/state-analysis/StateTerritorialAnalysis";
import EmptyState from "../components/EmptyState";
import { TERRITORIAL_VARIABLES, VAR_ID_TO_SCATTER_KEY } from "../components/state-analysis/analysisMetrics";

type Props = { appData: AppData };

export default function TerritorialTab({ appData }: Props) {
  const { state: appState } = useAppContext();
  const { primaryState, activeVariableIds } = appState;
  const { dataset, municipalManifest } = appData;
  const territorialKeys = useMemo(() => new Set(TERRITORIAL_VARIABLES.map((v) => v.key)), []);

  const stateCode = useMemo(
    () => dataset.records.find((r) => r.state === primaryState)?.stateCode ?? null,
    [dataset.records, primaryState]
  );

  const [municipios, setMunicipos] = useState<MunicipioAnalyticsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadedCodeRef = useRef<string | null>(null);

  const activeTerritorialVariableIds = useMemo(() => {
    if (!stateCode || !municipalManifest) return [];
    const stateVars = new Set(municipalManifest.states[stateCode]?.variables ?? []);
    return activeVariableIds.filter((id) => {
      const key = VAR_ID_TO_SCATTER_KEY[id];
      return stateVars.has(id) && key !== undefined && territorialKeys.has(key as (typeof TERRITORIAL_VARIABLES)[number]["key"]);
    });
  }, [activeVariableIds, municipalManifest, stateCode, territorialKeys]);

  useEffect(() => {
    if (!stateCode || stateCode === loadedCodeRef.current) return;
    setLoading(true);
    setLoadFailed(false);
    loadStateMunicipalAnalytics(stateCode).then((data) => {
      setMunicipos(data);
      loadedCodeRef.current = data.length > 0 ? stateCode : null;
      setLoading(false);
      if (data.length === 0) setLoadFailed(true);
    });
  }, [stateCode]);

  if (!municipalManifest) {
    return (
      <EmptyState
        title="Sin datos municipales"
        description="Ejecuta npm run data:build:analytics para generar los archivos municipales."
      />
    );
  }

  if (loading) {
    return (
      <div className="tab-content">
        <p style={{ padding: 24, color: "var(--text-3)" }}>Cargando datos municipales de {primaryState}…</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <EmptyState
        title="Archivo municipal no encontrado"
        description={`No se encontró ${stateCode}.json con datos municipales. Ejecuta npm run data:build:analytics para regenerar los archivos.`}
      />
    );
  }

  return (
      <StateTerritorialAnalysis
        stateAnalytics={dataset.stateAnalytics}
        municipios={municipios}
        activeVariableIds={activeTerritorialVariableIds}
      />
  );
}
