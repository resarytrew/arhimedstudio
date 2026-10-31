import manimgx as m
import numpy as np
import sympy as sp
import matplotlib.pyplot as plt
from scipy.integrate import quad
from arhimed_science import figure_to_mobject


class MathematicsLesson(m.Scene):
    def construct(self):
        x = sp.symbols("x")
        exact = sp.integrate(sp.sin(x), (x, 0, sp.pi))
        value, error = quad(np.sin, 0, np.pi)
        assert abs(value - float(exact)) < 1e-9
        figure, axes = plt.subplots(figsize=(7, 3), dpi=120)
        samples = np.linspace(0, np.pi, 150)
        axes.plot(samples, np.sin(samples), color="#138c8e")
        axes.fill_between(samples, np.sin(samples), alpha=0.25, color="#138c8e")
        axes.set(xlabel="x", ylabel="sin(x)", title="Area under sin(x)")
        figure.tight_layout()
        graph = figure_to_mobject(figure, width=9, max_height=4)
        title = m.Text("Интеграл как площадь", font_size=36).shift(2.7 * m.UP)
        formula = m.MathTex(r"\int_0^{\pi}\sin(x)\,dx=" + sp.latex(exact), font_size=32).shift(2.45 * m.DOWN)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.FadeIn(graph), run_time=1.5)
        self.play(m.Indicate(graph), run_time=0.5)
        self.wait(1.0)
        self.play(m.Write(formula), run_time=2.0)
        self.wait(2.0)
