import manimgx as m
import schemdraw
import schemdraw.elements as elm
from scipy.signal import TransferFunction, step
from arhimed_science import drawing_to_mobject


class ElectronicsLesson(m.Scene):
    def construct(self):
        drawing = schemdraw.Drawing(show=False)
        drawing.add(elm.SourceV().up().label("U = 5 V"))
        drawing.add(elm.Resistor().right().label("R = 1 kOhm"))
        drawing.add(elm.Capacitor().down().label("C = 1 uF"))
        drawing.add(elm.Line().left())
        circuit = drawing_to_mobject(drawing, width=7, max_height=3.8)
        times, values = step(TransferFunction([1], [0.001, 1]))
        assert values[-1] > 0.99
        title = m.Text("RC-цепь: заряд конденсатора", font_size=34).shift(2.7 * m.UP)
        formula = m.MathTex(r"U_C(t)=U_0(1-e^{-t/RC})", font_size=30).shift(2.45 * m.DOWN)
        conclusion = m.Text("Постоянная времени RC = 1 мс", font_size=28).move_to(formula)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.FadeIn(circuit), run_time=2.0)
        self.wait(1.0)
        self.play(m.Write(formula), run_time=1.0)
        self.wait(1.0)
        self.play(m.Transform(formula, conclusion), run_time=1.0)
        self.wait(1.0)
