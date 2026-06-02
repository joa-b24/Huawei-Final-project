/** Converts a raw snake_case variable ID into a readable label. */
export function humanizeVarId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
