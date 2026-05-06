import { useMemo, useState } from "react";
import type { AppData } from "../services/DataService";
import type { ImportedData } from "../app/App";
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
  onImport: (d: ImportedData) => void;
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
    setMode("catalog");
  }

  const statesWithData = useMemo(() => {
    if (!selectedVar) return 0;
    return appData.dataset.records.filter(
      (r) => r.metrics[selectedVar.variable_id] != null
    ).length;
  }, [selectedVar, appData.dataset.records]);

  return (
    <div className="tab-content">
      {mode === "catalog" && (
        <section className="panel">
          <CatalogBrowser
            catalog={catalog}
            editedIds={editedIds}
            hiddenIds={hiddenIds}
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
            onUpdateData={() => openWizardForVariable(selectedVar)}
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
          <OperationWizard
            catalog={catalog}
            initialVariable={wizardInitialVar}
            onDone={handleWizardDone}
          />
        </section>
      )}
    </div>
  );
}
