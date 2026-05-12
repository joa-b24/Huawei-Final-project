import { useState } from "react";
import type {
  VariableCatalogEntry,
  CategoryId,
  TipoValor,
  AgregacionDefault,
  MetricPolaridad,
} from "../../../types/dataStandard";
import type { Granularity } from "./Step1OperationType";

type Props = {
  granularity: Granularity;
  catalog: VariableCatalogEntry[];
  initialVariable?: VariableCatalogEntry;
  selected: VariableCatalogEntry | null;
  onSelect: (v: VariableCatalogEntry) => void;
  isNew: boolean | null;
  onSetIsNew: (v: boolean) => void;
  completarOnly: boolean;
  onSetCompletarOnly: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
};

const EMPTY_VAR: VariableCatalogEntry = {
  variable_id: "",
  categoria_id: "infraestructura_digital",
  nombre: "",
  descripcion: "",
  unidad_base: "",
  tipo_valor: "percentage",
  agregacion_default: "avg",
  direction: "higher_better",
  fuente_sugerida: "",
  sinonimos: [],
};

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "infraestructura_digital", label: "Infraestructura digital" },
  { id: "cobertura_red", label: "Cobertura de red" },
  { id: "bienestar_social", label: "Bienestar social" },
  { id: "economia", label: "Economía" },
  { id: "industria", label: "Industria" },
  { id: "contexto_territorial", label: "Contexto territorial" },
  { id: "demografia", label: "Demografía" },
];

function NewVariableForm({
  draft,
  onChange,
}: {
  draft: VariableCatalogEntry;
  onChange: (f: keyof VariableCatalogEntry, v: string) => void;
}) {
  return (
    <div className="var-form">
      <label>
        <span>ID de variable <span className="required">*</span></span>
        <input
          value={draft.variable_id}
          onChange={(e) => onChange("variable_id", e.target.value)}
          placeholder="ej: cobertura_fibra_pct"
        />
      </label>
      <label>
        <span>Nombre <span className="required">*</span></span>
        <input
          value={draft.nombre}
          onChange={(e) => onChange("nombre", e.target.value)}
          placeholder="ej: Cobertura de fibra óptica"
        />
      </label>
      <div className="var-form__row">
        <label>
          <span>Unidad <span className="required">*</span></span>
          <input
            value={draft.unidad_base}
            onChange={(e) => onChange("unidad_base", e.target.value)}
            placeholder="ej: %"
          />
        </label>
        <label>
          Fuente
          <input
            value={draft.fuente_sugerida}
            onChange={(e) => onChange("fuente_sugerida", e.target.value)}
            placeholder="ej: INEGI"
          />
        </label>
      </div>
      <div className="var-form__row">
        <label>
          Categoría
          <input
            list="cat-options"
            value={CATEGORIES.find((c) => c.id === draft.categoria_id)?.label ?? draft.categoria_id}
            onChange={(e) => {
              const match = CATEGORIES.find((c) => c.label === e.target.value);
              onChange("categoria_id", (match?.id ?? e.target.value) as CategoryId);
            }}
            placeholder="ej: Infraestructura digital"
          />
          <datalist id="cat-options">
            {CATEGORIES.map((c) => <option key={c.id} value={c.label} />)}
          </datalist>
        </label>
        <label>
          Tipo de valor
          <input
            list="tipo-options"
            value={draft.tipo_valor}
            onChange={(e) => onChange("tipo_valor", e.target.value as TipoValor)}
            placeholder="ej: percentage"
          />
          <datalist id="tipo-options">
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
            onChange={(e) => onChange("direction", e.target.value as MetricPolaridad)}
          >
            <option value="higher_better">↑ Mayor es mejor</option>
            <option value="lower_better">↓ Menor es mejor</option>
          </select>
        </label>
        <label>
          Agregación
          <input
            list="agr-options"
            value={draft.agregacion_default}
            onChange={(e) => onChange("agregacion_default", e.target.value as AgregacionDefault)}
            placeholder="ej: avg"
          />
          <datalist id="agr-options">
            <option value="avg" />
            <option value="sum" />
            <option value="latest" />
          </datalist>
        </label>
      </div>
      <label>
        Descripción
        <textarea
          value={draft.descripcion}
          onChange={(e) => onChange("descripcion", e.target.value)}
          rows={3}
          placeholder="Descripción detallada del indicador..."
        />
      </label>
    </div>
  );
}

export default function Step2Variable({
  granularity,
  catalog,
  initialVariable,
  selected,
  onSelect,
  isNew,
  onSetIsNew,
  completarOnly,
  onSetCompletarOnly,
  onBack,
  onNext,
}: Props) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<VariableCatalogEntry>(selected ?? EMPTY_VAR);

  const isStateGranularity = granularity === "state";
  const forceExisting = !!initialVariable;

  function handleDraftChange(field: keyof VariableCatalogEntry, value: string) {
    const updated = { ...draft, [field]: value } as VariableCatalogEntry;
    setDraft(updated);
    onSelect(updated);
  }

  const canContinue = isNew === true
    ? draft.variable_id.trim() !== "" && draft.nombre.trim() !== "" && draft.unidad_base.trim() !== ""
    : isNew === false
    ? selected !== null
    : false;

  // ── If variable is pre-selected (from catalog panel click) ──────────────────
  if (forceExisting) {
    return (
      <div className="wizard-step-body">
        <p className="wizard-step-title">Variable seleccionada</p>
        <div className="confirm-summary" style={{ marginBottom: 16 }}>
          <div className="confirm-summary__row">
            <span>Variable</span>
            <strong>{initialVariable.nombre}</strong>
          </div>
          <div className="confirm-summary__row">
            <span>ID</span>
            <code style={{ fontSize: 12 }}>{initialVariable.variable_id}</code>
          </div>
        </div>
        {isStateGranularity && (
          <label className="wizard-toggle-row">
            <input
              type="checkbox"
              checked={completarOnly}
              onChange={(e) => onSetCompletarOnly(e.target.checked)}
            />
            <span>
              <strong>Solo completar faltantes</strong>
              <span className="wizard-toggle-desc"> — no sobreescribe valores existentes</span>
            </span>
          </label>
        )}
        <div className="wizard-nav">
          <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
          <button className="btn-primary" onClick={onNext} type="button">Siguiente →</button>
        </div>
      </div>
    );
  }

  // ── Choose nueva / existente ────────────────────────────────────────────────
  if (isNew === null) {
    return (
      <div className="wizard-step-body">
        <p className="wizard-step-title">¿Es una variable nueva o existente?</p>
        <div className="op-type-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button
            className="op-type-card"
            onClick={() => { onSetIsNew(true); onSelect(EMPTY_VAR); }}
            type="button"
          >
            <span className="op-type-card__label">Nueva variable</span>
            <span className="op-type-card__desc">
              Define el indicador y súbelo por primera vez al catálogo.
            </span>
          </button>
          <button
            className="op-type-card"
            onClick={() => onSetIsNew(false)}
            type="button"
          >
            <span className="op-type-card__label">Variable existente</span>
            <span className="op-type-card__desc">
              Añade o actualiza datos de un indicador ya registrado.
            </span>
          </button>
        </div>
        <div className="wizard-nav">
          <button className="btn-ghost" onClick={onBack} type="button">← Atrás</button>
        </div>
      </div>
    );
  }

  // ── Nueva variable: show form ───────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="wizard-step-body">
        <p className="wizard-step-title">Define la nueva variable</p>
        <NewVariableForm draft={draft} onChange={handleDraftChange} />
        <div className="wizard-nav">
          <button className="btn-ghost" onClick={() => onSetIsNew(null as unknown as boolean)} type="button">← Atrás</button>
          <button className="btn-primary" disabled={!canContinue} onClick={onNext} type="button">Siguiente →</button>
        </div>
      </div>
    );
  }

  // ── Variable existente: list + completar toggle ─────────────────────────────
  const filtered = catalog.filter(
    (v) =>
      v.nombre.toLowerCase().includes(search.toLowerCase()) ||
      v.variable_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-title">Selecciona la variable</p>
      <input
        className="state-search"
        placeholder="Buscar variable..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="var-select-list">
        {filtered.map((v) => (
          <button
            key={v.variable_id}
            className={`var-select-row${selected?.variable_id === v.variable_id ? " selected" : ""}`}
            onClick={() => onSelect(v)}
            type="button"
          >
            <span className="var-select-row__name">{v.nombre}</span>
            <span className="var-select-row__meta">{v.unidad_base} · {v.categoria_id.replace(/_/g, " ")}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="empty-hint">No se encontraron variables para "{search}"</p>
        )}
      </div>
      {isStateGranularity && selected && (
        <label className="wizard-toggle-row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={completarOnly}
            onChange={(e) => onSetCompletarOnly(e.target.checked)}
          />
          <span>
            <strong>Solo completar faltantes</strong>
            <span className="wizard-toggle-desc"> — no sobreescribe valores existentes</span>
          </span>
        </label>
      )}
      <div className="wizard-nav">
        <button className="btn-ghost" onClick={() => onSetIsNew(null as unknown as boolean)} type="button">← Atrás</button>
        <button className="btn-primary" disabled={!canContinue} onClick={onNext} type="button">Siguiente →</button>
      </div>
    </div>
  );
}
