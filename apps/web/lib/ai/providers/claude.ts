import type { ProviderCompletionInput, ProviderCompletionResult } from "./openai";

export function isClaudeConfigured(apiKey: string | undefined): boolean {
  return Boolean(apiKey?.trim());
}

/**
 * Anthropic Messages API adapter (streaming-ready structure; completion is buffered).
 */
export async function completeWithClaude(
  input: ProviderCompletionInput,
  apiKey: string,
  model: string
): Promise<ProviderCompletionResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });

  if (!res.ok) {
    throw new Error(`claude_upstream_${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const raw = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!raw) throw new Error("empty_claude_completion");

  return { raw, provider: "claude", model: `claude:${model}` };
}
