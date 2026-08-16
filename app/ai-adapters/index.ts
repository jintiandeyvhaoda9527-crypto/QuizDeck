import type { AiConfiguration } from "../ai-config";
import type { AiProtocol } from "../ai-providers";
import { openAiCompatibleAdapter } from "./openai-compatible";
import type { AiProviderAdapter } from "./types";

const ADAPTERS: Readonly<Record<AiProtocol, AiProviderAdapter>> = {
  "openai-chat": openAiCompatibleAdapter,
};

export function getAiProviderAdapter(protocol: AiProtocol) {
  return ADAPTERS[protocol];
}

export function createAiProviderClient(config: AiConfiguration) {
  const adapter = getAiProviderAdapter(config.protocol);
  return {
    complete: (
      messages: Parameters<AiProviderAdapter["complete"]>[1],
      options?: Parameters<AiProviderAdapter["complete"]>[2],
    ) => adapter.complete(config, messages, options),
  };
}

export type {
  AiAdapterOptions,
  AiProviderAdapter,
} from "./types";
