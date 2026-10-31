# Browser rendering lifecycle

The implementation follows the reliability principles reviewed in
[ManimCat's executor](https://github.com/Wing900/ManimCat/blob/main/src/utils/manim-executor.ts),
its process registry and execution-state helpers: explicit terminal states,
deadlines, cancellation, diagnostics and validation of the actual artifact.
The implementation here is independently written for Studio's browser runtime.

## Tasks

ManimGX preview and MP4 export have `queued`, `running`, `completed`, `failed`
and `cancelled` states. Each task records project, scene, source revision,
request identifier, timestamps, progress, bounded stdout/stderr and its error.
A task has exactly one terminal transition; late messages cannot complete a
cancelled or superseded task. Preview keystrokes coalesce for 350 ms. A changed
source cancels an unfinished construction and destroys its Python context;
successfully completed previews reuse their existing authenticated session.

Preview has a five-minute deadline, including initialization. Export and output
validation/persistence have a twenty-minute deadline. These are wall-clock
limits owned by Studio, outside the isolated Python Worker. A timeout destroys
the iframe and its Worker; retry creates a fresh runtime. This also handles a
Python loop that cannot receive a cooperative stop message.

Ordinary export cancellation sends `cancel-export` for the exact request and
revision. The encoder checks its AbortSignal, cancels muxing and restores the
saved preview time/playback state. If the runtime does not acknowledge within
1.5 seconds, Studio disposes the entire session. Retry is available from the
task panel. A stale export result is ignored.

The browser exposes no portable process-tree RSS measurement or hard per-scene
RAM quota. `peakMemoryMB` is explicitly `null`. No subprocess launcher, local
Python service, claimed native memory cap or new parent-origin access is added.
The existing 180-second scene and 512 MiB MP4 transfer bounds still apply.

## Actual completion and diagnostics

The locked director emits completion only when Python `Scene.render` returns.
Its per-film events are routed to the exact custom element by checked build-time
hooks in the locked ManimGX 0.1.1 wrapper. The runtime waits for both that signal
and a usable GPU canvas with a finite duration before reporting
`rendered`. Merely receiving an initial partial film is insufficient.

Python exceptions, including a failure after an early animation, deliver an
explicit failure and traceback. Pyodide stdout/stderr are forwarded on the
authenticated channel. The director bounds log messages and text; Studio keeps
at most 64,000 characters per stream. Failed construction closes its runtime.
Engine boot/GPU failures and missing responses also terminate through the error
or deadline path. The task panel displays terminal errors without a loading
spinner and permits manual retry.

## Last successful video

An export response is only a candidate artifact. It must contain a nonempty,
bounded ISO-BMFF MP4 and decode to a positive finite duration and video dimensions.
Missing data, empty output, a fake `ftyp` header, an audio-only output, decoder
failure and verification timeout are failures even when runtime reports success.

Only after validation is the Blob committed transactionally to IndexedDB, keyed
by project and scene with its source revision and filename. The task completes
after this transaction. Errors, cancellation and failed storage transactions
preserve the previous artifact. Project changes cannot save another scene's
result under the active scene's identity. The last successful video can be
downloaded after editing errors, cancellation or reloading Studio.

Browser storage availability and quota errors are reported explicitly. Storage
can be cleared by browser/user policy; this is local persistence, not a backup
service. The video remains on the Studio origin and is never sent to the model
provider or runtime.

## Verification

`npm run test:rendering` covers state transitions, bounded logs, timeout teardown,
missing/empty/corrupt artifacts, cancellation, late results, persistent last-good
downloads and session reuse in installed Chrome and Edge. Its MP4 fixture is a
small real H.264 video; a header-only buffer is deliberately rejected.

The runtime's `npm run test:lifecycle` uses two preview servers on ports 4184 and
4185 and a real WebGPU browser. It checks full Python completion, stdout,
exception-after-first-frame failure, controlled MemoryError, cooperative export
cancellation and successful restart after destroying an infinite-loop Worker.
`npm run test:mp4` checks actual H.264 capture, decoding and moving output pixels.
Set `ARHIMED_LIFECYCLE_RUNTIME_URL` to verify the deployed runtime and
`ARHIMED_LIFECYCLE_BROWSER=msedge` to exercise Edge.
