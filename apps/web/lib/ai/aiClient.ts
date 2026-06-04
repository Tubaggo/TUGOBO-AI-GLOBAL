import {
  buildHotelAssistantSystemPrompt,
  buildHotelAssistantUserPayload,
} from "./prompts/hotelAssistantPrompt";
import { parseAssistantResponse, buildFallbackResponse } from "./guards";
import { logAiAudit } from "./audit";
import type {
  AiProviderName,
  AiRespondRequest,
  AiRespondResult,
  HotelAssistantResponse,
} from "./types";
import {
  completeWithOpenAI,
  isOpenAiConfigured,
  type ProviderCompletionInput,
} from "./providers/openai";
import { completeWithDeepSeek, isDeepSeekConfigured } from "./providers/deepseek";
import { completeWithClaude, isClaudeConfigured } from "./providers/claude";
import { completeWithGemini, isGeminiConfigured } from "./providers/gemini";
import { completeWithMock } from "./providers/mock-provider";

type AiEnvConfig = {
  // TUGOBO_AI_PROVIDER takes precedence; AI_PROVIDER is the legacy fallback.
  provider: AiProviderName;
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

export function resolveAiEnv(): AiEnvConfig {
  // TUGOBO_AI_PROVIDER is the canonical variable; AI_PROVIDER kept for backward compat.
  const rawProvider = (
    process.env.TUGOBO_AI_PROVIDER ?? process.env.AI_PROVIDER
  )?.toLowerCase();

  const provider: AiProviderName =
    rawProvider === "mock"
      ? "mock"
      : rawProvider === "deepseek"
        ? "deepseek"
        : rawProvider === "claude"
          ? "claude"
          : rawProvider === "gemini"
            ? "gemini"
            : "openai";

  return {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  };
}

function pickProvider(config: AiEnvConfig): AiProviderName | null {
  if (config.provider === "mock") return "mock";
  if (config.provider === "deepseek" && isDeepSeekConfigured(config.deepseekApiKey))
    return "deepseek";
  if (config.provider === "claude" && isClaudeConfigured(config.anthropicApiKey))
    return "claude";
  if (config.provider === "gemini" && isGeminiConfigured(config.geminiApiKey))
    return "gemini";
  // Fallback chain for real providers when preferred is not configured.
  if (isOpenAiConfigured(config.openaiApiKey)) return "openai";
  if (isDeepSeekConfigured(config.deepseekApiKey)) return "deepseek";
  if (isClaudeConfigured(config.anthropicApiKey)) return "claude";
  if (isGeminiConfigured(config.geminiApiKey)) return "gemini";
  return null;
}

async function runCompletion(
  provider: AiProviderName,
  input: ProviderCompletionInput,
  config: AiEnvConfig
) {
  if (provider === "mock") {
    return completeWithMock(input);
  }
  if (provider === "deepseek") {
    if (!config.deepseekApiKey) throw new Error("deepseek_not_configured");
    return completeWithDeepSeek(
      input,
      config.deepseekApiKey,
      config.deepseekModel,
      config.deepseekBaseUrl
    );
  }
  if (provider === "claude") {
    if (!config.anthropicApiKey) throw new Error("claude_not_configured");
    return completeWithClaude(input, config.anthropicApiKey, config.anthropicModel);
  }
  if (provider === "gemini") {
    if (!config.geminiApiKey) throw new Error("gemini_not_configured");
    return completeWithGemini(input, config.geminiApiKey, config.geminiModel);
  }
  // Default: openai
  if (!config.openaiApiKey) throw new Error("openai_not_configured");
  return completeWithOpenAI(input, config.openaiApiKey, config.openaiModel);
}

export async function generateHotelAssistantResponse(
  request: AiRespondRequest
): Promise<AiRespondResult> {
  const started = Date.now();
  const config = resolveAiEnv();
  const provider = pickProvider(config);

  if (!provider) {
    const fallback = buildFallbackResponse(request.mode, request.guest?.language ?? "tr");
    return { ok: false, error: "provider_unavailable", fallback };
  }

  const system = buildHotelAssistantSystemPrompt(request.mode, request);
  const user = buildHotelAssistantUserPayload(request);

  try {
    const completion = await runCompletion(provider, { system, user }, config);
    const parsed = parseAssistantResponse(completion.raw);

    if (!parsed) {
      const fallback = buildFallbackResponse(request.mode, request.guest?.language ?? "tr");
      return { ok: false, error: "parse_failed", fallback };
    }

    const data: HotelAssistantResponse = parsed;
    const processingMs = Date.now() - started;

    logAiAudit({
      request,
      response: data,
      provider: completion.provider,
      model: completion.model,
      processingMs,
    });

    return {
      ok: true,
      data,
      meta: {
        provider: completion.provider,
        model: completion.model,
        mode: request.mode,
        processingMs,
      },
    };
  } catch (e) {
    console.error("[AI_CLIENT] completion_failed", {
      message: e instanceof Error ? e.message : String(e),
      provider,
    });
    const fallback = buildFallbackResponse(request.mode, request.guest?.language ?? "tr");
    return { ok: false, error: "exception", fallback };
  }
}
