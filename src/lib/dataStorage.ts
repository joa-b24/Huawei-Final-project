import type { VariableCatalogEntry } from "../types/dataStandard";

const CATALOG_KEY = "catalog_overrides";
const IMPORTED_KEY = "imported_data";

export type OperationType =
  | "nueva_variable"
  | "historico"
  | "municipal"
  | "completar"
  | "modificar"
  | "actualizar";

export type ImportedDataEntry = {
  id: string;
  variable_id: string;
  operation: OperationType;
  granularity: "state" | "municipal";
  year?: number;
  rows: { state_code: string; cve_mun?: string; value: number; year?: number }[];
  savedAt: string;
};

// ── Catalog overrides ─────────────────────────────────────────────────────────

export function loadCatalogOverrides(): Record<string, Partial<VariableCatalogEntry>> {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCatalogOverride(
  variableId: string,
  patch: Partial<VariableCatalogEntry>
): void {
  const overrides = loadCatalogOverrides();
  overrides[variableId] = { ...overrides[variableId], ...patch };
  localStorage.setItem(CATALOG_KEY, JSON.stringify(overrides));
}

export function clearCatalogOverride(variableId: string): void {
  const overrides = loadCatalogOverrides();
  delete overrides[variableId];
  localStorage.setItem(CATALOG_KEY, JSON.stringify(overrides));
}

export function applyCatalogOverrides(
  entries: VariableCatalogEntry[]
): VariableCatalogEntry[] {
  const overrides = loadCatalogOverrides();
  return entries.map((e) =>
    overrides[e.variable_id] ? { ...e, ...overrides[e.variable_id] } : e
  );
}

// ── Imported data ─────────────────────────────────────────────────────────────

export function loadImportedData(): ImportedDataEntry[] {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveImportedEntry(entry: Omit<ImportedDataEntry, "id" | "savedAt">): ImportedDataEntry {
  const full: ImportedDataEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const all = loadImportedData();
  localStorage.setItem(IMPORTED_KEY, JSON.stringify([...all, full]));
  return full;
}

export function deleteImportedEntry(id: string): void {
  const all = loadImportedData().filter((e) => e.id !== id);
  localStorage.setItem(IMPORTED_KEY, JSON.stringify(all));
}
