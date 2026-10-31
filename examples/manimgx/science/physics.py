import manimgx as m
import sympy as sp
from sympy.physics.units import convert_to, kilometer, meter
from scipy.constants import g


class PhysicsLesson(m.Scene):
    def construct(self):
        t = sp.symbols("t")
        height = 20 - sp.Rational(1, 2) * g * t**2
        velocity = sp.diff(height, t)
        assert convert_to(kilometer, meter) == 1000 * meter
        title = m.Text("Свободное падение", font_size=36).shift(2.7 * m.UP)
        axes = m.Axes(x_range=[0, 2, 0.5], y_range=[0, 20, 5], x_length=8, y_length=3.6, tips=False)
        curve = axes.plot(lambda value: float(height.subs(t, value)), x_range=[0, 2], color=m.TEAL)
        formula = m.MathTex("h(t)=" + sp.latex(height), font_size=28).shift(2.4 * m.DOWN)
        result = m.Text("v(1 c) = " + str(round(float(velocity.subs(t, 1)), 2)) + " м/с", font_size=28).move_to(formula)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.Create(axes), run_time=1.0)
        self.play(m.Create(curve), run_time=2.0)
        self.play(m.Write(formula), run_time=1.0)
        self.wait(1.0)
        self.play(m.Transform(formula, result), run_time=1.0)
        self.wait(1.0)
