import type { ConversationStage, OperationConversation, SimulatedAiResult } from "./types";
import { STAGE_STATUS_LABELS } from "./channelLabels";
import { localeFromGuestLanguage, op, type OperationalTextKey } from "@/lib/i18n/operationalTexts";
import type { PanelLocale } from "@/lib/i18n/config";

const ANGRY_TERMS =
  /şikayet|kızgın|kizgin|sinir|berbat|rezalet|iade|mağdur|magdur|angry|complaint|terrible|awful/i;

const DATE_TERMS =
  /tarih|temmuz|ağustos|agustos|haziran|eylül|eylul|ekim|aralık|aralik|gece|night|july|august|müsait|musait|oda|room|availability|kişi|kisi|guest/i;

const PRICE_TERMS = /fiyat|ücret|ucret|price|teklif|quote|ne kadar|kaç para|kac para|rate/i;

const PAYMENT_TERMS =
  /ödeme|odeme|payment|link|kart|havale|checkout|pay\s*now/i;

const PAYMENT_FAIL_TERMS =
  /ödeme olmadı|odeme olmadi|link çalışm|link calism|başarısız|basarisiz|failed|hata verdi|ödeyemedim|odeyemedim/i;

const CONFIRM_TERMS = /tamam|onay|ödedim|odedim|confirmed|paid|rezervasyonu onay/i;

function inferStage(text: string, current: ConversationStage): ConversationStage {
  const lower = text.toLocaleLowerCase("tr-TR");

  if (ANGRY_TERMS.test(lower)) return "human_review";
  if (CONFIRM_TERMS.test(lower)) return "confirmed";
  if (PAYMENT_FAIL_TERMS.test(lower)) return "payment_problem";
  if (PAYMENT_TERMS.test(lower)) return "payment_pending";
  if (PRICE_TERMS.test(lower)) return "offer_sent";
  if (DATE_TERMS.test(lower)) {
    return current === "new_inquiry" ? "qualified" : "new_inquiry";
  }

  return current === "new_inquiry" ? "qualified" : current;
}

function buildReply(text: string, stage: ConversationStage, locale: PanelLocale): string {
  const lower = text.toLocaleLowerCase("tr-TR");

  if (stage === "human_review") return op("aiReplyHumanReview", locale);
  if (stage === "confirmed") return op("aiReplyConfirmed", locale);
  if (stage === "payment_problem") return op("aiReplyPaymentProblem", locale);
  if (stage === "payment_pending") return op("aiReplyPaymentPending", locale);
  if (stage === "offer_sent" || PRICE_TERMS.test(lower)) return op("aiReplyOffer", locale);
  if (DATE_TERMS.test(lower)) return op("aiReplyAvailability", locale);

  return op("aiReplyDefault", locale);
}

function operationalEventsForStage(
  prev: ConversationStage,
  next: ConversationStage,
  locale: PanelLocale
): string[] {
  const events: string[] = [];
  if (prev !== next) {
    if (next === "new_inquiry" || next === "qualified") {
      events.push(op("eventRequestReceived", locale));
    }
    if (next === "qualified") {
      events.push(op("eventAiChecking", locale));
    }
    if (next === "offer_sent") {
      events.push(op("eventOfferReady", locale));
    }
    if (next === "payment_pending") {
      events.push(op("eventPaymentLinkSent", locale));
      events.push(op("eventPaymentPending", locale));
    }
    if (next === "payment_problem" || next === "human_review") {
      events.push(op("eventHumanSuggested", locale));
    }
    if (next === "confirmed") {
      events.push(op("eventBookingConfirmed", locale));
    }
  }
  return events;
}

function suggestedAction(
  stage: ConversationStage,
  requiresHuman: boolean,
  locale: PanelLocale
): string {
  if (requiresHuman) return op("suggestedHumanTakeover", locale);
  const map: Record<ConversationStage, OperationalTextKey> = {
    new_inquiry: "actionShareAvailability",
    qualified: "actionShareAvailability",
    offer_sent: "actionConfirmOffer",
    payment_pending: "actionTrackPayment",
    payment_problem: "actionResendPayment",
    confirmed: "actionSendConfirmation",
    human_review: "actionStaffGreet",
  };
  return op(map[stage], locale);
}

function bookingValueForStage(stage: ConversationStage): number | undefined {
  if (stage === "offer_sent") return 12500;
  if (stage === "payment_pending" || stage === "payment_problem") return 14800;
  if (stage === "confirmed") return 14800;
  return undefined;
}

export function simulateAIResponse(
  message: string,
  conversation: Pick<OperationConversation, "stage" | "guestName" | "channel" | "language">
): SimulatedAiResult {
  const guestLocale = localeFromGuestLanguage(conversation.language);
  const operationalLocale: PanelLocale = "tr";
  const stage = inferStage(message, conversation.stage);
  const requiresHuman = stage === "human_review" || stage === "payment_problem";
  const replyText = buildReply(message, stage, guestLocale);
  const operationalEvents = operationalEventsForStage(conversation.stage, stage, operationalLocale);
  const bookingValue = bookingValueForStage(stage);

  return {
    replyText,
    stage,
    statusLabel: STAGE_STATUS_LABELS[stage],
    suggestedAction: suggestedAction(stage, requiresHuman, operationalLocale),
    requiresHuman,
    aiStatus: requiresHuman ? "waiting_staff" : stage === "qualified" ? "checking" : "replying",
    operationalEvents,
    bookingValue,
    paymentLinkSent: stage === "payment_pending",
    roomSuggestion: stage === "offer_sent" ? "Superior Çift Oda" : undefined,
  };
}
