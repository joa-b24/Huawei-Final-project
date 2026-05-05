import { useState } from "react";
import type { VariableCatalogEntry } from "../../../types/dataStandard";
import type { OperationType, ImportedDataEntry } from "../../../lib/dataStorage";
import type { ParsedRow } from "../../../lib/csvParser";
import { saveImportedEntry } from "../../../lib/dataStorage";
import { exportImportedEntryAsWideJson } from "../../../lib/dataExport";

type Props = {
  operation: OperationType;
  variable: VariableCatalogEntry;
  rows: ParsedRow[];
  onBack: () => void;
  onDone: () => void;
};

const OP_LABELS: Record<OperationType, string> = {
  nueva_variable: "Nueva variable",
  completar: "Completar datos",
  modificar: "Modificar datos",
  actualizar: "Actualizar datos",
};

function coerceRows(
  rows: ParsedRow[],
  operation: OperationType
): ImportedDataEntry["rows"] {
  return rows
    .map((r) => ({
      state_code: r.state_code ?? r.estado ?? "",
      cve_mun: r.cve_mun,
      value: parseFloat(r.value ?? "0"),
      year: r.year ? parseInt(r.year) : undefined,
    }))
    .filter((r) => r.state_code && !isNaN(r.value));
}

export default function Step4Confirm({ operation, variable, rows, onBack, onDone }: Props) {
  const [saved, setSaved] = useState<ImportedDataEntry | null>(null);

  const coerced = coerceRows(rows, operation);
  const stateCount = new Set(coerced.map((r) => r.state_code)).size;
  const isMunicipal = operation === "municipal";

  function handleSave() {
    const entry = saveImportedEntry({
      variable_id: variable.variable_id,
      operation,
      granularity: isMunicipal ? "municipal" : "state",
      rows: coerced,
    });
    setSaved(entry);
  }

  if (saved) {
    return (
      <div className="wizard-step-body">
        <div className="wizard-success">
          <span className="wizard-success__icon">✓</span>
          <p className="wizard-success__msg">
            <strong>{coerced.length} registros</strong> guardados en localStorage para{" "}
            <strong>{variable.nombre}</strong>.
          </p>
        </div>
        <div className="wizard-nav">
          <button className="btn-ghost" onClick={() => exportImportedEntryAsWideJson(saved)} type="button">
            Exportar JSON para pipeline
          </button>
          <button className="btn-primary" onClick={onDone} type="button">
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">Confirmar importación</p>
      <div className="confirm-summary">
        <div className="confirm-summary__row">
          <span>Variable</span>
          <strong>{variable.nombre}</strong>
        </div>
        <div className="confirm-summary__row">
          <span>Operación</span>
          <strong>{OP_LABELS[operation]}</strong>
        </div>
        <div className="confirm-summary__row">
          <span>Registros</span>
          <strong>{coerced.length} filas ({stateCount} {isMunicipal ? "municipios" : "estados"})</strong>
        </div>
        {coerced.length < rows.length && (
          <p className="wizard-warn">
            {rows.length - coerced.length} filas descartadas por valores inválidos.
          </p>
        )}
      </div>
      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
        <button className="btn-primary" disabled={coerced.length === 0} onClick={handleSave} type="button">
          Guardar en localStorage
        </button>
      </div>
    </div>
  );
}
