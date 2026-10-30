"""ManimGX 0.1.1: 3D demonstration of a capacitive MEMS accelerometer.

Runs inside the isolated Arhimed Studio ManimGX browser runtime.
No external assets, custom Python modules, network access or local server.
The model is schematic: displacement and electrode geometry are not to scale.
"""

import manimgx as m
import numpy as np


def spring_points(x_start: float, x_end: float, y: float, z: float) -> np.ndarray:
    """A zigzag spring with endpoints that follow the moving proof mass."""
    segments = 18
    xs = np.linspace(x_start, x_end, segments + 1)
    points = []
    for index, x in enumerate(xs):
        offset = 0.0 if index in (0, segments) else (0.11 if index % 2 else -0.11)
        points.append([x, y + offset, z])
    return np.array(points)


class MemsAccelerometer3D(m.ThreeDScene):
    def construct(self) -> None:
        self.set_camera_orientation(
            phi=66 * m.DEGREES,
            theta=-54 * m.DEGREES,
            zoom=0.92,
        )
        self.camera.tone_mapping = "agx"
        self.camera.ambient_occlusion = 0.3
        self.add(
            m.SunLight(5 * m.UP + 4 * m.OUT),
            m.AmbientLight(intensity=0.35),
        )

        # The chip is a shallow 3D substrate; the moving mass is suspended above it.
        substrate = m.Cube(side_length=1)
        substrate.stretch_to_fit_width(7.2)
        substrate.stretch_to_fit_height(4.0)
        substrate.rescale_to_fit(0.17, 2, stretch=True)
        substrate.set_color("#1e293b")
        substrate.set_fill(opacity=0.85)
        substrate.move_to([0, 0, -0.55])

        frame = m.Cube(side_length=1, fill_color="#64748b", fill_opacity=0.95)
        frame.stretch_to_fit_width(6.6)
        frame.stretch_to_fit_height(0.32)
        frame.rescale_to_fit(0.28, 2, stretch=True)
        frame.move_to([0, -1.58, -0.05])

        def electrode(x: float, color: str) -> m.Cube:
            plate = m.Cube(side_length=1, fill_color=color, fill_opacity=0.93)
            plate.stretch_to_fit_width(0.20)
            plate.stretch_to_fit_height(1.70)
            plate.rescale_to_fit(0.48, 2, stretch=True)
            plate.move_to([x, 0, 0.25])
            return plate

        electrode_left = electrode(-2.10, "#fbbf24")
        electrode_right = electrode(2.10, "#fbbf24")

        displacement = m.ValueTracker(0.0)
        mass = m.Cube(side_length=1, fill_color="#38bdf8", fill_opacity=0.98)
        mass.stretch_to_fit_width(1.50)
        mass.stretch_to_fit_height(1.70)
        mass.rescale_to_fit(0.65, 2, stretch=True)
        mass.add_updater(lambda mob: mob.move_to([displacement.get_value(), 0, 0.25]))

        def spring(left: bool, y: float) -> m.VMobject:
            x_fixed = -3.25 if left else 3.25
            x_moving = displacement.get_value() + (-0.75 if left else 0.75)
            line = m.VMobject(stroke_color="#e2e8f0", stroke_width=3, shade_in_3d=True)
            line.set_points_as_corners(spring_points(x_fixed, x_moving, y, 0.35))
            return line

        springs = [
            m.always_redraw(lambda side=side, level=level: spring(side, level))
            for side in (True, False)
            for level in (-0.58, 0.58)
        ]

        title = m.Text("MEMS: capacitive accelerometer", font_size=34).to_corner(m.UL)
        formula = m.MathTex(r"C=\frac{\varepsilon A}{d}", font_size=46).to_corner(m.UR)
        note = m.Text("Displacement changes the electrode gaps", font_size=24)
        note.to_edge(m.DOWN, buff=0.30)
        self.add_fixed_in_frame_mobjects(title, formula, note)

        self.play(m.FadeIn(substrate), m.FadeIn(frame), run_time=0.9)
        self.play(m.FadeIn(electrode_left), m.FadeIn(electrode_right), run_time=0.7)
        self.add(mass, *springs)
        self.play(m.FadeIn(mass), run_time=0.6)
        self.play(displacement.animate.set_value(0.35), run_time=1.5)
        self.play(displacement.animate.set_value(-0.35), run_time=1.5)
        self.play(displacement.animate.set_value(0.0), run_time=1.5)
        self.move_camera(phi=55 * m.DEGREES, theta=-30 * m.DEGREES, run_time=1.5)
        self.wait(0.8)
