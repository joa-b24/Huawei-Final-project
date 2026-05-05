import { useMemo, useState } from "react";
import type { VariableCatalogEntry, CategoryId } from "../../types/dataStandard";
import { exportCatalog } from "../../lib/dataExport";

type Props = {
  catalog: VariableCatalogEntry[];
  editedIds: Set<string>;
  onSelectVariable: (v: VariableCatalogEntry) => void;
  onNewOperation: () => void;
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

const DIRECTION_LABEL: Record<string, string> = {
  higher_better: "↑ mayor es mejor",
  lower_better: "↓ menor es mejor",
};

export default function CatalogBrowser({ catalog, editedIds, onSelectVariable, onNewOperation }: Props) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<CategoryId | "">("");
  const [filterDir, setFilterDir] = useState<"" | "higher_better" | "lower_better">("");

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.categoria_id))) as CategoryId[],
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter((v) => {
      if (q && !v.nombre.toLowerCase().includes(q) && !v.variable_id.includes(q)) return false;
      if (filterCat && v.categoria_id !== filterCat) return false;
      if (filterDir && v.direction && v.direction !== filterDir) return false;
      return true;
    });
  }, [catalog, search, filterCat, filterDir]);

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
          value={filterDir}
          onChange={(e) => setFilterDir(e.target.value as "" | "higher_better" | "lower_better")}
        >
          <option value="">Cualquier dirección</option>
          <option value="higher_better">↑ Mayor es mejor</option>
          <option value="lower_better">↓ Menor es mejor</option>
        </select>
        <div className="catalog-actions">
          <button className="btn-primary" onClick={onNewOperation} type="button">
            + Nueva operación
          </button>
          <button
            className="btn-ghost"
            onClick={() => exportCatalog(catalog)}
            type="button"
            title="Descarga el catálogo con las ediciones aplicadas"
          >
            Exportar catálogo
          </button>
        </div>
      </div>
      <p className="catalog-count">
        {filtered.length} variable{filtered.length !== 1 ? "s" : ""}
        {editedIds.size > 0 && <span className="catalog-edited-badge"> · {editedIds.size} editada{editedIds.size !== 1 ? "s" : ""}</span>}
      </p>

      <table className="catalog-table ranking-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Unidad</th>
            <th>Dirección</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <tr
              key={v.variable_id}
              className={editedIds.has(v.variable_id) ? "catalog-row--edited" : ""}
              onClick={() => onSelectVariable(v)}
              title="Clic para editar o añadir datos"
            >
              <td>
                <span className="catalog-var-name">{v.nombre}</span>
                <span className="catalog-var-id">{v.variable_id}</span>
              </td>
              <td>{CATEGORY_LABELS[v.categoria_id] ?? v.categoria_id}</td>
              <td>{v.unidad_base}</td>
              <td>{v.direction ? DIRECTION_LABEL[v.direction] : "—"}</td>
              <td>{v.fuente_sugerida || "—"}</td>
            </tr>
          ))}
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
