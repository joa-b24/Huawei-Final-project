import { useState } from "react";
import type { VariableCatalogEntry } from "../../../types/dataStandard";
import type { OperationType } from "../../../lib/dataStorage";
import type { ParsedRow } from "../../../lib/csvParser";
import type { Granularity } from "./Step1OperationType";
import { resolveStateCode } from "../../../lib/stateResolver";

type CoercedRow = { state_code: string; cve_mun?: string; value: number; year: number };

export type CoerceResult = {
  rows: CoercedRow[];
  unmappedKeys: string[];   // raw geo values that couldn't be resolved
  discarded: number;        // rows dropped for reasons other than unmapped geo
};

// JSON uploads can produce numbers even though ParsedRow says string — cast everything.
function str(v: unknown): string { return v != null ? String(v) : ""; }
function strOrUndef(v: unknown): string | undefined { return v != null ? String(v) : undefined; }

function coerceRows(
  rows: ParsedRow[],
  valueColumn: string,
  manualYear?: number,
): CoerceResult {
  const unmappedSet = new Set<string>();
  const result: CoercedRow[] = [];
  let discarded = 0;

  for (const r of rows) {
    const cveMun = strOrUndef(r.cve_mun ?? r.cvegeo ?? r.cve_geo ?? r.clave_municipio);

    // --- Resolve state_code via stateResolver (accepts names, CVE_ENT, aliases, codes) ---
    const rawSc =
      r.state_code ?? r.estado ?? r.entidad ?? r.entidad_federativa ??
      r["Entidad federativa"] ?? r.nombre_estado ?? r["nombre estado"] ??
      r.cve_ent ?? r.CVE_ENT ?? r.clave_estado ?? r["clave_estado"] ?? r["Clave estado"];

    let state_code: string;
    if (rawSc != null && String(rawSc).trim() !== "") {
      const resolved = resolveStateCode(String(rawSc));
      if (resolved) {
        state_code = resolved;
      } else {
        unmappedSet.add(String(rawSc).trim());
        // Try to derive from cvegeo as last resort
        state_code = cveMun ? (cveMun.padStart(5, "0").slice(0, 2)) : "";
        // Attempt to resolve the numeric prefix too
        if (state_code) {
          state_code = resolveStateCode(String(parseInt(state_code))) ?? state_code;
        }
      }
    } else if (cveMun && cveMun.length >= 4) {
      // Derive from cvegeo: numeric prefix → lookup
      const numPrefix = String(parseInt(cveMun.padStart(5, "0").slice(0, 2)));
      state_code = resolveStateCode(numPrefix) ?? cveMun.padStart(5, "0").slice(0, 2);
    } else {
      state_code = "";
    }

    // --- Year: row column takes precedence, falls back to manualYear ---
    const rawYear = r.year ?? r.anio ?? r.año ?? r.periodo;
    const year = rawYear !== undefined && rawYear !== ""
      ? parseInt(str(rawYear))
      : (manualYear ?? NaN);

    // --- Value from the selected column ---
    const rawVal = r[valueColumn];
    const value = parseFloat(str(rawVal) || "NaN");

    if (!state_code || isNaN(value) || isNaN(year)) {
      discarded++;
      continue;
    }

    result.push({ state_code, cve_mun: cveMun, value, year });
  }

  return { rows: result, unmappedKeys: [...unmappedSet], discarded };
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
  rows: CoercedRow[],
  updateStateLevel: boolean
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
  if (operation === "nueva_variable" || operation === "historico" || (payload.granularity !== "state" && variable.variable_id)) {
    payload.catalog_entry = variable;
  }
  if (operation === "historico") {
    payload.update_state_level = updateStateLevel;
  }
  try {
    const res = await fetch("/api/pipeline/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { ok: res.ok && data.ok, log: data.log ?? [] };
  } catch (err) {
    return {
      ok: false,
      log: [`Error de conexión: ${String(err)}. Verifica que el servidor local esté corriendo.`],
    };
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
  valueColumn: string;
  manualYear?: number;
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
  valueColumn,
  manualYear,
  onBack,
  onDone,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [yearConfirmed, setYearConfirmed] = useState(false);
  const [updateStateLevel, setUpdateStateLevel] = useState(true);

  const operation = deriveOperation(granularity, isNew, completarOnly);
  const { rows: coerced, unmappedKeys, discarded } = coerceRows(rows, valueColumn, manualYear);
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

  // Historico: derive latest year and detect if variable already has state data
  const maxIncomingYear =
    granularity === "historico" && coerced.length > 0
      ? Math.max(...coerced.map((r) => r.year))
      : undefined;
  const hasHistoricoConflict = granularity === "historico" && existingYear !== undefined;

  const modeLabel = isNew
    ? "Nueva variable"
    : completarOnly
    ? "Solo completar faltantes"
    : "Actualizar datos";

  async function handleConfirm() {
    setStatus("running");
    setLog([]);
    const shouldUpdateState =
      granularity === "historico" ? (hasHistoricoConflict ? updateStateLevel : true) : true;
    const result = await runPipeline(variable, operation, coerced, shouldUpdateState);
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
          <strong>
            {incomingYear ?? (manualYear ? `${manualYear} (manual)` : "—")}
          </strong>
        </div>
        <div className="confirm-summary__row">
          <span>Columna de valor</span>
          <strong><code>{valueColumn}</code></strong>
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
        {unmappedKeys.length > 0 && (
          <div className="wizard-warn-box" style={{ marginTop: 8, padding: "8px 12px", background: "var(--amber-bg, #fef3c7)", border: "1px solid var(--amber, #d97706)", borderRadius: "var(--radius)", fontSize: 13 }}>
            <strong>{unmappedKeys.length} clave{unmappedKeys.length !== 1 ? "s" : ""} geográfica{unmappedKeys.length !== 1 ? "s" : ""} no reconocida{unmappedKeys.length !== 1 ? "s" : ""}:</strong>
            <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12 }}>
              {unmappedKeys.join(" · ")}
            </p>
            <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
              Las filas con estas claves se descartaron. Revisa la ortografía o usa el código INEGI (CVE_ENT).
            </p>
          </div>
        )}
        {discarded > 0 && (
          <p className="wizard-warn">
            {discarded} fila{discarded !== 1 ? "s" : ""} descartada{discarded !== 1 ? "s" : ""} por valores inválidos o sin año.
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

      {hasHistoricoConflict && maxIncomingYear !== undefined && (
        <div className="wizard-warn-box" style={{ marginTop: 12, padding: "10px 14px", background: "var(--amber-bg, #fef3c7)", border: "1px solid var(--amber, #d97706)", borderRadius: "var(--radius)", fontSize: 13 }}>
          <strong>Datos estatales existentes (año {existingYear})</strong>
          <p style={{ margin: "4px 0 8px" }}>
            La variable ya tiene un valor estatal del año <strong>{existingYear}</strong>. El año más
            reciente de la serie importada es <strong>{maxIncomingYear}</strong>.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={updateStateLevel}
              onChange={(e) => setUpdateStateLevel(e.target.checked)}
            />
            Actualizar el valor estatal con los datos del año {maxIncomingYear}.
          </label>
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
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
