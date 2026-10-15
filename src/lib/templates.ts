export const WELCOME_CODE = `import manimx as m


class Example(m.Scene):
    def construct(self):
        title = m.Tex("Добро пожаловать в ArhimedStudio!").shift(3*m.UP)
        circle = m.Circle(radius=1.5, color="rgb(255,0,0)")
        square = m.Square(side_length=4, color="rgb(0,255,0)")

        self.play(m.Create(circle), m.Write(title))
        self.wait(0.3)
        self.play(m.Transform(circle, square))
        self.wait(0.5)
`;

export interface Template {
  id: string;
  title: string;
  prompt: string;
  keywords: string[];
  reply: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "projectile",
    title: "Бросок под углом",
    prompt: "Запусти снаряд под углом и разложи его скорость",
    keywords: ["снаряд", "бросок", "брос", "projectile", "траектор", "парабол", "под углом", "баллист", "кинемат"],
    reply:
      "Построил сцену о движении тела, брошенного под углом к горизонту. Сначала появляются оси, затем шарик летит по параболе, а в верхней точке скорость раскладывается на горизонтальную составляющую vₓ (она постоянна) и вертикальную v_y (в вершине она равна нулю).",
    code: `import manimx as m
import numpy as np


class Projectile(m.Scene):
    def construct(self):
        title = m.Text("Бросок под углом к горизонту", font_size=34).to_edge(m.UP)
        axes = m.Axes(x_range=[0, 10, 1], y_range=[0, 4, 1], x_length=10, y_length=4.5).shift(0.6*m.DOWN)
        labels = axes.get_axis_labels("x", "y")

        v0 = 9.0
        angle = 50 * m.DEGREES
        g = 9.8
        vx = v0 * np.cos(angle)
        vy = v0 * np.sin(angle)
        t_end = 2 * vy / g

        path = axes.plot(lambda x: x * np.tan(angle) - g * x**2 / (2 * vx**2), x_range=[0, vx * t_end], color=m.YELLOW)
        ball = m.Dot(axes.c2p(0, 0), radius=0.13, color=m.ORANGE)

        self.play(m.Write(title))
        self.play(m.Create(axes), m.FadeIn(labels))

        start = axes.c2p(0, 0)
        v_arrow = m.Arrow(start, axes.c2p(1.4, 1.67), buff=0, color=m.RED)
        v_label = m.MathTex("\\\\vec{v}_0", color=m.RED).next_to(v_arrow.get_end(), m.UP, buff=0.1)
        self.play(m.FadeIn(ball, scale=0.5), m.GrowArrow(v_arrow), m.Write(v_label))
        self.wait(0.4)
        self.play(m.FadeOut(v_arrow), m.FadeOut(v_label))

        self.play(m.Create(path), m.MoveAlongPath(ball, path), run_time=3, rate_func=m.linear)
        self.wait(0.3)

        top_x = vx * vy / g
        top = axes.c2p(top_x, vy**2 / (2 * g))
        top_dot = m.Dot(top, color=m.WHITE)
        vx_arrow = m.Arrow(top, [top[0] + 1.8, top[1], 0], buff=0, color=m.BLUE)
        vx_label = m.MathTex("v_x = v_0 \\\\cos\\\\alpha", color=m.BLUE, font_size=36).next_to(vx_arrow, m.UP, buff=0.15)
        vy_label = m.MathTex("v_y = 0", color=m.GREEN, font_size=36).next_to(top_dot, m.LEFT, buff=0.4)

        self.play(m.FadeIn(top_dot, scale=0.3))
        self.play(m.GrowArrow(vx_arrow), m.Write(vx_label))
        self.play(m.Write(vy_label))
        self.wait(0.5)

        formula = m.MathTex("L = \\\\frac{v_0^2 \\\\sin 2\\\\alpha}{g}", font_size=40).to_corner(m.DR, buff=0.6)
        box = m.SurroundingRectangle(formula, color=m.YELLOW, buff=0.2)
        self.play(m.Write(formula), m.Create(box))
        self.play(m.Indicate(path))
        self.wait(1)
`,
  },
  {
    id: "dijkstra",
    title: "Алгоритм Дейкстры",
    prompt: "Найди кратчайший путь алгоритмом Дейкстры",
    keywords: ["дейкстр", "dijkstra", "граф", "кратчайш", "путь", "алгоритм"],
    reply:
      "Готово! Сцена показывает граф из шести вершин с весами рёбер. Алгоритм Дейкстры по шагам посещает вершины (они подсвечиваются синим), обновляет расстояния над узлами, а в конце рисует кратчайший путь A → F длиной 13.",
    code: `import manimx as m
import numpy as np


class Dijkstra(m.Scene):
    def construct(self):
        title = m.Text("Алгоритм Дейкстры", font_size=36).to_edge(m.UP)
        self.play(m.Write(title))

        pos = {"A": [-5, -0.3, 0], "B": [-2, 1.7, 0], "C": [-2, -2.3, 0], "D": [1.5, 1.7, 0], "E": [1.5, -2.3, 0], "F": [5, -0.3, 0]}
        edges = [["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5], ["C", "D", 8], ["C", "E", 9], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]]
        names = ["A", "B", "C", "D", "E", "F"]

        lines = {}
        edge_anims = []
        for a, b, w in edges:
            line = m.Line(pos[a], pos[b], buff=0.4, color=m.GREY, stroke_width=3)
            mid = (np.array(pos[a]) + np.array(pos[b])) / 2
            label = m.Text(str(w), font_size=26, color=m.LIGHT_GRAY).move_to(mid + 0.28*m.UP + 0.12*m.RIGHT)
            lines[a + b] = line
            edge_anims.append(m.Create(line))
            edge_anims.append(m.FadeIn(label))

        nodes = {}
        node_anims = []
        for name in names:
            c = m.Circle(radius=0.4, color=m.WHITE, fill_color="#1e293b", fill_opacity=1).move_to(pos[name]).set_z_index(1)
            t = m.Text(name, font_size=30).move_to(pos[name]).set_z_index(2)
            nodes[name] = c
            node_anims.append(m.GrowFromCenter(c))
            node_anims.append(m.FadeIn(t))

        self.play(m.LaggedStart(*node_anims, lag_ratio=0.08), run_time=1.5)
        self.play(m.LaggedStart(*edge_anims, lag_ratio=0.05), run_time=1.5)

        dist = {}
        for name in names:
            d = m.MathTex("\\\\infty", font_size=32, color=m.GREY).next_to(nodes[name], m.UP, buff=0.12)
            dist[name] = d
            self.add(d)
        self.wait(0.3)

        self.play(m.Transform(dist["A"], m.MathTex("0", font_size=32, color=m.YELLOW).move_to(dist["A"])))

        order = ["A", "C", "B", "D", "E", "F"]
        updates = {"A": [["B", "4"], ["C", "2"]], "C": [["B", "3"], ["D", "10"], ["E", "11"]], "B": [["D", "8"]], "D": [["E", "10"], ["F", "14"]], "E": [["F", "13"]], "F": []}
        for v in order:
            self.play(nodes[v].animate.set_fill(m.BLUE_E, 1).set_stroke(m.BLUE, 6), run_time=0.6)
            for u, val in updates[v]:
                new = m.MathTex(val, font_size=32, color=m.YELLOW).move_to(dist[u])
                self.play(m.Transform(dist[u], new), m.Indicate(nodes[u], scale_factor=1.15), run_time=0.6)

        path_anims = []
        for key in ["AC", "CB", "BD", "DE", "EF"]:
            src = key[0]
            dst = key[1]
            hl = m.Line(pos[src], pos[dst], buff=0.4, color=m.YELLOW, stroke_width=8).set_z_index(0.5)
            path_anims.append(m.Create(hl))
        self.play(m.Succession(*path_anims), run_time=2.5)

        result = m.MathTex("A \\\\to C \\\\to B \\\\to D \\\\to E \\\\to F = 13", color=m.YELLOW, font_size=40).to_edge(m.DOWN, buff=0.35)
        self.play(m.Write(result))
        self.wait(1.2)
`,
  },
  {
    id: "eigen",
    title: "Собственные векторы",
    prompt: "Покажи, чем особенны собственные векторы",
    keywords: ["собствен", "eigen", "матриц", "линейн", "преобразован", "вектор"],
    reply:
      "Сцена показывает линейное преобразование A = [[3, 1], [0, 2]]. Жёлтый и розовый векторы — собственные: после преобразования они остаются на своих прямых и лишь растягиваются в λ₁ = 3 и λ₂ = 2 раза. Зелёный вектор меняет направление — он не собственный.",
    code: `import manimx as m


class Eigenvectors(m.Scene):
    def construct(self):
        plane = m.NumberPlane(x_range=[-10, 10, 1], y_range=[-6, 6, 1])
        title = m.Text("Собственные векторы сохраняют направление", font_size=30).to_edge(m.UP, buff=0.3)
        bg = m.BackgroundRectangle(title, buff=0.15)
        formula = m.MathTex("A\\\\vec{v} = \\\\lambda \\\\vec{v}", font_size=44).to_corner(m.DL, buff=0.5)
        fbg = m.BackgroundRectangle(formula, buff=0.15)

        self.play(m.Create(plane), run_time=1.5)
        self.play(m.FadeIn(bg), m.Write(title))

        span1 = m.DashedLine([-8, 0, 0], [8, 0, 0], color=m.YELLOW, stroke_opacity=0.6)
        span2 = m.DashedLine([5, -5, 0], [-5, 5, 0], color=m.PINK, stroke_opacity=0.6)
        v1 = m.Vector([1, 0, 0], color=m.YELLOW)
        v2 = m.Vector([-1, 1, 0], color=m.PINK)
        w = m.Vector([1, 1, 0], color=m.GREEN)

        self.play(m.Create(span1), m.Create(span2))
        self.play(m.GrowArrow(v1), m.GrowArrow(v2), m.GrowArrow(w))
        self.play(m.FadeIn(fbg), m.Write(formula))
        self.wait(0.5)

        A = [[3, 1], [0, 2]]
        self.play(
            plane.animate.apply_matrix(A),
            v1.animate.apply_matrix(A),
            v2.animate.apply_matrix(A),
            w.animate.apply_matrix(A),
            run_time=3,
        )
        self.wait(0.3)

        l1 = m.MathTex("\\\\lambda_1 = 3", color=m.YELLOW, font_size=40).next_to(v1.get_end(), m.DOWN, buff=0.25)
        l2 = m.MathTex("\\\\lambda_2 = 2", color=m.PINK, font_size=40).next_to(v2.get_end(), m.LEFT, buff=0.2)
        l3 = m.Text("не собственный", color=m.GREEN, font_size=26).next_to(w.get_end(), m.RIGHT, buff=0.2)
        self.play(m.Write(l1), m.Write(l2), m.FadeIn(l3))
        self.play(m.Indicate(v1), m.Indicate(v2))
        self.wait(1.2)
`,
  },
  {
    id: "taylor",
    title: "Ряд Тейлора",
    prompt: "Приблизь синус многочленами Тейлора",
    keywords: ["тейлор", "taylor", "синус", "sin", "ряд", "приближ", "многочлен", "полином"],
    reply:
      "Готово: синусоида (синяя) и её многочлены Тейлора (жёлтые) степеней 1, 3, 5, 7 и 9. С каждым новым слагаемым приближение «прилипает» к синусу на всё большем интервале — это отлично видно в динамике.",
    code: `import manimx as m
import numpy as np


class Taylor(m.Scene):
    def construct(self):
        title = m.Text("Многочлены Тейлора для sin(x)", font_size=34).to_edge(m.UP, buff=0.3)
        axes = m.Axes(x_range=[-7, 7, 1], y_range=[-2.5, 2.5, 1], x_length=12, y_length=5).shift(0.3*m.DOWN)
        sine = axes.plot(lambda x: np.sin(x), color=m.BLUE, stroke_width=5)
        label = m.MathTex("\\\\sin x", color=m.BLUE, font_size=40).move_to(axes.c2p(-5.6, 1.6))

        self.play(m.Write(title), m.Create(axes))
        self.play(m.Create(sine), m.Write(label), run_time=1.6)

        polys = [
            lambda x: x,
            lambda x: x - x**3 / 6,
            lambda x: x - x**3 / 6 + x**5 / 120,
            lambda x: x - x**3 / 6 + x**5 / 120 - x**7 / 5040,
            lambda x: x - x**3 / 6 + x**5 / 120 - x**7 / 5040 + x**9 / 362880,
        ]
        texs = [
            "P_1(x) = x",
            "P_3(x) = x - \\\\frac{x^3}{3!}",
            "P_5(x) = x - \\\\frac{x^3}{3!} + \\\\frac{x^5}{5!}",
            "P_7(x) = \\\\ldots - \\\\frac{x^7}{7!}",
            "P_9(x) = \\\\ldots + \\\\frac{x^9}{9!}",
        ]

        approx = axes.plot(polys[0], color=m.YELLOW)
        formula = m.MathTex(texs[0], color=m.YELLOW, font_size=38).to_edge(m.DOWN, buff=0.3)
        self.play(m.Create(approx), m.Write(formula))
        self.wait(0.4)

        for i in range(1, 5):
            new_curve = axes.plot(polys[i], color=m.YELLOW)
            new_tex = m.MathTex(texs[i], color=m.YELLOW, font_size=38).to_edge(m.DOWN, buff=0.3)
            self.play(m.Transform(approx, new_curve), m.Transform(formula, new_tex), run_time=1.3)
            self.wait(0.4)

        self.play(m.Indicate(formula))
        self.wait(1)
`,
  },
  {
    id: "pythagoras",
    title: "Теорема Пифагора",
    prompt: "Докажи наглядно теорему Пифагора",
    keywords: ["пифагор", "pythag", "гипотенуз", "катет", "треугольник"],
    reply:
      "Построил наглядную иллюстрацию теоремы Пифагора: прямоугольный треугольник со сторонами 3, 4, 5 и квадраты на каждой стороне. В конце формула a² + b² = c² превращается в числовую проверку 9 + 16 = 25.",
    code: `import manimx as m


class Pythagoras(m.Scene):
    def construct(self):
        title = m.Text("Теорема Пифагора", font_size=36).to_edge(m.UP, buff=0.3)
        A = [-1, -1.2, 0]
        B = [1, -1.2, 0]
        C = [-1, 0.3, 0]

        tri = m.Polygon(A, B, C, color=m.WHITE, fill_color=m.GREY, fill_opacity=0.35)
        sq_a = m.Polygon(A, C, [-2.5, 0.3, 0], [-2.5, -1.2, 0], color=m.BLUE, fill_opacity=0.45)
        sq_b = m.Polygon(A, [-1, -3.2, 0], [1, -3.2, 0], B, color=m.GREEN, fill_opacity=0.45)
        sq_c = m.Polygon(C, B, [2.5, 0.8, 0], [0.5, 1.8, 0], color=m.ORANGE, fill_opacity=0.45)
        fig = m.VGroup(tri, sq_a, sq_b, sq_c).shift(2.2*m.LEFT + 0.8*m.UP)

        la = m.MathTex("a^2", font_size=40).move_to(sq_a)
        lb = m.MathTex("b^2", font_size=40).move_to(sq_b)
        lc = m.MathTex("c^2", font_size=40).move_to(sq_c)

        self.play(m.Write(title))
        self.play(m.Create(tri))
        self.play(m.LaggedStart(m.DrawBorderThenFill(sq_a), m.DrawBorderThenFill(sq_b), m.DrawBorderThenFill(sq_c), lag_ratio=0.4), run_time=2.4)
        self.play(m.Write(la), m.Write(lb), m.Write(lc))
        self.wait(0.4)

        formula = m.MathTex("a^2 + b^2 = c^2", font_size=60).shift(3.6*m.RIGHT + 0.6*m.UP)
        self.play(m.TransformFromCopy(la, formula))
        self.wait(0.4)
        check = m.MathTex("3^2 + 4^2 = 5^2", font_size=52, color=m.YELLOW).next_to(formula, m.DOWN, buff=0.6)
        nums = m.MathTex("9 + 16 = 25", font_size=52, color=m.YELLOW).move_to(check)
        self.play(m.Write(check))
        self.wait(0.4)
        self.play(m.Transform(check, nums))
        self.play(m.Circumscribe(formula))
        self.wait(1)
`,
  },
  {
    id: "unit-circle",
    title: "Синус на единичной окружности",
    prompt: "Как точка на окружности рисует синусоиду",
    keywords: ["окружност", "тригоном", "синусоид", "единичн", "радиан", "волн", "колебан"],
    reply:
      "Сцена связывает движение точки по единичной окружности с графиком синуса: пока точка делает полный оборот, справа синхронно рисуется синусоида. Высота точки в каждый момент равна значению sin θ.",
    code: `import manimx as m
import numpy as np


class UnitCircle(m.Scene):
    def construct(self):
        title = m.Text("Откуда берётся синусоида", font_size=34).to_edge(m.UP, buff=0.3)
        circle = m.Circle(radius=1.5, color=m.BLUE).shift(4.3*m.LEFT)
        center = m.Dot(circle.get_center(), color=m.WHITE, radius=0.05)
        axes = m.Axes(x_range=[0, 6.4, 1], y_range=[-1.2, 1.2, 1], x_length=7.1, y_length=3.6, tips=False).shift(2.6*m.RIGHT)
        wave = axes.plot(lambda x: np.sin(x), x_range=[0, 2 * m.PI], color=m.YELLOW, stroke_width=5)
        dot = m.Dot(circle.point_from_proportion(0), color=m.YELLOW, radius=0.11)

        self.play(m.Write(title))
        self.play(m.Create(circle), m.FadeIn(center), m.Create(axes))
        self.play(m.FadeIn(dot, scale=0.5))
        self.play(m.MoveAlongPath(dot, circle), m.Create(wave), run_time=5, rate_func=m.linear)
        self.wait(0.3)

        for k in [1, 2, 3]:
            ang = k * m.PI / 2
            p = circle.get_center() + 1.5 * np.array([np.cos(ang), np.sin(ang), 0])
            q = axes.c2p(ang, np.sin(ang))
            link = m.DashedLine(p, q, color=m.GREY, stroke_opacity=0.8)
            self.play(m.Create(link), run_time=0.5)

        formula = m.MathTex("y = \\\\sin\\\\theta", font_size=48, color=m.YELLOW).to_edge(m.DOWN, buff=0.6)
        self.play(m.Write(formula))
        self.play(m.Indicate(wave))
        self.wait(1)
`,
  },
  {
    id: "derivative",
    title: "Производная как наклон",
    prompt: "Объясни производную через касательную",
    keywords: ["производн", "касательн", "derivat", "наклон", "дифференц", "скорость изменения"],
    reply:
      "Показал производную как угловой коэффициент касательной к параболе y = x². Касательная скользит вдоль графика, а значение k = 2x пересчитывается на каждом шаге: слева наклон отрицательный, в вершине — ноль, справа — положительный.",
    code: `import manimx as m


class Derivative(m.Scene):
    def construct(self):
        title = m.Text("Производная — наклон касательной", font_size=34).to_edge(m.UP, buff=0.3)
        axes = m.Axes(x_range=[-3, 3, 1], y_range=[-1, 9, 1], x_length=7, y_length=5.6).shift(1.6*m.LEFT + 0.4*m.DOWN)
        graph = axes.plot(lambda x: x**2, color=m.BLUE, stroke_width=5)
        glabel = m.MathTex("y = x^2", color=m.BLUE, font_size=40).move_to(axes.c2p(2.3, 8))

        tangent = lambda a: axes.plot(lambda x: 2 * a * (x - a) + a**2, x_range=[a - 1.3, a + 1.3], color=m.YELLOW)

        self.play(m.Write(title), m.Create(axes))
        self.play(m.Create(graph), m.Write(glabel))

        line = tangent(-2)
        dot = m.Dot(axes.c2p(-2, 4), color=m.YELLOW, radius=0.1)
        slope = m.MathTex("k = 2x = -4", font_size=46, color=m.YELLOW).shift(4.4*m.RIGHT + 0.5*m.UP)
        rule = m.MathTex("f'(x) = 2x", font_size=46).next_to(slope, m.UP, buff=0.6)

        self.play(m.FadeIn(dot, scale=0.4), m.Create(line))
        self.play(m.Write(rule), m.Write(slope))
        self.wait(0.4)

        for a in [-1, 0, 1, 2]:
            new_slope = m.MathTex(f"k = 2x = {2 * a}", font_size=46, color=m.YELLOW).move_to(slope)
            self.play(
                m.Transform(line, tangent(a)),
                dot.animate.move_to(axes.c2p(a, a**2)),
                m.Transform(slope, new_slope),
                run_time=1.2,
            )
            self.wait(0.3)

        self.play(m.Circumscribe(rule))
        self.wait(1)
`,
  },
];

export const SUGGESTED_PROMPTS = TEMPLATES.map((t) => t.prompt);

export function genericCode(topic: string) {
  const clean = topic.replace(/["\\\n]/g, " ").trim();
  const short = clean.length > 42 ? clean.slice(0, 40).trim() + "…" : clean;
  return `import manimx as m


class Lesson(m.Scene):
    def construct(self):
        title = m.Text("${short}", font_size=40).to_edge(m.UP, buff=0.6)
        underline = m.Line(3.5*m.LEFT, 3.5*m.RIGHT, color=m.BLUE).next_to(title, m.DOWN, buff=0.2)

        circle = m.Circle(radius=0.9, color=m.BLUE, fill_opacity=0.25)
        square = m.Square(side_length=1.7, color=m.GREEN, fill_opacity=0.25)
        triangle = m.Triangle(color=m.YELLOW, fill_opacity=0.25).scale(1.1)
        shapes = m.VGroup(circle, square, triangle).arrange(m.RIGHT, buff=1.2)

        self.play(m.Write(title))
        self.play(m.Create(underline))
        self.play(m.LaggedStart(m.GrowFromCenter(circle), m.GrowFromCenter(square), m.GrowFromCenter(triangle), lag_ratio=0.3))
        self.play(shapes.animate.shift(0.4*m.DOWN).scale(0.9))

        note = m.Text("Шаг 1 → Шаг 2 → Вывод", font_size=30, color=m.LIGHT_GRAY).to_edge(m.DOWN, buff=0.8)
        self.play(m.FadeIn(note, shift=0.3*m.UP))
        self.play(m.Indicate(square))
        self.wait(1)
`;
}

/** Stage 2 Canvas library: each source remains independent and is never converted between engines. */
const STAGE_2_STARTERS: Omit<Template, "code">[] = [
  { id: "quadratic", title: "Квадратная функция", prompt: "Покажи график квадратной функции", keywords: ["квадратн", "парабол", "функц", "график"], reply: "Подготовил сцену для разбора параболы: начните с вершины, затем покажите влияние коэффициентов и подпишите оси." },
  { id: "newton", title: "Метод Ньютона", prompt: "Объясни метод Ньютона", keywords: ["ньютон", "касательн", "корень", "итерац"], reply: "Подготовил последовательность шагов метода Ньютона: касательная, новое приближение и вывод о сходимости." },
  { id: "complex-plane", title: "Комплексная плоскость", prompt: "Покажи комплексные числа на плоскости", keywords: ["комплекс", "аргумент", "модуль", "плоскост"], reply: "Подготовил сцену для связи комплексного числа с точкой, модулем и аргументом на комплексной плоскости." },
  { id: "pendulum", title: "Маятник", prompt: "Объясни колебания маятника", keywords: ["маятник", "колебан", "период", "амплитуд"], reply: "Подготовил основу урока о маятнике: положение равновесия, амплитуда, период и связь с синусоидой." },
  { id: "energy", title: "Закон сохранения энергии", prompt: "Покажи закон сохранения энергии", keywords: ["энерг", "потенциальн", "кинетическ", "сохранен"], reply: "Подготовил сцену для последовательного показа перехода потенциальной энергии в кинетическую." },
  { id: "ohm", title: "Закон Ома", prompt: "Объясни закон Ома", keywords: ["ом", "ток", "напряжен", "сопротивлен", "электр"], reply: "Подготовил визуальную основу закона Ома с формулой, величинами и местом для графика зависимости." },
  { id: "orbit", title: "Орбиты планет", prompt: "Покажи движение планеты по орбите", keywords: ["орбит", "планет", "кеплер", "гравитац"], reply: "Подготовил сцену для объяснения эллиптической орбиты, фокуса и изменения скорости планеты." },
  { id: "timeline-history", title: "Историческая шкала", prompt: "Создай историческую временную шкалу", keywords: ["истор", "временн", "эпох", "хронолог"], reply: "Подготовил нейтральную сцену временной шкалы: добавьте события, даты, источники и причинно-следственные связи." },
];

TEMPLATES.push(
  ...STAGE_2_STARTERS.map((starter) => ({
    ...starter,
    code: genericCode(starter.title),
  }))
);
