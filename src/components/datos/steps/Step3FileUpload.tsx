import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { parseCsv, type ParsedRow } from "../../../lib/csvParser";
import {
  GEO_STATE_COLUMNS,
  GEO_MUN_COLUMNS,
  YEAR_COLUMNS,
  VALUE_COLUMNS,
} from "../../../lib/stateResolver";
import type { Granularity } from "./Step1OperationType";

type Props = {
  granularity: Granularity;
  variableId: string;
  onParsed: (rows: ParsedRow[], headers: string[], valueColumn: string, manualYear?: number) => void;
  onBack: () => void;
  onNext: () => void;
  hasData: boolean;
};

// All geo/year aliases that should never be offered as value candidates.
function isMetaColumn(col: string): boolean {
  const lower = col.toLowerCase();
  return (
    GEO_STATE_COLUMNS.has(lower) ||
    GEO_MUN_COLUMNS.has(lower) ||
    YEAR_COLUMNS.has(lower)
  );
}

/** Pick the best default value column from the available headers. */
function autoSelectValueColumn(headers: string[]): string {
  // Prefer exact VALUE_COLUMNS match first.
  for (const h of headers) {
    if (VALUE_COLUMNS.has(h.toLowerCase())) return h;
  }
  // Fall back to first non-meta column.
  const candidates = headers.filter((h) => !isMetaColumn(h));
  return candidates[0] ?? headers[0] ?? "";
}

/** Check whether any row has a parseable year. */
function detectYearColumn(rows: ParsedRow[]): boolean {
  return rows.some((r) => {
    const y = r.year ?? r.anio ?? r.año ?? r.periodo;
    return y !== undefined && y !== "" && !isNaN(parseInt(String(y)));
  });
}

const SCHEMA_HINT: Record<Granularity, string> = {
  state: [
    "Columna de entidad: state_code · estado · clave_estado · CVE_ENT · nombre estado · Entidad federativa",
    "Columna de valor: value · valor · dato · variable (o elige abajo si hay varias)",
    "Columna de año: year · anio · año  (opcional — puedes indicarlo en el formulario)",
  ].join("\n"),
  historico: [
    "Columna de entidad: state_code · estado · clave_estado · CVE_ENT · nombre estado",
    "Columna de valor: value · valor · dato · variable",
    "Columna de año: year · anio · año  (obligatorio para series históricas)",
  ].join("\n"),
  municipal: [
    "Columna municipal: cvegeo · cve_mun · cve_geo · clave_municipio  (5 dígitos INEGI)",
    "Columna de entidad (opcional): state_code · CVE_ENT · estado  — se deriva de cvegeo si falta",
    "Columna de valor: value · valor · dato · variable",
    "Columna de año: year · anio · año  (opcional — puedes indicarlo en el formulario)",
  ].join("\n"),
};

export default function Step3FileUpload({
  granularity,
  variableId,
  onParsed,
  onBack,
  onNext,
  hasData,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Column selection
  const [valueColumn, setValueColumn] = useState<string>("");
  const [candidateColumns, setCandidateColumns] = useState<string[]>([]);

  // Year
  const [hasYearCol, setHasYearCol] = useState(true);
  const [manualYear, setManualYear] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  function notifyParent(
    rows: ParsedRow[],
    hdrs: string[],
    valCol: string,
    yearMissing: boolean,
    yearStr: string,
  ) {
    const yr = yearMissing && yearStr ? parseInt(yearStr) : undefined;
    onParsed(rows, hdrs, valCol, yr);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".json")) {
      setError("Solo se aceptan archivos .csv o .json");
      return;
    }
    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let rows: ParsedRow[];
        let hdrs: string[];
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text);
          rows = Array.isArray(data) ? data : data.records ?? [];
          hdrs = rows.length > 0 ? Object.keys(rows[0]) : [];
        } else {
          const parsed = parseCsv(text);
          rows = parsed.rows;
          hdrs = parsed.headers;
        }

        const yearPresent = detectYearColumn(rows);
        setHasYearCol(yearPresent);

        // Candidates: every column that isn't a geo or year alias.
        const candidates = hdrs.filter((h) => !isMetaColumn(h));
        setCandidateColumns(candidates);
        const best = autoSelectValueColumn(hdrs);
        setValueColumn(best);

        setHeaders(hdrs);
        setAllRows(rows);
        setPreview(rows.slice(0, 5));
        notifyParent(rows, hdrs, best, !yearPresent, manualYear);
      } catch {
        setError("No se pudo leer el archivo. Verifica el formato.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function handleValueColumnChange(col: string) {
    setValueColumn(col);
    notifyParent(allRows, headers, col, !hasYearCol, manualYear);
  }

  function handleManualYearChange(val: string) {
    setManualYear(val);
    notifyParent(allRows, headers, valueColumn, !hasYearCol, val);
  }

  const yearOk = hasYearCol || (manualYear !== "" && !isNaN(parseInt(manualYear)));
  // For historico the year column is mandatory (the series needs per-row years).
  const yearRequired = granularity === "historico";
  const canContinue = hasData && valueColumn !== "" && (yearOk || (!yearRequired && !hasYearCol && manualYear === ""));

  // Whether the Siguiente button should actually be enabled:
  // - has parsed rows
  // - has a value column selected
  // - year is either in the file, or provided manually (unless historico)
  const nextEnabled = hasData && valueColumn !== "" && (hasYearCol || !yearRequired);

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">Sube el archivo de datos</p>
      <p className="wizard-schema-hint" style={{ whiteSpace: "pre-line" }}>
        {SCHEMA_HINT[granularity]}
        {"\n"}Variable: <code>{variableId}</code>
      </p>

      {/* Drop zone */}
      <div
        className={`file-dropzone${dragOver ? " drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        {fileName ? (
          <span className="dropzone-filename"><FileText size={14} /> {fileName}</span>
        ) : (
          <>
            <span className="dropzone-icon"><Upload size={40} strokeWidth={1.5} /></span>
            <span className="dropzone-label">Arrastra tu archivo aquí o haz clic para seleccionar</span>
            <span className="dropzone-hint">Formatos: .csv · .json</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {error && <p className="wizard-error">{error}</p>}

      {/* Column picker — shown when file is loaded */}
      {headers.length > 0 && (
        <div className="import-options">
          {/* Value column */}
          <div className="import-option-row">
            <label className="import-option-label">Columna de valor</label>
            {candidateColumns.length <= 1 ? (
              <span className="import-option-fixed">
                <code>{valueColumn || "—"}</code>
                {candidateColumns.length === 0 && (
                  <span className="wizard-warn" style={{ marginLeft: 8 }}>
                    No se detectó columna de valor.
                  </span>
                )}
              </span>
            ) : (
              <select
                className="import-option-select"
                value={valueColumn}
                onChange={(e) => handleValueColumnChange(e.target.value)}
              >
                {candidateColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Manual year input when file has no year column */}
          {!hasYearCol && (
            <div className="import-option-row">
              <label className="import-option-label">
                Año de los datos
                {yearRequired && <span style={{ color: "var(--red)", marginLeft: 4 }}>*</span>}
              </label>
              {yearRequired ? (
                <p className="wizard-error" style={{ margin: 0 }}>
                  Para series históricas la columna <code>year</code> / <code>anio</code> es obligatoria — agrégala al archivo.
                </p>
              ) : (
                <input
                  type="number"
                  className="import-option-input"
                  placeholder="ej. 2023"
                  min={1990}
                  max={2099}
                  value={manualYear}
                  onChange={(e) => handleManualYearChange(e.target.value)}
                />
              )}
              {!yearRequired && (
                <span className="import-option-hint">
                  El archivo no tiene columna de año — este valor se aplicará a todos los registros.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="data-preview">
          <p className="data-preview__label">
            {allRows.length} fila{allRows.length !== 1 ? "s" : ""} · {headers.length} columna{headers.length !== 1 ? "s" : ""}
            {!hasYearCol && manualYear && ` · año: ${manualYear}`}
          </p>
          <div className="data-preview__scroll">
            <table className="ranking-table">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      style={h === valueColumn ? { background: "var(--accent-subtle, #e0f2fe)", fontWeight: 700 } : undefined}
                    >
                      {h}
                      {h === valueColumn && (
                        <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>▶ valor</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td
                        key={h}
                        style={h === valueColumn ? { background: "var(--accent-subtle, #e0f2fe)" } : undefined}
                      >
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length < allRows.length && (
            <p className="data-preview__label" style={{ marginTop: 4, opacity: 0.6 }}>
              Mostrando 5 de {allRows.length} filas
            </p>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
        <button
          className="btn-primary"
          disabled={!nextEnabled}
          onClick={onNext}
          type="button"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
