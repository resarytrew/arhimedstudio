"""A polished 3D teaching model of a differential capacitive MEMS accelerometer.

Compatible with the locked ManimGX 0.1.1 browser runtime in Arhimed Studio.
It needs only manimgx and numpy, both already provided by the isolated runtime.

Physics: x is the proof-mass displacement towards the right-hand fixed plate.
The gaps are d_L=d+x and d_R=d-x. The displayed parallel-plate equations
are an idealized model; fringing, damping, fabrication details and scale are
deliberately omitted.
"""

import manimgx as m
import numpy as np


# Visual dimensions are model units rather than micrometres.
MASS_HALF_WIDTH = 0.95
PLATE_INNER_X = 1.84
ANCHOR_INNER_X = 3.07
SPRING_Y = 0.84
SPRING_Z = 0.33
TRAVEL = 0.30

BG = "#091322"
SUBSTRATE = "#26384D"
MASS = "#45C5E8"
MASS_EDGE = "#A7EBFF"
LEFT_ELECTRODE = "#F5BD48"
RIGHT_ELECTRODE = "#6AD8E8"
SPRING = "#B9CBDD"


def prism(width: float, height: float, depth: float, color: str, center: list[float]):
    """Construct a shaded rectangular solid using supported ManimGX 0.1.1 API."""
    block = m.Cube(side_length=1, fill_color=color, fill_opacity=1)
    block.stretch_to_fit_width(width)
    block.stretch_to_fit_height(height)
    # There is no stretch_to_fit_depth in ManimGX 0.1.1.
    block.rescale_to_fit(depth, 2, stretch=True)
    block.move_to(center)
    return block


def compliant_beam(x0: float, x1: float, y: float) -> np.ndarray:
    """Rounded, tapered serpentine spring with endpoints on physical attachments."""
    progress = np.linspace(0.0, 1.0, 81)
    xs = x0 + (x1 - x0) * progress
    # Four lateral waves approximate a compliant suspension beam.
    envelope = np.sin(np.pi * progress) ** 0.75
    lateral = 0.105 * np.sin(8 * np.pi * progress) * envelope
    return np.column_stack([xs, y + lateral, np.full_like(xs, SPRING_Z)])


class MemsAccelerometer3D(m.ThreeDScene):
    def construct(self) -> None:
        self.camera.background_color = BG
        self.camera.tone_mapping = "agx"
        self.camera.ambient_occlusion = 0.32
        self.set_camera_orientation(
            phi=63 * m.DEGREES,
            theta=-53 * m.DEGREES,
            zoom=1.16,
        )
        self.add(
            m.SunLight(5 * m.UP + 4 * m.OUT),
            m.AmbientLight(intensity=0.37),
        )

        # A lower, wide substrate provides a clear physical frame of reference.
        substrate = prism(8.30, 4.55, 0.16, SUBSTRATE, [0, 0, -0.52])
        left_trace = prism(7.00, 0.075, 0.055, "#415872", [0, -1.72, -0.405])
        right_trace = prism(7.00, 0.075, 0.055, "#415872", [0, 1.72, -0.405])

        # The two electrodes stay fixed. Their face-to-mass gap is d+/-x.
        plate_l = prism(0.22, 1.18, 0.57, LEFT_ELECTRODE, [-1.95, 0, 0.35])
        plate_r = prism(0.22, 1.18, 0.57, RIGHT_ELECTRODE, [1.95, 0, 0.35])

        # Four anchoring pads at the spring ends. Springs pass above and
        # below the electrode zone instead of intersecting the gold plates.
        pads = m.VGroup(*[
            prism(0.43, 0.35, 0.67, "#7289A2", [side * 3.28, height, -0.035])
            for side in (-1, 1)
            for height in (-SPRING_Y, SPRING_Y)
        ])

        displacement = m.ValueTracker(0.0)
        mass = prism(1.90, 1.77, 0.55, MASS, [0, 0, 0.35])
        mass.add_updater(
            lambda block: block.move_to([displacement.get_value(), 0, 0.35])
        )

        def spring_line(side: int, y: float):
            # Connection goes from the fixed pad to the proof-mass side face.
            x_fixed = side * ANCHOR_INNER_X
            x_mass = displacement.get_value() + side * MASS_HALF_WIDTH
            line = m.VMobject(
                stroke_color=SPRING,
                stroke_width=3.7,
                shade_in_3d=True,
            )
            line.set_points_as_corners(compliant_beam(x_fixed, x_mass, y))
            return line

        springs = [
            m.always_redraw(lambda side=side, y=y: spring_line(side, y))
            for side in (-1, 1)
            for y in (-SPRING_Y, SPRING_Y)
        ]

        # Moving gap indicators make the differential principle visible.
        # Each line terminates exactly on the inner electrode/mass faces.
        def gap_indicator(side: int):
            x = displacement.get_value()
            if side < 0:
                start, end = -PLATE_INNER_X, x - MASS_HALF_WIDTH
                color = LEFT_ELECTRODE
            else:
                start, end = x + MASS_HALF_WIDTH, PLATE_INNER_X
                color = RIGHT_ELECTRODE
            return m.Line(
                [start, 0, 0.74],
                [end, 0, 0.74],
                color=color,
                stroke_width=4,
                shade_in_3d=True,
            )

        gap_lines = [
            m.always_redraw(lambda side=side: gap_indicator(side))
            for side in (-1, 1)
        ]

        # Fixed-in-frame labels never drift when the camera orbits.
        eyebrow = m.Text(
            "МИКРОЭЛЕКТРОМЕХАНИКА  /  3D",
            font_size=18,
            color="#8EABC5",
        ).to_corner(m.UL, buff=0.50)
        title = m.Text(
            "Ёмкостный акселерометр",
            font_size=32,
            color="#F1F6FC",
        ).next_to(eyebrow, m.DOWN, aligned_edge=m.LEFT, buff=0.17)
        eq_l = m.MathTex(
            r"C_L=\frac{\varepsilon A}{d+x}",
            font_size=32,
            color=LEFT_ELECTRODE,
        ).to_corner(m.UR, buff=0.53)
        eq_r = m.MathTex(
            r"C_R=\frac{\varepsilon A}{d-x}",
            font_size=32,
            color=RIGHT_ELECTRODE,
        ).next_to(eq_l, m.DOWN, aligned_edge=m.RIGHT, buff=0.14)
        caption = m.Text(
            "Инерция смещает массу и изменяет два зазора.",
            font_size=22,
            color="#E2EBF5",
        ).to_corner(m.DL, buff=0.64)
        disclaimer = m.Text(
            "Схема. Масштаб условный.",
            font_size=17,
            color="#8EABC5",
        ).to_corner(m.DR, buff=0.65)
        self.add_fixed_in_frame_mobjects(
            eyebrow, title, eq_l, eq_r, caption, disclaimer
        )

        # Establish the sensor, then show opposite changes of capacitance.
        self.play(m.FadeIn(substrate), run_time=0.9)
        self.play(
            m.FadeIn(left_trace),
            m.FadeIn(right_trace),
            m.FadeIn(pads),
            run_time=0.8,
        )
        self.play(
            m.FadeIn(plate_l),
            m.FadeIn(plate_r),
            run_time=0.8,
        )
        self.add(mass, *springs, *gap_lines)
        self.play(m.FadeIn(mass), run_time=0.7)
        self.wait(0.4)

        # Right acceleration response: right gap shrinks, left gap grows.
        self.play(
            displacement.animate.set_value(TRAVEL),
            run_time=1.9,
            rate_func=m.smooth,
        )
        self.wait(0.6)
        self.play(
            displacement.animate.set_value(-TRAVEL),
            run_time=2.5,
            rate_func=m.smooth,
        )
        self.wait(0.6)
        self.play(
            displacement.animate.set_value(0.0),
            run_time=1.5,
            rate_func=m.smooth,
        )

        # Small final orbit demonstrates that all components are truly 3D.
        self.move_camera(
            phi=55 * m.DEGREES,
            theta=-35 * m.DEGREES,
            zoom=1.21,
            run_time=2.2,
        )
        self.wait(1.0)
