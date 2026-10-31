# Scientific Python in ManimGX

Select **ManimGX 0.1.1 · isolated** in the scene engine selector. The **Готовые темы**
menu and initial chat suggestions include six working lessons. The offline
assistant returns the complete example; connected language models receive the
same package catalog and drawing-adapter instructions. Generated code remains
a candidate revision until the author applies it.

| Discipline | Pinned library | Available operations |
| --- | --- | --- |
| Physics | SymPy 1.14.0, SciPy 1.18.0 | Symbolic differentiation, units, mechanics, constants, integration, signals |
| Electronics | Schemdraw 0.23, SciPy 1.18.0 | Circuit symbols and layout; numerical transfer-function responses |
| Engineering diagrams | Schemdraw 0.23 | Flowcharts and logic diagrams |
| Biology | Biopython 1.87 | DNA/RNA transcription, translation and sequence statistics |
| Chemistry | PeriodicTable 2.1.0 | Elements, isotopes, formula composition and molar masses |
| Mathematics | SymPy 1.14.0, SciPy 1.18.0, Matplotlib 3.10.8 | Exact algebra, numerical calculations, plots and shaded areas |

The corresponding packages run in the dedicated runtime at
https://arhimed-runtime.github.io/. Versions and transitive dependencies are
vendored with SHA-256 hashes. Only imported scientific packages load on demand.
No pip access, remote data service, new CSP exception or parent-origin access is
introduced. Canvas retains its own restricted dialect and cannot import these
Python packages.

## Embed plots and diagrams

```python
import manimgx as m
import matplotlib.pyplot as plt
from arhimed_science import figure_to_mobject

class PlotLesson(m.Scene):
    def construct(self):
        fig, ax = plt.subplots(figsize=(6, 3), dpi=120)
        ax.plot([0, 1, 2], [0, 1, 4])
        ax.set(xlabel="x", ylabel="x²")
        fig.tight_layout()
        image = figure_to_mobject(fig, width=9, max_height=4.5)
        self.play(m.FadeIn(image), run_time=2)
        self.wait(1)
        self.play(m.Indicate(image), run_time=1)
        self.play(m.FadeOut(image), run_time=2)
        self.wait(2)
```

For Schemdraw, create `schemdraw.Drawing(show=False)`, add components and call
`drawing_to_mobject(drawing, width=9, max_height=4.5)`. Both adapters use the
non-interactive Agg backend and in-memory images, preserving labels outside
axes. Figures close after capture. The result is a snapshot; animate native
ManimGX objects when geometry must change continuously. Do not call GUI
`show()`, `save()`, `savefig()` or external simulators from a scene.

Schemdraw is a diagram library, not a SPICE solver. PeriodicTable does not infer
bond geometry; the molecule in the chemistry example is schematic. Biopython's
network/database integrations and external command-line programs are outside
this fixed browser runtime. These lessons illustrate scientific concepts;
they are not engineering validation tools.

Complete sources: `examples/manimgx/science/*.py`. The runtime also keeps copies
in `examples/science` for its independent browser acceptance tests. Keep copies
in sync when changing examples. The Studio test checks imports, candidate
validation, offline selection, menu availability and rejection of unavailable
packages. Runtime acceptance executes all six sources with their numerical
assertions in real Python/WebGPU and records screenshots.

Package documentation: [SymPy](https://docs.sympy.org/latest/index.html),
[SciPy](https://docs.scipy.org/doc/scipy/),
[Schemdraw](https://schemdraw.readthedocs.io/en/stable/usage/start.html),
[Biopython](https://biopython.org/docs/latest/),
[PeriodicTable](https://periodictable.readthedocs.io/en/latest/api/formulas.html),
[Matplotlib](https://matplotlib.org/stable/).
