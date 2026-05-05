import { useMemo, useState } from "react";
import type { AppData } from "../services/DataService";
import type { ImportedData } from "../app/App";
import type { VariableCatalogEntry } from "../types/dataStandard";
import { applyCatalogOverrides, loadCatalogOverrides, saveCatalogOverride } from "../lib/dataStorage";
import CatalogBrowser from "../components/datos/CatalogBrowser";
import OperationWizard from "../components/datos/OperationWizard";

type Mode = "catalog" | "wizard";

type Props = {
  appData: AppData;
  onImport: (d: ImportedData) => void;
};

export default function DatosTab({ appData }: Props) {
  const [mode, setMode] = useState<Mode>("catalog");
  const [wizardInitialVar, setWizardInitialVar] = useState<VariableCatalogEntry | undefined>();
  const [overrideVersion, setOverrideVersion] = useState(0);

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

  const editedIds = useMemo(
    () => new Set(Object.keys(loadCatalogOverrides())),
    [overrideVersion]
  );

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

  return (
    <div className="tab-content">
      {mode === "catalog" && (
        <section className="panel">
          <CatalogBrowser
            catalog={catalog}
            editedIds={editedIds}
            onSelectVariable={openWizardForVariable}
            onNewOperation={openWizardNew}
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
