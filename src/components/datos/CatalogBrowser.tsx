import { useMemo, useState } from "react";
import { Download, Eye, EyeOff, MoveDownRight, MoveUpRight, Plus } from "lucide-react";
import type { VariableCatalogEntry, CategoryId } from "../../types/dataStandard";
import { exportCatalog } from "../../lib/dataExport";

type Props = {
  catalog: VariableCatalogEntry[];
  editedIds: Set<string>;
  hiddenIds: Set<string>;
  onSelectVariable: (v: VariableCatalogEntry) => void;
  onNewOperation: () => void;
  onToggleHidden: (id: string) => void;
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

export default function CatalogBrowser({
  catalog, editedIds, hiddenIds,
  onSelectVariable, onNewOperation, onToggleHidden,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<CategoryId | "">("");
  const [filterFuente, setFilterFuente] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.categoria_id))) as CategoryId[],
    [catalog]
  );

  const fuentes = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.fuente_sugerida).filter(Boolean))).sort(),
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter((v) => {
      if (q && !v.nombre.toLowerCase().includes(q) && !v.variable_id.includes(q)) return false;
      if (filterCat && v.categoria_id !== filterCat) return false;
      if (filterFuente && v.fuente_sugerida !== filterFuente) return false;
      return true;
    });
  }, [catalog, search, filterCat, filterFuente]);

  function handleHide(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onToggleHidden(id);
  }

  return (
    <div className="catalog-browser">
      <div className="catalog-controls">
        <input
          className="state-search"
          placeholder="Buscar variable..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="comparison-select"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as CategoryId | "")}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
          ))}
        </select>
        <select
          className="comparison-select"
          value={filterFuente}
          onChange={(e) => setFilterFuente(e.target.value)}
        >
          <option value="">Cualquier fuente</option>
          {fuentes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div className="catalog-actions">
          <button
            className="btn-primary catalog-action-icon"
            onClick={onNewOperation}
            type="button"
            title="Nueva operación"
          >
            <Plus size={16} />
          </button>
          <button
            className="btn-ghost catalog-action-icon"
            onClick={() => exportCatalog(catalog)}
            type="button"
            title="Exportar catálogo"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <p className="catalog-count">
        {filtered.length} variable{filtered.length !== 1 ? "s" : ""}
        {hiddenIds.size > 0 && <span className="catalog-edited-badge"> · {hiddenIds.size} oculta{hiddenIds.size !== 1 ? "s" : ""}</span>}
        {editedIds.size > 0 && <span className="catalog-edited-badge"> · {editedIds.size} editada{editedIds.size !== 1 ? "s" : ""}</span>}
      </p>

      <table className="catalog-table ranking-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Unidad</th>
            <th>Polaridad</th>
            <th>Fuente</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => {
            const isHidden = hiddenIds.has(v.variable_id);
            return (
              <tr
                key={v.variable_id}
                className={[
                  editedIds.has(v.variable_id) ? "catalog-row--edited" : "",
                  isHidden ? "catalog-row--hidden" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectVariable(v)}
                title="Clic para editar o añadir datos"
              >
                <td>
                  <span className="catalog-var-name">{v.nombre}</span>
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
