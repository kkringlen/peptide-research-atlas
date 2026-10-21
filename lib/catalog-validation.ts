export const MAX_CATALOG_BYTES = 2_000_000;
const levels = new Set(["approved", "human", "preclinical", "uncertain"]);
const kinds = new Set(["Peptide", "Peptide blend", "Bioregulator", "Other compound", "Hormone", "Vitamin", "Unspecified blend", "Cosmetic product"]);
const identities = new Set(["identified", "interpreted", "unresolved"]);
const ids = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;

export function validatePayload(payload: unknown): { records: Record<string, unknown>[]; baseRevision: number } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Expected a catalog object.");
  const p = payload as Record<string, unknown>;
  if (!Number.isSafeInteger(p.baseRevision) || (p.baseRevision as number) < 0) throw new Error("A valid saved revision is required.");
  if (!Array.isArray(p.records) || p.records.length > 3000) throw new Error("The catalog must contain at most 3,000 records.");
  const seen = new Set<string>();
  for (const item of p.records) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Each catalog entry must be an object.");
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !ids.test(record.id) || seen.has(record.id)) throw new Error("Each entry needs a unique valid ID.");
    seen.add(record.id);
    if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 300) throw new Error("Each entry needs a name of at most 300 characters.");
    if (typeof record.evidenceLevel !== "string" || !levels.has(record.evidenceLevel)) throw new Error("Invalid evidence category.");
    if (typeof record.kind !== "string" || !kinds.has(record.kind)) throw new Error("Invalid compound type.");
    if (typeof record.identityStatus !== "string" || !identities.has(record.identityStatus)) throw new Error("Invalid identity category.");
    if (record.imageNumbers !== undefined && (!Array.isArray(record.imageNumbers) || record.imageNumbers.length > 6 || record.imageNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 6))) throw new Error("Invalid screenshot references.");
    if (record.reviewedAt !== undefined && (typeof record.reviewedAt !== "string" || (record.reviewedAt !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt)))) throw new Error("Invalid review date.");
    for (const key of ["_userAdded", "_userEdited", "_conflictCopy"]) {
      if (record[key] !== undefined && typeof record[key] !== "boolean") throw new Error("Invalid personal-edit marker.");
    }
    if (record._modifiedAt !== undefined && (typeof record._modifiedAt !== "string" || !Number.isFinite(Date.parse(record._modifiedAt)))) throw new Error("Invalid change timestamp.");
    for (const key of ["aliases", "areas", "cautions", "strengths", "originalLabels"]) {
      if (record[key] !== undefined && (!Array.isArray(record[key]) || (record[key] as unknown[]).length > 200 || (record[key] as unknown[]).some(v => typeof v !== "string" || v.length > 4000))) throw new Error(`Invalid ${key} list.`);
    }
    for (const key of ["summary", "mechanism", "evidenceSummary", "regulatory", "identityNote"]) {
      if (record[key] !== undefined && (typeof record[key] !== "string" || (record[key] as string).length > 20000)) throw new Error(`Invalid ${key} text.`);
    }
    if (record.sources !== undefined) {
      if (!Array.isArray(record.sources) || record.sources.length > 100) throw new Error("Invalid source list.");
      for (const source of record.sources) {
        if (!source || typeof source !== "object" || typeof source.title !== "string" || !source.title.trim() || source.title.length > 1000 || typeof source.url !== "string" || source.url.length > 4000 || (source.type !== undefined && (typeof source.type !== "string" || source.type.length > 200))) throw new Error("Each source needs a title and URL.");
        let url: URL;
        try { url = new URL(source.url); } catch { throw new Error("A source URL is not valid."); }
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Source links must use http or https.");
      }
    }
  }
  return { records: p.records as Record<string, unknown>[], baseRevision: p.baseRevision as number };
}
