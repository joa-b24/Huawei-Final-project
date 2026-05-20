import { useState } from "react";
import type { VariableCatalogEntry } from "../../../types/dataStandard";
import type { OperationType } from "../../../lib/dataStorage";
import type { ParsedRow } from "../../../lib/csvParser";
import type { Granularity } from "./Step1OperationType";
import { exportImportedEntryAsWideJson } from "../../../lib/dataExport";

type CoercedRow = { state_code: string; cve_mun?: string; value: number; year: number };

// JSON uploads can produce numbers even though ParsedRow says string — cast everything.
function str(v: unknown): string { return v != null ? String(v) : ""; }
function strOrUndef(v: unknown): string | undefined { return v != null ? String(v) : undefined; }

function coerceRows(rows: ParsedRow[]): CoercedRow[] {
  return rows
    .map((r) => {
      const cveMun = strOrUndef(r.cve_mun ?? r.cvegeo ?? r.cve_geo);
      // Derive state_code from cvegeo: zero-pad to 5 digits first so that
      // 4-digit codes (states 1-9, e.g. "5012") resolve correctly to "05"
      const rawSc = str(r.state_code ?? r.estado);
      const state_code = rawSc || (cveMun && cveMun.length >= 4 ? cveMun.padStart(5, "0").slice(0, 2) : "");
      return {
        state_code,
        cve_mun: cveMun,
        value: parseFloat(str(r.value) || "0"),
        year: parseInt(str(r.year ?? r.anio)),
      };
    })
    .filter((r) => r.state_code && !isNaN(r.value) && !isNaN(r.year));
}

function deriveOperation(
  granularity: Granularity,
  isNew: boolean,
  completarOnly: boolean
): OperationType {
  if (granularity === "historico") return "historico";
  if (granularity === "municipal") return "municipal";
  if (isNew) return "nueva_variable";
  return completarOnly ? "completar" : "actualizar";
}

async function runPipeline(
  variable: VariableCatalogEntry,
  operation: OperationType,
  rows: CoercedRow[]
): Promise<{ ok: boolean; log: string[] }> {
  const payload: Record<string, unknown> = {
    variable_id: variable.variable_id,
    operation,
    granularity: operation === "municipal" ? "municipal" : "state",
    exported_at: new Date().toISOString(),
    records: rows.map((r) => ({
      state_code: r.state_code,
      ...(r.cve_mun ? { cve_mun: r.cve_mun } : {}),
      anio: r.year,
      metrics: { [variable.variable_id]: r.value },
    })),
  };
  if (operation === "nueva_variable" || (payload.granularity !== "state" && variable.variable_id)) {
    payload.catalog_entry = variable;
  }
  try {
    const res = await fetch("/api/pipeline/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, log: [String(err)] };
  }
}

const GRANULARITY_LABELS: Record<Granularity, string> = {
  state: "Estatal",
  historico: "Histórico",
  municipal: "Municipal",
};

type Props = {
  granularity: Granularity;
  isNew: boolean;
  completarOnly: boolean;
  variable: VariableCatalogEntry;
  existingYear?: number;
  rows: ParsedRow[];
  onBack: () => void;
  onDone: () => void;
};

type Status = "idle" | "running" | "done" | "error";

export default function Step4Confirm({
  granularity,
  isNew,
  completarOnly,
  variable,
  existingYear,
  rows,
  onBack,
  onDone,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [yearConfirmed, setYearConfirmed] = useState(false);

  const operation = deriveOperation(granularity, isNew, completarOnly);
  const coerced = coerceRows(rows);
  const isMunicipal = granularity === "municipal";

  const munCount = isMunicipal
    ? new Set(coerced.map((r) => r.cve_mun).filter(Boolean)).size
    : 0;
  const stateCount = new Set(coerced.map((r) => r.state_code)).size;

  // Year conflict: only for state + existing, when incoming year ≤ existing year
  const incomingYear = coerced[0]?.year;
  const hasYearConflict =
    granularity === "state" &&
    !isNew &&
    existingYear !== undefined &&
    incomingYear !== undefined &&
    incomingYear <= existingYear;

  const modeLabel = isNew
    ? "Nueva variable"
    : completarOnly
    ? "Solo completar faltantes"
    : "Actualizar datos";

  async function handleConfirm() {
    setStatus("running");
    setLog([]);
    const result = await runPipeline(variable, operation, coerced);
    setLog(result.log);
    setStatus(result.ok ? "done" : "error");
  }

  if (status === "done" || status === "running" || status === "error") {
    return (
      <div className="wizard-step-body">
        {status === "done" && (
          <div className="wizard-success">
            <span className="wizard-success__icon">✓</span>
            <p className="wizard-success__msg">
              <strong>{coerced.length} registros</strong> importados para{" "}
              <strong>{variable.nombre}</strong>.
            </p>
          </div>
        )}
        {status === "running" && (
          <p className="wizard-step-title">Procesando importación…</p>
        )}
        {status === "error" && (
          <p className="wizard-step-title" style={{ color: "var(--red)" }}>
            Error en el pipeline
          </p>
        )}
        {log.length > 0 && <pre className="pipeline-log">{log.join("\n")}</pre>}
        <div className="wizard-nav">
          {status === "error" && (
            <button className="btn-ghost" onClick={() => setStatus("idle")} type="button">
              ← Reintentar
            </button>
          )}
          {status === "done" && (
            <button className="btn-primary" onClick={() => window.location.reload()} type="button">
              Recargar dashboard
            </button>
          )}
          {status !== "running" && (
            <button className="btn-ghost" onClick={onDone} type="button">
              Volver al catálogo
            </button>
          )}
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
          <span>Granularidad</span>
          <strong>{GRANULARITY_LABELS[granularity]}</strong>
        </div>
        <div className="confirm-summary__row">
          <span>Modo</span>
          <strong>{modeLabel}</strong>
        </div>
        <div className="confirm-summary__row">
          <span>Año</span>
          <strong>{incomingYear ?? "—"}</strong>
        </div>
        <div className="confirm-summary__row">
          <span>Registros</span>
          <strong>
            {isMunicipal
              ? `${coerced.length} municipios en ${stateCount} estado${stateCount !== 1 ? "s" : ""} (${munCount} cve_mun únicos)`
              : `${coerced.length} filas (${stateCount} estado${stateCount !== 1 ? "s" : ""})`}
          </strong>
        </div>
        {isMunicipal && (
          <>
            <div className="confirm-summary__row">
              <span>Campo municipal</span>
              <strong>{variable.campo_municipal ?? <span style={{ color: "var(--text-3)", fontWeight: 400 }}>no especificado</span>}</strong>
            </div>
            {variable.agregacion_default === "avg" && (
              <div className="confirm-summary__row">
                <span>Peso municipal</span>
                <strong>
                  {variable.peso_municipal === "localidades"
                    ? "Localidades (localidades_n)"
                    : variable.peso_municipal === "uniforme"
                    ? "Uniforme (promedio simple)"
                    : "Población (pobtot_iter)"}
                </strong>
              </div>
            )}
          </>
        )}
        {coerced.length < rows.length && (
          <p className="wizard-warn">
            {rows.length - coerced.length} filas descartadas por valores inválidos o sin año.
          </p>
        )}
      </div>

      {hasYearConflict && (
        <div className="wizard-warn-box" style={{ marginTop: 12, padding: "10px 14px", background: "var(--amber-bg, #fef3c7)", border: "1px solid var(--amber, #d97706)", borderRadius: "var(--radius)", fontSize: 13 }}>
          <strong>Aviso: año previo al existente</strong>
          <p style={{ margin: "4px 0 8px" }}>
            Los datos existentes son de <strong>{existingYear}</strong>, pero los que estás importando son de{" "}
            <strong>{incomingYear}</strong>. Esto sobreescribirá datos más recientes.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={yearConfirmed}
              onChange={(e) => setYearConfirmed(e.target.checked)}
            />
            Entiendo que el año importado ({incomingYear}) es {incomingYear === existingYear ? "igual al" : "anterior al"} existente ({existingYear}) y quiero continuar.
          </label>
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
        <button
          className="btn-ghost"
          onClick={() =>
            exportImportedEntryAsWideJson({
              id: `export-${Date.now()}`,
              variable_id: variable.variable_id,
              operation,
              granularity: isMunicipal ? "municipal" : "state",
              rows: coerced,
              savedAt: new Date().toISOString(),
            })
          }
          type="button"
        >
          Exportar JSON
        </button>
        <button
          className="btn-primary"
          disabled={coerced.length === 0 || (hasYearConflict && !yearConfirmed)}
          onClick={handleConfirm}
          type="button"
        >
          Confirmar e importar
        </button>
      </div>
    </div>
  );
}
