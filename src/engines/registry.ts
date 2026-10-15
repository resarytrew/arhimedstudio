import { ArhimedCanvasAdapterV1 } from "./canvas-adapter";
import { ManimGXBrowserAdapterV1 } from "./manimgx-browser-adapter";
import type { EngineAdapterV1, EngineId } from "./contracts";

/** Studio-owned registry. Project files contain an ID, never an adapter URL. */
export class EngineRegistryV1 {
  private readonly adapters = new Map<EngineId, EngineAdapterV1>();

  constructor(adapters: readonly EngineAdapterV1[] = [new ArhimedCanvasAdapterV1(), new ManimGXBrowserAdapterV1(false)]) {
    for (const adapter of adapters) this.adapters.set(adapter.metadata.engineId, adapter);
  }

  get(engineId: EngineId): EngineAdapterV1 | undefined {
    return this.adapters.get(engineId);
  }

  list(): readonly EngineAdapterV1[] {
    return [...this.adapters.values()];
  }
}

export const studioEngineRegistry = new EngineRegistryV1();
