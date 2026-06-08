import { useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, MoveDownRight, MoveUpRight, Plus, X } from "lucide-react";
import type { VariableCatalogEntry, CategoryId, VariableRole } from "../../types/dataStandard";

type Props = {
  catalog: VariableCatalogEntry[];
  editedIds: Set<string>;
  hiddenIds: Set<string>;
  coverageMap?: Map<string, { hasMunicipal: boolean; hasHistorical: boolean }>;
  onSelectVariable: (v: VariableCatalogEntry) => void;
  onNewOperation: () => void;
  onToggleHidden: (id: string) => void;
};

const ROLE_LABELS: Record<VariableRole, string> = {
  target:      "Objetivo",
  explanatory: "Predictor",
  both:        "Ambos",
  contextual:  "Contextual",
};

const CATEGORY_LABELS: Record<CategoryId, string> = {
  infraestructura_digital: "Infraestructura digital",
  cobertura_red: "Cobertura de red",
  bienestar_social: "Bienestar social",
  economia: "Economía",
  industria: "Industria",
  contexto_territorial: "Contexto territorial",
  demografia: "Demografía",
};

const BADGE_STYLE = { fontSize: 8, fontWeight: 700, letterSpacing: "0.05em", borderRadius: 3, padding: "1px 4px", marginLeft: 4, verticalAlign: "middle" } as const;

type ColKey = "cat" | "role" | "fuente";

export default function CatalogBrowser({
  catalog, editedIds, hiddenIds, coverageMap,
  onSelectVariable, onNewOperation, onToggleHidden,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterCoverage, setFilterCoverage] = useState<"all" | "municipal" | "historical">("all");
  const [colFilters, setColFilters] = useState<Record<ColKey, string>>({ cat: "", role: "", fuente: "" });
  const [openCol, setOpenCol] = useState<ColKey | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.categoria_id))) as CategoryId[],
    [catalog]
  );
  const fuentes = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.fuente_sugerida).filter(Boolean))).sort(),
    [catalog]
  );
  const roles: VariableRole[] = ["both", "target", "explanatory", "contextual"];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter((v) => {
      if (q && !v.nombre.toLowerCase().includes(q) && !v.variable_id.includes(q)) return false;
      if (filterCoverage === "municipal" && !coverageMap?.get(v.variable_id)?.hasMunicipal) return false;
      if (filterCoverage === "historical" && !coverageMap?.get(v.variable_id)?.hasHistorical) return false;
      if (colFilters.cat && v.categoria_id !== colFilters.cat) return false;
      if (colFilters.role && (v.role ?? "both") !== colFilters.role) return false;
      if (colFilters.fuente && v.fuente_sugerida !== colFilters.fuente) return false;
      return true;
    });
  }, [catalog, search, filterCoverage, colFilters, coverageMap]);

  function setColFilter(key: ColKey, value: string) {
    setColFilters((prev) => ({ ...prev, [key]: value }));
    setOpenCol(null);
  }

  function handleHide(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onToggleHidden(id);
  }

  const activeColFilters = Object.values(colFilters).filter(Boolean).length;

  function ColHeader({ colKey, label, options }: { colKey: ColKey; label: string; options: { value: string; label: string }[] }) {
    const isFiltered = !!colFilters[colKey];
    const isOpen = openCol === colKey;
    return (
      <th
        className={`catalog-col-header${isFiltered ? " filtered" : ""}`}
        onClick={(e) => { e.stopPropagation(); setOpenCol(isOpen ? null : colKey); }}
      >
        <span className="catalog-col-header__inner">
          {isFiltered
            ? <><span style={{ color: "var(--blue)", fontSize: 11, fontWeight: 700 }}>{options.find(o => o.value === colFilters[colKey])?.label ?? colFilters[colKey]}</span><X size={10} style={{ marginLeft: 2, color: "var(--blue)" }} /></>
            : <>{label}<ChevronDown size={11} style={{ marginLeft: 3, opacity: 0.45 }} /></>
          }
        </span>
        {isOpen && (
          <>
            <div className="col-filter-backdrop" onClick={(e) => { e.stopPropagation(); setOpenCol(null); }} />
            <div className="catalog-col-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
              <button
                className={!colFilters[colKey] ? "active" : ""}
                onClick={() => setColFilter(colKey, "")}
              >
                Todas
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  className={colFilters[colKey] === opt.value ? "active" : ""}
                  onClick={() => setColFilter(colKey, opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </th>
    );
  }

  return (
    <div className="catalog-browser">
      {/* Top controls: search + coverage buttons + actions */}
      <div className="catalog-controls">
        <input
          className="state-search"
          placeholder="Buscar variable..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="var-filter-row" style={{ margin: 0 }}>
          {(["all", "municipal", "historical"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`var-filter-btn${filterCoverage === f ? " active" : ""}`}
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setFilterCoverage(f)}
            >
              {f === "all" ? "Todas" : f === "municipal" ? "Municipal" : "Histórica"}
            </button>
          ))}
        </div>
        <div className="catalog-actions">
          {activeColFilters > 0 && (
            <button
              className="btn-ghost catalog-action-icon"
              title="Limpiar filtros de columna"
              type="button"
              onClick={() => setColFilters({ cat: "", role: "", fuente: "" })}
              style={{ color: "var(--blue)", fontSize: 11 }}
            >
              <X size={14} /> {activeColFilters}
            </button>
          )}
          {import.meta.env.DEV && (
            <button
              className="btn-primary catalog-action-icon"
              onClick={onNewOperation}
              type="button"
              title="Nueva operación"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      <p className="catalog-count">
        {filtered.length} variable{filtered.length !== 1 ? "s" : ""}
        {hiddenIds.size > 0 && <span className="catalog-edited-badge"> · {hiddenIds.size} oculta{hiddenIds.size !== 1 ? "s" : ""}</span>}
        {editedIds.size > 0 && <span className="catalog-edited-badge"> · {editedIds.size} editada{editedIds.size !== 1 ? "s" : ""}</span>}
        {activeColFilters > 0 && <span className="catalog-edited-badge" style={{ color: "var(--blue)" }}> · {activeColFilters} filtro{activeColFilters !== 1 ? "s" : ""} activo{activeColFilters !== 1 ? "s" : ""}</span>}
      </p>

      <table className="catalog-table ranking-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <ColHeader
              colKey="cat"
              label="Categoría"
              options={categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))}
            />
            <th>Unidad</th>
            <th>Polaridad</th>
            <ColHeader
              colKey="role"
              label="Rol"
              options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
            <ColHeader
              colKey="fuente"
              label="Fuente"
              options={fuentes.map((f) => ({ value: f, label: f }))}
            />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => {
            const isHidden = hiddenIds.has(v.variable_id);
            const cov = coverageMap?.get(v.variable_id);
            return (
              <tr
                key={v.variable_id}
                className={[
                  editedIds.has(v.variable_id) ? "catalog-row--edited" : "",
                  isHidden ? "catalog-row--hidden" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectVariable(v)}
                title={import.meta.env.PROD ? "Ver detalles de la variable" : "Clic para editar o añadir datos"}
              >
                <td>
                  <span className="catalog-var-name">
                    {v.nombre}
                    {cov?.hasMunicipal && (
                      <span style={{ ...BADGE_STYLE, background: "#1d4ed8", color: "#fff" }}>MUN</span>
                    )}
                    {cov?.hasHistorical && (
                      <span style={{ ...BADGE_STYLE, background: "#065f46", color: "#fff" }}>HIST</span>
                    )}
                  </span>
                  <span className="catalog-var-id">{v.variable_id}</span>
                </td>
                <td>{CATEGORY_LABELS[v.categoria_id] ?? v.categoria_id}</td>
                <td>{v.unidad_base}</td>
                <td>
                  {v.direction === "higher_better" && (
                    <span className="catalog-direction catalog-direction--up"><MoveUpRight size={14} /></span>
                  )}
                  {v.direction === "lower_better" && (
                    <span className="catalog-direction catalog-direction--down"><MoveDownRight size={14} /></span>
                  )}
                  {!v.direction && <span style={{ color: "var(--text-3)" }}>—</span>}
                </td>
                <td>
                  {v.role && v.role !== "both"
                    ? <span className={`catalog-role-badge catalog-role--${v.role}`}>{ROLE_LABELS[v.role]}</span>
                    : <span style={{ color: "var(--text-3)" }}>—</span>}
                </td>
                <td>{v.fuente_sugerida || "—"}</td>
                <td className="catalog-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="catalog-action-btn"
                    title={isHidden ? "Mostrar en sidebar" : "Ocultar en sidebar"}
                    onClick={(e) => handleHide(v.variable_id, e)}
                  >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div className="empty-state compact">
          <h2>Sin resultados</h2>
          <p>No hay variables que coincidan con los filtros aplicados.</p>
        </div>
      )}
    </div>
  );
}
