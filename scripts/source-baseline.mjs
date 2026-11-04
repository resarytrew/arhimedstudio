import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Refreshes docs/source-baseline.json after a reviewed change.
 * `baselineSha256` is the original Stage 0 value and is preserved; `sha256` is recomputed
 * from the working tree. New Canvas engine modules are registered with a null baseline.
 * Run `git diff docs/source-baseline.json` to see exactly which files moved.
 */
const path = 'docs/source-baseline.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));

/** The manifest and tests hash UTF-8 text after CRLF-to-LF normalization. */
async function hashSource(relative) {
  const text = await readFile(relative, 'utf8');
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

for (const entry of manifest.files) {
  const current = await hashSource(entry.path);
  entry.sha256 = current;
  entry.changedSinceBaseline = entry.baselineSha256 !== null && current !== entry.baselineSha256;
}

const registered = new Set(manifest.files.map(entry => entry.path));
const engineModules = (await readdir('src/engine')).filter(name => name.endsWith('.ts')).map(name => `src/engine/${name}`).sort();
for (const module of engineModules) {
  if (registered.has(module)) continue;
  manifest.files.push({ path: module, baselineSha256: null, sha256: await hashSource(module), changedSinceBaseline: true });
}
manifest.files.sort((a, b) => a.path.localeCompare(b.path));

await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
const changed = manifest.files.filter(entry => entry.changedSinceBaseline).length;
console.log(`Recorded ${manifest.files.length} source files (${changed} changed since the Stage 0 baseline).`);
