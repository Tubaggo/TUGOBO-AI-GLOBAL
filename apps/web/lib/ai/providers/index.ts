import type { AiProviderName } from "../types";
import {
  completeWithOpenAI,
  isOpenAiConfigured,
  type ProviderCompletionInput,
  type ProviderCompletionResult,
} from "./openai";
import { completeWithDeepSeek, isDeepSeekConfigured } from "./deepseek";
import { completeWithClaude, isClaudeConfigured } from "./claude";
import { completeWithGemini, isGeminiConfigured } from "./gemini";
import { completeWithMock, isMockConfigured } from "./mock-provider";

export type { ProviderCompletionInput, ProviderCompletionResult };

export type ProviderAdapter = {
  name: AiProviderName;
  isConfigured: () => boolean;
  complete: (
    input: ProviderCompletionInput,
    config: ProviderRuntimeConfig
  ) => Promise<ProviderCompletionResult>;
};

export type ProviderRuntimeConfig = {
  openaiApiKey?: string;
  openaiModel: string;
  deepseekApiKey?: string;
  deepseekModel: string;
  deepseekBaseUrl?: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  geminiApiKey?: string;
  geminiModel: string;
};

export const providerAdapters: ProviderAdapter[] = [
  {
    name: "mock",
    isConfigured: () => isMockConfigured(),
    complete: (input) => completeWithMock(input),
  },
  {
    name: "openai",
    isConfigured: () => isOpenAiConfigured(process.env.OPENAI_API_KEY),
    complete: (input, config) =>
      completeWithOpenAI(input, config.openaiApiKey!, config.openaiModel),
  },
  {
    name: "deepseek",
    isConfigured: () => isDeepSeekConfigured(process.env.DEEPSEEK_API_KEY),
    complete: (input, config) =>
      completeWithDeepSeek(
        input,
        config.deepseekApiKey!,
        config.deepseekModel,
        config.deepseekBaseUrl
      ),
  },
  {
    name: "claude",
    isConfigured: () => isClaudeConfigured(process.env.ANTHROPIC_API_KEY),
    complete: (input, config) =>
      completeWithClaude(input, config.anthropicApiKey!, config.anthropicModel),
  },
  {
    name: "gemini",
    isConfigured: () => isGeminiConfigured(process.env.GEMINI_API_KEY),
    complete: (input, config) =>
      completeWithGemini(input, config.geminiApiKey!, config.geminiModel),
  },
];

// Resolves the best available provider given an optional preference.
// Preference order: preferred → configured fallbacks → null.
// "mock" is always considered configured; real providers require API keys.
export function resolveConfiguredProvider(
  preferred: string | undefined
): ProviderAdapter | null {
  const order: AiProviderName[] =
    preferred === "mock"
      ? ["mock"]
      : preferred === "deepseek"
        ? ["deepseek", "openai", "claude", "gemini"]
        : preferred === "claude"
          ? ["claude", "openai", "deepseek", "gemini"]
          : preferred === "gemini"
            ? ["gemini", "openai", "deepseek", "claude"]
            : preferred === "openai"
              ? ["openai", "deepseek", "claude", "gemini"]
              : ["openai", "deepseek", "claude", "gemini"];

  for (const name of order) {
    const adapter = providerAdapters.find((a) => a.name === name);
    if (adapter?.isConfigured()) return adapter;
  }
  return providerAdapters.find((a) => a.name !== "mock" && a.isConfigured()) ?? null;
}
