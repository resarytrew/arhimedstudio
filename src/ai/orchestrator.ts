import { llmAssistant, localAssistant, type AssistantReply, type LLMSettings } from "../lib/assistant";

export const AI_ORCHESTRATOR_V1 = "1" as const;

export interface AiEngineProfileV1 {
  id: "arhimed-canvas" | "manimgx-browser";
  version: "1";
  instructions: string;
  allowedApi: readonly string[];
  repairRule: string;
}

export const AI_ENGINE_PROFILES: Record<AiEngineProfileV1["id"], AiEngineProfileV1> = {
  "arhimed-canvas": {
    id: "arhimed-canvas", version: "1",
    instructions: "Use the arhimed-manimx-v1 subset and import manimx as m.",
    allowedApi: ["m.Circle", "m.Text", "self.play", "self.wait"],
    repairRule: "Return a complete replacement scene that only uses the Canvas dialect.",
  },
  "manimgx-browser": {
    id: "manimgx-browser", version: "1",
    instructions: "Use import manimgx as m. The accepted browser runtime has a locked dependency set.",
    allowedApi: ["m.ValueTracker", "m.always_redraw", "self.play", "self.wait"],
    repairRule: "Do not add imports or packages; return one complete scene for the locked runtime.",
  },
};

export interface AiGenerationRequestV1 {
  projectId: string;
  engine: AiEngineProfileV1["id"];
  settings: LLMSettings;
  history: { role: "user" | "assistant"; content: string }[];
  prompt: string;
  source: string;
}

export interface AiCandidateV1 {
  baseSource: string;
  reply: AssistantReply;
  profile: AiEngineProfileV1;
}

/**
 * Provider credentials live only in the caller's in-memory LLMSettings. This object never
 * serializes settings, messages, or source outside an explicit provider request.
 */
export class AIOrchestratorV1 {
  private readonly active = new Map<string, AbortController>();

  async generate(request: AiGenerationRequestV1): Promise<AiCandidateV1> {
    if (this.active.has(request.projectId)) throw new Error("Для проекта уже выполняется один запрос ИИ.");
    const controller = new AbortController();
    this.active.set(request.projectId, controller);
    try {
      const profile = AI_ENGINE_PROFILES[request.engine];
      const reply = request.settings.provider === "offline"
        ? localAssistant(request.prompt, request.source, request.history.length === 0)
        : await llmAssistant(request.settings, request.history.slice(-6), request.prompt, request.source, controller.signal);
      return { baseSource: request.source, reply, profile };
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
