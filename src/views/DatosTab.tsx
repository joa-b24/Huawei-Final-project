import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../services/DataService";
import type { VariableCatalogEntry } from "../types/dataStandard";
import {
  applyCatalogOverrides, loadCatalogOverrides,
  loadHiddenIds, toggleHiddenId,
} from "../lib/dataStorage";
import CatalogBrowser from "../components/datos/CatalogBrowser";
import VariablePanel from "../components/datos/VariablePanel";
import OperationWizard from "../components/datos/OperationWizard";

type Mode = "catalog" | "panel" | "wizard";

type Props = {
  appData: AppData;
  onCatalogChange: () => void;
};

export default function DatosTab({ appData, onCatalogChange }: Props) {
  const [mode, setMode] = useState<Mode>("catalog");
  const [selectedVar, setSelectedVar] = useState<VariableCatalogEntry | undefined>();
  const [wizardInitialVar, setWizardInitialVar] = useState<VariableCatalogEntry | undefined>();
  const [overrideVersion, setOverrideVersion] = useState(0);
  const [localVersion, setLocalVersion] = useState(0);

  const bump = () => { setLocalVersion((v) => v + 1); onCatalogChange(); };

  const catalog = useMemo(() => {
    const base = appData.variablesCatalog.length > 0
      ? appData.variablesCatalog
      : appData.dataset.metricCatalog.map((m) => ({
          variable_id: m.id,
          categoria_id: m.category as VariableCatalogEntry["categoria_id"],
          nombre: m.label,
          descripcion: m.description ?? "",
          unidad_base: m.unit ?? "",
          tipo_valor: "number" as const,
          agregacion_default: "avg" as const,
          fuente_sugerida: "",
          sinonimos: [],
        }));
    return applyCatalogOverrides(base);
  }, [appData.variablesCatalog, appData.dataset.metricCatalog, overrideVersion]);

  const editedIds = useMemo(() => new Set(Object.keys(loadCatalogOverrides())), [overrideVersion]);
  const hiddenIds = useMemo(() => loadHiddenIds(), [localVersion]);

  function handleToggleHidden(id: string) {
    toggleHiddenId(id);
    bump();
  }

  function openPanel(v: VariableCatalogEntry) {
    setSelectedVar(v);
    setMode("panel");
  }

  function openWizardForVariable(v: VariableCatalogEntry) {
    setWizardInitialVar(v);
    setMode("wizard");
  }

  function openWizardNew() {
    setWizardInitialVar(undefined);
    setMode("wizard");
  }

  function handleWizardDone() {
    setOverrideVersion((v) => v + 1);
    bump();
    setMode("catalog");
  }

  const metricYears = useMemo(() => {
    const result: Record<string, number> = {};
    for (const m of appData.dataset.metricCatalog) {
      if (m.year != null) result[m.id] = m.year;
    }
    return result;
  }, [appData.dataset.metricCatalog]);

  const statesWithData = useMemo(() => {
    if (!selectedVar) return 0;
    return appData.dataset.records.filter(
      (r) => r.metrics[selectedVar.variable_id] != null
    ).length;
  }, [selectedVar, appData.dataset.records]);

  const lastYearWithData = useMemo(() => {
    if (!selectedVar) return null;
    const recordYear = appData.dataset.records.find(
      (r) => r.metrics[selectedVar.variable_id] != null
    )?.year;
    return recordYear ?? null;
  }, [selectedVar, appData.dataset.records]);

  const municipalStatesCount = useMemo(() => {
    if (!selectedVar || !appData.municipalManifest) return 0;
    return Object.values(appData.municipalManifest.states).filter(
      (e) => e.variables.includes(selectedVar.variable_id)
    ).length;
  }, [selectedVar, appData.municipalManifest]);

  const coverageMap = useMemo(() => {
    const munVarIds = new Set<string>();
    if (appData.municipalManifest) {
      Object.values(appData.municipalManifest.states).forEach((s) => s.variables.forEach((v) => munVarIds.add(v)));
    }
    const histVarIds = new Set(appData.temporalVariables ?? []);
    const map = new Map<string, { hasMunicipal: boolean; hasHistorical: boolean }>();
    for (const m of appData.dataset.metricCatalog) {
      map.set(m.id, { hasMunicipal: munVarIds.has(m.id), hasHistorical: histVarIds.has(m.id) });
    }
    return map;
  }, [appData.municipalManifest, appData.temporalVariables, appData.dataset.metricCatalog]);

  const [temporalYears, setTemporalYears] = useState<number[]>([]);
  useEffect(() => {
    if (mode !== "panel" || !selectedVar) { setTemporalYears([]); return; }
    fetch(`/data/outputs/temporal/${selectedVar.variable_id}.json`)
      .then((r) => r.ok ? r.json() as Promise<{ records: { year: number }[] }> : null)
      .then((data) => {
        if (!data) { setTemporalYears([]); return; }
        const years = [...new Set(data.records.map((r) => r.year))].sort((a, b) => a - b);
        setTemporalYears(years);
      })
      .catch(() => setTemporalYears([]));
  }, [selectedVar?.variable_id, mode]);

  return (
    <div className="tab-content">
      {mode === "catalog" && (
        <section className="panel">
          <CatalogBrowser
            catalog={catalog}
            editedIds={editedIds}
            hiddenIds={hiddenIds}
            coverageMap={coverageMap}
            onSelectVariable={openPanel}
            onNewOperation={openWizardNew}
            onToggleHidden={handleToggleHidden}
          />
        </section>
      )}

      {mode === "panel" && selectedVar && (
        <section className="panel">
          <VariablePanel
            variable={selectedVar}
            statesWithData={statesWithData}
            totalStates={appData.dataset.records.length}
            lastYearWithData={lastYearWithData}
            municipalStatesCount={municipalStatesCount}
            historicalYears={temporalYears}
            onUpdateData={() => openWizardForVariable(selectedVar)}
            onDelete={() => { bump(); setSelectedVar(undefined); setMode("catalog"); }}
            onBack={() => setMode("catalog")}
          />
        </section>
      )}

      {mode === "wizard" && (
        <section className="panel">
          <button
            className="btn-ghost wizard-back-link"
            onClick={() => setMode("catalog")}
            type="button"
          >
            ← Volver al catálogo
          </button>
          {import.meta.env.PROD ? (
            <div className="env-guard-banner">
              La importación y edición de datos está disponible únicamente en entorno local para asegurar validación antes de publicar cambios.
            </div>
          ) : (
            <OperationWizard
              catalog={catalog}
              initialVariable={wizardInitialVar}
              metricYears={metricYears}
              onDone={handleWizardDone}
            />
          )}
        </section>
      )}
    </div>
  );
}
