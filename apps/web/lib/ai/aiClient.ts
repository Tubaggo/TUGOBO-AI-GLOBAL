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
import { getActiveTugoboProvider } from "./provider-registry";
import type { ProviderRuntimeConfig } from "./providers";

type AiEnvConfig = ProviderRuntimeConfig & {
  // TUGOBO_AI_PROVIDER takes precedence; AI_PROVIDER is the legacy fallback.
  provider: AiProviderName;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;

export function resolveAiEnv(): AiEnvConfig {
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function generateHotelAssistantResponse(
  request: AiRespondRequest
): Promise<AiRespondResult> {
  const started = Date.now();
  const config = resolveAiEnv();
  const adapter = getActiveTugoboProvider();

  if (!adapter) {
    const fallback = buildFallbackResponse(request.mode, request.guest?.language ?? "tr");
    return { ok: false, error: "provider_unavailable", fallback };
  }

  const system = buildHotelAssistantSystemPrompt(request.mode, request);
  const user = buildHotelAssistantUserPayload(request);

  try {
    const completion = await withTimeout(
      adapter.complete({ system, user }, config),
      DEFAULT_PROVIDER_TIMEOUT_MS,
      adapter.name
    );
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
      provider: adapter.name,
    });
    const fallback = buildFallbackResponse(request.mode, request.guest?.language ?? "tr");
    return { ok: false, error: "exception", fallback };
  }
}
