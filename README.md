# ArhimedStudio

Browser-only educational animation studio. Node.js 22+ is needed to build, not to view the static output. Python is not required.

```sh
npm ci
npm run dev
npm run build
npm test
```

Tests use installed Chrome and Edge. `npm run test:update` deliberately regenerates visual baselines; inspect diffs before accepting.
Deploy `dist/` to any static host, including a GitHub Pages project path. Routing uses hashes.

The source baseline and its SHA-256 manifest are recorded in `docs/source-baseline.json`; the original source directory remains untouched. Subsequent changes are reviewable in Git and covered by the baseline tests.
See `docs/architecture.md` for the approved specification and `docs/stages.md` for actual acceptance status. Do not skip stage gates.

ManimGX includes pinned scientific Python libraries for physics, electronics,
engineering diagrams, biology, chemistry and mathematics. Select the ManimGX
engine, then choose a lesson from **Готовые темы**. See
[the library catalog and examples](docs/scientific-libraries.md).

ManimGX rendering and MP4 export have explicit task states, cancellation,
deadlines, Python diagnostics and a persistent last-successful-video download.
See [the browser rendering lifecycle](docs/browser-render-lifecycle.md).
