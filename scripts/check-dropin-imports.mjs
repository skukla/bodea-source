/*
 * CI guard: every `@dropins/*` import specifier in this repo must resolve in
 * the import map of the boilerplate generation that Demo Builder actually
 * ships (the b2b last-known-good ref of adobe-commerce/boilerplate-b2b-template).
 *
 * This closes the gap the LKG gate cannot see: a block in this library could
 * import a dropin that the pinned template generation does not vendor, and
 * nothing else would catch it before a storefront blank-pages.
 *
 * Plain Node (>=18, global fetch), no dependencies.
 * Usage: node scripts/check-dropin-imports.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const LKG_URL = 'https://raw.githubusercontent.com/skukla/eds-demo-patches/main/b2b/last-known-good';
const headHtmlUrl = (ref) => `https://raw.githubusercontent.com/adobe-commerce/boilerplate-b2b-template/${ref}/head.html`;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/** Extracts the import-map `imports` keys from a head.html document. */
function parseImportMap(headHtml) {
  const match = headHtml.match(/<script[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No <script type="importmap"> found in head.html');
  const { imports } = JSON.parse(match[1]);
  if (!imports || typeof imports !== 'object') {
    throw new Error('Import map has no "imports" object');
  }
  return Object.keys(imports);
}

/** True when `specifier` resolves against the import-map keys. */
function resolves(specifier, mapKeys) {
  return mapKeys.some((key) => (
    key.endsWith('/') ? specifier.startsWith(key) : specifier === key
  ));
}

/** Collects `@dropins/*` specifiers from static and dynamic imports in JS source. */
function collectDropinSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /from\s+['"](@dropins\/[^'"]+)['"]/g, // import ... from '@dropins/...'
    /import\s*\(\s*['"](@dropins\/[^'"]+)['"]/g, // import('@dropins/...')
    /^\s*import\s+['"](@dropins\/[^'"]+)['"]/gm, // bare import '@dropins/...'
  ];
  patterns.forEach((pattern) => {
    [...source.matchAll(pattern)].forEach((match) => specifiers.add(match[1]));
  });
  return specifiers;
}

/** Recursively lists .js files under a directory; returns [] if it is missing. */
async function listJsFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

async function main() {
  const lkgSha = (await fetchText(LKG_URL)).trim();
  if (!/^[0-9a-f]{40}$/.test(lkgSha)) {
    throw new Error(`LKG file did not contain a commit SHA: "${lkgSha}"`);
  }

  const mapKeys = parseImportMap(await fetchText(headHtmlUrl(lkgSha)));
  console.info(`Import map @ b2b LKG ${lkgSha.slice(0, 8)}: ${mapKeys.length} entries`);

  const blockFiles = await listJsFiles('blocks');
  const brandFiles = (await listJsFiles('scripts'))
    .filter((file) => /scripts\/bodea-[^/]+\.js$/.test(file));
  const files = [...blockFiles, ...brandFiles];

  const failures = [];
  let checked = 0;
  await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    collectDropinSpecifiers(source).forEach((specifier) => {
      checked += 1;
      if (!resolves(specifier, mapKeys)) {
        failures.push(`${file}: ${specifier}`);
      }
    });
  }));

  console.info(`Checked ${checked} @dropins specifiers across ${files.length} files`);
  if (checked === 0) {
    throw new Error('Found zero @dropins specifiers — the scan is misaimed, refusing to pass');
  }

  if (failures.length > 0) {
    console.error('\n@dropins specifiers ABSENT from the LKG import map:');
    failures.sort().forEach((failure) => console.error(`  ${failure}`));
    process.exit(1);
  }

  console.info('All @dropins specifiers resolve in the LKG import map');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
