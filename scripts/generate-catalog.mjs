#!/usr/bin/env node
/** Rebuild checked-in deliverables using only Node.js built-in modules. */
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--check") || args.length > 1) {
  console.error("Usage: node scripts/generate-catalog.mjs [--check]");
  process.exit(2);
}
const checkOnly = args.includes("--check");
const placeholder = "__CATALOG_JSON__";
const kinds = new Set(["Peptide", "Peptide blend", "Bioregulator", "Other compound", "Hormone", "Vitamin", "Unspecified blend", "Cosmetic product"]);
const levels = new Set(["approved", "human", "preclinical", "uncertain"]);
const identities = new Set(["identified", "interpreted", "unresolved"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateCatalog(records) {
  assert(Array.isArray(records) && records.length > 0 && records.length <= 2000, "Catalog must contain 1–2,000 records.");
  const seen = new Set();
  records.forEach((record, index) => {
    const at = `Record ${index + 1}`;
    assert(record && typeof record === "object" && !Array.isArray(record), `${at} must be an object.`);
    assert(typeof record.id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(record.id), `${at} needs a valid ID of at most 160 characters.`);
    assert(!seen.has(record.id), `${at} duplicates an existing ID.`);
    seen.add(record.id);
    for (const [key, maximum] of Object.entries({ name: 160, summary: 6000, mechanism: 8000, evidenceSummary: 10000, regulatory: 6000, identityNote: 6000 })) {
      assert(typeof record[key] === "string" && record[key].length <= maximum, `${at}: ${key} must be text of at most ${maximum} characters.`);
    }
    assert(record.name.trim() && record.summary.trim(), `${at} needs a nonempty name and summary.`);
    assert(kinds.has(record.kind), `${at} has an unsupported compound type.`);
    assert(levels.has(record.evidenceLevel), `${at} has an unsupported evidence level.`);
    assert(identities.has(record.identityStatus), `${at} has an unsupported identity status.`);
    for (const key of ["aliases", "areas", "cautions", "strengths", "originalLabels"]) {
      const maximum = key === "areas" ? 30 : 150;
      assert(Array.isArray(record[key]) && record[key].length <= maximum, `${at}: ${key} must be an array of at most ${maximum} strings.`);
      assert(record[key].every((value) => typeof value === "string" && value.trim() && value.length <= 2000), `${at}: ${key} contains invalid or oversized text.`);
    }
    assert(record.areas.length > 0, `${at} needs at least one research area.`);
    assert(Array.isArray(record.imageNumbers) && record.imageNumbers.length <= 6 && record.imageNumbers.every((value) => Number.isInteger(value) && value >= 1 && value <= 6), `${at} has invalid screenshot references.`);
    assert(typeof record.reviewedAt === "string" && (record.reviewedAt === "" || (/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt) && !Number.isNaN(Date.parse(record.reviewedAt)) && new Date(record.reviewedAt).toISOString().slice(0, 10) === record.reviewedAt)), `${at} has an invalid review date.`);
    assert(Array.isArray(record.sources) && record.sources.length <= 100, `${at} needs a source array of at most 100 items.`);
    record.sources.forEach((source, sourceIndex) => {
      const label = `${at}, source ${sourceIndex + 1}`;
      assert(source && typeof source === "object" && !Array.isArray(source), `${label} must be an object.`);
      assert(typeof source.title === "string" && source.title.trim() && source.title.length <= 500, `${label} needs a title of at most 500 characters.`);
      assert(typeof source.url === "string" && source.url.length <= 4000, `${label} needs a URL of at most 4,000 characters.`);
      let url;
      try { url = new URL(source.url); } catch { throw new Error(`${label} has an invalid URL.`); }
      assert(url.protocol === "https:" || url.protocol === "http:", `${label} must use an http or https URL.`);
      assert(typeof source.type === "string" && source.type.length <= 100, `${label} needs a source type of at most 100 characters.`);
    });
    for (const key of ["_userAdded", "_userEdited", "_conflictCopy"]) {
      assert(record[key] === undefined || typeof record[key] === "boolean", `${at} has an invalid personal-edit marker.`);
    }
    assert(record._modifiedAt === undefined || (typeof record._modifiedAt === "string" && Number.isFinite(Date.parse(record._modifiedAt))), `${at} has an invalid modification timestamp.`);
  });
  assert(Buffer.byteLength(JSON.stringify({ records, baseRevision: 0 })) <= 2_000_000, "Catalog exceeds the online API's 2 MB limit.");
}

async function writeAtomic(relativePath, content) {
  const destination = resolve(root, relativePath);
  const temporary = `${destination}.tmp-${process.pid}`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

async function main() {
  const [catalogText, template] = await Promise.all([
    readFile(resolve(root, "data/catalog.json"), "utf8"),
    readFile(resolve(root, "ui-template.html"), "utf8"),
  ]);
  let records;
  try { records = JSON.parse(catalogText); } catch { throw new Error("data/catalog.json is not valid JSON."); }
  validateCatalog(records);
  assert(template.split(placeholder).length === 2, "ui-template.html must contain exactly one __CATALOG_JSON__ placeholder.");
  const encodedCatalog = JSON.stringify(records).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const html = template.replace(placeholder, () => encodedCatalog);
  assert(!html.includes(placeholder), "Catalog placeholder remains in the generated HTML.");
  const embeddedMatch = html.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert(embeddedMatch && JSON.stringify(JSON.parse(embeddedMatch[1])) === JSON.stringify(records), "Embedded catalog did not round-trip correctly.");
  const executableScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert(executableScripts.length > 0, "The template has no executable application script.");
  for (const [index, match] of executableScripts.entries()) new Script(match[1], { filename: `atlas-script-${index + 1}.js` });
  const researchSnapshot = records.map((record) => record.reviewedAt).filter(Boolean).sort().at(-1) || null;
  const outputs = new Map([
    ["app/catalog-html.ts", `// Generated by scripts/generate-catalog.mjs. Edit ui-template.html and data/catalog.json.\nexport const catalogHtml = ${JSON.stringify(html)};\n`],
    ["offline/Peptide_Research_Atlas_Offline.html", html],
    ["offline/Peptide_Research_Atlas_Backup.json", `${JSON.stringify({ format: "peptide-research-library", schemaVersion: 1, researchSnapshot, records }, null, 2)}\n`],
  ]);
  const mismatches = [];
  for (const [relativePath, content] of outputs) {
    if (checkOnly) {
      let existing;
      try { existing = await readFile(resolve(root, relativePath), "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (existing !== content) mismatches.push(relativePath);
    } else {
      await writeAtomic(relativePath, content);
    }
  }
  if (mismatches.length) {
    console.error("Generated files are missing or out of date:");
    mismatches.forEach((file) => console.error(`- ${file}`));
    console.error("Run npm run catalog:build, review the changes, and commit the generated files.");
    process.exitCode = 1;
    return;
  }
  const areaCount = new Set(records.flatMap((record) => record.areas)).size;
  const labelCount = records.reduce((total, record) => total + record.originalLabels.length, 0);
  console.log(`${checkOnly ? "Verified" : "Generated"} ${outputs.size} files: ${records.length} profiles, ${labelCount} source lines, ${areaCount} research areas. No network access used.`);
}

main().catch((error) => {
  console.error(`Catalog generation failed: ${error.message}`);
  process.exitCode = 1;
});
