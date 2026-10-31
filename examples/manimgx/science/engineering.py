import manimgx as m
import schemdraw
from schemdraw import flow
from arhimed_science import drawing_to_mobject


class EngineeringLesson(m.Scene):
    def construct(self):
        drawing = schemdraw.Drawing(show=False)
        drawing.add(flow.Start().label("Start"))
        drawing.add(flow.Arrow().right())
        drawing.add(flow.Box().label("Sensor"))
        drawing.add(flow.Arrow().right())
        drawing.add(flow.Box().label("Control"))
        drawing.add(flow.Arrow().right())
        drawing.add(flow.Box().label("Actuator"))
        diagram = drawing_to_mobject(drawing, width=10, max_height=3.7)
        title = m.Text("Система автоматического управления", font_size=32).shift(2.7 * m.UP)
        caption = m.Text("Датчик → регулятор → исполнитель", font_size=28).shift(2.4 * m.DOWN)
        conclusion = m.Text("Каждый блок выполняет свою функцию", font_size=27).move_to(caption)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.FadeIn(diagram), run_time=2.0)
        self.wait(1.0)
        self.play(m.Write(caption), run_time=1.0)
        self.wait(1.0)
        self.play(m.Transform(caption, conclusion), run_time=1.0)
        self.wait(1.0)
