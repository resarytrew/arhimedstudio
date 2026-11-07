# Arhimed Flow — protocol for the 5× authoring-code claim

**Registered:** 2026-11-02. **Version:** 0.1. **Status:** prerequisite methodology, NOT an observed 5× result. Any change to this protocol requires a dated version and a new evaluation run.

## Claim and target

Test: **≥5× fewer author-written Python tokens** than an independently written, idiomatic **Manim Community Edition** implementation of the same prescribed mathematical video, on five genuinely unseen hold-out scenes, while maintaining acceptance of the same pedagogy and visual storyboard. Native ManimGX 0.1.1 is an additional comparator, not a substitute for ManimCE.

This is NOT an unrestricted claim about every mathematics lesson. A task solved through a bespoke video script hidden in a Flow library is **benchmark contamination**.

## Corpus integrity

The accompanying manifest, flow-benchmark-corpus.json, records hashes for **eight preexisting scene files**: three historical development pilots and five retrospective audit cases. All eight were inspected in an earlier AST audit. **None of those eight is a valid blind hold-out.**

Five separate independent assignments, H01–H05, are reserved but **not yet sealed**. Before starting the Flow API, independent authors/custodians must supply and freeze:
- Competent ManimCE Python source and exact package/dependency versions.
- Rendered reference video, shot-by-shot storyboard, semantic events, intended mathematics, visual assets, aspect ratio, resolution, FPS and duration.
- Source/video/storyboard SHA-256, authorship, license and seal date.
- Clear pass/fail criteria, without seeing the Flow implementation.

A public list of candidate topics is not enough to call a set “hold-out”. Custodians should withhold independent implementation details until **after a tagged API/compiler freeze**. Any compiler changes following the reveal must be scored as a new exploratory run, not an authentic blind success.

Do not publicly upload user-owned source or recordings without permission. Historical hashes alone may be published.

## Equivalent content and rendering

1. The target storyboard/video is locked **before** a Flow solution. Both authors must represent the **same mathematical steps, object relationships, highlights, pauses and camera focus**. Flow cannot win by dropping content.
2. All registered mathematical invariants and semantic events must pass (100%). Event timing tolerance: ±0.10 seconds; total duration tolerance ±max(0.5 seconds, 2%).
3. Sample frames at shot/event boundaries, their midpoints, and every 0.5 seconds.
4. Same renderer: normalized 640×360 image diff threshold **≤2%** of pixels with channel difference >16. Distinct renderers: pixel-perfect equality is invalid; compare matching semantic/layout anchors and propose **SSIM ≥0.92** plus independent human judgement. These are *provisional thresholds*, not a validated test; calibrate and freeze them before Flow evaluation, never after.
5. Record failures, mathematical mismatches and adverse legibility. Publish code, baselines, environment and negative results.

Existing Canvas Playwright screenshots do **not** establish a ManimCE-versus-Flow baseline. A separate comparison harness still has to be implemented.

## Count author-written tokens fairly

- Format both Python sources with exactly **Ruff 0.14.6**, line length 88. Use lexical tokenize after formatting, excluding comment, whitespace, indentation and newline tokens.
- Symmetrically exclude only **top-level imports, scene class declaration and construct method header**. Include every authored helper, scene-specific library extension, math formula, style, manual override and escape hatch.
- Publish raw tokens, author tokens, normalized SLOC, complete sources and formatter version. Because a string literal counts as one token, also publish total authored string-literal characters; do not hide a full animation in a literal or giant asset.
- Formula per accepted scene: **ratio = ManimCE author tokens / Flow author tokens**.
- Primary gate: **all five hold-out scenes must pass content/visual acceptance AND their median token ratio ≥5**. If any scene fails, the unqualified hold-out claim fails. Publish every per-scene outcome, coverage, worst regression and escape-hatch cost. Accepted-only statistics can be shown but cannot replace intention-to-treat results.
- Other metrics: rendered video duration/quality, authored SLOC, accumulated inserted+deleted token edits (requires opt-in editor logging), active author time, preview cycles, unsupported-feature rate, generated code after eject, and maintenance size of the reusable library.
- Generated/ejected code is auditable and independently editable; an impressive expansion ratio **alone is not reduced authoring effort**.

The AST classifier in scripts/flow_audit.py is a heuristic. It NEVER executes the source. Human-review all ambiguous lines and a fixed-seed random sample of at least 20% of remaining lines. Report inter-rater disagreements. “math SLOC / total SLOC” is not an immutable mathematical limit on possible compression.

## Reproduction

Install pinned formatter:

    python -m pip install -r benchmarks/requirements.txt

Audit syntax and line categories (stdlib only):

    python scripts/flow_audit.py examples/manimgx/pro/quadratic_formula.py --format json

Primary normalized-token metric (fails if Ruff absent or version mismatches):

    python scripts/flow_audit.py examples/manimgx/pro/quadratic_formula.py --formatted-tokens --format json

Tests:

    python -m unittest discover -s tests -p "test_flow_audit.py"

## Research sequence and stop rule

1. Preregister independent ManimCE source+video+storyboard hashes and implementation environments, finish cross-renderer comparison harness, and **only then** implement Flow API.
2. Generalizable auto-composition, lifecycle and themes; measure dev set without customizing helpers to individual scenes.
3. If dev ratio after composition is **<2×** and manual annotation shows a dense math corpus, narrow the claim rather than optimistically extending development. The “35% math” rule is only a heuristic.
4. Implement typed algebraic rewrite steps with subterm **provenance** (what moved, appeared, disappeared, or remained equivalent) and mechanical motion schemas.
5. Freeze API/compiler/config/tag, then reveal independent hold-out scenes. Count all author choices and overrides. Include losses and rejected tasks publicly.
6. Provide readable **eject** output in an ordinary supported renderer; preserve compatibility with current Arhimed Canvas and ManimGX. No automatic migration of existing project sources.

**No blind baseline, no hold-out score, no 5× claim exists at this stage.**
