// AI-1 Sprint: Provider Registry
//
// This module is the single integration point between the TUGOBO runtime and
// the AI provider layer. Import from here — not from individual provider files.
//
// Current state (AI-1): Infrastructure only. The registry resolves the active
// provider based on ENV but is NOT yet wired into the conversation flow.
//
// TODO (AI-2 Sprint): Call getActiveTugoboProvider() inside the conversation
// response pipeline to replace the direct generateHotelAssistantResponse() call
// with a provider-aware response loop.

import { resolveConfiguredProvider, type ProviderAdapter } from "./providers";
import type { AiProviderName } from "./types";

export type TugoboProviderInfo = {
  id: AiProviderName | "none";
  isReal: boolean;
  isMock: boolean;
  isAvailable: boolean;
};

// Returns the active provider adapter based on TUGOBO_AI_PROVIDER env var.
// Falls back to AI_PROVIDER for backward compatibility.
// Returns null only when no provider is configured AND mock is not selected.
export function getActiveTugoboProvider(): ProviderAdapter | null {
  const preferred =
    process.env.TUGOBO_AI_PROVIDER?.toLowerCase() ??
    process.env.AI_PROVIDER?.toLowerCase();
  return resolveConfiguredProvider(preferred);
}

// Describes the active provider without executing it. Safe to call anywhere.
export function describeTugoboProvider(): TugoboProviderInfo {
  const provider = getActiveTugoboProvider();
  if (!provider) {
    return { id: "none", isReal: false, isMock: false, isAvailable: false };
  }
  return {
    id: provider.name,
    isReal: provider.name !== "mock",
    isMock: provider.name === "mock",
    isAvailable: true,
  };
}

// Checks whether a real (non-mock) AI provider is ready to handle live requests.
// Use this guard before enabling AI-driven conversation replies.
export function isRealProviderReady(): boolean {
  const info = describeTugoboProvider();
  return info.isReal && info.isAvailable;
}
