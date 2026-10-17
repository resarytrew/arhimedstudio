# ManimGX MP4 export protocol

The ManimGX preview is intentionally a cross-origin, sandboxed iframe. Studio cannot
read its canvas or safely record it from the parent page. MP4 export is consequently
performed in the runtime and the completed file is returned through the authenticated
`MessageChannel`.

## Capability handshake

The runtime's existing `ready` response must advertise the feature explicitly:

```ts
port.postMessage({
  protocol: "arhimed-runtime-v1",
  sessionId,
  revision: 0,
  requestId: "connect",
  kind: "ready",
  capabilities: { mp4Export: true },
});
```

Studio leaves the MP4 control disabled for older runtimes that omit this flag. This is
intentional: changing a WebM filename to `.mp4` does not make it an MP4 video.

## Commands and responses

After the scene has rendered, Studio sends this command on the already-authenticated
port. `revision` is the current rendered revision and `requestId` is unique per job.

```ts
{ kind: "export-mp4", protocol, sessionId, revision, requestId, fps: 30 }
```

The runtime must accept `export-mp4` only when the session, revision and request ID
are valid. It must never treat it as a new source-load command. It may report progress:

```ts
{ kind: "export-progress", protocol, sessionId, revision, requestId, progress: 0.5 }
```

On success it returns a transferable `ArrayBuffer` containing an ISO-BMFF MP4 file:

```ts
port.postMessage(
  { kind: "exported", protocol, sessionId, revision, requestId, data: mp4.buffer },
  [mp4.buffer],
);
```

Failures use the existing `failed` or `rejected` message kinds with the same identity
fields and a safe diagnostic in `detail`.

## Runtime implementation requirements

Encode the runtime-owned canvas with a confirmed H.264 `VideoEncoder` configuration,
mux encoded chunks into ISO-BMFF, and render exact frame times from zero through the
scene duration at the requested FPS. Release every `VideoFrame`, flush the encoder,
and check cancellation between frames. Do not fetch codecs or accept arbitrary URLs.
The Studio adapter caps a returned artifact at 512 MiB, verifies the `ftyp` signature,
and times out after five minutes.
