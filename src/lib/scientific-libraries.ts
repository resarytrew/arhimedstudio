import physics from "../../examples/manimgx/science/physics.py?raw";
import electronics from "../../examples/manimgx/science/electronics.py?raw";
import engineering from "../../examples/manimgx/science/engineering.py?raw";
import biology from "../../examples/manimgx/science/biology.py?raw";
import chemistry from "../../examples/manimgx/science/chemistry.py?raw";
import mathematics from "../../examples/manimgx/science/mathematics.py?raw";
import type { Template } from "./templates";

export const SCIENTIFIC_IMPORT_ROOTS = ["sympy", "scipy", "matplotlib", "schemdraw", "Bio", "periodictable", "arhimed_science"] as const;

export const SCIENTIFIC_LIBRARIES = [
  { name: "SymPy", version: "1.14.0", scope: "Символьная математика, механика и единицы физических величин", imports: "sympy; sympy.physics.units; sympy.physics.mechanics" },
  { name: "SciPy", version: "1.18.0", scope: "Физические константы, интегрирование, дифференциальные уравнения и сигналы", imports: "scipy.constants; scipy.integrate; scipy.signal" },
  { name: "Schemdraw", version: "0.23", scope: "Электроника, логика и инженерные блок-схемы", imports: "schemdraw; schemdraw.elements; schemdraw.flow; schemdraw.logic" },
  { name: "Biopython", version: "1.87", scope: "ДНК, РНК, трансляция и анализ последовательностей в памяти", imports: "Bio.Seq; Bio.SeqUtils" },
  { name: "PeriodicTable", version: "2.1.0", scope: "Элементы, изотопы, состав вещества и молярные массы", imports: "periodictable" },
  { name: "Matplotlib", version: "3.10.8", scope: "Графики, поля и диаграммы с подписями", imports: "matplotlib.pyplot" },
] as const;

export const SCIENCE_TEMPLATES: Template[] = [
  { id: "science-physics", title: "Физика · свободное падение", prompt: "Покажи свободное падение с SymPy и SciPy", keywords: ["sympy.physics", "свободное падение", "физик"], reply: "Символьная производная SymPy даёт скорость, а ускорение свободного падения берётся из scipy.constants. Кривая строится по вычисленной формуле.", code: physics },
  { id: "science-electronics", title: "Электроника · RC-цепь", prompt: "Покажи RC-цепь с Schemdraw и SciPy", keywords: ["rc-цеп", "rc цеп", "электрон", "конденсатор", "электрическ"], reply: "Схему строит Schemdraw, отклик RC-цепи рассчитывает scipy.signal. Схема передаётся в ManimGX как изображение из памяти.", code: electronics },
  { id: "science-engineering", title: "Инженерия · блок-схема", prompt: "Построй инженерную блок-схему с Schemdraw", keywords: ["блок-схем", "блок схем", "инженер", "schemdraw.flow"], reply: "Блок-схема собрана из элементов schemdraw.flow и встроена в сцену ManimGX. Каждый блок обозначает часть системы управления.", code: engineering },
  { id: "science-biology", title: "Биология · от ДНК к белку", prompt: "Покажи транскрипцию и трансляцию ДНК с Biopython", keywords: ["биолог", "днк", "рнк", "biopython", "транскрип", "трансляц"], reply: "Biopython вычисляет РНК, аминокислотную последовательность и GC-состав. Анимация последовательно показывает результат каждого шага.", code: biology },
  { id: "science-chemistry", title: "Химия · молярная масса", prompt: "Рассчитай молярную массу воды с PeriodicTable", keywords: ["хими", "молярн", "изотоп", "periodictable"], reply: "Молярная масса рассчитывается пакетом PeriodicTable по составу H₂O. Модель молекулы в кадре — условная иллюстрация, а не расчёт её геометрии.", code: chemistry },
  { id: "science-mathematics", title: "Математика · площадь под графиком", prompt: "Визуализируй интеграл с SymPy, SciPy и Matplotlib", keywords: ["matplotlib", "интеграл", "математическ", "scipy", "sympy"], reply: "SymPy находит точный интеграл, SciPy проверяет его численно. Matplotlib рисует график и закрашенную площадь; подписи сохраняются при переносе в ManimGX.", code: mathematics },
];

export const SCIENTIFIC_AI_INSTRUCTIONS = `
В runtime доступны закреплённые сторонние библиотеки (только для ManimGX):
${SCIENTIFIC_LIBRARIES.map(item => `- ${item.name} ${item.version}: ${item.scope}. Импорты: ${item.imports}.`).join("\n")}
Импортируй только нужные пакеты: runtime загружает локальные закреплённые файлы по требованию.
Для графиков используй matplotlib.pyplot.subplots(), затем from arhimed_science import figure_to_mobject; image = figure_to_mobject(fig, width=9, max_height=4.5). Передавай image в self.play(m.FadeIn(image)).
Для схем используй schemdraw.Drawing(show=False), добавь элементы и вызови from arhimed_science import drawing_to_mobject; image = drawing_to_mobject(drawing, width=9, max_height=4.5).
Не вызывай plt.show(), savefig(), drawing.save(), GUI, shell, pip или чтение/запись файлов. Адаптеры используют Agg и RGBA-массивы только в памяти; не импортируй SVG из файла.
Изображение графика или схемы — снимок: для непрерывного изменения используй геометрию ManimGX, а расчёты выполняй сторонней библиотекой. Не выдавай Schemdraw за SPICE-симулятор, PeriodicTable — за 3D-молекулярный движок, а Biopython — за доступ к удалённым базам.
`;
