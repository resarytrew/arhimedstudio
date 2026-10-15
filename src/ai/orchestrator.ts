import { llmAssistant, localAssistant, type AssistantReply, type LLMSettings } from "../lib/assistant";
import { AI_CONTEXT_LIMITS_V1, AI_ENGINE_PROFILES, type AiEngineId, type AiEngineProfileV1 } from "./profiles";
import { validateAiCandidate, type AiCandidateValidationV1 } from "./validation";

export const AI_ORCHESTRATOR_V1 = "1" as const;
export { AI_ENGINE_PROFILES } from "./profiles";
export type { AiEngineProfileV1 } from "./profiles";

export interface AiGenerationRequestV1 {
  projectId: string;
  engine: AiEngineId;
  settings: LLMSettings;
  history: { role: "user" | "assistant"; content: string }[];
  prompt: string;
  source: string;
  /** Immutable revision selected by the author before the request starts. */
  baseRevision: string;
}

export interface AiCandidateV1 {
  baseSource: string;
  baseRevision: string;
  reply: AssistantReply;
  profile: AiEngineProfileV1;
  validation: AiCandidateValidationV1;
}

function abortError() {
  return new DOMException("Генерация отменена.", "AbortError");
}

function compactHistory(history: AiGenerationRequestV1["history"]) {
  const compact: typeof history = [];
  let budget = AI_CONTEXT_LIMITS_V1.historyChars;
  for (const entry of history.slice(-6).reverse()) {
    if (budget <= 0) break;
    const content = entry.content.slice(-Math.min(AI_CONTEXT_LIMITS_V1.historyMessageChars, budget));
    budget -= content.length;
    compact.unshift({ role: entry.role, content });
  }
  return compact;
}

/**
 * Provider credentials stay in the caller's in-memory LLMSettings. This class makes one
 * cancellable request per project, then statically checks the returned source without running it.
 */
export class AIOrchestratorV1 {
  private readonly active = new Map<string, AbortController>();

  async generate(request: AiGenerationRequestV1): Promise<AiCandidateV1> {
    if (this.active.has(request.projectId)) throw new Error("Для проекта уже выполняется один запрос ИИ.");
    if (request.prompt.length > AI_CONTEXT_LIMITS_V1.promptChars || request.source.length > AI_CONTEXT_LIMITS_V1.sourceChars) {
      throw new Error("Запрос или исходник превышает безопасный лимит контекста.");
    }
    const controller = new AbortController();
    this.active.set(request.projectId, controller);
    try {
      const profile = AI_ENGINE_PROFILES[request.engine];
      const history = compactHistory(request.history);
      if (controller.signal.aborted) throw abortError();
      const reply = request.settings.provider === "offline"
        ? localAssistant(request.prompt, request.source, request.history.length === 0, request.engine)
        : await llmAssistant(
          request.settings,
          history,
          request.prompt,
          request.source,
          controller.signal,
          profile.instructions,
          AI_CONTEXT_LIMITS_V1.outputTokens,
        );
      if (controller.signal.aborted) throw abortError();
      const validation = reply.code
        ? validateAiCandidate(reply.code, request.engine)
        : { status: "warning" as const, engineId: request.engine, diagnostics: [{ message: "Ответ не содержит блока Python-кода." }] };
      return { baseSource: request.source, baseRevision: request.baseRevision, reply, profile, validation };
    } finally {
      this.active.delete(request.projectId);
    }
  }

  cancel(projectId: string): boolean {
    const controller = this.active.get(projectId);
    if (!controller) return false;
    controller.abort();
    return true;
  }
}

export const aiOrchestrator = new AIOrchestratorV1();
