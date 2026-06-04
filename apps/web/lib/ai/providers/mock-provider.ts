import type { ProviderCompletionInput, ProviderCompletionResult } from "./openai";
import type { HotelAssistantResponse } from "../types";

// AI-1 Sprint: Mock provider for safe dev/demo use without real API keys.
// Deterministic — same input pattern yields the same response category.
// Never call external services. Always succeeds. Safe to use in any environment.

type MockScenario = "reservation" | "payment" | "cancellation" | "complaint" | "default";

function detectScenario(userText: string): MockScenario {
  const t = userText.toLowerCase();
  if (t.includes("iptal") || t.includes("cancel")) return "cancellation";
  if (t.includes("şikayet") || t.includes("sorun") || t.includes("complaint")) return "complaint";
  if (t.includes("ödeme") || t.includes("payment") || t.includes("fiyat") || t.includes("price")) return "payment";
  if (
    t.includes("rezervasyon") ||
    t.includes("oda") ||
    t.includes("room") ||
    t.includes("book") ||
    t.includes("gecel")
  )
    return "reservation";
  return "default";
}

const MOCK_RESPONSES: Record<MockScenario, HotelAssistantResponse> = {
  reservation: {
    reply:
      "Rezervasyon talebinizi aldım. Müsaitlik durumunu kontrol edip en kısa sürede size dönüş yapacağım.",
    intent: "reservation_inquiry",
    reservationStage: "new_inquiry",
    confidence: 0.78,
    requiresHuman: false,
    suggestedAction: "check_availability",
    riskSignals: [],
    paymentStatus: "not_applicable",
    guestSummary: "Misafir rezervasyon talebi iletti. Müsaitlik kontrol gerekiyor.",
    language: "tr",
  },
  payment: {
    reply:
      "Ödeme işleminizle ilgili ekibimiz kısa süre içinde size yardımcı olacak. Lütfen bekleyin.",
    intent: "payment_question",
    reservationStage: "payment_pending",
    confidence: 0.72,
    requiresHuman: false,
    suggestedAction: "follow_up_payment",
    riskSignals: [],
    paymentStatus: "pending",
    guestSummary: "Misafir ödeme konusunda bilgi istiyor.",
    language: "tr",
  },
  cancellation: {
    reply:
      "İptal talebinizi aldım. Rezervasyon politikamızı kontrol etmem gerekiyor — ekibim en kısa sürede size dönecek.",
    intent: "cancellation_request",
    reservationStage: "human_review",
    confidence: 0.55,
    requiresHuman: true,
    suggestedAction: "escalate_to_human",
    riskSignals: ["cancellation_request"],
    paymentStatus: "unknown",
    guestSummary: "Misafir iptal talebi iletti. İnsan desteği gerekiyor.",
    language: "tr",
  },
  complaint: {
    reply:
      "Yaşadığınız durumu duyduğuma üzüldüm. Ekibimiz en kısa sürede sizinle ilgilenecek.",
    intent: "complaint",
    reservationStage: "human_review",
    confidence: 0.45,
    requiresHuman: true,
    suggestedAction: "escalate_to_human",
    riskSignals: ["guest_complaint"],
    paymentStatus: "unknown",
    guestSummary: "Misafir şikayet bildirdi. İnsan müdahalesi önerilir.",
    language: "tr",
  },
  default: {
    reply:
      "Mesajınızı aldım. Size nasıl yardımcı olabileceğimi hemen kontrol ediyorum.",
    intent: "unclear",
    reservationStage: "new_inquiry",
    confidence: 0.65,
    requiresHuman: false,
    suggestedAction: "check_availability",
    riskSignals: [],
    paymentStatus: "not_applicable",
    guestSummary: "Misafir genel bir mesaj gönderdi.",
    language: "tr",
  },
};

export async function completeWithMock(
  input: ProviderCompletionInput
): Promise<ProviderCompletionResult> {
  const scenario = detectScenario(input.user);
  const response = MOCK_RESPONSES[scenario];

  // Fixed 80ms latency — deterministic, not random.
  await new Promise((resolve) => setTimeout(resolve, 80));

  return {
    raw: JSON.stringify(response),
    provider: "mock",
    model: "tugobo-mock-v1",
  };
}

export function isMockConfigured(): boolean {
  return true;
}
