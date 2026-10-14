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

## Stage 1 — IN PROGRESS

Dedicated experiment repository: `resarytrew/arhimed-runtime-lab`. The Studio codebase will not receive a ManimGX adapter until the public, isolated real-runtime experiment reaches its stated acceptance criteria.

First configuration result (commit `bbb150e3fd566b7a47fcb65c0af40752f09de445`): **negative in Chrome 155.0.8059.40 and Edge 155.0.4283.45 on Windows 11 / RTX 3070**. A real `manimgx@0.1.1` custom element was executed in an opaque-origin `sandbox="allow-scripts"` iframe. Classic Blob Workers start, but Blob module Workers do not. ManimGX 0.1.1 requires the latter and reports `ManimGX could not start`; no adapter or automatic sandbox weakening has been introduced.

The same verified configuration blocks synthetic parent DOM, localStorage and IndexedDB controls, external and localhost egress (including a Worker probe), and forged/malformed messages. The public lab is `https://resarytrew.github.io/arhimed-runtime-lab/`; its report, fixed runtime hashes and GitHub Pages workflow are in `resarytrew/arhimed-runtime-lab`. Different paths on `resarytrew.github.io` are one origin, so configuration 2 needs a separately administered HTTPS origin before it can be tested; provision of that origin is an open infrastructure prerequisite. Until then, Canvas and prepared video fallbacks remain the only browser publication paths.

- Stages 2–5: BLOCKED BY PREVIOUS GATES. No universal adapter, new runtime, or project migration has been introduced.

The architecture specification describes the target, not completed features. Record evidence and unresolved conditions here before advancing.
