# ArhimedStudio

Browser-only educational animation studio. Node.js 22+ is needed to build, not to view the static output. Python is not required.

```sh
npm ci
npm run dev
npm run build
npm test          # Chrome and Edge, including pixel baselines (local workstation)
npm run test:ci   # the cloud-CI subset: Chrome, no pixel or production checks
```

**Test matrix.** `npm test` uses the installed Chrome and Edge and compares visual baselines, so it is
meant for a workstation like the one described in `docs/stages.md`. GitHub Actions runs
`npm run test:ci`, which executes the suite in Chrome and excludes only two tagged groups: `@visual`
(pixel baselines recorded on the maintainer's Windows machine) and `@published` (a smoke test of the
deployed GitHub Pages build). New spec files are covered automatically; nothing has to be registered.
`npm run test:update` deliberately regenerates visual baselines — inspect the diff before accepting it.

Publishing is gated: the `deploy-pages` job needs both the static build and the browser suite, so a red
suite cannot ship. Deploy `dist/` to any static host, including a GitHub Pages project path; routing uses hashes.

The source baseline and its SHA-256 manifest live in `docs/source-baseline.json`. The original source
directory remains untouched, and `tests/source-baseline.spec.ts` fails when a restored file changes without
updating the manifest, or when a new Canvas engine module is added without registering it. After a reviewed
change run `npm run baseline:update` and check `git diff docs/source-baseline.json`.
See `docs/architecture.md` for the approved specification and `docs/stages.md` for actual acceptance status.
Do not skip stage gates.

ManimGX includes pinned scientific Python libraries for physics, electronics,
engineering diagrams, biology, chemistry and mathematics. Select the ManimGX
engine, then choose a lesson from **Готовые темы**. See
[the library catalog and examples](docs/scientific-libraries.md).

ManimGX rendering and MP4 export have explicit task states, cancellation,
deadlines, Python diagnostics and a persistent last-successful-video download.
See [the browser rendering lifecycle](docs/browser-render-lifecycle.md).

**MP4 export is not released.** The Studio side and the runtime overlay in
`integration/manimgx-runtime-mp4/` are implemented and CI-compiled against the public runtime, but the
overlay has not been deployed to `arhimed-runtime.github.io`. On the public runtime the MP4 control stays
disabled and the preview only plays the scene; see the access limitation in that directory's README.
