import { useState, useMemo } from "react";
import type { PcaManifest, PcaResults } from "../../services/DataService";
import { humanizeVarId } from "../../utils/humanize";

type Props = {
  availableVariables: string[];
  varLabels: Record<string, string>;
  manifest: PcaManifest;
  onClose: () => void;
  onDone: (newManifest: PcaManifest, newResults: PcaResults) => void;
};

type Step = "variables" | "config" | "run";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const STEP_LABELS = ["Variables", "Configuración", "Ejecutar"];

export default function PcaWizard({ availableVariables, varLabels, manifest, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("variables");
  const stepIdx = step === "variables" ? 0 : step === "config" ? 1 : 2;

  // Step 1 state
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 2 state
  const [name, setName]         = useState("");
  const [indexName, setIndexName] = useState("");
  const [nClusters, setNClusters] = useState(0); // 0 = auto
  const [normalize, setNormalize] = useState(true);

  // Step 3 state
  const [running, setRunning]   = useState(false);
  const [log, setLog]           = useState<string[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  const filtered = useMemo(
    () =>
      availableVariables.filter((v) =>
        search
          ? (varLabels[v] ?? v).toLowerCase().includes(search.toLowerCase()) ||
            v.toLowerCase().includes(search.toLowerCase())
          : true
      ),
    [availableVariables, varLabels, search]
  );

  const analysisId = useMemo(() => slugify(name || "nuevo_analisis"), [name]);

  const existingIds = useMemo(() => new Set(manifest.analyses.map((a) => a.id)), [manifest]);
  const idConflict = useMemo(
    () => existingIds.has(analysisId) && !manifest.analyses.find((a) => a.id === analysisId)?.readonly === false,
    [existingIds, analysisId, manifest.analyses]
  );

  function toggleVar(v: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  async function runAnalysis() {
    setRunning(true);
    setLog([]);
    setError(null);
    setDone(false);

    const config = {
      id:         analysisId,
      name:       name.trim() || "Nuevo análisis",
      index_name: indexName.trim() || "Índice PCA",
      variables:  Array.from(selected),
      n_clusters: nClusters,
      normalize,
    };

    try {
      const res = await fetch("/api/pipeline/run-pca", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(config),
      });
      const data = await res.json() as { ok: boolean; log: string[]; manifest: unknown; results: unknown };
      setLog(data.log ?? []);
      if (!data.ok) {
        setError("El script terminó con errores. Revisa el log.");
      } else if (!data.manifest || !data.results) {
        setError("El script terminó pero no se encontraron los archivos de resultados. Revisa el log.");
      } else {
        setDone(true);
        onDone(data.manifest as any, data.results as any);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const S = {
    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    modal: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      width: "min(780px, 96vw)",
      maxHeight: "88vh",
      display: "flex",
      flexDirection: "column" as const,
      boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
    },
    header: {
      padding: "18px 24px 14px",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    body: {
      padding: "20px 24px",
      overflowY: "auto" as const,
      flex: 1,
    },
    footer: {
      padding: "14px 24px",
      borderTop: "1px solid var(--border)",
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
    },
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "var(--text-1)" }}>
              Nuevo análisis de agrupación
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-3)" }}>
              PCA + K-Means sobre variables con datos estatales completos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-3)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div style={{ padding: "12px 24px 0", display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              style={{
                paddingBottom: 10,
                marginRight: 24,
                fontSize: 13,
                fontWeight: i === stepIdx ? 700 : 400,
                color: i === stepIdx ? "var(--blue)" : i < stepIdx ? "var(--text-2)" : "var(--text-3)",
                borderBottom: i === stepIdx ? "2px solid var(--blue)" : "2px solid transparent",
                cursor: i < stepIdx ? "pointer" : "default",
              }}
              onClick={() => {
                if (i === 0) setStep("variables");
                if (i === 1 && selected.size >= 3) setStep("config");
              }}
            >
              {i + 1}. {label}
              {i === 0 && selected.size > 0 && ` (${selected.size})`}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* ── Paso 1: Variables ── */}
          {step === "variables" && (
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-2)" }}>
                Elige las variables que entrarán al análisis. Se necesitan al menos 3.
                Solo se muestran las que tienen datos para los 32 estados.
              </p>
              <input
                type="text"
                placeholder="Buscar variable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginBottom: 10,
                  padding: "7px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "var(--surface)",
                  color: "var(--text-1)",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "var(--text-3)" }}>
                <span>{filtered.length} variables · {selected.size} seleccionadas</span>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 12, cursor: "pointer", padding: 0 }}
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                {filtered.map((v, i) => {
                  const isSelected = selected.has(v);
                  return (
                    <label
                      key={v}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                        background: isSelected ? "color-mix(in srgb, var(--blue) 6%, transparent)" : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVar(v)}
                        style={{ accentColor: "var(--blue)", width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-1)", fontWeight: isSelected ? 600 : 400 }}>
                        {varLabels[v] ?? humanizeVarId(v)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>{v}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <p style={{ padding: "20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    Sin resultados para "{search}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Paso 2: Configuración ── */}
          {step === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-1)" }}>
                  Nombre del análisis
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Análisis de infraestructura"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "8px 10px",
                    border: `1px solid ${idConflict ? "var(--red)" : "var(--border)"}`,
                    borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text-1)",
                  }}
                />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: idConflict ? "var(--red)" : "var(--text-3)" }}>
                  ID: <code>{analysisId}</code>
                  {idConflict && " — ya existe un análisis con este ID"}
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-1)" }}>
                  Nombre del índice
                </label>
                <input
                  type="text"
                  value={indexName}
                  onChange={(e) => setIndexName(e.target.value)}
                  placeholder="ej. Índice de Infraestructura Digital"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "8px 10px",
                    border: "1px solid var(--border)", borderRadius: 6, fontSize: 13,
                    background: "var(--surface)", color: "var(--text-1)",
                  }}
                />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-3)" }}>
                  Aparece en la narrativa y en las KPIs del tab Estructura.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-1)" }}>
                  Número de grupos (K-Means)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={nClusters}
                    onChange={(e) => setNClusters(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--blue)" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--blue)", minWidth: 60, textAlign: "right" }}>
                    {nClusters === 0 ? "Auto" : nClusters}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-3)" }}>
                  Auto: detecta el k óptimo via silhouette score (recomendado).
                </p>
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={normalize}
                    onChange={(e) => setNormalize(e.target.checked)}
                    style={{ accentColor: "var(--blue)", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                    Normalizar variables (StandardScaler)
                  </span>
                </label>
                <p style={{ margin: "4px 0 0 25px", fontSize: 11, color: "var(--text-3)" }}>
                  Recomendado cuando las variables tienen unidades distintas.
                </p>
              </div>

              <div style={{ padding: "12px 14px", background: "var(--surface-2, #f8fafc)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>
                  {selected.size} variables seleccionadas
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Array.from(selected).map((v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: 11, padding: "2px 8px",
                        background: "color-mix(in srgb, var(--blue) 10%, transparent)",
                        color: "var(--blue)", borderRadius: 12,
                      }}
                    >
                      {varLabels[v] ?? humanizeVarId(v)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Ejecutar ── */}
          {step === "run" && (
            <div>
              {!done && !running && !error && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                    Resumen del análisis
                  </p>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    {[
                      ["ID", analysisId],
                      ["Nombre", name || "Nuevo análisis"],
                      ["Índice", indexName || "Índice PCA"],
                      ["Variables", `${selected.size}`],
                      ["Clusters", nClusters === 0 ? "Auto-detect" : String(nClusters)],
                      ["Normalizar", normalize ? "Sí" : "No"],
                    ].map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 0", color: "var(--text-3)", width: 120 }}>{k}</td>
                        <td style={{ padding: "6px 0", fontWeight: 600, color: "var(--text-1)" }}>{v}</td>
                      </tr>
                    ))}
                  </table>
                </div>
              )}

              {running && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 100 100"
                    style={{ width: 72, height: 72, animation: "loading-float 1.6s ease-in-out infinite", filter: "drop-shadow(0 10px 24px rgba(27,70,186,0.35))", marginBottom: 16 }}
                  >
                    <defs>
                      <linearGradient id="pcaBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1b46ba" />
                        <stop offset="100%" stopColor="#0b2475" />
                      </linearGradient>
                      <linearGradient id="pcaCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <g transform="translate(10,10)">
                      <path className="loading-logo__layer--3" d="M 15 55 L 40 70 L 65 55 L 40 40 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
                      <path className="loading-logo__layer--2" d="M 15 38 L 40 53 L 65 38 L 40 23 Z" fill="url(#pcaCyan)" fillOpacity="0.25" stroke="url(#pcaCyan)" strokeWidth="2.5" strokeLinejoin="round" />
                      <path className="loading-logo__layer--1" d="M 15 21 L 40 36 L 65 21 L 40 6 Z" fill="url(#pcaBlue)" fillOpacity="0.85" stroke="url(#pcaBlue)" strokeWidth="3" strokeLinejoin="round" />
                      <line x1="40" y1="6" x2="40" y2="70" stroke="url(#pcaCyan)" strokeWidth="2.5" strokeDasharray="2 3" opacity="0.7" />
                      <circle cx="40" cy="21" r="5" fill="#ffffff" stroke="url(#pcaBlue)" strokeWidth="3" />
                      <circle cx="40" cy="21" r="1.5" fill="url(#pcaCyan)" />
                    </g>
                  </svg>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>Ejecutando análisis…</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>Esto puede tardar unos segundos.</p>
                </div>
              )}

              {log.length > 0 && (
                <pre
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: "12px 14px",
                    borderRadius: 8,
                    fontSize: 11,
                    lineHeight: 1.6,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: 260,
                    overflowY: "auto",
                    margin: "12px 0 0",
                  }}
                >
                  {log.join("\n")}
                </pre>
              )}

              {error && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "color-mix(in srgb, var(--red) 8%, transparent)", borderRadius: 8, borderLeft: "3px solid var(--red)", fontSize: 13, color: "var(--text-1)" }}>
                  <strong>Error:</strong> {error}
                </div>
              )}

              {done && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: "color-mix(in srgb, var(--green, #16a34a) 8%, transparent)", borderRadius: 8, borderLeft: "3px solid var(--green, #16a34a)", fontSize: 13, color: "var(--text-1)" }}>
                  Análisis completado. Los resultados ya están cargados en la vista.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {step === "variables" && (
            <>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
              <button
                type="button"
                onClick={() => setStep("config")}
                disabled={selected.size < 3}
                style={selected.size >= 3 ? btnPrimary : btnDisabled}
              >
                Siguiente →
              </button>
            </>
          )}
          {step === "config" && (
            <>
              <button type="button" onClick={() => setStep("variables")} style={btnSecondary}>← Atrás</button>
              <button
                type="button"
                onClick={() => setStep("run")}
                disabled={!name.trim() || idConflict}
                style={name.trim() && !idConflict ? btnPrimary : btnDisabled}
              >
                Siguiente →
              </button>
            </>
          )}
          {step === "run" && (
            <>
              {!done && <button type="button" onClick={() => setStep("config")} style={btnSecondary} disabled={running}>← Atrás</button>}
              {done
                ? <button type="button" onClick={onClose} style={btnPrimary}>Cerrar</button>
                : (
                  <button
                    type="button"
                    onClick={runAnalysis}
                    disabled={running}
                    style={running ? btnDisabled : btnPrimary}
                  >
                    {running ? "Ejecutando…" : "Ejecutar análisis"}
                  </button>
                )
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const base = {
  padding: "8px 18px",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  transition: "opacity 0.15s",
};
const btnPrimary  = { ...base, background: "var(--blue)", color: "#fff" };
const btnSecondary = { ...base, background: "transparent", border: "1px solid var(--border)", color: "var(--text-2)" };
const btnDisabled  = { ...base, background: "var(--border)", color: "var(--text-3)", cursor: "not-allowed" };
