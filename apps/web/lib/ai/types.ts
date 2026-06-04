import { z } from "zod";

export const AI_INTENTS = [
  "reservation_inquiry",
  "quote_request",
  "availability_question",
  "payment_question",
  "payment_failed",
  "cancellation_request",
  "complaint",
  "checkin_question",
  "upsell_opportunity",
  "human_help_request",
  "unclear",
] as const;

export type AiIntent = (typeof AI_INTENTS)[number];

export const AI_RESERVATION_STAGES = [
  "new_inquiry",
  "qualified",
  "offer_sent",
  "payment_pending",
  "payment_problem",
  "confirmed",
  "human_review",
] as const;

export type AiReservationStage = (typeof AI_RESERVATION_STAGES)[number];

export const AI_SUGGESTED_ACTIONS = [
  "check_availability",
  "prepare_quote",
  "send_payment_link",
  "follow_up_payment",
  "escalate_to_human",
  "answer_faq",
  "confirm_booking_status",
  "none",
] as const;

export type AiSuggestedAction = (typeof AI_SUGGESTED_ACTIONS)[number];

export const AI_PAYMENT_STATUSES = [
  "not_applicable",
  "pending",
  "failed",
  "completed",
  "unknown",
] as const;

export type AiPaymentStatus = (typeof AI_PAYMENT_STATUSES)[number];

export type AiProviderName = "openai" | "deepseek" | "claude" | "gemini" | "mock";

export type AiOperationMode = "demo" | "live";

export type AiProcessingStatus =
  | "idle"
  | "checking"
  | "preparing_offer"
  | "tracking_payment"
  | "awaiting_approval"
  | "human_recommended"
  | "human_active"
  | "error";

export const guestContextSchema = z.object({
  name: z.string().optional(),
  language: z.string().optional(),
  isVip: z.boolean().optional(),
  priorStays: z.number().optional(),
  notes: z.string().optional(),
});

export const reservationContextSchema = z.object({
  stage: z.enum(AI_RESERVATION_STAGES).optional(),
  roomType: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.number().optional(),
  totalAmount: z.number().optional(),
  currency: z.string().optional(),
  paymentStatus: z.enum(AI_PAYMENT_STATUSES).optional(),
  ref: z.string().optional(),
});

export const hotelPolicySchema = z.object({
  hotelName: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  paymentPolicy: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
});

export const aiRespondRequestSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1).max(4000),
  guest: guestContextSchema.optional(),
  reservationContext: reservationContextSchema.optional(),
  hotelPolicy: hotelPolicySchema.optional(),
  mode: z.enum(["demo", "live"]).default("demo"),
  recentMessages: z
    .array(
      z.object({
        role: z.enum(["guest", "staff", "ai"]),
        content: z.string(),
      })
    )
    .max(12)
    .optional(),
});

export type AiRespondRequest = z.infer<typeof aiRespondRequestSchema>;

export const hotelAssistantResponseSchema = z.object({
  reply: z.string().min(1),
  intent: z.enum(AI_INTENTS),
  reservationStage: z.enum(AI_RESERVATION_STAGES),
  confidence: z.number().min(0).max(1),
  requiresHuman: z.boolean(),
  suggestedAction: z.enum(AI_SUGGESTED_ACTIONS),
  riskSignals: z.array(z.string()).max(8),
  paymentStatus: z.enum(AI_PAYMENT_STATUSES),
  guestSummary: z.string().max(500),
  language: z.string().max(8),
});

export type HotelAssistantResponse = z.infer<typeof hotelAssistantResponseSchema>;

export type AiRespondSuccess = {
  ok: true;
  data: HotelAssistantResponse;
  meta: {
    provider: AiProviderName;
    model: string;
    mode: AiOperationMode;
    processingMs: number;
  };
};

export type AiRespondError = {
  ok: false;
  error: "invalid_body" | "provider_unavailable" | "upstream" | "parse_failed" | "exception";
  fallback?: HotelAssistantResponse;
};

export type AiRespondResult = AiRespondSuccess | AiRespondError;

export type ConversationAiState = {
  status: AiProcessingStatus;
  statusLabel: string;
  lastResponse: HotelAssistantResponse | null;
  lastError: string | null;
  requiresHuman: boolean;
  confidence: number | null;
  intent: AiIntent | null;
  reservationStage: AiReservationStage | null;
  suggestedAction: AiSuggestedAction | null;
  guestSummary: string | null;
  paymentStatus: AiPaymentStatus | null;
  riskSignals: string[];
  updatedAt: number | null;
};

export const INITIAL_CONVERSATION_AI_STATE: ConversationAiState = {
  status: "idle",
  statusLabel: "",
  lastResponse: null,
  lastError: null,
  requiresHuman: false,
  confidence: null,
  intent: null,
  reservationStage: null,
  suggestedAction: null,
  guestSummary: null,
  paymentStatus: null,
  riskSignals: [],
  updatedAt: null,
};
