import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { parseCsv, type ParsedRow } from "../../../lib/csvParser";
import type { Granularity } from "./Step1OperationType";

type Props = {
  granularity: Granularity;
  variableId: string;
  onParsed: (rows: ParsedRow[], headers: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  hasData: boolean;
};

const SCHEMA_HINT: Record<Granularity, string> = {
  state: "state_code (ej. AGS, CMX), value, year",
  historico: "state_code (ej. AGS, CMX), year, value",
  municipal: "cvegeo (5 dígitos INEGI), value, year  —  state_code se deriva automáticamente",
};

function hasYearColumn(rows: ParsedRow[]): boolean {
  return rows.some((r) => {
    const y = r.year ?? r.anio;
    return y !== undefined && y !== "" && !isNaN(parseInt(y));
  });
}

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
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [yearMissing, setYearMissing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".json")) {
      setError("Solo se aceptan archivos .csv o .json");
      return;
    }
    setFileName(file.name);
    setError(null);
    setYearMissing(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let rows: ParsedRow[];
        let h: string[];
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text);
          rows = Array.isArray(data) ? data : data.records ?? [];
          h = rows.length > 0 ? Object.keys(rows[0]) : [];
        } else {
          const parsed = parseCsv(text);
          rows = parsed.rows;
          h = parsed.headers;
        }
        const missing = !hasYearColumn(rows);
        setYearMissing(missing);
        setHeaders(h);
        setPreview(rows.slice(0, 5));
        onParsed(rows, h);
      } catch {
        setError("No se pudo leer el archivo. Verifica el formato.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  const canContinue = hasData && !yearMissing;

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">Sube el archivo de datos</p>
      <p className="wizard-schema-hint">
        Formato esperado: <code>{SCHEMA_HINT[granularity]}</code>
        {" · "}variable: <code>{variableId}</code>
      </p>

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
      {yearMissing && (
        <p className="wizard-error">
          El archivo no incluye la columna <code>year</code> (o <code>anio</code>).
          El año es obligatorio — por favor agrégalo al archivo.
        </p>
      )}

      {preview.length > 0 && (
        <div className="data-preview">
          <p className="data-preview__label">{preview.length < 5 ? preview.length : "5+"} filas · {headers.length} columnas</p>
          <div className="data-preview__scroll">
            <table className="ranking-table">
              <thead>
                <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => <td key={h}>{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
        <button className="btn-primary" disabled={!canContinue} onClick={onNext} type="button">
          Siguiente →
        </button>
      </div>
    </div>
  );
}
