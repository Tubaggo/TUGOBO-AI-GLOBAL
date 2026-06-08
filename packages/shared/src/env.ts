import { z } from "zod";

// Recognized AI provider names. "mock" is dev-only and rejected in production
// by assertProductionEnv() below.
export const AI_PROVIDER_NAMES = [
  "mock",
  "openai",
  "deepseek",
  "claude",
  "gemini",
] as const;

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Database (Supabase Postgres connection string — server-only)
  DATABASE_URL: z.string().min(1).optional(),

  // AI provider selection
  // TUGOBO_AI_PROVIDER is authoritative; AI_PROVIDER is the legacy fallback.
  TUGOBO_AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).optional(),
  AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().optional(),

  // DeepSeek
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_MODEL: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().optional(),

  // Anthropic / Claude
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().optional(),

  // Google Gemini
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),

  // Meta WhatsApp Cloud API
  META_WHATSAPP_PHONE_ID: z.string().optional(),
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // ManyChat bridge (server-only)
  MANYCHAT_BRIDGE_OUTBOUND_URL: z.string().optional(),
  MANYCHAT_BRIDGE_TOKEN: z.string().optional(),
  MANYCHAT_BRIDGE_SECRET: z.string().optional(),
  MANYCHAT_OUTBOUND_INTERNAL_TOKEN: z.string().optional(),
  MANYCHAT_OUTBOUND_MOCK_MODE: z.string().optional(),
  MANYCHAT_OUTBOUND_API_URL: z.string().optional(),
  MANYCHAT_OUTBOUND_API_TOKEN: z.string().optional(),

  // Inngest
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Langfuse
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().optional(),

  // Resend (transactional email)
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_EMAIL: z.string().optional(),

  // Pilot hotel (live operations)
  PILOT_HOTEL_ID: z.string().optional(),
  NEXT_PUBLIC_PILOT_HOTEL_ID: z.string().optional(),

  // Public contact link
  NEXT_PUBLIC_WHATSAPP_CONTACT: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function normalizeEnv(input: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? undefined : value])
  );
}

function getEnv(): Env {
  const normalized = normalizeEnv(process.env);
  const result = envSchema.safeParse(normalized);

  if (!result.success) {
    console.warn(
      "Environment variables are incomplete or invalid:",
      result.error.flatten().fieldErrors
    );

    const fallback = envSchema.partial().parse(normalized);
    return {
      NODE_ENV: fallback.NODE_ENV ?? "development",
      NEXT_PUBLIC_SUPABASE_URL: fallback.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: fallback.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: fallback.OPENAI_API_KEY,
      OPENAI_MODEL: fallback.OPENAI_MODEL,
      AI_PROVIDER: fallback.AI_PROVIDER,
      DEEPSEEK_MODEL: fallback.DEEPSEEK_MODEL,
      DEEPSEEK_API_KEY: fallback.DEEPSEEK_API_KEY,
      DEEPSEEK_BASE_URL: fallback.DEEPSEEK_BASE_URL,
      TWILIO_ACCOUNT_SID: fallback.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: fallback.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_NUMBER: fallback.TWILIO_WHATSAPP_NUMBER,
      META_WHATSAPP_PHONE_ID: fallback.META_WHATSAPP_PHONE_ID,
      META_WHATSAPP_TOKEN: fallback.META_WHATSAPP_TOKEN,
      META_WHATSAPP_VERIFY_TOKEN: fallback.META_WHATSAPP_VERIFY_TOKEN,
      INNGEST_EVENT_KEY: fallback.INNGEST_EVENT_KEY,
      INNGEST_SIGNING_KEY: fallback.INNGEST_SIGNING_KEY,
      LANGFUSE_PUBLIC_KEY: fallback.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_SECRET_KEY: fallback.LANGFUSE_SECRET_KEY,
      LANGFUSE_HOST: fallback.LANGFUSE_HOST,
      NEXT_PUBLIC_APP_URL: fallback.NEXT_PUBLIC_APP_URL,
    };
  }

  return result.data;
}

export const env = getEnv();

// Variables that MUST be present (non-empty) when NODE_ENV=production.
const PRODUCTION_REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "TUGOBO_AI_PROVIDER",
  "PILOT_HOTEL_ID",
  "NEXT_PUBLIC_PILOT_HOTEL_ID",
] as const;

// Provider → the API key that must accompany it in production.
const PROVIDER_REQUIRED_KEY: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/**
 * Production fail-fast environment guard (DEPLOY-2).
 *
 * In production this throws an aggregated error if the runtime is misconfigured,
 * so a degraded deployment cannot silently appear "healthy". In development and
 * test it is a no-op, keeping local workflows flexible (getEnv() still warns).
 *
 * This function is intentionally side-effect-free at import time — it only runs
 * when explicitly called (see apps/web/instrumentation.ts), so importing this
 * module in edge contexts never throws.
 */
export function assertProductionEnv(source: NodeJS.ProcessEnv = process.env): void {
  const normalized = normalizeEnv(source);

  if (normalized.NODE_ENV !== "production") return;

  const errors: string[] = [];

  for (const key of PRODUCTION_REQUIRED_VARS) {
    if (!normalized[key]) {
      errors.push(`Missing required production env: ${key}`);
    }
  }

  const provider = normalized.TUGOBO_AI_PROVIDER?.toLowerCase();
  if (provider === "mock") {
    errors.push('TUGOBO_AI_PROVIDER="mock" is dev-only and must not be used in production.');
  } else if (provider) {
    const requiredKey = PROVIDER_REQUIRED_KEY[provider];
    if (requiredKey && !normalized[requiredKey]) {
      errors.push(`TUGOBO_AI_PROVIDER="${provider}" requires ${requiredKey} to be set.`);
    }
  }

  const appUrl = normalized.NEXT_PUBLIC_APP_URL;
  if (appUrl && /localhost|127\.0\.0\.1/i.test(appUrl)) {
    errors.push(
      `NEXT_PUBLIC_APP_URL must be the public app URL, not localhost (got "${appUrl}").`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Production environment validation failed:\n - ${errors.join("\n - ")}`
    );
  }
}
