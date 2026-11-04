import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The manifest in docs/source-baseline.json is only useful if something enforces it.
 * It records the original Stage 0 value of every restored file (`baselineSha256`) and the
 * current reviewed value (`sha256`). This test makes an unreviewed edit to the Canvas engine,
 * the store or the assistant fail loudly instead of drifting silently.
 *
 * Files that legitimately changed after Stage 0 keep their baseline hash and set
 * `changedSinceBaseline: true`. Regenerate with `npm run baseline:update` and review the diff.
 */

interface BaselineEntry {
  path: string;
  /** Stage 0 value; null for modules that were added after the baseline was recorded. */
  baselineSha256: string | null;
  sha256: string;
  changedSinceBaseline: boolean;
}

interface BaselineManifest {
  schemaVersion: number;
  hashAlgorithm: string;
  files: BaselineEntry[];
}

const root = process.cwd();
const manifestPath = join(root, "docs/source-baseline.json");

/** Hashes text the same way on every checkout: UTF-8 after CRLF-to-LF normalization. */
function hashSource(relativePath: string): string {
  return createHash("sha256").update(readFileSync(join(root, relativePath), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function readManifest(): BaselineManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as BaselineManifest;
}

test("source baseline manifest matches the reviewed sources", () => {
  const manifest = readManifest();
  expect(manifest.schemaVersion).toBe(2);
  expect(manifest.files.length).toBeGreaterThan(0);

  const problems: string[] = [];
  for (const entry of manifest.files) {
    let current: string;
    try {
      current = hashSource(entry.path);
    } catch {
      problems.push(`${entry.path}: listed in the manifest but missing from the repository.`);
      continue;
    }
    if (current !== entry.sha256) {
      problems.push(`${entry.path}: changed since the manifest was reviewed. Run "npm run baseline:update" and review the diff.`);
    }
    if (entry.baselineSha256 !== null && entry.changedSinceBaseline === (current === entry.baselineSha256)) {
      problems.push(`${entry.path}: changedSinceBaseline=${entry.changedSinceBaseline}, but that does not match the recorded hash.`);
    }
  }
  expect(problems).toEqual([]);
});

test("every Canvas engine module is registered in the source baseline", () => {
  const manifest = readManifest();
  const registered = new Set(manifest.files.map((entry) => entry.path));
  const engineModules = readdirSync(join(root, "src/engine"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `src/engine/${name}`)
    .sort();
  expect(engineModules.length).toBeGreaterThan(0);
  // A new engine module must be a reviewed addition, not an invisible one.
  expect(engineModules.filter((module) => !registered.has(module))).toEqual([]);
});
