# ManimGX 0.1.1: 3D Python examples

These are **Python scenes for the existing ManimGX browser adapter**. They are
independent of Arhimed's Canvas interpreter and contain no AI or editing UI.

## Included examples

- `webgpu-3d-smoke.py`: a lit parametric 3D surface, a sphere, fixed MathTex
  and animated perspective camera. Suitable for a quick hardware check.
- `mems-capacitive-accelerometer.py`: an illustrative 3D capacitive
  accelerometer with substrate, proof mass, fixed electrodes, springs driven
  by `ValueTracker`, lighting, formula and moving camera. This is a
  *schematic teaching animation*, not a verified mechanical simulation.

## Run in Arhimed Studio

1. Open Arhimed Studio and choose **ManimGX** as the scene engine.
2. Paste the complete contents of one `.py` example into the code editor.
3. Wait for the isolated Python/WebGPU runtime to complete the scene.
4. Try another example without switching the engine. The updated preview
   should reuse the authenticated iframe and Python environment.

The example uses only imports allowed by the fixed runtime (`manimgx` and
`numpy`). It does not fetch assets or require package installation.

## Verification

The default CI task tests the ManimGX iframe protocol using a mock runtime,
without requiring a GPU:

```bash
npx playwright test tests/manimgx-session.spec.ts --project=chrome
```

For a **real** WebGPU/ManimGX 0.1.1 acceptance run on a supported computer:

```powershell
$env:ARHIMED_MANIMGX_3D = "1"
npx playwright test tests/manimgx-3d.spec.ts --project=chrome
```

The real-GPU test loads the published Studio under
`https://resarytrew.github.io`, which is on the isolated runtime's
explicit parent-origin allowlist. Local Studio previews at an arbitrary
port are not authorized to send commands to the published runtime.

The 3D test is opt-in because headless CI environments cannot guarantee
WebGPU adapter availability and real GPU performance. A passing mock test
**does not certify** geometry, shaders, lighting or actual video encoding.
Likewise, successfully playing a scene does not establish native MP4 export:
that feature requires changes in the separately administered runtime repo.

## Runtime repository permission

The separate repository
`arhimed-runtime/arhimed-runtime.github.io` currently rejects GitHub
write operations from this connected account. No changes to that repository
have been deployed. Future changes to the cross-origin runtime must preserve
the sandbox, independent HTTPS origin, authenticated MessageChannel, strict
CSP, locked Python packages and import allowlist.
