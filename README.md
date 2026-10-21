# Peptide Research Atlas

A personal research reference with **96 compound and product profiles**, grouping **145 source-list lines** from six supplied screenshots into **12 research areas**. The research snapshot is **October 20, 2026**.

**GitHub Pages address:** [Peptide Research Atlas](https://kkringlen.github.io/peptide-research-atlas/) — available after the one-time Pages setup below.

**Private dashboard with cloud saving:** [Open the existing atlas](https://peptide-research-atlas.ayeyepioneer.chatgpt.site)

This public repository stores the complete application source, researched catalog, a GitHub Pages edition, and a directly usable offline edition. The GitHub Pages edition uses browser-local storage; the existing private dashboard retains its separate cloud database and access controls.

## Enable the public GitHub website

The ready-to-publish website is in `docs/index.html`. No package installation, custom build workflow, or external service is needed for this edition.

1. Open [Settings → Pages](https://github.com/kkringlen/peptide-research-atlas/settings/pages).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Select branch **main**, folder **/docs**, and click **Save**.
4. Wait for GitHub's Pages deployment to finish. The website address is **https://kkringlen.github.io/peptide-research-atlas/**.

Publishing updates to `docs/` on `main` updates the public website. The `.nojekyll` file tells GitHub to serve the generated files directly. Repository visibility alone does not activate Pages; the repository owner must enable the publishing source once.

Visitors can search, compare, add profiles, and edit amounts. **Personal changes stay in that browser** and do not update the public website, commit to GitHub, or synchronize across devices. Use **Export data backup** and **Import / merge data** to transfer changes, and keep a backup before clearing browser data. Each visitor starts with the published catalog.

## Use the atlas

- Search by compound name, abbreviation, or research area.
- Open a profile for grouped label amounts, mechanisms, evidence, approval context, cautions, and original sources.
- Compare two to four entries side by side.
- Add compounds or edit amounts and research notes. Personal changes are labeled.
- Use **Export data backup** and **Import / merge data** to move edits between copies.

Categories describe research interests and reported uses, rather than guaranteed benefits. Amounts are transcribed product details, not administration instructions. An approved medicine or studied ingredient does not authenticate a product in the screenshots. Ambiguous names, formulas, and units remain flagged.

## Open the offline edition

1. Download [Peptide_Research_Atlas_Offline.html](offline/Peptide_Research_Atlas_Offline.html) using GitHub's file-download control, or download and extract the repository ZIP.
2. Open the downloaded HTML file in a browser. It contains the complete catalog and interface; no server, package installation, or internet connection is needed to read, compare, and edit entries.
3. Follow source links when connected to the internet.

Offline edits are stored in that browser. Use the atlas's **Offline copy** action to download a new HTML snapshot containing current edits, and export JSON to transfer those edits to the online atlas or another browser. Offline files do not automatically synchronize with the hosted database or this repository.

The [initial JSON backup](offline/Peptide_Research_Atlas_Backup.json) can be restored or merged through **Import / merge data**. Import previews new and matching entries before applying changes.

## Source map

| Path | Role |
| --- | --- |
| `ui-template.html` | Canonical HTML, CSS, and browser JavaScript source |
| `data/catalog.json` | Canonical researched profiles, grouped amounts, and citations |
| `scripts/generate-catalog.mjs` | Deterministic generator and consistency checker |
| `app/catalog-html.ts` | Generated HTML module served by the online route |
| `docs/` | Generated public GitHub Pages edition with browser-local saves |
| `offline/` | Generated standalone HTML and importable JSON backup |
| `app/api/catalog/route.ts` | Authenticated catalog loading and revision-controlled saving |
| `app/chatgpt-auth.ts` | Sites-provided ChatGPT identity helpers |
| `lib/catalog-validation.ts` | Online payload validation |
| `db/`, `drizzle/` | D1 schema and database migrations |
| `.openai/hosting.json` | Nonsecret identity and bindings for the original Sites deployment |
| `build/`, `scripts/` | Retained framework and Sites runtime support |

The original screenshots, browser storage, hosted user database, authentication credentials, and access tokens are not included. Provenance is retained as the transcribed original labels and screenshot numbers in each profile. Existing third-party notices are preserved in `build/` and `vendor/`.

## Edit and regenerate

Use **Node.js 22.13.0 or later**, matching `package.json`. The catalog generator uses only Node built-in modules, so it works before installing application dependencies.

1. Edit `data/catalog.json` for research content, source links, aliases, categories, or listed amounts.
2. Edit `ui-template.html` for interface behavior or presentation. Keep its single `__CATALOG_JSON__` placeholder.
3. Regenerate the checked-in deliverables:

   ```sh
   npm run catalog:build
   ```

4. Verify that generated files match the canonical source without writing anything:

   ```sh
   npm run catalog:check
   ```

Equivalent commands without npm are:

```sh
node scripts/generate-catalog.mjs
node scripts/generate-catalog.mjs --check
```

Generation validates IDs, data types, evidence categories, source URLs, and limits compatible with the interface and API. It safely embeds JSON, checks application JavaScript syntax, and writes these five deterministic outputs:

- `app/catalog-html.ts`
- `offline/Peptide_Research_Atlas_Offline.html`
- `offline/Peptide_Research_Atlas_Backup.json`
- `docs/index.html`
- `docs/.nojekyll`

`--check` reports missing or stale outputs and exits unsuccessfully if any differ; it does not create or change files. Commit canonical source and regenerated outputs together. Do not edit the generated files directly.

Browser edits and imported backups do not write to `data/catalog.json`. To promote reviewed personal edits into the repository, export a backup, review its `records` array, update the canonical JSON, and regenerate. Preserve per-profile review dates and evidence limits; update the visible snapshot wording in the template when publishing a newly reviewed research snapshot.

## Run the full application locally

The complete online application uses Vinext, Vite, and Cloudflare Workers. Install the locked dependencies and build with:

```sh
npm run install:ci
npm run build
```

The build script first regenerates the catalog. A clean clone defaults to the portable execution profile. `npm run dev` starts the framework development server; `npm start` previews a completed Worker build locally. These commands do not deploy the application.

The portable development helper can simulate ChatGPT identity on loopback development requests. This mock is for local development only and does not supply production authentication. Database-backed previewing also requires local D1 migrations; the migration source is included under `drizzle/`.

To apply the initial migration to a newly created local preview database after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_perfect_venus.sql
```

Apply migrations in order and do not replay ones already applied. Runtime state, dependencies, build outputs, environment files, and TypeScript caches are ignored by Git.

## Online hosting, identity, and persistence

The existing private live atlas remains hosted through **Sites**. Its complete online behavior depends on:

- A Cloudflare Worker runtime and the `DB` D1 binding.
- A private Sites access policy.
- Sites-injected, trusted `oai-authenticated-user-*` headers and platform-managed ChatGPT sign-in routes.
- A per-user database record with revision checks to preserve concurrent edits.

The retained `.openai/hosting.json` documents the original deployment identity, `appgprj_6ad83f02d43081919ff4e34b6aaf7eab`. It is configuration, not a credential. Changing a Git remote or pushing this repository does **not** automatically update the existing Site. Publishing requires the supported Sites workflow and appropriate account access.

**GitHub Pages serves the static edition and does not run this application's Worker/D1 API or provide the same private Sites sign-in.** The generator explicitly disables cloud API calls in `docs/index.html` and the standalone offline edition. Their edits remain local to the browser. Repository visibility and Pages settings do not change the private dashboard's access controls or publish its stored user data.

A migration to a different full-stack host would require deliberate replacements for the database binding and trusted authentication layer. Do not treat caller-supplied identity headers as authenticated users on an unrelated host.

## Research provenance

Each profile retains its source links, evidence classification, original list wording, and review date. Named blends and unclear abbreviations remain distinguishable from identified compounds. The 145 source lines are grouped into 96 profiles rather than repeated as one profile per amount. Research and approval status can change; consult the original linked material when revisiting a claim.
