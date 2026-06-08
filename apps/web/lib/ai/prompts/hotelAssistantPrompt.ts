import { HOTEL_OPERATIONS_ASSISTANT_V1 } from "@tugobo/core/prompts";
import type { AiOperationMode, AiRespondRequest } from "../types";

// Maps a BCP-47-ish language code (case-insensitive) to its English language
// name. Used to turn the detected `guest.language` code into an explicit,
// authoritative reply-language directive in the system prompt. Region suffixes
// (e.g. "en-GB", "pt_BR") are normalized to the base code before lookup.
const LANGUAGE_NAMES: Record<string, string> = {
  tr: "Turkish",
  en: "English",
  ru: "Russian",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
};

function resolveLanguageName(language: string | undefined): string | null {
  if (!language) return null;
  const base = language.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return LANGUAGE_NAMES[base] ?? null;
}

function buildLanguageDirective(language: string | undefined): string {
  const name = resolveLanguageName(language);

  if (!name) {
    // No recognized code → keep the prior heuristic behavior.
    return "Reply in the guest's language when clear; default Turkish if unclear.";
  }

  return [
    `Guest language: ${name}.`,
    `You MUST write the reply field in ${name}.`,
    `guestSummary must remain Turkish for hotel staff.`,
  ].join("\n");
}

export function buildHotelAssistantSystemPrompt(
  mode: AiOperationMode,
  ctx: Pick<AiRespondRequest, "guest" | "reservationContext" | "hotelPolicy">
): string {
  const hotelName = ctx.hotelPolicy?.hotelName ?? "otel";
  const base = HOTEL_OPERATIONS_ASSISTANT_V1(hotelName, mode);
  const languageDirective = buildLanguageDirective(ctx.guest?.language);

  return `
${base}

You are NOT a generic chatbot. You assist the hotel team; humans keep authority.

Tone: warm, concise, professional, Turkish hospitality-native, helpful, non-robotic.
${languageDirective}

You help with:
- answering guest questions
- reservation intent detection
- offer preparation guidance
- payment follow-up
- human takeover recommendations
- guest context summaries
- urgency identification

Avoid: long explanations, technical AI language, over-promising, fake certainty, legal/financial claims.

SAFETY — never:
- invent availability/prices in live mode
- promise refunds
- override hotel policy
- confirm reservation without payment/approval
- give legal or medical advice

When unsure, use phrases like:
- "Müsaitlik durumunu kontrol etmem gerekiyor."
- "Bu konuda ekibimizin onayı gerekli."
- "Ödeme durumunu kontrol edip size yardımcı olayım."

Recommend human takeover (requiresHuman: true) when:
- guest is angry, asks for exception, cancellation dispute, refund request
- repeated payment failure, VIP guest, low confidence (<0.6), unclear policy
- high-value booking, accessibility/dietary special needs, legal/sensitive issues

OUTPUT: respond with a single JSON object only (no markdown), matching this schema:
{
  "reply": "guest-facing message",
  "intent": one of: reservation_inquiry, quote_request, availability_question, payment_question, payment_failed, cancellation_request, complaint, checkin_question, upsell_opportunity, human_help_request, unclear,
  "reservationStage": one of: new_inquiry, qualified, offer_sent, payment_pending, payment_problem, confirmed, human_review,
  "confidence": 0.0-1.0,
  "requiresHuman": boolean,
  "suggestedAction": one of: check_availability, prepare_quote, send_payment_link, follow_up_payment, escalate_to_human, answer_faq, confirm_booking_status, none,
  "riskSignals": string[],
  "paymentStatus": one of: not_applicable, pending, failed, completed, unknown,
  "guestSummary": "short staff-facing summary in Turkish",
  "language": "tr" | "en" | etc.
}

Keep reply under 4 sentences unless guest needs detail.
`.trim();
}

export function buildHotelAssistantUserPayload(req: AiRespondRequest): string {
  const parts: string[] = [
    `Conversation: ${req.conversationId}`,
    `Mode: ${req.mode}`,
    `Guest message: ${req.message}`,
  ];

  if (req.guest) {
    parts.push(`Guest context: ${JSON.stringify(req.guest)}`);
  }
  if (req.reservationContext) {
    parts.push(`Reservation context: ${JSON.stringify(req.reservationContext)}`);
  }
  if (req.hotelPolicy) {
    parts.push(`Hotel policy: ${JSON.stringify(req.hotelPolicy)}`);
  }
  if (req.recentMessages?.length) {
    parts.push(
      `Recent messages:\n${req.recentMessages
        .map((m) => `[${m.role}] ${m.content}`)
        .join("\n")}`
    );
  }

  return parts.join("\n\n");
}
