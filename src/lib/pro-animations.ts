import quadratic from "../../examples/manimgx/pro/quadratic_formula.py?raw";
import circle from "../../examples/manimgx/pro/circle_area.py?raw";
import linear from "../../examples/manimgx/pro/linear_maps.py?raw";
import type { Template } from "./templates";

/**
 * Real ManimGX 0.1.1 examples, adapted from the MIT-licensed Academa Labs repository.
 * They retain their native scene choreography instead of being reduced to 8 seconds.
 */
export const PRO_ANIMATION_TEMPLATES: Template[] = [
  {
    id: "pro-quadratic",
    title: "Профессиональная анимация · квадратное уравнение",
    prompt: "Покажи профессиональное анимированное геометрическое доказательство формулы квадратного уравнения",
    keywords: ["геометрическое доказательство формулы", "квадратное уравнение", "completing a square"],
    reply: "Официальная сцена ManimGX 0.1.1: перестановка площадей, дополнение до квадрата и преобразование членов уравнения. Исходник сохранён без ускорения.",
    code: quadratic,
  },
  {
    id: "pro-circle",
    title: "Профессиональная анимация · площадь круга",
    prompt: "Покажи профессиональное доказательство площади круга развертыванием колец",
    keywords: ["доказательство площади круга", "развертыванием колец", "circle area", "площадь круга"],
    reply: "Официальная сцена ManimGX 0.1.1: тонкие концентрические кольца превращаются в полосы и составляют треугольник. Исходный темп сохранён.",
    code: circle,
  },
  {
    id: "pro-linear",
    title: "Профессиональная анимация · линейные преобразования",
    prompt: "Покажи профессиональную анимацию матриц, базисных векторов и преобразования сетки",
    keywords: ["матрицы и линейные преобразования", "базисных векторов", "преобразования сетки", "linear maps"],
    reply: "Официальная сцена ManimGX 0.1.1 о действии матрицы на сетку, базис и площадь. Трансформации рассчитываются в нативной геометрии ManimGX.",
    code: linear,
  },
];
