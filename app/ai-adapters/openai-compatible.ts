import {
  createOpenAiCompatibleClient,
  testAiConnection,
} from "../ai-client";
import { discoverOpenAiModels } from "../ai-model-discovery";
import type { AiProviderAdapter } from "./types";

export const openAiCompatibleAdapter: AiProviderAdapter = {
  listModels(config, options = {}) {
    return discoverOpenAiModels(config, options);
  },
  testModel(config, options = {}) {
    const client = createOpenAiCompatibleClient(
      config,
      options.transport,
    );
    return testAiConnection(client, { signal: options.signal });
  },
  complete(config, messages, options = {}) {
    const { transport, ...completionOptions } = options;
    return createOpenAiCompatibleClient(config, transport).complete(
      messages,
      completionOptions,
    );
  },
};
