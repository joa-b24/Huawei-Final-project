import type { VariableCatalogEntry } from "../types/dataStandard";

const CATALOG_KEY = "catalog_overrides";

export type OperationType =
  | "nueva_variable"
  | "historico"
  | "municipal"
  | "completar"
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
  const existingIds = new Set(entries.map((e) => e.variable_id));
  const patched = entries.map((e) =>
    overrides[e.variable_id] ? { ...e, ...overrides[e.variable_id] } : e
  );
  const added = Object.entries(overrides)
    .filter(([id]) => !existingIds.has(id))
    .map(([, patch]) => patch as VariableCatalogEntry)
    .filter((v) => v.variable_id && v.nombre);
  return [...patched, ...added];
}

// ── Deleted variable IDs ───────────────────────────────────────────────────────

const DELETED_KEY = "deleted_variable_ids";

export function loadDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addDeletedId(id: string): void {
  const ids = loadDeletedIds();
  ids.add(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

// ── Hidden variable IDs (ocultas en sidebar) ──────────────────────────────────
//
// Three localStorage keys cooperate:
//   hidden_variable_ids     — manually hidden by the user
//   no_data_hidden_ids      — auto-hidden because they have no data in combined JSON
//   user_shown_no_data_ids  — user explicitly un-hid an auto-hidden variable (overrides auto)
//
// Effective hidden set = manual ∪ (no_data \ user_shown)

const HIDDEN_KEY = "hidden_variable_ids";
const NO_DATA_HIDDEN_KEY = "no_data_hidden_ids";
const USER_SHOWN_KEY = "user_shown_no_data_ids";

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]")); }
  catch { return new Set(); }
}

function saveSet(key: string, s: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...s]));
}

export function loadHiddenIds(): Set<string> {
  const manual = loadSet(HIDDEN_KEY);
  const noData = loadSet(NO_DATA_HIDDEN_KEY);
  const userShown = loadSet(USER_SHOWN_KEY);
  const result = new Set(manual);
  for (const id of noData) if (!userShown.has(id)) result.add(id);
  return result;
}

export function toggleHiddenId(id: string): void {
  const manual = loadSet(HIDDEN_KEY);
  const noData = loadSet(NO_DATA_HIDDEN_KEY);
  const userShown = loadSet(USER_SHOWN_KEY);
  const effectivelyHidden = loadHiddenIds();

  if (effectivelyHidden.has(id)) {
    if (noData.has(id)) {
      // Auto-hidden due to no data → user is explicitly showing it
      userShown.add(id);
      saveSet(USER_SHOWN_KEY, userShown);
    } else {
      manual.delete(id);
      saveSet(HIDDEN_KEY, manual);
    }
  } else {
    // Currently shown → manually hide
    manual.add(id);
    saveSet(HIDDEN_KEY, manual);
    // If user had previously overridden auto-hide, clear that override
    if (userShown.has(id)) { userShown.delete(id); saveSet(USER_SHOWN_KEY, userShown); }
  }
}

// Called on app startup to sync auto-hidden set with actual data availability.
// Safe to call on every load — won't override manual user decisions.
export function syncNoDataAutoHidden(
  idsWithData: Set<string>,
  allCatalogIds: string[]
): void {
  const noDataIds = new Set(allCatalogIds.filter((id) => !idsWithData.has(id)));
  saveSet(NO_DATA_HIDDEN_KEY, noDataIds);

  // Remove user_shown overrides for IDs that now have data (override is irrelevant)
  const userShown = loadSet(USER_SHOWN_KEY);
  let changed = false;
  for (const id of userShown) {
    if (idsWithData.has(id)) { userShown.delete(id); changed = true; }
  }
  if (changed) saveSet(USER_SHOWN_KEY, userShown);
}
