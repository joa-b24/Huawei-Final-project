import type { VariableCatalogEntry } from "../types/dataStandard";
import type { ImportedDataEntry } from "./dataStorage";

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCatalog(
  entries: VariableCatalogEntry[],
  updatedAt: string = new Date().toISOString().slice(0, 10)
): void {
  downloadJson({ updated_at: updatedAt, variables: entries }, "variables.catalog.json");
}

export function exportImportedEntryAsWideJson(entry: ImportedDataEntry): void {
  const records = entry.rows.map((r) => ({
    state_code: r.state_code,
    ...(r.cve_mun ? { cve_mun: r.cve_mun } : {}),
    ...(r.year ? { anio: r.year } : entry.year ? { anio: entry.year } : {}),
    metrics: { [entry.variable_id]: r.value },
  }));

  downloadJson(
    {
      variable_id: entry.variable_id,
      operation: entry.operation,
      granularity: entry.granularity,
      exported_at: new Date().toISOString(),
      records,
    },
    `${entry.variable_id}_${entry.operation}.json`
  );
}
