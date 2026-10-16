/** Local, serialisable lesson metadata. It deliberately contains no provider credentials or URLs. */
export type TrustState = "draft" | "validated" | "runtime-verified" | "trusted-template" | "untrusted-import";

export type LessonParameterKind = "number" | "boolean" | "select" | "text";

export interface LessonParameter {
  id: string;
  label: string;
  kind: LessonParameterKind;
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  explanation?: string;
}

export interface LessonQuestion {
  id: string;
  prompt: string;
  hint?: string;
  answer?: string;
}

export interface LessonCheckpoint {
  id: string;
  title: string;
  explanation: string;
}

export interface LessonPlan {
  version: 1;
  goal: string;
  audience: string;
  outcome: string;
  steps: string[];
  formulas: string[];
  parameters: LessonParameter[];
  checkpoints: LessonCheckpoint[];
  questions: LessonQuestion[];
  publicSummary: string;
}

export interface LessonProgress {
  parameterValues: Record<string, number | boolean | string>;
  answers: Record<string, string>;
  reachedCheckpoints: string[];
}

export interface SecurityEvent {
  id: string;
  at: number;
  type: "ai-request" | "candidate-created" | "candidate-accepted" | "runtime-verified" | "export" | "import" | "security-log-cleared";
  detail: string;
}

export const emptyLessonPlan = (): LessonPlan => ({
  version: 1,
  goal: "",
  audience: "",
  outcome: "",
  steps: [],
  formulas: [],
  parameters: [],
  checkpoints: [],
  questions: [],
  publicSummary: "",
});

export const emptyLessonProgress = (): LessonProgress => ({ parameterValues: {}, answers: {}, reachedCheckpoints: [] });

export function lessonContext(plan: LessonPlan): string {
  const lines = [
    plan.goal && `Цель урока: ${plan.goal}`,
    plan.audience && `Аудитория: ${plan.audience}`,
    plan.outcome && `Ожидаемый результат: ${plan.outcome}`,
    plan.steps.length && `Шаги: ${plan.steps.join(" → ")}`,
    plan.formulas.length && `Формулы: ${plan.formulas.join("; ")}`,
    plan.parameters.length && `Интерактивные параметры: ${plan.parameters.map((parameter) => parameter.label).join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}
