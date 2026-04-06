export type LessonId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type TheorySimulatorType =
  | 'light-flux'
  | 'light-illuminance'
  | 'light-brightness'
  | 'light-pulsation'
  | 'light-room-index'
  | 'light-specific-power'
  | 'light-multi-source'
  | 'noise-distance'
  | 'noise-barrier'
  | 'noise-sum'
  | 'noise-reflection'
  | 'emi-spectrum'
  | 'emi-wave'
  | 'emi-ppe-zones'
  | 'emi-shield-thickness'
  | 'emi-waveguide'
  | 'emi-field-attenuation'
  | 'hf-field-strength'
  | 'hf-wave-propagation'
  | 'hf-soil-attenuation'
  | 'uhf-field-strength'
  | 'uhf-antenna-pattern'
  | 'radiation-dose'
  | 'electric-current-body'
  | 'electric-resistance'
  | 'electric-frequency-effect'
  | 'ground-current-spread'
  | 'step-voltage'
  | 'equipotential-zones'
  | 'l11-it-touch'
  | 'l11-tn-normal-touch'
  | 'l11-tn-emergency-touch'
  | 'l12-tn-fault-modes'
  | 'l12-earthing-electrodes'
  | 'l13-fire-triangle'
  | 'l13-vapor-nkpr'
  | 'l13-delta-p-category';

export interface TheoryMiniQuestion {
  question: string;
  type: 'single' | 'numeric';
  options?: string[];
  correctAnswer: number | string;
  tolerance?: number;
  explanation: string;
}

export interface TheoryModule {
  id: string;
  title: string;
  keywords: string[];
  definition: string;
  formula: string;
  formulaExplanation: string;
  units: string;
  practicalMeaning: string;
  commonMistakes: string[];
  simulator: TheorySimulatorType;
  miniQuestion: TheoryMiniQuestion;
  assetIds?: string[];
}

export type LabStepType =
  | 'instruction'
  | 'sceneAction'
  | 'measurement'
  | 'calculation'
  | 'tableFill'
  | 'quizCheck';

export interface LabStep {
  id: string;
  type: LabStepType;
  title: string;
  /** Один абзац или несколько пунктов маркированного списка под «Что делаем:». */
  whatToDo: string | string[];
  why: string;
  sceneAction: string;
  hint: string;
  resultField?: string;
}

export interface LabVariant {
  variant: number;
  ticketLastDigits: number[];
  /** Числа и, при необходимости, строковые поля (например диапазон f для табл. 8.2). */
  values: Record<string, number | string>;
  sourceNote: string;
  validated: boolean;
  /** Подпись столбца в `VariantTable` вместо номера варианта (например «Ацетон» для табл. 13.3). */
  displayLabel?: string;
}

export interface LabWizard {
  intro: string;
  equipment: string[];
  manualTableName: string;
  manualTablePageHint: string;
  manualConfirmationRequired: boolean;
  allowTrainingEdit: boolean;
  steps: LabStep[];
  reportConclusionHint: string;
}

export type TestQuestion =
  | {
      id: string;
      type: 'single';
      prompt: string;
      options: string[];
      correct: number;
      explanation: string;
    }
  | {
      id: string;
      type: 'multi';
      prompt: string;
      options: string[];
      correct: number[];
      explanation: string;
    }
  | {
      id: string;
      type: 'numeric';
      prompt: string;
      correct: number;
      tolerance: number;
      explanation: string;
      unit?: string;
    };

export interface LessonTheme {
  id: LessonId;
  title: string;
  goal: string;
  references: string[];
  assets: string[];
  theoryModules: TheoryModule[];
  labWizard: LabWizard;
  variants: LabVariant[];
  tests: TestQuestion[];
}
