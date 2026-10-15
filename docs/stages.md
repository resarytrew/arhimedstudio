# Implementation stages

## Stage 0 — ACCEPTED (2026-10-14)

The existing Canvas/TypeScript studio has been restored as a browser-only Vite application. No Python service is required for the editor, preview, timeline, or static build.

Acceptance evidence:

- `npm run build` completes successfully.
- `npm test` completes 10 Playwright checks on local, dedicated Vite server `127.0.0.1:4181`: Chrome 155.0.8059.40 and Edge 155.0.4283.45.
- The regression suite records three deterministic reference frames for the welcome scene, seven shipped templates, and a generic scene in each browser. It also checks finite geometry and measures interpreter timings for every scene.
- Compatibility coverage proves that a project from `arhimed.projects.v1` opens unchanged, survives editing and reload, reports a source-line parser error, preserves the Canvas timeline, and keeps code/preview panels usable.
- The suite verifies PNG, WebM, and Python downloads while every non-local network request is blocked; it verifies the shipped offline assistant and project creation as well.
- `npm run licenses` records 166 dependency licenses and license notices under `public/licenses/`; there are no unknown licenses in the generated report.

The Canvas parser now reports unclosed `()`, `[]`, and `{}` with a source line instead of accepting an incomplete expression. This is a backward-compatible error-reporting fix covered by the suite.

The source baseline hashes remain in `docs/source-baseline.json`; the original source directory is not modified.

## Stage 1 — ACCEPTED (2026-10-15)

Dedicated experiment repository: `resarytrew/arhimed-runtime-lab`; dedicated runtime repository: `arhimed-runtime/arhimed-runtime.github.io`.

First configuration result (commit `bbb150e3fd566b7a47fcb65c0af40752f09de445`): **negative in Chrome 155.0.8059.40 and Edge 155.0.4283.45 on Windows 11 / RTX 3070**. A real `manimgx@0.1.1` custom element was executed in an opaque-origin `sandbox="allow-scripts"` iframe. Classic Blob Workers start, but Blob module Workers do not. ManimGX 0.1.1 requires the latter and reports `ManimGX could not start`; no adapter or automatic sandbox weakening has been introduced.

The opaque-origin result remains negative. Configuration 2 is accepted on the separately administered runtime origin `https://arhimed-runtime.github.io/`: real ManimGX 0.1.1/Pyodide/WebGPU, Blob module Worker, dynamic `ValueTracker`/`always_redraw`, stop/restart, MessageChannel validation and synthetic-parent isolation were verified in Chrome and Edge. The runtime assets are locked and hash-verified. The detailed public evidence and limitations are in [the Stage 1 report](https://github.com/arhimed-runtime/arhimed-runtime.github.io/blob/main/docs/stage-1-https-origin-report.md). Canvas remains the default browser publication path; GX uses the accepted cross-origin runtime or a prepared video fallback.

## Stage 2 — ACCEPTED (2026-10-15)

Implemented slice:

- `EngineAdapterV1` contracts, explicit capabilities/events and Studio-owned adapter registry;
- existing Canvas wrapped as `arhimed-canvas` / `arhimed-manimx-v1`, preserving its native timeline and exports;
- opt-in `manimgx-browser` adapter using the accepted runtime URL, sandboxed cross-origin iframe and authenticated `MessageChannel`; it never transfers project storage, API keys or arbitrary URLs;
- new `arhimed.projects.v2` storage with original scene source, engine metadata, immutable source revisions and candidate AI revisions; `arhimed.projects.v1` is preserved and imported without rewriting source;
- `AIOrchestratorV1`, offline/OpenRouter/OpenAI-compatible provider selection, one request per project, `AbortController` cancellation, normalized provider errors and in-memory API keys;
- AI code is now a candidate revision. It is applied only after an explicit author action and fails closed if the base revision changed;
- 15 Canvas educational starter scenes with Chrome/Edge visual baselines.

Acceptance evidence:

- `npm run build` passes. The original Canvas regression checks, source migration, AI candidate-review flow and adapter contract pass in Chrome 155.0.8059.40 and Edge 155.0.4283.45.
- The published Studio has an end-to-end test from `https://resarytrew.github.io/arhimedstudio/` to `https://arhimed-runtime.github.io/`. It explicitly creates a separate ManimGX scene, writes `import manimgx as m` source by hand, and observes a rendered result in the isolated `allow-scripts allow-same-origin` iframe in Chrome and Edge. The test also asserts the sandbox attributes. No Canvas source is converted or overwritten.
- The Canvas interpreter and its reference-frame suite remain browser-only. Its parser and renderer are unchanged by the adapter wrapper; the normal Chrome/Edge regression suite checks all 15 shipped starter scenes and legacy `arhimed.projects.v1` migration. Canvas therefore retains its existing preview, native timeline, PNG and WebM export path.
- Stage 1 records the independent runtime timing baseline on the same Windows 11 / RTX 3070 station: warm simple-scene p95 was 113 ms in Chrome and 64 ms in Edge, below the one-second target. Studio's cross-origin opt-in test adds no runtime package or Python initialization step beyond that fixed runtime. Cold initialization remains separate (10,967 ms Chrome; 8,560 ms Edge) and is shown to the author as runtime setup rather than treated as an interactive-frame metric.

Stage 3 may begin only as a separate publication increment. It must not make the local Python extensions mandatory or change the accepted Canvas/GX contracts.

The architecture specification describes the target, not completed features. Record evidence and unresolved conditions here before advancing.
