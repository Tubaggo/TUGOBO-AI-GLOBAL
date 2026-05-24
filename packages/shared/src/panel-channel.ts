/** UI / panel channel identifiers (distinct from provider ChannelType). */
export type PanelChannelType = "web_chat" | "whatsapp" | "instagram" | "manual";

export type MessageRole = "guest" | "ai" | "staff" | "system";

export type MessageDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type EscalationState =
  | "none"
  | "suggested"
  | "active"
  | "resolved";

export type ConversationReservationState =
  | "none"
  | "inquiry"
  | "quoted"
  | "payment_pending"
  | "confirmed"
  | "cancelled";

export type ConversationPaymentState =
  | "none"
  | "pending"
  | "failed"
  | "completed";

export type ReservationLifecycleState =
  | "inquiry_received"
  | "quote_prepared"
  | "quote_sent"
  | "payment_link_sent"
  | "payment_pending"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "human_review_required";

export type ReservationLifecycleActor = "guest" | "ai" | "operator" | "system";

export type ReservationLifecycleSeverity = "info" | "success" | "warning" | "error";
