import manimgx as m
import periodictable as pt


class ChemistryLesson(m.Scene):
    def construct(self):
        water = pt.formula("H2O")
        assert 18 < water.mass < 18.1
        title = m.Text("Молярная масса воды", font_size=36).shift(2.7 * m.UP)
        oxygen = m.Circle(radius=0.6, color=m.RED, fill_opacity=0.7)
        left_h = m.Circle(radius=0.36, color=m.BLUE, fill_opacity=0.7).shift(1.4 * m.LEFT + 0.8 * m.DOWN)
        right_h = m.Circle(radius=0.36, color=m.BLUE, fill_opacity=0.7).shift(1.4 * m.RIGHT + 0.8 * m.DOWN)
        bonds = m.VGroup(m.Line(oxygen.get_center(), left_h.get_center()), m.Line(oxygen.get_center(), right_h.get_center()))
        formula = m.MathTex(r"M(H_2O)=2M(H)+M(O)", font_size=30).shift(2 * m.DOWN)
        result = m.Text("M(H₂O) = " + str(round(water.mass, 3)) + " г/моль", font_size=30).shift(2.65 * m.DOWN)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.Create(bonds), m.FadeIn(oxygen), run_time=1.0)
        self.play(m.FadeIn(left_h), m.FadeIn(right_h), run_time=1.0)
        self.wait(1.0)
        self.play(m.Write(formula), run_time=1.0)
        self.wait(1.0)
        self.play(m.Write(result), run_time=1.0)
        self.wait(1.0)
