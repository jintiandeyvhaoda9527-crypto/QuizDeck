import type {
  AiChatMessage,
  AiCompletionOptions,
  AiConnectionTestResult,
} from "../ai-client";
import type {
  AiConfiguration,
  AiConnectionInput,
} from "../ai-config";
import type { AiModelDiscoveryResult } from "../ai-model-discovery";
import type { AiHttpTransport } from "../ai-transport";

export interface AiAdapterOptions {
  signal?: AbortSignal;
  transport?: AiHttpTransport;
}

export interface AiProviderAdapter {
  listModels(
    config: AiConnectionInput,
    options?: AiAdapterOptions,
  ): Promise<AiModelDiscoveryResult>;
  testModel(
    config: AiConfiguration,
    options?: AiAdapterOptions,
  ): Promise<AiConnectionTestResult>;
  complete(
    config: AiConfiguration,
    messages: readonly AiChatMessage[],
    options?: AiCompletionOptions & Pick<AiAdapterOptions, "transport">,
  ): Promise<string>;
}
