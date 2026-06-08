import { useState } from "react";
import { createPortal } from "react-dom";
import { MoveDownRight, MoveUpRight, Trash2 } from "lucide-react";
import type {
  VariableCatalogEntry,
  CategoryId,
  TipoValor,
  AgregacionDefault,
  MetricPolaridad,
  VariableRole,
} from "../../types/dataStandard";

const CATEGORY_LABELS: Record<CategoryId, string> = {
  infraestructura_digital: "Infraestructura digital",
  cobertura_red: "Cobertura de red",
  bienestar_social: "Bienestar social",
  economia: "Economía",
  industria: "Industria",
  contexto_territorial: "Contexto territorial",
  demografia: "Demografía",
};

const CATEGORIES: { id: CategoryId; label: string }[] = Object.entries(CATEGORY_LABELS).map(
  ([id, label]) => ({ id: id as CategoryId, label })
);

const ROLE_OPTIONS: { value: VariableRole; label: string; desc: string }[] = [
  { value: "both",        label: "Análisis (Y o X)",   desc: "Puede usarse como variable dependiente o predictor." },
  { value: "target",      label: "Solo objetivo (Y)",  desc: "Variable dependiente exclusiva; no se usa como predictor." },
  { value: "explanatory", label: "Solo predictor (X)", desc: "Variable explicativa; no se usa como objetivo." },
  { value: "contextual",  label: "Contextual",         desc: "Referencia/escala; excluida del análisis estadístico." },
];

type Props = {
  variable: VariableCatalogEntry;
  statesWithData: number;
  totalStates: number;
  lastYearWithData: number | null;
  municipalStatesCount: number;
  historicalYears?: number[];
  onUpdateData: () => void;
  onDelete?: () => void;
  onBack: () => void;
};

type SaveStatus = "idle" | "saving" | "done" | "error";
type DeleteStatus = "idle" | "confirm" | "deleting" | "done" | "error";

async function deleteVariableApi(variable_id: string): Promise<{ ok: boolean; log: string[] }> {
  try {
    const res = await fetch("/api/pipeline/delete-variable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variable_id }),
    });
    if (!res.ok) throw new Error("Server Error");
    return await res.json();
  } catch {
    return {
      ok: false,
      log: ["No se pudo completar la acción. Esta función está disponible solo en entorno local."],
    };
  }
}

async function saveMetadata(
  variable_id: string,
  catalog_entry: VariableCatalogEntry
): Promise<{ ok: boolean; log: string[] }> {
  try {
    const res = await fetch("/api/pipeline/update-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variable_id, catalog_entry }),
    });
    if (!res.ok) throw new Error("Server Error");
    return await res.json();
  } catch {
    return {
      ok: false,
      log: ["No se pudo completar la acción. Esta función puede estar disponible solo en entorno local."],
    };
  }
}

export default function VariablePanel({
  variable: v,
  statesWithData,
  lastYearWithData,
  totalStates,
  municipalStatesCount,
  historicalYears = [],
  onUpdateData,
  onDelete,
  onBack,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<VariableCatalogEntry>(v);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("idle");
  const [deleteLog, setDeleteLog] = useState<string[]>([]);

  async function handleDelete() {
    setDeleteStatus("deleting");
    const result = await deleteVariableApi(v.variable_id);
    setDeleteLog(result.log);
    if (result.ok) {
      setDeleteStatus("done");
      onDelete?.();
    } else {
      setDeleteStatus("error");
    }
  }

  function handleChange(field: keyof VariableCatalogEntry, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit() {
    setDraft(v);
    setSaveStatus("idle");
    setLog([]);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setSaveStatus("idle");
  }

  async function handleSave() {
    setSaveStatus("saving");
    const result = await saveMetadata(v.variable_id, draft);
    setLog(result.log);
    setSaveStatus(result.ok ? "done" : "error");
  }

  // ── Post-save result screen ───────────────────────────────────────────────
  if (saveStatus === "done" || saveStatus === "error") {
    return (
      <div className="var-panel">
        <button className="btn-ghost wizard-back-link" onClick={onBack} type="button">
          ← Volver al catálogo
        </button>
        {saveStatus === "done" ? (
          <div className="wizard-success">
            <span className="wizard-success__icon">✓</span>
            <p className="wizard-success__msg">
              Metadatos de <strong>{draft.nombre}</strong> actualizados.
            </p>
          </div>
        ) : (
          <p className="wizard-step-title" style={{ color: "var(--red)" }}>
            Error al guardar metadatos
          </p>
        )}
        {log.length > 0 && <pre className="pipeline-log">{log.join("\n")}</pre>}
        <div className="wizard-nav">
          {saveStatus === "error" && (
            <button className="btn-ghost" onClick={() => setSaveStatus("idle")} type="button">
              ← Reintentar
            </button>
          )}
          {saveStatus === "done" && (
            <button className="btn-primary" onClick={() => window.location.reload()} type="button">
              Recargar dashboard
            </button>
          )}
          <button className="btn-ghost" onClick={onBack} type="button">
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="var-panel">
        <button className="btn-ghost wizard-back-link" onClick={cancelEdit} type="button">
          ← Cancelar edición
        </button>

        <div className="var-panel__header">
          <div>
            <h2 className="var-panel__name">Editar metadatos</h2>
            <span className="catalog-var-id">{v.variable_id}</span>
          </div>
        </div>

        <div className="var-form">
          <label>
            <span>Nombre <span className="required">*</span></span>
            <input
              value={draft.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
            />
          </label>

          <label>
            Descripción
            <textarea
              value={draft.descripcion}
              onChange={(e) => handleChange("descripcion", e.target.value)}
              rows={3}
            />
          </label>

          <div className="var-form__row">
            <label>
              <span>Unidad <span className="required">*</span></span>
              <input
                value={draft.unidad_base}
                onChange={(e) => handleChange("unidad_base", e.target.value)}
              />
            </label>
            <label>
              Fuente
              <input
                value={draft.fuente_sugerida}
                onChange={(e) => handleChange("fuente_sugerida", e.target.value)}
              />
            </label>
          </div>

          <div className="var-form__row">
            <label>
              Categoría
              <input
                list="edit-cat-options"
                value={CATEGORIES.find((c) => c.id === draft.categoria_id)?.label ?? draft.categoria_id}
                onChange={(e) => {
                  const match = CATEGORIES.find((c) => c.label === e.target.value);
                  handleChange("categoria_id", (match?.id ?? e.target.value) as CategoryId);
                }}
              />
              <datalist id="edit-cat-options">
                {CATEGORIES.map((c) => <option key={c.id} value={c.label} />)}
              </datalist>
            </label>
            <label>
              Tipo de valor
              <input
                list="edit-tipo-options"
                value={draft.tipo_valor}
                onChange={(e) => handleChange("tipo_valor", e.target.value as TipoValor)}
              />
              <datalist id="edit-tipo-options">
                <option value="percentage" />
                <option value="number" />
                <option value="integer" />
                <option value="currency" />
              </datalist>
            </label>
            <label>
              Dirección
              <select
                value={draft.direction ?? "higher_better"}
                onChange={(e) => handleChange("direction", e.target.value as MetricPolaridad)}
              >
                <option value="higher_better">↑ Mayor es mejor</option>
                <option value="lower_better">↓ Menor es mejor</option>
              </select>
            </label>
            <label>
              Agregación
              <input
                list="edit-agr-options"
                value={draft.agregacion_default}
                onChange={(e) => handleChange("agregacion_default", e.target.value as AgregacionDefault)}
              />
              <datalist id="edit-agr-options">
                <option value="avg" />
                <option value="sum" />
                <option value="latest" />
              </datalist>
            </label>
          </div>

          <label>
            Rol analítico
            <select
              value={draft.role ?? "both"}
              onChange={(e) => handleChange("role", e.target.value as VariableRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value} title={r.desc}>{r.label}</option>
              ))}
            </select>
            <span className="var-form__hint">
              {ROLE_OPTIONS.find((r) => r.value === (draft.role ?? "both"))?.desc}
            </span>
          </label>
        </div>

        <div className="wizard-nav" style={{ marginTop: 20 }}>
          <button className="btn-ghost" onClick={cancelEdit} type="button">Cancelar</button>
          <button
            className="btn-primary"
            disabled={saveStatus === "saving" || !draft.nombre.trim() || !draft.unidad_base.trim()}
            onClick={handleSave}
            type="button"
          >
            {saveStatus === "saving" ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        {saveStatus === "saving" && (
          <p className="wizard-step-title" style={{ marginTop: 12, fontSize: 13 }}>
            Actualizando catálogo…
          </p>
        )}
      </div>
    );
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  return (
    <div className="var-panel">
      <button className="btn-ghost wizard-back-link" onClick={onBack} type="button">
        ← Volver al catálogo
      </button>

      <div className="var-panel__header">
        <div>
          <h2 className="var-panel__name">{v.nombre}</h2>
          <span className="catalog-var-id">{v.variable_id}</span>
        </div>
        {import.meta.env.DEV && (
          <div className="var-panel__actions">
            <button className="btn-ghost" type="button" onClick={startEdit}>
              Editar metadatos
            </button>
            <button className="btn-primary" type="button" onClick={onUpdateData}>
              Actualizar datos
            </button>
            <button className="btn-danger" type="button" onClick={() => setDeleteStatus("confirm")}>
              <Trash2 size={13} /> Eliminar
            </button>
          </div>
        )}

      {deleteStatus !== "idle" && deleteStatus !== "done" && createPortal(
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3 className="delete-modal__title">¿Eliminar variable?</h3>
            <p className="delete-modal__body">
              Se eliminará <strong>{v.nombre}</strong> (<code>{v.variable_id}</code>) del catálogo y de todos los archivos de datos.
            </p>
            {historicalYears.length > 0 && (
              <p className="delete-modal__warn">
                · Datos históricos: {historicalYears.length} año(s) ({historicalYears[0]}–{historicalYears[historicalYears.length - 1]}) serán eliminados de <code>outputs/temporal/</code>.
              </p>
            )}
            {municipalStatesCount > 0 && (
              <p className="delete-modal__warn">
                · Datos municipales en {municipalStatesCount} estado(s) serán eliminados de <code>outputs/municipal/</code>.
              </p>
            )}
            <p className="delete-modal__warn">Esta acción no se puede deshacer.</p>
            <div className="delete-modal__actions">
              <button className="btn-ghost" type="button" onClick={() => setDeleteStatus("idle")} disabled={deleteStatus === "deleting"}>
                Cancelar
              </button>
              <button className="btn-danger" type="button" onClick={handleDelete} disabled={deleteStatus === "deleting"}>
                {deleteStatus === "deleting" ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
            {deleteStatus === "error" && deleteLog.length > 0 && (
              <pre className="pipeline-log" style={{ marginTop: 12 }}>{deleteLog.join("\n")}</pre>
            )}
          </div>
        </div>,
        document.body
      )}
      </div>

      {v.descripcion && (
        <p className="var-panel__desc">{v.descripcion}</p>
      )}

      <div className="var-panel__meta">
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Categoría</span>
          <span className="var-panel__meta-value">{CATEGORY_LABELS[v.categoria_id] ?? v.categoria_id}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Unidad</span>
          <span className="var-panel__meta-value">{v.unidad_base || "—"}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Dirección</span>
          <span className="var-panel__meta-value">
            {v.direction === "higher_better" && (
              <span className="catalog-direction catalog-direction--up"><MoveUpRight size={14} /></span>
            )}
            {v.direction === "lower_better" && (
              <span className="catalog-direction catalog-direction--down"><MoveDownRight size={14} /></span>
            )}
            {!v.direction && "—"}
          </span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Fuente</span>
          <span className="var-panel__meta-value">{v.fuente_sugerida || "—"}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Tipo</span>
          <span className="var-panel__meta-value">{v.tipo_valor}</span>
        </div>
        <div className="var-panel__meta-item">
          <span className="var-panel__meta-label">Agregación</span>
          <span className="var-panel__meta-value">{v.agregacion_default}</span>
        </div>
        {v.role && (
          <div className="var-panel__meta-item">
            <span className="var-panel__meta-label">Rol</span>
            <span className="var-panel__meta-value">
              {ROLE_OPTIONS.find((r) => r.value === v.role)?.label ?? v.role}
            </span>
          </div>
        )}
      </div>

      <div className="var-panel__coverage">
        <span className="var-panel__meta-label">Cobertura estatal{lastYearWithData ? ` (${lastYearWithData})` : ""}</span>
        <div className="var-panel__coverage-bar">
          <div
            className="var-panel__coverage-fill"
            style={{ width: totalStates > 0 ? `${(statesWithData / totalStates) * 100}%` : "0%" }}
          />
        </div>
        <span className="var-panel__coverage-text">{statesWithData} / {totalStates} estados</span>
      </div>

      {historicalYears.length > 0 && (
        <div className="var-panel__coverage">
          <span className="var-panel__meta-label">
            Cobertura histórica · {historicalYears.length} año{historicalYears.length !== 1 ? "s" : ""}{" "}
            ({historicalYears[0]}–{historicalYears[historicalYears.length - 1]})
          </span>
          <div className="var-panel__year-pills">
            {historicalYears.map((y) => (
              <span key={y} className="var-panel__year-pill">{y}</span>
            ))}
          </div>
        </div>
      )}

      <div className="var-panel__coverage">
        <span className="var-panel__meta-label">Cobertura municipal</span>
        <div className="var-panel__coverage-bar">
          <div
            className="var-panel__coverage-fill"
            style={{ width: totalStates > 0 ? `${(municipalStatesCount / totalStates) * 100}%` : "0%" }}
          />
        </div>
        <span className="var-panel__coverage-text">
          {municipalStatesCount} / {totalStates} estados con datos municipales
        </span>
      </div>
    </div>
  );
}
