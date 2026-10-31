"""ManimGX 0.1.1 browser GPU smoke test: 3D surface, light and moving camera."""

import manimgx as m
import numpy as np


class BrowserThreeDCapabilities(m.ThreeDScene):
    def construct(self) -> None:
        self.set_camera_orientation(phi=67 * m.DEGREES, theta=-49 * m.DEGREES)
        self.camera.tone_mapping = "agx"
        self.camera.ambient_occlusion = 0.25

        axes = m.ThreeDAxes(
            x_range=[-2, 2, 1], y_range=[-2, 2, 1], z_range=[-1, 2, 1],
            x_length=5.6, y_length=5.6, z_length=3.6,
        )
        hill = m.Surface(
            lambda u, v: axes.c2p(u, v, 1.5 * np.exp(-(u * u + v * v))),
            u_range=[-2, 2], v_range=[-2, 2], resolution=(24, 24),
        ).set_fill_by_checkerboard(m.BLUE_D, m.TEAL, opacity=0.9)
        sphere = m.Sphere(radius=0.40, resolution=(12, 12))
        sphere.set_color(m.YELLOW)
        sphere.move_to(axes.c2p(0, 0, 1.9))

        equation = m.MathTex(r"z=1.5e^{-(x^2+y^2)}", font_size=38)
        equation.to_corner(m.UL)
        self.add_fixed_in_frame_mobjects(equation)
        self.add(m.SunLight(4 * m.UP + 3 * m.OUT), m.AmbientLight(intensity=0.3))
        self.play(m.Create(axes), m.FadeIn(hill), run_time=1.1)
        self.play(m.FadeIn(sphere), m.Write(equation), run_time=0.8)
        self.move_camera(phi=55 * m.DEGREES, theta=-25 * m.DEGREES, run_time=1.4)
        self.wait(0.4)
