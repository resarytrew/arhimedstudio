# ManimGX Runtime: MP4 export implementation

This directory contains **deployable TypeScript source replacements** for the
separate-origin runtime at `arhimed-runtime/arhimed-runtime.github.io`.
Arhimed Studio continues to communicate only through the authenticated
MessageChannel. No project storage, API keys or parent DOM are exposed.

## Included files

| File | Copy to runtime |
| --- | --- |
| `src/cross-origin-protocol.ts` | `src/cross-origin-protocol.ts` |
| `src/cross-origin-runtime.ts` | `src/cross-origin-runtime.ts` |
| `src/mp4-export.ts` | `src/mp4-export.ts` (new) |

These are full replacement source files based on runtime `main` as inspected
on 31 October 2026, not excerpts. Review upstream changes before applying
them to a newer runtime revision.

## Install

In a local checkout of `arhimed-runtime/arhimed-runtime.github.io`:

```bash
# Copy these three files from the Studio repository into ./src in runtime.
# The copy command below assumes Studio and runtime are sibling folders.
cp ../arhimedstudio/integration/manimgx-runtime-mp4/src/*.ts ./src/

# Only a pinned local npm dependency is needed; no external network calls at runtime.
npm ci
npm install --save-exact mediabunny@1.64.0
npm run build
```

Commit all updated runtime source files, `package.json` and `package-lock.json`.
Publish using the runtime repository's existing GitHub Pages workflow. **Do
not** change the separate origin, the CSP, the parent-origin allowlist or the
fixed Python-package/import policies.

The Studio side of the protocol is updated in the same branch as this overlay.
After deploying the runtime, open a ManimGX scene in Studio. The MP4 button
becomes available only after the active scene reports successful rendering,
and only when the browser supports WebCodecs H.264. The runtime returns an
ISO-BMFF MP4 ArrayBuffer. The parent checks the `ftyp` signature and limits
the transferred file to 512 MiB.

## How export works

1. Authenticate with the existing MessageChannel and advertise
   `capabilities.mp4Export` after checking available H.264 encoder profiles.
2. Execute the scene normally and save its successful `renderedRevision`.
3. Handle `export-mp4` only at the exact current rendered revision.
4. Pause the GPU player; for each frame `t = frameIndex/fps`, seek to `t`,
   allow the GPU player two browser presentation callbacks, and copy its
   internal canvas to an opaque 2D capture canvas.
5. Mediabunny uses WebCodecs AVC/H.264 to encode the frame and writes a
   real ISO-BMFF MP4 to a memory-backed `BufferTarget`.
6. Return intermediate `export-progress` events and a transferable
   `ArrayBuffer` on success.
7. When another source revision arrives, abort the old export before
   removing the old WebGPU player. Restore the saved preview time/state
   on success or failure.

## Limits and acceptance

- Video track only; audio export has **not** been implemented.
- Native preview pixel resolution is used (capped at 1920 x 1080). It does
  not pretend that an upscaled 720p frame is true 4K.
- FPS: 24, 25, 30, 50 or 60. Studio currently requests 30.
- Maximum scene duration in this memory-based version: 180 seconds.
- Maximum transfer: 512 MiB. In-memory muxing may require substantial
  browser memory for long videos.
- The browser must support WebGPU for ManimGX playback and WebCodecs
  H.264 for export.
- Since the native player has no public synchronous offline-render API,
  frame capture waits for the browser's painting loop. **Video timestamps
  are exact**, but pixel capture speed is still bounded by display
  callbacks; this is not yet a fast headless renderer.
- The native ManimGX player controls render through the player itself.
  Real GPU testing must confirm whether any controls appear in exported
  frames and whether frame seeking redraws consistently.

### Automated checks

GitHub Actions on this Studio branch clones the public runtime into a
temporary workspace, applies the three source files, installs pinned
Mediabunny and compiles the runtime with TypeScript and Vite. Another
Playwright test covers the authenticated download protocol using a fake
runtime and a non-playable `ftyp` buffer. A separate **real WebCodecs**
Chrome test creates a 640x360 H.264 MP4 from a controlled canvas and
checks that Chrome can decode its video metadata. This encoding test
passed in GitHub Actions run 41212878006 (31 October 2026).

**Successful WebCodecs encoding does not prove actual ManimGX WebGPU canvas capture.**
Accept the feature only after a real Chrome/Edge WebGPU test produces a
playable MP4 with correct timing, no blank frames, and correct output
pixels, checked with FFprobe or equivalent.

### Access limitation

The connected GitHub integration currently receives a 403 response when
creating a branch in `arhimed-runtime/arhimed-runtime.github.io`. Therefore
these sources are committed to the writable Studio repository and CI-compiled
against the real public runtime, but **they are not yet deployed to the
separate runtime origin**. The Studio button stays disabled on the old
runtime until the patch is applied and published with appropriate access.

Mediabunny is licensed MPL-2.0. Preserve its applicable license and notice
requirements when distributing the built runtime.

For a Windows PowerShell checkout of the runtime and Studio in sibling directories:

```powershell
Copy-Item ..\arhimedstudio\integration\manimgx-runtime-mp4\src\*.ts .\src\
npm ci
npm install --save-exact mediabunny@1.64.0
npm run build
```
