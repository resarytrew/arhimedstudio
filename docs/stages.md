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

- Stages 2–5: BLOCKED BY PREVIOUS GATES. No universal adapter, new runtime, or project migration has been introduced.

The architecture specification describes the target, not completed features. Record evidence and unresolved conditions here before advancing.
