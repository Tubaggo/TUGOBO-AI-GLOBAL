import type {
  ConnectedChannelProvider,
  ConversationPaymentState,
  ConversationReservationState,
  EscalationState,
  MessageDeliveryStatus,
  PanelChannelType,
  ReservationLifecycleActor,
  ReservationLifecycleSeverity,
  ReservationLifecycleState,
} from "@tugobo/shared";
import type { ConversationStage, MessageSender } from "@/lib/channels/types";

/** Central conversation model for live operations (panel + API). */
export type LiveConversation = {
  id: string;
  hotelId: string;
  guestName: string;
  guestPhone?: string;
  language?: string;
  channel: PanelChannelType;
  status: "ai_active" | "human_takeover" | "resolved" | "open";
  stage: ConversationStage;
  statusLabel: string;
  assignedOperatorId?: string;
  aiActive: boolean;
  aiPaused: boolean;
  escalationState: EscalationState;
  reservationState: ConversationReservationState;
  paymentState: ConversationPaymentState;
  unreadCount: number;
  lastMessage: string;
  lastActivityAt: string;
  externalSessionId?: string;
  bookingValue?: number;
  reservation?: LiveReservationSummary;
  latestLifecycleEvent?: ReservationLifecycleEvent;
  aiSuggestion?: ReservationAiSuggestion;
  requiresHuman: boolean;
  operatorJoinedAt?: string;
};

export type ReservationLifecycleEvent = {
  id: string;
  hotel_id: string;
  conversation_id: string;
  reservation_id?: string;
  state: ReservationLifecycleState;
  title: string;
  description: string;
  timestamp: string;
  actor: ReservationLifecycleActor;
  severity: ReservationLifecycleSeverity;
};

export type ReservationAiSuggestion = {
  nextReply?: string;
  suggestedAction: "next_reply" | "payment_follow_up" | "human_takeover";
  label: string;
};

export type LiveReservationSummary = {
  id: string;
  ref?: string;
  roomType?: string;
  checkIn?: string;
  checkOut?: string;
  guestCount?: number;
  totalAmount?: number;
  currency: string;
  status: "confirmed" | "pending_payment" | "quoted" | "cancelled";
};

export type LiveMessage = {
  id: string;
  conversationId: string;
  role: MessageSender;
  content: string;
  timestamp: string;
  deliveryStatus: MessageDeliveryStatus;
  aiGenerated: boolean;
  humanOverride: boolean;
  channel?: PanelChannelType;
  provider?: ConnectedChannelProvider;
};

export type TakeoverAction = "takeover" | "release_to_ai";

export type IngestLiveMessageInput = {
  channel: PanelChannelType;
  guestName: string;
  message: string;
  externalSessionId?: string;
  conversationId?: string;
  guestPhone?: string;
  language?: string;
};
