import type { ProviderCompletionInput, ProviderCompletionResult } from "./openai";

export function isGeminiConfigured(apiKey: string | undefined): boolean {
  return Boolean(apiKey?.trim());
}

/** Google Gemini generateContent adapter (streaming-ready; buffered response). */
export async function completeWithGemini(
  input: ProviderCompletionInput,
  apiKey: string,
  model: string
): Promise<ProviderCompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    throw new Error(`gemini_upstream_${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error("empty_gemini_completion");

  return { raw, provider: "gemini", model: `gemini:${model}` };
}
