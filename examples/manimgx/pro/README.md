# Professional ManimGX motion examples

These three source files are copied from the **ManimGX 0.1.1** official examples
by Academa Labs and retained with an attribution header under the upstream MIT
license: https://github.com/academa-labs/manimgx/tree/v0.1.1/examples

- `quadratic_formula.py`: geometrical completion of the square, algebraic term choreography
- `circle_area.py`: ring unrolling into a triangle, continuous geometric transformations
- `linear_maps.py`: animated grids, basis vectors and determinants

They use the native ManimGX 0.1.1 API, not Manim Community or Arhimed Canvas.
They are intended as study/reference material for authors who want to learn
effective motion choreography, and are selectable in the ManimGX lesson menu.

The original examples are authored for the default widescreen composition.
To make a vertical 9:16 video, set `config.pixel_width` and
`config.pixel_height` and **recompose** the objects for the narrower frame.
Changing only the pixel dimensions does not provide a good portrait layout.

The Studio build checks Python syntax; mocked-runtime tests exercise menu
selection and candidate validation. Full WebGPU/MP4 playback requires a
separate real-browser hardware acceptance test. The examples are not claimed
to have been rendered by the CI's mocked runtime.
