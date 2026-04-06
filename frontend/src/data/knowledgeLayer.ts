import type { LessonId } from '../types/theme';
import type { FormulaBlockProps } from '../components/lesson/FormulaBlock';
import type { PracticeMethod } from '../components/lesson/AdvancedPracticeTable';
import type { Glossary } from '../components/lesson/TermHighlight';

/* ---- Raw JSON shape (matches lab-*.json) ---- */

export interface KnowledgeTheoryBlock {
  id: string;
  heading: string;
  text: string;
  keywords: string[];
}

export interface KnowledgeFormula {
  id: string;
  label: string;
  expression: string;
  imagePath?: string;
  variables: { symbol: string; description: string; unit: string }[];
  example?: { given: Record<string, number>; steps: string[]; result: string };
  explanation?: string;
}

export interface KnowledgeFigure {
  id: string;
  path: string;
  caption: string;
}

export interface KnowledgeQuiz {
  question: string;
  answer: string;
}

export interface KnowledgePracticeMethod {
  id: string;
  title: string;
  description: string;
  steps?: string[];
}

/** Явный порядок теории, формул и рисунков (как в методичке). Если задан, вкладка «Теория» строит поток только по нему. */
export type KnowledgeContentFlowStep =
  | { step: 'theory'; blockId: string }
  | { step: 'formula'; id: string }
  | { step: 'figure'; id: string };

export interface KnowledgeLayer {
  id: string;
  title: string;
  goal: string;
  theory: KnowledgeTheoryBlock[];
  formulas: KnowledgeFormula[];
  figures: KnowledgeFigure[];
  /** Опционально: последовательность блоков для занятий с жёстким порядком иллюстраций. */
  contentFlow?: KnowledgeContentFlowStep[];
  tables: unknown;
  practice: { methods: KnowledgePracticeMethod[] };
  quiz: KnowledgeQuiz[];
}

/* ---- Static imports ---- */

import lab1 from '../content/labs/lab-1.json';
import lab2 from '../content/labs/lab-2.json';
import lab3 from '../content/labs/lab-3.json';
import lab4 from '../content/labs/lab-4.json';
import lab5 from '../content/labs/lab-5.json';
import lab6 from '../content/labs/lab-6.json';
import lab7 from '../content/labs/lab-7.json';
import lab8 from '../content/labs/lab-8.json';
import lab9 from '../content/labs/lab-9.json';
import lab10 from '../content/labs/lab-10.json';
import lab11 from '../content/labs/lab-11.json';
import lab12 from '../content/labs/lab-12.json';
import lab13 from '../content/labs/lab-13.json';
import lab14 from '../content/labs/lab-14.json';
import lab15 from '../content/labs/lab-15.json';

const layers: Record<number, KnowledgeLayer> = {
  1: lab1 as unknown as KnowledgeLayer,
  2: lab2 as unknown as KnowledgeLayer,
  3: lab3 as unknown as KnowledgeLayer,
  4: lab4 as unknown as KnowledgeLayer,
  5: lab5 as unknown as KnowledgeLayer,
  6: lab6 as unknown as KnowledgeLayer,
  7: lab7 as unknown as KnowledgeLayer,
  8: lab8 as unknown as KnowledgeLayer,
  9: lab9 as unknown as KnowledgeLayer,
  10: lab10 as unknown as KnowledgeLayer,
  11: lab11 as unknown as KnowledgeLayer,
  12: lab12 as unknown as KnowledgeLayer,
  13: lab13 as unknown as KnowledgeLayer,
  14: lab14 as unknown as KnowledgeLayer,
  15: lab15 as unknown as KnowledgeLayer,
};

/* ---- Public API ---- */

export function getKnowledgeLayer(lessonId: LessonId): KnowledgeLayer | undefined {
  return layers[lessonId];
}

/**
 * Занятия 6–15: поле `goal` из JSON дублируется первым синтетическим блоком «Цель работы» в теории (в JSON отдельного блока нет).
 * Занятия 1–5: цель задана первым элементом массива `theory` в lab-N.json; под заголовком страницы не показывается (см. LessonPage).
 */
export function shouldInlineGoalInTheory(lessonId: LessonId): boolean {
  return lessonId >= 6 && lessonId <= 15;
}

export function theoryBlocksWithGoal(layer: KnowledgeLayer, lessonId: LessonId): KnowledgeTheoryBlock[] {
  if (!shouldInlineGoalInTheory(lessonId) || !layer.goal?.trim()) return layer.theory;
  const goalBlock: KnowledgeTheoryBlock = {
    id: `${layer.id}-goal`,
    heading: 'Цель работы',
    text: layer.goal.trim(),
    keywords: ['цель работы'],
  };
  return [goalBlock, ...layer.theory];
}

/** Convert knowledge formula into FormulaBlock props */
export function toFormulaBlockProps(formula: KnowledgeFormula): FormulaBlockProps {
  return {
    id: formula.id,
    label: formula.label,
    expression: formula.expression,
    imagePath: formula.imagePath,
    variables: formula.variables,
    example: formula.example,
    explanation: formula.explanation,
  };
}

/** Build a glossary from theory blocks */
export function buildGlossary(layer: KnowledgeLayer): Glossary {
  const glossary: Glossary = {};
  for (const block of layer.theory) {
    // Use first sentence of text as the definition for each keyword
    const firstSentence = block.text.split(/[.!?]/)[0]?.trim() ?? block.text;
    for (const kw of block.keywords) {
      // Skip very short keywords (≤2 chars): formula symbols like E, H, f, G, λ
      // match inside virtually every word and produce false highlights
      if (kw.length <= 2) continue;
      if (!glossary[kw]) {
        glossary[kw] = `${block.heading}: ${firstSentence}.`;
      }
    }
  }
  return glossary;
}

/** Build practice methods with computation stubs from the knowledge layer */
export function buildPracticeMethods(lessonId: LessonId): PracticeMethod[] {
  // Lesson-specific calculation methods using real formulas
  switch (lessonId) {
    case 1:
      return [
        {
          id: 'illuminance-measurement',
          title: 'Определение освещённости',
          description: 'Расчёт освещённости по силе света и расстоянию',
          params: [
            { key: 'I', label: 'Сила света', unit: 'кд', defaultValue: 900 },
            { key: 'r', label: 'Расстояние', unit: 'м', defaultValue: 2 },
          ],
          steps: [
            {
              label: 'Освещённость E',
              formula: 'E = I / r²',
              compute: (p) => p.I / (p.r * p.r),
              resultKey: 'E',
              resultUnit: 'лк',
            },
          ],
          conclusionFn: (r) =>
            r.E >= 300
              ? `E = ${r.E.toFixed(1)} лк — норма выполняется (≥ 300 лк)`
              : `E = ${r.E.toFixed(1)} лк — норма НЕ выполняется (< 300 лк)`,
        },
      ];

    case 2:
      return [
        {
          id: 'utilization-method',
          title: 'Метод коэффициента использования',
          description: 'N = (Eн·S·Kз·z) / (n·Φл·η)',
          params: [
            { key: 'En', label: 'Eн (норма)', unit: 'лк', defaultValue: 300 },
            { key: 'S', label: 'Площадь S', unit: 'м²', defaultValue: 72 },
            { key: 'Kz', label: 'Кз', unit: '', defaultValue: 1.5 },
            { key: 'z', label: 'z (неравн.)', unit: '', defaultValue: 1.1 },
            { key: 'n', label: 'n (ламп/свет.)', unit: '', defaultValue: 2 },
            { key: 'Fl', label: 'Φл (поток)', unit: 'лм', defaultValue: 3000 },
          ],
          steps: [
            {
              label: 'Индекс помещения i',
              formula: 'i = (A·B) / (Hp·(A+B))',
              compute: () => 1.5,
              resultKey: 'i',
              resultUnit: '',
            },
            {
              label: 'η (из таблицы по i)',
              formula: 'η ≈ 0.5 (по i)',
              compute: () => 0.5,
              resultKey: 'eta',
              resultUnit: '',
            },
            {
              label: 'Число светильников N',
              formula: 'N = (Eн·S·Kз·z) / (n·Φл·η)',
              compute: (p) => Math.ceil((p.En * p.S * p.Kz * p.z) / (p.n * p.Fl * (p.eta || 0.5))),
              resultKey: 'N',
              resultUnit: 'шт.',
            },
          ],
          conclusionFn: (r) => `Необходимо ${r.N} светильников для обеспечения нормы.`,
        },
        {
          id: 'specific-power',
          title: 'Метод удельной мощности',
          description: 'Wp = αКЗ · αЗ · αЕ · Wт, затем N = (Wp · S) / (Pлампы · n)',
          params: [
            { key: 'S', label: 'Площадь', unit: 'м²', defaultValue: 72 },
            { key: 'Wt', label: 'Wт (табл.)', unit: 'Вт/м²', defaultValue: 16 },
            { key: 'aKZ', label: 'αКЗ', unit: '', defaultValue: 1.3 },
            { key: 'aZ', label: 'αЗ', unit: '', defaultValue: 1.15 },
            { key: 'aE', label: 'αЕ = Eн/100', unit: '', defaultValue: 3 },
            { key: 'Pl', label: 'Pлампы', unit: 'Вт', defaultValue: 36 },
            { key: 'n', label: 'n (ламп/свет.)', unit: '', defaultValue: 2 },
          ],
          steps: [
            {
              label: 'Удельная мощность Wp',
              formula: 'Wp = αКЗ × αЗ × αЕ × Wт',
              compute: (p) => p.aKZ * p.aZ * p.aE * p.Wt,
              resultKey: 'Wp',
              resultUnit: 'Вт/м²',
            },
            {
              label: 'Общая мощность',
              formula: 'P = Wp × S',
              compute: (p) => p.Wp * p.S,
              resultKey: 'P',
              resultUnit: 'Вт',
            },
            {
              label: 'Число светильников',
              formula: 'N = P / (Pлампы × n)',
              compute: (p) => Math.ceil(p.P / (p.Pl * p.n)),
              resultKey: 'N',
              resultUnit: 'шт.',
            },
          ],
          conclusionFn: (r) => `Необходимо ${r.N} светильников (удельная мощность Wp = ${r.Wp?.toFixed(1)} Вт/м²).`,
        },
        {
          id: 'luminous-lines',
          title: 'Метод светящихся линий',
          description: 'Формулы 2.16–2.19: расчёт числа рядов и светильников в ряду.',
          params: [
            { key: 'L', label: 'Длина помещения', unit: 'м', defaultValue: 12 },
            { key: 'B', label: 'Ширина помещения', unit: 'м', defaultValue: 6 },
            { key: 'H', label: 'Высота подвеса Hp', unit: 'м', defaultValue: 2.7 },
            { key: 'Lsv', label: 'Длина светильника', unit: 'м', defaultValue: 1.27 },
          ],
          steps: [
            {
              label: 'Длина ряда l',
              formula: 'l = 0.5 × L\'  (L\' ≈ L)',
              compute: (p) => 0.5 * p.L,
              resultKey: 'rowLen',
              resultUnit: 'м',
            },
            {
              label: 'Светильников в ряду N1',
              formula: 'N₁ = l / Lсв (округл. вверх)',
              compute: (p) => Math.ceil(p.rowLen / p.Lsv),
              resultKey: 'N1',
              resultUnit: 'шт.',
            },
            {
              label: 'Число рядов',
              formula: 'Ряды = B / (Hp × 1.6) (округл.)',
              compute: (p) => Math.max(1, Math.round(p.B / (p.H * 1.6))),
              resultKey: 'rows',
              resultUnit: '',
            },
            {
              label: 'Общее число N',
              formula: 'N = N₁ × Ряды',
              compute: (p) => p.N1 * p.rows,
              resultKey: 'N',
              resultUnit: 'шт.',
            },
          ],
          conclusionFn: (r) => `Необходимо ${r.N} светильников (${r.N1} в ряду × ${r.rows} рядов).`,
        },
      ];

    case 4:
      return [
        {
          id: 'noise-calculation',
          title: 'Расчёт интенсивности шума',
          description:
            'Пошаговый расчёт по формулам 4.1–4.8: от уровня источников до итогового L\'Σ.',
          params: [
            { key: 'L1', label: 'L₁ (источник 1)', unit: 'дБ', defaultValue: 100 },
            { key: 'R1', label: 'R₁', unit: 'м', defaultValue: 4 },
            { key: 'G1', label: 'G₁ (масса преграды 1)', unit: 'кг/м²', defaultValue: 250 },
            { key: 'L2', label: 'L₂ (источник 2)', unit: 'дБ', defaultValue: 90 },
            { key: 'R2', label: 'R₂', unit: 'м', defaultValue: 8 },
            { key: 'G2', label: 'G₂ (масса преграды 2)', unit: 'кг/м²', defaultValue: 300 },
            { key: 'L3', label: 'L₃ (источник 3)', unit: 'дБ', defaultValue: 85 },
            { key: 'R3', label: 'R₃', unit: 'м', defaultValue: 6 },
            { key: 'G3', label: 'G₃ (масса преграды 3)', unit: 'кг/м²', defaultValue: 200 },
          ],
          steps: [
            {
              label: 'LR₁ на расстоянии R₁',
              formula: 'LR = L₁ − 20·lg(R) − 8',
              compute: (p) => p.L1 - 20 * Math.log10(Math.max(0.1, p.R1)) - 8,
              resultKey: 'LR1',
              resultUnit: 'дБ',
            },
            {
              label: 'N₁ (снижение преградой 1)',
              formula: 'N = 14,5·lg(G) + 15',
              compute: (p) => 14.5 * Math.log10(Math.max(1, p.G1)) + 15,
              resultKey: 'N1',
              resultUnit: 'дБ',
            },
            {
              label: 'L\'R₁ (после преграды)',
              formula: 'L\'R = LR − N',
              compute: (p) => p.LR1 - p.N1,
              resultKey: 'LpR1',
              resultUnit: 'дБ',
            },
            {
              label: 'LR₂ на расстоянии R₂',
              formula: 'LR = L₂ − 20·lg(R) − 8',
              compute: (p) => p.L2 - 20 * Math.log10(Math.max(0.1, p.R2)) - 8,
              resultKey: 'LR2',
              resultUnit: 'дБ',
            },
            {
              label: 'N₂ (снижение преградой 2)',
              formula: 'N = 14,5·lg(G) + 15',
              compute: (p) => 14.5 * Math.log10(Math.max(1, p.G2)) + 15,
              resultKey: 'N2',
              resultUnit: 'дБ',
            },
            {
              label: 'L\'R₂ (после преграды)',
              formula: 'L\'R = LR − N',
              compute: (p) => p.LR2 - p.N2,
              resultKey: 'LpR2',
              resultUnit: 'дБ',
            },
            {
              label: 'LR₃ на расстоянии R₃',
              formula: 'LR = L₃ − 20·lg(R) − 8',
              compute: (p) => p.L3 - 20 * Math.log10(Math.max(0.1, p.R3)) - 8,
              resultKey: 'LR3',
              resultUnit: 'дБ',
            },
            {
              label: 'N₃ (снижение преградой 3)',
              formula: 'N = 14,5·lg(G) + 15',
              compute: (p) => 14.5 * Math.log10(Math.max(1, p.G3)) + 15,
              resultKey: 'N3',
              resultUnit: 'дБ',
            },
            {
              label: 'L\'R₃ (после преграды)',
              formula: 'L\'R = LR − N',
              compute: (p) => p.LR3 - p.N3,
              resultKey: 'LpR3',
              resultUnit: 'дБ',
            },
            {
              label: 'LΣ (суммарный от 3 источников)',
              formula: 'LΣ = 10·lg(10^(L₁/10) + 10^(L₂/10) + 10^(L₃/10))',
              compute: (p) =>
                10 *
                Math.log10(
                  Math.pow(10, Math.max(-100, p.LpR1) / 10) +
                    Math.pow(10, Math.max(-100, p.LpR2) / 10) +
                    Math.pow(10, Math.max(-100, p.LpR3) / 10),
                ),
              resultKey: 'Lsum',
              resultUnit: 'дБ',
            },
          ],
          conclusionFn: (r) =>
            r.Lsum <= 40
              ? `LΣ = ${r.Lsum.toFixed(1)} дБ — в пределах нормы (≤ 40 дБ)`
              : `LΣ = ${r.Lsum.toFixed(1)} дБ — превышает комфортный уровень 40 дБ`,
        },
      ];

    case 5:
      return [
        {
          id: 'emi-analysis',
          title: 'Анализ ЭМИ',
          description: 'Определение длины волны и ППЭ по заданным параметрам.',
          params: [
            { key: 'f', label: 'Частота', unit: 'МГц', defaultValue: 2450 },
            { key: 'E', label: 'E', unit: 'В/м', defaultValue: 14 },
            { key: 'H', label: 'H', unit: 'А/м', defaultValue: 0.45 },
          ],
          steps: [
            {
              label: 'Длина волны λ',
              formula: 'λ = c / f',
              compute: (p) => 299792458 / (p.f * 1e6),
              resultKey: 'lambda',
              resultUnit: 'м',
            },
            {
              label: 'ППЭ',
              formula: 'ППЭ = E × H',
              compute: (p) => p.E * p.H,
              resultKey: 'PPE',
              resultUnit: 'Вт/м²',
            },
          ],
          conclusionFn: (r) =>
            r.PPE <= 10
              ? `ППЭ = ${r.PPE.toFixed(3)} Вт/м² — ниже теплового порога`
              : `ППЭ = ${r.PPE.toFixed(3)} Вт/м² — превышает тепловой порог 10 мВт/см²!`,
        },
      ];

    case 6:
      return [
        {
          id: 'shield-calc',
          title: 'Расчёт параметров защиты от ЭМИ',
          description: 'H → λ → ППЭδ → ППЭδдоп → L → ω → μa → M → α → l',
          params: [
            { key: 'w', label: 'Витки w', unit: '', defaultValue: 12 },
            { key: 'I', label: 'Ток I', unit: 'А', defaultValue: 350 },
            { key: 'r', label: 'Радиус катушки r', unit: 'м', defaultValue: 0.25 },
            { key: 'R', label: 'Расстояние R', unit: 'м', defaultValue: 3 },
            { key: 'betaM', label: 'βm', unit: '', defaultValue: 1 },
            { key: 'f', label: 'Частота f', unit: 'Гц', defaultValue: 3e8 },
            { key: 'T', label: 'Время T', unit: 'ч', defaultValue: 4 },
            { key: 'N', label: 'N', unit: 'Вт·ч/м²', defaultValue: 2 },
            { key: 'mu', label: 'μ', unit: '', defaultValue: 200 },
            { key: 'gamma', label: 'γ', unit: '1/(Ом·м)', defaultValue: 1e7 },
            { key: 'D', label: 'Диаметр D', unit: 'м', defaultValue: 0.01 },
            { key: 'eps', label: 'ε', unit: '', defaultValue: 7 },
          ],
          steps: [
            {
              label: 'H',
              formula: 'H = (w·I·r²·βm) / (4·R³)',
              compute: (p) => (p.w * p.I * p.r * p.r * p.betaM) / (4 * Math.pow(Math.max(1e-6, p.R), 3)),
              resultKey: 'H',
              resultUnit: 'А/м',
            },
            { label: 'λ', formula: 'λ = c / f', compute: (p) => 299792458 / Math.max(1e-9, p.f), resultKey: 'lambda', resultUnit: 'м' },
            {
              label: 'ППЭδ',
              formula: 'ППЭδ = 377·H²/2',
              compute: (p) => (377 * p.H * p.H) / 2,
              resultKey: 'PPEd',
              resultUnit: 'Вт/м²',
            },
            {
              label: 'ППЭδдоп',
              formula: 'ППЭδдоп = N / T',
              compute: (p) => p.N / Math.max(1e-9, p.T),
              resultKey: 'PPEdMax',
              resultUnit: 'Вт/м²',
            },
            {
              label: 'L',
              formula: 'L = ППЭδ / ППЭδдоп',
              compute: (p) => p.PPEd / Math.max(1e-12, p.PPEdMax),
              resultKey: 'L',
              resultUnit: '',
            },
            { label: 'ω', formula: 'ω = 2πf', compute: (p) => 2 * Math.PI * p.f, resultKey: 'omega', resultUnit: '1/с' },
            {
              label: 'μa',
              formula: 'μa = μ0·μ',
              compute: (p) => (4 * Math.PI * 1e-7) * p.mu,
              resultKey: 'muA',
              resultUnit: 'Гн/м',
            },
            {
              label: 'M',
              formula: 'M = ln(L) / (2·√(ω·μa·γ/2))',
              compute: (p) => {
                const denom = 2 * Math.sqrt((p.omega * p.muA * p.gamma) / 2);
                return Math.log(Math.max(1, p.L)) / Math.max(1e-12, denom);
              },
              resultKey: 'M',
              resultUnit: 'м',
            },
            {
              label: 'α',
              formula: 'α = 32 / (D·√ε)',
              compute: (p) => 32 / (Math.max(1e-12, p.D) * Math.sqrt(Math.max(1e-12, p.eps))),
              resultKey: 'alpha',
              resultUnit: 'дБ/м',
            },
            {
              label: 'l',
              formula: 'l = (10·lg(L)) / α',
              compute: (p) => (10 * Math.log10(Math.max(1, p.L))) / Math.max(1e-12, p.alpha),
              resultKey: 'len',
              resultUnit: 'м',
            },
          ],
          conclusionFn: (r) =>
            `H = ${r.H.toFixed(4)} А/м; ППЭδ = ${r.PPEd.toFixed(6)} Вт/м²; L = ${r.L.toFixed(3)}; M = ${(r.M * 1000).toFixed(
              3,
            )} мм; l = ${(r.len * 1000).toFixed(1)} мм.`,
        },
      ];

    case 7:
      return [
        {
          id: 'hf-field-calc',
          title: 'Расчёт E по Шулейкину–Ван-дер-Полю',
          description: 'x → F → E для заданного расстояния',
          params: [
            { key: 'lambda', label: 'λ', unit: 'м', defaultValue: 1650 },
            { key: 'P', label: 'P', unit: 'кВт', defaultValue: 300 },
            { key: 'Ga', label: 'Ga', unit: '', defaultValue: 1.1 },
            { key: 'theta', label: 'θ', unit: '', defaultValue: 7 },
            { key: 'sigma', label: 'δ', unit: 'См/м', defaultValue: 0.003 },
            { key: 'd', label: 'd', unit: 'м', defaultValue: 1000 },
          ],
          steps: [
            { label: 'f (частота)', formula: 'f = c/λ', compute: (p) => 299792458 / p.lambda, resultKey: 'freq', resultUnit: 'Гц' },
            {
              label: 'x', formula: 'π·d / (λ·√(θ²+(60·λ·δ)²))',
              compute: (p) => {
                const term = Math.sqrt(p.theta ** 2 + (60 * p.lambda * p.sigma) ** 2);
                return (Math.PI * p.d) / (p.lambda * term);
              },
              resultKey: 'x', resultUnit: '',
            },
            { label: 'F', formula: '1.41·(2+0.3x)/(2+x+0.6x²)', compute: (p) => 1.41 * (p.x === 0 ? 1 : (2 + 0.3 * p.x) / (2 + p.x + 0.6 * p.x ** 2)), resultKey: 'F', resultUnit: '' },
            { label: 'E', formula: '7.750·√(P·Ga)·F/d', compute: (p) => 7.75 * Math.sqrt(p.P * p.Ga) * p.F / p.d, resultKey: 'E', resultUnit: 'В/м' },
          ],
          conclusionFn: (r) => `E = ${r.E.toFixed(4)} В/м на расстоянии d.`,
        },
      ];

    case 8:
      return [
        {
          id: 'uhf-field-calc',
          title: 'Расчёт E УВЧ-передатчика',
          description: 'R, Δ, F(Δ) → E для передатчика телецентра',
          params: [
            { key: 'P', label: 'P (Вт)', unit: 'Вт', defaultValue: 80000 },
            { key: 'G', label: 'G', unit: '', defaultValue: 12 },
            { key: 'Hant', label: 'H (высота)', unit: 'м', defaultValue: 300 },
            { key: 'r', label: 'r (земля)', unit: 'м', defaultValue: 400 },
            { key: 'K', label: 'K', unit: '', defaultValue: 1.41 },
          ],
          steps: [
            { label: 'R', formula: '√(H²+r²)', compute: (p) => Math.sqrt(p.Hant ** 2 + p.r ** 2), resultKey: 'R', resultUnit: 'м' },
            { label: 'Δ', formula: 'arctan(H/r)', compute: (p) => Math.atan(p.Hant / p.r), resultKey: 'delta', resultUnit: 'рад' },
            { label: 'F(Δ)', formula: '1.41·(2+0.3r)/(2+r+0.6r²)', compute: (p) => 1.41 * (2 + 0.3 * p.r) / (2 + p.r + 0.6 * p.r ** 2), resultKey: 'Fd', resultUnit: '' },
            { label: 'E', formula: 'K·√(30PG)·F(Δ)/R', compute: (p) => p.K * Math.sqrt(30 * p.P * p.G) * p.Fd / p.R, resultKey: 'E', resultUnit: 'В/м' },
          ],
          conclusionFn: (r) => `E = ${r.E.toFixed(3)} В/м.`,
        },
      ];

    case 9:
      return [
        {
          id: 'body-impedance-calc',
          title: 'Расчёт импеданса тела',
          description: 'Rн → Zн → Z → I',
          params: [
            { key: 'Rv', label: 'Rв', unit: 'Ом', defaultValue: 500 },
            { key: 'Rn', label: 'Rн', unit: 'Ом', defaultValue: 5000 },
            { key: 'C', label: 'C', unit: 'нФ', defaultValue: 20 },
            { key: 'f', label: 'f', unit: 'Гц', defaultValue: 50 },
            { key: 'U', label: 'U_пр', unit: 'В', defaultValue: 220 },
          ],
          steps: [
            { label: 'Zн', formula: 'Rн/√(1+(2πfCRн)²)', compute: (p) => p.Rn / Math.sqrt(1 + (2 * Math.PI * p.f * (p.C * 1e-9) * p.Rn) ** 2), resultKey: 'Zn', resultUnit: 'Ом' },
            { label: 'Z', formula: '2Zн+Rв', compute: (p) => 2 * p.Zn + p.Rv, resultKey: 'Z', resultUnit: 'Ом' },
            { label: 'I (мА)', formula: 'U/Z·1000', compute: (p) => (p.U / p.Z) * 1000, resultKey: 'ImA', resultUnit: 'мА' },
          ],
          conclusionFn: (r) => {
            if (r.ImA < 0.5) return `I = ${r.ImA.toFixed(2)} мА — безопасный уровень.`;
            if (r.ImA < 10) return `I = ${r.ImA.toFixed(2)} мА — ощутимый ток.`;
            if (r.ImA < 100) return `I = ${r.ImA.toFixed(2)} мА — неотпускающий! Опасно!`;
            return `I = ${r.ImA.toFixed(2)} мА — фибрилляционный! Смертельно опасен!`;
          },
        },
      ];

    case 10:
      return [
        {
          id: 'step-voltage-calc',
          title: 'Расчёт шагового напряжения',
          description: 'j → UA → Uш для разных x',
          params: [
            { key: 'Iz', label: 'Iз', unit: 'А', defaultValue: 10 },
            { key: 'rho', label: 'ρ', unit: 'Ом·м', defaultValue: 100 },
            { key: 'x', label: 'x', unit: 'м', defaultValue: 5 },
            { key: 'a', label: 'a (шаг)', unit: 'м', defaultValue: 0.8 },
          ],
          steps: [
            { label: 'j', formula: 'Iз/(2π·x²)', compute: (p) => p.Iz / (2 * Math.PI * p.x ** 2), resultKey: 'j', resultUnit: 'А/м²' },
            { label: 'UA', formula: 'Iз·ρ/(2π·x)', compute: (p) => p.Iz * p.rho / (2 * Math.PI * p.x), resultKey: 'UA', resultUnit: 'В' },
            { label: 'Uш', formula: 'Iз·ρ·a/(2π·x·(x+a))', compute: (p) => p.Iz * p.rho * p.a / (2 * Math.PI * p.x * (p.x + p.a)), resultKey: 'Ush', resultUnit: 'В' },
          ],
          conclusionFn: (r) =>
            r.Ush < 36
              ? `Uш = ${r.Ush.toFixed(2)} В — ниже безопасного порога 36 В.`
              : `Uш = ${r.Ush.toFixed(2)} В — опасное шаговое напряжение!`,
        },
      ];

    case 11:
      return [
        {
          id: 'three-phase-touch-current',
          title: 'Оценка тока через тело (упрощённо)',
          description: 'I ≈ U / R_{h} для сети с глухозаземлённой нейтралью (нормальный режим, касание фазы).',
          params: [
            { key: 'Uphi', label: 'U_ф', unit: 'В', defaultValue: 220 },
            { key: 'Rh', label: 'R_h', unit: 'Ом', defaultValue: 1000 },
          ],
          steps: [
            {
              label: 'Ток I_h',
              formula: 'I_h ≈ U_ф / R_h',
              compute: (p) => p.Uphi / Math.max(1, p.Rh),
              resultKey: 'Ih',
              resultUnit: 'А',
            },
            {
              label: 'I_h (мА)',
              formula: '×1000',
              compute: (p) => (p.Uphi / Math.max(1, p.Rh)) * 1000,
              resultKey: 'IhMA',
              resultUnit: 'мА',
            },
          ],
          conclusionFn: (r) => {
            const ma = r.IhMA ?? 0;
            if (ma < 0.5) return `I ≈ ${ma.toFixed(2)} мА — ощущение слабое или отсутствует.`;
            if (ma < 10) return `I ≈ ${ma.toFixed(2)} мА — ощутимый ток.`;
            if (ma < 100) return `I ≈ ${ma.toFixed(2)} мА — опасная зона (неотпускающий ток и выше).`;
            return `I ≈ ${ma.toFixed(2)} мА — крайне опасно.`;
          },
        },
      ];

    default:
      return [];
  }
}
