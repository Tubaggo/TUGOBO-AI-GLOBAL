"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  Bot,
  UserCheck,
  Phone,
  Clock,
  CalendarDays,
  Users,
  Moon,
  ExternalLink,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  Zap,
  User,
  CreditCard,
  TrendingUp,
  MessageSquare,
  Inbox,
  CalendarCheck,
  Banknote,
  ShieldCheck,
  ArrowUpRight,
  AlertTriangle,
  Sparkles,
  CheckCheck,
  RefreshCw,
  ChevronLeft,
  PanelRight,
} from "lucide-react";
import {
  ConversationsMobileTabs,
  type ConversationsMobilePane,
} from "../_components/conversations-mobile-tabs";
import { MobileQuickActions } from "../_components/mobile-quick-actions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CONVERSATIONS,
  type Conversation,
  type ConversationChannel,
  type LeadStatus,
  type ConversationStatus,
} from "../_components/mock-data";
import {
  CHAT_THREADS,
  type ChatMsg,
  type ConvReservation,
  type ChatThread,
} from "../_components/chat-threads";
import { StatusBadge, LeadBadge, LanguageFlag } from "../_components/badges";
import { MessageRow, ChatTypingIndicator } from "@/app/dashboard/_components/chat";
import { cn } from "@/lib/utils";
import {
  useLivePanelOverlay,
  type LiveConvOverlay,
  type LiveQueueStats,
} from "@/lib/panel/use-live-panel-overlay";
import {
  aiReservationStageLabel,
  confidencePercent,
  suggestedActionLabel,
} from "@/lib/ai/confidence";
import { useConversationAi } from "@/lib/ai/use-guest-ai-response";
import { useConversationAiStore } from "@/lib/stores/conversation-ai-store";
import { simulateAIResponse } from "@/lib/channels/simulate-ai-response";
import { stageLabel } from "@/lib/channels/channelLabels";
import type {
  ChannelType,
  OperationConversation,
  OperationMessage,
  OperationReservationSummary,
} from "@/lib/channels/types";
import { useOperationConversationStore } from "@/lib/stores/operation-conversation-store";
import { useOperationConversationsPanel } from "@/lib/panel/use-operation-conversations";
import { ChannelBadge, ChannelGlyph, channelDisplayLabel } from "../_components/channel-badge";
import { ChannelFilters } from "../_components/channel-filters";
import { DemoIncomingSimulator } from "../_components/demo-incoming-simulator";
import { DemoOrchestrationPanel } from "../_components/demo-orchestration-panel";
import { OperationalEmptyState } from "../_components/operational-empty-state";
import {
  ConversationSkeleton,
  QueueSkeleton,
  SummaryCardSkeleton,
} from "../_components/skeletons";
import { usePanelStagedLoad } from "@/lib/panel/use-panel-staged-load";
import type { AiTypingPhase } from "@/app/dashboard/_components/chat";
import { op } from "@/lib/i18n/operationalTexts";
import { useLiveConversationSync } from "@/lib/realtime";
import { useLiveConversationApi } from "@/lib/runtime/live";
import { isLiveConversationId } from "@/lib/conversation/live-sync";

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = "all" | ConversationStatus;

const TABS: { id: Tab; label: string; count: number }[] = [
  { id: "all", label: "Tümü", count: 8 },
  { id: "ai_active", label: "AI", count: 4 },
  { id: "human_takeover", label: "Bekleyen", count: 2 },
  { id: "resolved", label: "Kapandı", count: 2 },
];

const CONV_REVENUE: Record<string, { value: string; status: "confirmed" | "pending" | "quoted" }> = {
  c2: { value: "€780", status: "pending" },
  c4: { value: "$850", status: "confirmed" },
  c5: { value: "€650", status: "quoted" },
  c6: { value: "$850", status: "confirmed" },
  c8: { value: "$1,200", status: "confirmed" },
};

// AI message when resuming after staff hand-back — contextual, language-matched
const AI_RESUME: Record<string, string> = {
  c1: "Ahmet Bey, görüşmeyi yeniden devralıyorum! Superior Oda rezervasyonunuzu oluşturmaya hazırım — devam edelim mi? 😊",
  c2: "Hans, I've picked up the conversation! Your Triple Room Premium reservation is still on hold — shall I resend the secure payment link?",
  c3: "Добрый день, Елена! Я снова на связи. Давайте подберём для вас идеальный номер с учётом всех ваших пожеланий. 🌟",
  c4: "Hello Sarah! I've resumed the conversation. Your Deluxe Suite is confirmed for June 15. Is there anything else I can help you with?",
  c5: "Ciao Giulia! Riprendo la conversazione. La Camera Doppia Superior è ancora disponibile per il 10-15 luglio — procedo con la prenotazione? 🌊",
  c6: "Hi James! Back online. Your Deluxe Suite extension to June 27 is confirmed. The additional $340 payment link is ready whenever you are!",
  c7: "Merhaba Fatma Hanım! Animasyon programı ve glutensiz menümüz hakkında detaylı bilgi vermeye hazırım. Aile odası seçeneklerini de paylaşıyorum! 🌟",
  c8: "Hello Mohammed! Your Family Room is fully confirmed for July 1–7. Looking forward to welcoming your family! 🌴",
};

// AI confirmation after payment — per conversation, language-matched
const PAYMENT_CONFIRM_MSGS: Record<string, string> = {
  c2: "Zahlung bestätigt ✅ Ihr Triple Room Premium ist vollständig gebucht!\n\nEine Bestätigung wurde an Ihre WhatsApp gesendet. Wir freuen uns darauf, Sie am 28. Juni begrüßen zu dürfen! 🎉",
  c5: "Pagamento confermato ✅ La Camera Doppia Superior è prenotata!\n\nUna conferma è stata inviata al tuo WhatsApp. Non vediamo l'ora di accoglierti il 10 luglio! 🌊",
};

// ─── ROI metrics (base values — updated live when reservations confirm) ───────

const BASE_METRICS = {
  bookings: 3,
  revenue: 4230,       // € — direct bookings via AI this week
  responseTime: "38s", // avg, vs. 4h industry average
  leadsAfterHours: 7,  // leads caught outside business hours
};

type OpsPhase =
  | "idle"
  | "triage"
  | "checking_availability"
  | "generating_offer"
  | "awaiting_payment"
  | "follow_up_scheduled";

function resolveTypingPhase(phase: OpsPhase): AiTypingPhase {
  switch (phase) {
    case "checking_availability":
      return "checking_availability";
    case "awaiting_payment":
      return "checking_payment";
    case "generating_offer":
    case "follow_up_scheduled":
      return "preparing_reservation";
    case "triage":
      return "thinking";
    default:
      return "composing";
  }
}

const OPS_PHASES: {
  phase: OpsPhase;
  label: string;
  sub: string;
  icon: React.ElementType;
  wrap: string;
  text: string;
}[] = [
  {
    phase: "triage",
    label: "Talep",
    sub: "misafir talebi alındı",
    icon: Sparkles,
    wrap: "bg-violet-500/10 border-violet-500/18",
    text: "text-violet-300/80",
  },
  {
    phase: "checking_availability",
    label: "Müsaitlik",
    sub: "oda kontrolü",
    icon: RefreshCw,
    wrap: "bg-sky-500/10 border-sky-500/18",
    text: "text-sky-200/80",
  },
  {
    phase: "generating_offer",
    label: "Teklif",
    sub: "fiyat hazırlanıyor",
    icon: Sparkles,
    wrap: "bg-blue-500/10 border-blue-500/18",
    text: "text-blue-200/80",
  },
  {
    phase: "awaiting_payment",
    label: "Ödeme",
    sub: "ödeme bekleniyor",
    icon: CreditCard,
    wrap: "bg-amber-500/10 border-amber-500/18",
    text: "text-amber-200/80",
  },
  {
    phase: "follow_up_scheduled",
    label: "Takip",
    sub: "hatırlatma planlandı",
    icon: CheckCheck,
    wrap: "bg-emerald-500/10 border-emerald-500/18",
    text: "text-emerald-200/80",
  },
];

// Static metric definitions (value is computed dynamically in MetricsBar)
const METRIC_DEFS = [
  {
    icon: CalendarCheck,
    key: "bookings" as const,
    label: "Günlük rezervasyon",
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/[0.12]",
    borderColor: "border-emerald-500/[0.10]",
  },
  {
    icon: TrendingUp,
    key: "revenue" as const,
    label: "Direkt gelir",
    color: "text-blue-400",
    iconBg: "bg-blue-500/[0.12]",
    borderColor: "border-blue-500/[0.10]",
  },
  {
    icon: Banknote,
    key: "ota" as const,
    label: "OTA tasarrufu",
    color: "text-amber-400",
    iconBg: "bg-amber-500/[0.12]",
    borderColor: "border-amber-500/[0.10]",
  },
  {
    icon: Zap,
    key: "response" as const,
    label: "Ort. yanıt süresi",
    color: "text-violet-400",
    iconBg: "bg-violet-500/[0.12]",
    borderColor: "border-violet-500/[0.10]",
  },
  {
    icon: ShieldCheck,
    key: "leads" as const,
    label: "Bekleyen onay",
    color: "text-cyan-400",
    iconBg: "bg-cyan-500/[0.12]",
    borderColor: "border-cyan-500/[0.10]",
  },
] as const;

// Simulated follow-up from Ahmet (c1) — triggers 8 seconds after page load
const INCOMING_MSG: ChatMsg = {
  id: "incoming-ahmet-followup",
  dir: "in",
  body: "Rezervasyon oluşturabilir miyiz? Fiyat için Süperiör oda uygun görünüyor.",
  time: "",
};

// ─── Demo guest pool ──────────────────────────────────────────────────────────

type DemoGuest = {
  name: string; initials: string; avatarColor: string; phone: string;
  language: string; flag: string;
  inquiry: string; aiGreet: string; aiOffer: string; aiPaymentMsg: string; aiConfirm: string;
  room: string; checkIn: string; checkOut: string;
  nights: number; guestCount: number; pricePerNight: number; currency: string;
};

const DEMO_GUESTS: DemoGuest[] = [
  {
    name: "Sophie Martin", initials: "SM", avatarColor: "bg-rose-500", phone: "+33 6 12 34 56 78",
    language: "FR", flag: "🇫🇷",
    inquiry: "Bonjour! Je cherche une chambre double pour 2 personnes du 15 au 18 août. Avez-vous de la disponibilité?",
    aiGreet: "Bonjour Sophie! 😊 Bienvenue au Grand Hotel Demo. Je vérifie les disponibilités du 15 au 18 août pour vous…",
    aiOffer: "Excellente nouvelle! Pour vos dates, j'ai la disponibilité suivante:\n\n🛏  Chambre Double Deluxe — €220/nuit\n⭐  Suite Junior — €310/nuit\n\nLa Chambre Double Deluxe inclut le petit-déjeuner et une vue sur le jardin.\n3 nuits × €220 = **€660** au total.\n\nSouhaitez-vous réserver la Chambre Double Deluxe?",
    aiPaymentMsg: "Parfait Sophie! 🎉 J'ai créé votre réservation et envoyé un lien de paiement sécurisé sur votre WhatsApp.\n\nMontant: €660 · Paiement 100% sécurisé.",
    aiConfirm: "Paiement confirmé ✅ Votre Chambre Double Deluxe est réservée!\n\nUne confirmation a été envoyée sur votre WhatsApp. Nous avons hâte de vous accueillir le 15 août! 🌹",
    room: "Deluxe Double Room", checkIn: "Aug 15", checkOut: "Aug 18", nights: 3, guestCount: 2, pricePerNight: 220, currency: "€",
  },
  {
    name: "Lorenzo Ricci", initials: "LR", avatarColor: "bg-orange-500", phone: "+39 320 765 1234",
    language: "IT", flag: "🇮🇹",
    inquiry: "Buongiorno! Cerco una camera per due persone dal 20 al 25 settembre. Ha disponibilità?",
    aiGreet: "Buongiorno Lorenzo! 🌟 Benvenuto al Grand Hotel Demo. Verifico subito le disponibilità per il 20-25 settembre…",
    aiOffer: "Perfetto! Ho trovato le seguenti opzioni per il vostro soggiorno:\n\n🛏  Camera Doppia Superior — €170/notte\n⭐  Suite con Vista Mare — €280/notte\n\nLa Camera Doppia Superior include colazione e accesso alla piscina.\n5 notti × €170 = **€850** totale.\n\nProcedo con la prenotazione?",
    aiPaymentMsg: "Meraviglioso! 🎉 La prenotazione è pronta. Ho inviato il link di pagamento sicuro al vostro WhatsApp.\n\nImporto: €850 · Pagamento sicuro garantito.",
    aiConfirm: "Pagamento confermato ✅ La Camera Doppia Superior è prenotata!\n\nUna conferma è stata inviata al tuo WhatsApp. Non vediamo l'ora di accoglierti il 20 settembre! 🌊",
    room: "Superior Double Room", checkIn: "Sep 20", checkOut: "Sep 25", nights: 5, guestCount: 2, pricePerNight: 170, currency: "€",
  },
  {
    name: "Anna Hoffmann", initials: "AH", avatarColor: "bg-sky-500", phone: "+49 176 543 2100",
    language: "DE", flag: "🇩🇪",
    inquiry: "Guten Tag! Wir suchen ein Zimmer für 2 Erwachsene und 1 Kind vom 10. bis 14. Juli. Haben Sie etwas Passendes?",
    aiGreet: "Guten Tag Anna! 👋 Herzlich willkommen im Grand Hotel Demo. Ich prüfe sofort die Verfügbarkeit für den 10.–14. Juli…",
    aiOffer: "Tolle Neuigkeiten! Für Ihre Familie habe ich folgende Optionen:\n\n🛏  Familienzimmer (2+1) — €190/Nacht\n⭐  Junior Suite — €260/Nacht\n\nDas Familienzimmer bietet ein Doppelbett + Kinderbett und Frühstück inklusive.\n4 Nächte × €190 = **€760** Gesamt.\n\nSoll ich die Reservierung vorbereiten?",
    aiPaymentMsg: "Wunderbar! 🎉 Ihre Reservierung ist erstellt. Ich habe den sicheren Zahlungslink an Ihr WhatsApp gesendet.\n\nBetrag: €760 · 100% sichere Zahlung.",
    aiConfirm: "Zahlung bestätigt ✅ Ihr Familienzimmer ist gebucht!\n\nEine Bestätigung wurde an Ihr WhatsApp gesendet. Wir freuen uns darauf, Sie und Ihre Familie am 10. Juli willkommen zu heißen! 🌟",
    room: "Family Room", checkIn: "Jul 10", checkOut: "Jul 14", nights: 4, guestCount: 3, pricePerNight: 190, currency: "€",
  },
  {
    name: "David Lim", initials: "DL", avatarColor: "bg-teal-500", phone: "+65 9123 4567",
    language: "EN", flag: "🇸🇬",
    inquiry: "Hi! I'd like to book a deluxe room for 2 nights, August 8-10. What are your rates?",
    aiGreet: "Hi David! 👋 Welcome to Grand Hotel Demo. Let me check availability for August 8–10 right away…",
    aiOffer: "Great news! I have availability for your dates:\n\n🛏  Deluxe Sea View Room — $260/night\n⭐  Premium Suite — $390/night\n\nThe Deluxe Sea View Room includes breakfast, pool access, and a stunning ocean view.\n2 nights × $260 = **$520** total.\n\nShall I reserve the Deluxe Sea View Room for you?",
    aiPaymentMsg: "Excellent choice! 🎉 Your reservation is ready. I've sent a secure payment link to your WhatsApp.\n\nAmount: $520 · Secure checkout.",
    aiConfirm: "Payment confirmed ✅ Your Deluxe Sea View Room is booked!\n\nA confirmation has been sent to your WhatsApp. Looking forward to welcoming you on August 8! 🌴",
    room: "Deluxe Sea View Room", checkIn: "Aug 8", checkOut: "Aug 10", nights: 2, guestCount: 2, pricePerNight: 260, currency: "$",
  },
  {
    name: "Isabel Ferreira", initials: "IF", avatarColor: "bg-fuchsia-500", phone: "+55 11 9 8765 4321",
    language: "PT", flag: "🇧🇷",
    inquiry: "Olá! Gostaria de reservar um quarto duplo para 3 noites a partir de 5 de outubro. Tem disponibilidade?",
    aiGreet: "Olá Isabel! 🌟 Bem-vinda ao Grand Hotel Demo. Verificando disponibilidade para 5-8 de outubro agora…",
    aiOffer: "Ótima notícia! Encontrei as seguintes opções para você:\n\n🛏  Quarto Duplo Standard — €140/noite\n⭐  Quarto Duplo Superior — €195/noite\n\nO Quarto Duplo Superior inclui café da manhã, acesso à piscina e vista para o jardim.\n3 noites × €195 = **€585** total.\n\nDeseja reservar o Quarto Duplo Superior?",
    aiPaymentMsg: "Perfeito! 🎉 Sua reserva está criada. Enviei o link de pagamento seguro para o seu WhatsApp.\n\nValor: €585 · Pagamento 100% seguro.",
    aiConfirm: "Pagamento confirmado ✅ Seu Quarto Duplo Superior está reservado!\n\nUma confirmação foi enviada ao seu WhatsApp. Mal podemos esperar para recebê-la em 5 de outubro! 🌸",
    room: "Superior Double Room", checkIn: "Oct 5", checkOut: "Oct 8", nights: 3, guestCount: 2, pricePerNight: 195, currency: "€",
  },
];

// ─── Toast type ───────────────────────────────────────────────────────────────

type ToastData = { title: string; sub?: string; type: "success" | "new" };
type OperationFeedItem = {
  id: string;
  channel: "web_chat" | "instagram" | "whatsapp";
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
  severity: "info" | "success" | "warning" | "error";
  conversation_id?: string;
};

type ReservationLifecycleActionState =
  NonNullable<OperationConversation["latestLifecycleEvent"]>["state"];
type ReservationPaymentActionState =
  NonNullable<OperationConversation["latestPaymentEvent"]>["state"];

type ReservationLifecycleAction = {
  state: ReservationLifecycleActionState;
  label: string;
  description: string;
  severity: OperationFeedItem["severity"];
  icon: React.ElementType;
};

type PaymentActionSpec = {
  state: ReservationPaymentActionState;
  title: string;
  description: string;
  suggestion: string;
};

type PaymentAmountView = {
  value?: number;
  currency: string;
  label: string;
};

type OperationalOutcomeKind =
  | "confirmed"
  | "payment_pending"
  | "cancelled"
  | "quote"
  | "human_takeover"
  | "closed_without_reservation";

type OperationalOutcomeTone = {
  border: string;
  bg: string;
  iconBg: string;
  icon: string;
  badge: string;
  dot: string;
  amount: string;
  separator: string;
};

type OperationalOutcomeView = {
  kind: OperationalOutcomeKind;
  title: string;
  description: string;
  badge: string;
  lifecycleLabel: string;
  reservationLabel: string;
  paymentLabel: string;
  idLabel?: string;
  idValue?: string;
  offerId?: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  nights?: number;
  amount?: PaymentAmountView;
  canSendPaymentLink: boolean;
  tone: OperationalOutcomeTone;
  icon: React.ElementType;
};

const PAYMENT_ACTIONS: Partial<Record<ReservationLifecycleActionState, PaymentActionSpec>> = {
  payment_link_sent: {
    state: "payment_link_sent",
    title: "Ödeme bağlantısı gönderildi",
    description: "Misafire ödeme bağlantısı gönderildi.",
    suggestion: "Ödeme bağlantısı gönderildi. Misafire ödeme adımını takip edeceğimi bildirin.",
  },
  payment_pending: {
    state: "payment_pending",
    title: "Ödeme bekleniyor",
    description: "Misafirden ödeme bekleniyor.",
    suggestion: "Ödeme bekleniyor. 15 dakika içinde hatırlatma önerilir.",
  },
  confirmed: {
    state: "paid",
    title: "Rezervasyon onaylandı",
    description: "Ödeme alındı ve rezervasyon onaylandı.",
    suggestion: "Rezervasyon onaylandı. Misafire onay ve giriş bilgileri gönderilebilir.",
  },
};

const RESERVATION_LIFECYCLE_ACTIONS: ReservationLifecycleAction[] = [
  {
    state: "quote_sent",
    label: "Teklif gönderildi",
    description: "Misafire teklif gönderildi.",
    severity: "success",
    icon: FileText,
  },
  {
    state: "payment_link_sent",
    label: "Ödeme bağlantısı gönderildi",
    description: "Misafire ödeme bağlantısı gönderildi.",
    severity: "success",
    icon: CreditCard,
  },
  {
    state: "payment_pending",
    label: "Ödeme bekleniyor",
    description: "Misafirden ödeme bekleniyor.",
    severity: "warning",
    icon: Clock,
  },
  {
    state: "confirmed",
    label: "Rezervasyon onaylandı",
    description: "Rezervasyon başarıyla onaylandı.",
    severity: "success",
    icon: CheckCircle2,
  },
  {
    state: "cancelled",
    label: "İptal edildi",
    description: "Rezervasyon süreci iptal edildi.",
    severity: "warning",
    icon: AlertCircle,
  },
  {
    state: "human_review_required",
    label: "Operatör incelemesi gerekiyor",
    description: "Rezervasyon sürecinde operatör aksiyonu gerekli.",
    severity: "warning",
    icon: AlertTriangle,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const pathname = usePathname();
  const panelBase = pathname.startsWith("/demo/otel-paneli")
    ? "/demo/otel-paneli"
    : pathname.startsWith("/app")
      ? "/app"
      : "/dashboard";
  const isLivePanel = panelBase === "/app";
  const reservationsHref = `${panelBase}/reservations`;

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("c2");
  const live = useLivePanelOverlay(selected);
  const conversationAi = useConversationAi(selected);
  const opPanel = useOperationConversationsPanel();
  const syncSelectedConversation = useOperationConversationStore((s) => s.selectConversation);
  const liveApi = useLiveConversationApi();
  const liveSync = useLiveConversationSync(isLivePanel ? selected : null);
  const [opsTick, setOpsTick] = useState(0);

  // Demo mode
  const [demoMode, setDemoMode] = useState(false);
  const [demoConversations, setDemoConversations] = useState<Conversation[]>([]);
  const [demoChatThreads, setDemoChatThreads] = useState<Record<string, ChatThread>>({});

  // Per-conversation interactive state
  const [localStatuses, setLocalStatuses] = useState<Record<string, ConversationStatus>>({});
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMsg[]>>({});
  const [localTyping, setLocalTyping] = useState<Record<string, boolean>>({});
  const [localLeadStatuses, setLocalLeadStatuses] = useState<Record<string, LeadStatus>>({});
  const [localLifecycleEvents, setLocalLifecycleEvents] = useState<
    Record<string, OperationConversation["latestLifecycleEvent"]>
  >({});
  const [localPaymentEvents, setLocalPaymentEvents] = useState<
    Record<string, OperationConversation["latestPaymentEvent"]>
  >({});
  const [pendingLifecycleAction, setPendingLifecycleAction] =
    useState<ReservationLifecycleActionState | null>(null);
  const [localUnreads, setLocalUnreads] = useState<Record<string, number>>(
    Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.unread]))
  );
  const [localLastMsgs, setLocalLastMsgs] = useState<Record<string, string>>({});
  const [localReservations, setLocalReservations] = useState<Record<string, ConvReservation>>({});
  const [confirmedReservations, setConfirmedReservations] = useState<Record<string, boolean>>({});

  const [sentLink, setSentLink] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [operationFeed, setOperationFeed] = useState<OperationFeedItem[]>([]);

  // Hans (c2) is the canonical deterministic payment-pending / payment-recovery demo
  // scenario. The global operation feed can contain stale "Ödeme alındı" /
  // "Rezervasyon onaylandı" / "Operasyon tamamlandı" events from prior demo runs
  // or from other conversations — those would contradict Hans' current lifecycle
  // and confuse the demo. Suppress them only for c2; Sarah and others are unaffected.
  const visibleOperationFeed = useMemo(() => {
    if (selected !== "c2") return operationFeed;
    const STALE_HANS_TITLES = new Set([
      "Ödeme alındı",
      "Rezervasyon onaylandı",
      "Operasyon tamamlandı",
    ]);
    return operationFeed.filter((event) => !STALE_HANS_TITLES.has(event.title));
  }, [operationFeed, selected]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  const demoActiveRef = useRef(false);
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const demoRoundRef = useRef(0);
  const lifecycleHydratedKeysRef = useRef<Record<string, string>>({});
  const paymentHydratedKeysRef = useRef<Record<string, string>>({});

  const [opsPhase, setOpsPhase] = useState<OpsPhase>("triage");
  const [opsPulseAt, setOpsPulseAt] = useState<number>(() => Date.now());
  const [lastSyncAt, setLastSyncAt] = useState<number>(() => Date.now());
  const [mobilePane, setMobilePane] = useState<ConversationsMobilePane>("queue");
  const [tabletSummaryOpen, setTabletSummaryOpen] = useState(false);
  const { isLoading: threadLoading } = usePanelStagedLoad(selected, 260);
  const { isLoading: queueLoading } = usePanelStagedLoad("queue", 220);
  const typingPhase = resolveTypingPhase(opsPhase);

  function selectConversation(id: string) {
    setSelected(id);
    syncSelectedConversation(id);
    opPanel.clearPulse(id);
    setMobilePane("chat");
    setTabletSummaryOpen(false);
  }

  // Keep ref in sync for stale-closure safety in timeouts
  useEffect(() => {
    selectedRef.current = selected;
    syncSelectedConversation(selected);
  }, [selected, syncSelectedConversation]);

  // ── Derived values for selected conversation ───────────────────────────────

  const staticIds = useMemo(() => new Set(CONVERSATIONS.map((c) => c.id)), []);
  const operationConvs = useMemo(
    () => opPanel.panelConversations.filter((c) => !staticIds.has(c.id)),
    [opPanel.panelConversations, staticIds]
  );
  const allConvs: Conversation[] = useMemo(
    () => [...operationConvs, ...demoConversations, ...CONVERSATIONS],
    [demoConversations, operationConvs]
  );
  const selectedConv = allConvs.find((c) => c.id === selected);
  const thread =
    CHAT_THREADS[selected] ??
    demoChatThreads[selected] ??
    opPanel.threadsById[selected];
  const selectedOperation = opPanel.getOperationSummary(selected);
  const allConversationIds = allConvs.map((conversation) => conversation.id).join("|");
  const lifecycleHydrationTargets = useMemo(() => {
    const operationById = new Map(
      opPanel.rawConversations.map((conversation) => [conversation.id, conversation])
    );
    // Deterministic demo: the static seed threads (c1–c8 in CONVERSATIONS, incl. Hans c2 /
    // Sarah c4 / Mohammed c8) are the source of truth and must never be overridden by
    // persisted lifecycle/payment replays — that is what reintroduced the
    // payment_pending → confirmed flicker and let Hans auto-confirm after a refresh. Only
    // live / ingested conversations hydrate from the server.
    return allConvs
      .filter((conversation) => !staticIds.has(conversation.id))
      .map((conversation) => ({
        id: conversation.id,
        hotelId: operationById.get(conversation.id)?.hotelId ?? "demo-hotel",
      }));
  }, [allConvs, opPanel.rawConversations, staticIds]);

  const hasLocalStatus = selected in localStatuses;
  const effectiveStatus: ConversationStatus = localStatuses[selected] ?? selectedConv?.status;
  const effectiveLeadStatus: LeadStatus | undefined =
    localLeadStatuses[selected] ?? selectedConv?.leadStatus;
  const selectedLifecycleEvent =
    selectedOperation?.latestLifecycleEvent ?? localLifecycleEvents[selected];
  const selectedPaymentEvent =
    selectedOperation?.latestPaymentEvent ?? localPaymentEvents[selected];
  const selectedAiSuggestion =
    (selectedPaymentEvent ? paymentSuggestion(selectedPaymentEvent.state) : undefined) ??
    selectedOperation?.aiSuggestion ??
    (selectedLifecycleEvent ? lifecycleSuggestion(selectedLifecycleEvent.state) : undefined);
  const selectedConversationForPanel = selectedConv
    ? {
        ...selectedConv,
        status: effectiveStatus,
        leadStatus: effectiveLeadStatus ?? selectedConv.leadStatus,
      }
    : undefined;
  const allMessages: ChatMsg[] = [...(thread?.messages ?? []), ...(localMessages[selected] ?? [])];
  const isAiTyping = hasLocalStatus
    ? (localTyping[selected] ?? false)
    : (thread?.aiTyping ?? false);

  // Reservation: localReservations (demo / manual) takes priority over thread data
  const rawReservation = localReservations[selected] ?? thread?.reservation;
  const operationReservation = selectedOperation?.reservation
    ? operationReservationToPanel(
        selectedOperation.reservation,
        selectedConv?.contact.name,
        selectedOperation.bookingValue
      )
    : undefined;
  const baseReservation = rawReservation ?? operationReservation;
  const effectiveReservation: ConvReservation | undefined = baseReservation
    ? normalizeConversationReservation(baseReservation, {
        locallyConfirmed: confirmedReservations[selected],
        lifecycleEvent: selectedLifecycleEvent,
        paymentEvent: selectedPaymentEvent,
        effectiveStatus,
      })
    : undefined;

  const selectedReservationStatus = effectiveReservation?.status;

  useEffect(() => {
    let cancelled = false;

    async function loadOperationFeed() {
      if (!isLivePanel && !selectedOperation) {
        setOperationFeed([]);
        return;
      }

      try {
        const params = new URLSearchParams({ limit: "3" });
        if (isLivePanel || isLiveConversationId(selected) || selected.startsWith("demo-manychat-")) {
          params.set("conversation_id", selected);
        }
        const res = await fetch(`/api/operations/feed?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          events?: OperationFeedItem[];
        } | null;

        if (!cancelled) {
          setOperationFeed(data?.ok && Array.isArray(data.events) ? data.events : []);
        }

        if (
          !staticIds.has(selected) &&
          (isLivePanel || selectedOperation || selected.startsWith("demo-manychat-"))
        ) {
          const lifecycleParams = new URLSearchParams();
          const hotelId = selectedOperation?.hotelId ?? "demo-hotel";
          lifecycleParams.set("hotel_id", hotelId);
          const lifecycleRes = await fetch(
            `/api/conversations/${selected}/reservation-lifecycle?${lifecycleParams.toString()}`
          );
          const lifecycleData = (await lifecycleRes.json().catch(() => null)) as {
            ok?: boolean;
            events?: NonNullable<OperationConversation["latestLifecycleEvent"]>[];
          } | null;
          const latestLifecycleEvent = lifecycleData?.events?.[0];

          if (!cancelled && latestLifecycleEvent) {
            applyLocalLifecycleProjection(selected, latestLifecycleEvent);
            applyOperationLifecycleProjection(selected, latestLifecycleEvent);
          }

          const paymentRes = await fetch(
            `/api/conversations/${selected}/payment?${lifecycleParams.toString()}`
          );
          const paymentData = (await paymentRes.json().catch(() => null)) as {
            ok?: boolean;
            events?: NonNullable<OperationConversation["latestPaymentEvent"]>[];
          } | null;
          const latestPaymentEvent = paymentData?.events?.[0];

          if (!cancelled && latestPaymentEvent) {
            applyPaymentProjection(selected, latestPaymentEvent);
          }
        }
      } catch {
        if (!cancelled) setOperationFeed([]);
      }
    }

    void loadOperationFeed();
    const interval = window.setInterval(loadOperationFeed, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projection helpers intentionally use this selected snapshot.
  }, [isLivePanel, selected, selectedOperation]);

  useEffect(() => {
    if (!isLivePanel && !opPanel.rawConversations.length) return;
    if (!allConversationIds) return;

    let cancelled = false;

    async function hydratePersistedLifecycle() {
      await Promise.all(
        lifecycleHydrationTargets.map(async (target) => {
          const hydrationKey = `${target.hotelId}:${target.id}`;
          if (lifecycleHydratedKeysRef.current[hydrationKey]) return;

          try {
            const params = new URLSearchParams({ hotel_id: target.hotelId });
            const response = await fetch(
              `/api/conversations/${target.id}/reservation-lifecycle?${params.toString()}`
            );
            const data = (await response.json().catch(() => null)) as {
              ok?: boolean;
              events?: NonNullable<OperationConversation["latestLifecycleEvent"]>[];
            } | null;

            if (cancelled) return;

            const latestLifecycleEvent = data?.events?.[0];
            lifecycleHydratedKeysRef.current[hydrationKey] =
              latestLifecycleEvent?.id ?? "none";

            if (!latestLifecycleEvent) return;

            applyLocalLifecycleProjection(target.id, latestLifecycleEvent);
            applyOperationLifecycleProjection(target.id, latestLifecycleEvent);
          } catch {
            if (!cancelled) {
              lifecycleHydratedKeysRef.current[hydrationKey] = "failed";
            }
          }
        })
      );

      await Promise.all(
        lifecycleHydrationTargets.map(async (target) => {
          const hydrationKey = `${target.hotelId}:${target.id}`;
          if (paymentHydratedKeysRef.current[hydrationKey]) return;

          try {
            const params = new URLSearchParams({ hotel_id: target.hotelId });
            const response = await fetch(
              `/api/conversations/${target.id}/payment?${params.toString()}`
            );
            const data = (await response.json().catch(() => null)) as {
              ok?: boolean;
              events?: NonNullable<OperationConversation["latestPaymentEvent"]>[];
            } | null;

            if (cancelled) return;

            const latestPaymentEvent = data?.events?.[0];
            paymentHydratedKeysRef.current[hydrationKey] =
              latestPaymentEvent?.id ?? "none";

            if (!latestPaymentEvent) return;

            applyPaymentProjection(target.id, latestPaymentEvent);
          } catch {
            if (!cancelled) {
              paymentHydratedKeysRef.current[hydrationKey] = "failed";
            }
          }
        })
      );
    }

    void hydratePersistedLifecycle();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projection helpers intentionally use this hydration snapshot.
  }, [allConversationIds, isLivePanel, lifecycleHydrationTargets, opPanel.rawConversations.length]);

  // Pre-compute confirmed metrics for MetricsBar (includes demo revenue via localReservations)
  const confirmedCount = Object.values(confirmedReservations).filter(Boolean).length;
  const confirmedRevenue = Object.entries(confirmedReservations)
    .filter(([, v]) => v)
    .reduce((sum, [id]) => {
      const staticTotal = CHAT_THREADS[id]?.reservation?.total;
      const localTotal = localReservations[id]?.total;
      return sum + (staticTotal ?? localTotal ?? 0);
    }, 0);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(title: string, sub?: string, type: ToastData["type"] = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, sub, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3800);
  }

  function addMessages(convId: string, msgs: ChatMsg[]) {
    setLocalMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] ?? []), ...msgs],
    }));
  }

  function messagesForConv(convId: string): ChatMsg[] {
    const base =
      CHAT_THREADS[convId]?.messages ??
      demoChatThreads[convId]?.messages ??
      opPanel.threadsById[convId]?.messages ??
      [];
    return [...base, ...(localMessages[convId] ?? [])];
  }

  function reservationStatusForLifecycle(
    state: ReservationLifecycleActionState
  ): ConvReservation["status"] | undefined {
    if (state === "quote_sent" || state === "quote_prepared") return "quoted";
    if (state === "payment_link_sent" || state === "payment_pending") return "pending_payment";
    if (state === "confirmed") return "confirmed";
    if (state === "cancelled" || state === "expired") return "cancelled";
    if (state === "human_review_required") return "human_review";
    return undefined;
  }

  function leadStatusForLifecycle(state: ReservationLifecycleActionState): LeadStatus {
    if (state === "confirmed") return "confirmed";
    if (state === "cancelled" || state === "expired") return "lost";
    if (
      state === "quote_sent" ||
      state === "quote_prepared" ||
      state === "payment_link_sent" ||
      state === "payment_pending"
    ) {
      return "quoted";
    }
    return "new";
  }

  function conversationStatusForLifecycle(
    state: ReservationLifecycleActionState,
    fallback: ConversationStatus
  ): ConversationStatus {
    if (state === "confirmed") return "resolved";
    if (state === "human_review_required") return "human_takeover";
    return fallback === "resolved" && state !== "cancelled" && state !== "expired"
      ? "ai_active"
      : fallback;
  }

  function applyLocalLifecycleProjection(
    conversationId: string,
    event: NonNullable<OperationConversation["latestLifecycleEvent"]>
  ) {
    setLocalLifecycleEvents((prev) => ({ ...prev, [conversationId]: event }));
    setLocalLeadStatuses((prev) => ({
      ...prev,
      [conversationId]: leadStatusForLifecycle(event.state),
    }));

    const nextStatus = reservationStatusForLifecycle(event.state);
    const existingReservation =
      localReservations[conversationId] ??
      CHAT_THREADS[conversationId]?.reservation ??
      demoChatThreads[conversationId]?.reservation;

    if (nextStatus && existingReservation) {
      setLocalReservations((prev) => ({
        ...prev,
        [conversationId]: {
          ...(prev[conversationId] ?? existingReservation),
          status: nextStatus,
        },
      }));
      setConfirmedReservations((prev) => ({
        ...prev,
        [conversationId]: nextStatus === "confirmed",
      }));
    }

    setLocalStatuses((prev) => {
      const baseStatus =
        prev[conversationId] ??
        allConvs.find((conversation) => conversation.id === conversationId)?.status ??
        "ai_active";
      return {
        ...prev,
        [conversationId]: conversationStatusForLifecycle(event.state, baseStatus),
      };
    });
  }

  function applyOperationLifecycleProjection(
    conversationId: string,
    event: NonNullable<OperationConversation["latestLifecycleEvent"]>
  ) {
    useOperationConversationStore.setState((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              stage: lifecycleStateToStage(event.state),
              statusLabel: event.title,
              latestLifecycleEvent: event,
              aiSuggestion: lifecycleSuggestion(event.state),
              requiresHuman:
                event.state === "human_review_required" || conversation.requiresHuman,
              reservation: operationReservationForLifecycle(conversation, event),
            }
          : conversation
      ),
    }));
  }

  function reservationStatusForPayment(
    state: ReservationPaymentActionState
  ): OperationReservationSummary["status"] | undefined {
    if (state === "payment_link_sent" || state === "payment_pending") return "pending_payment";
    if (state === "paid") return "confirmed";
    if (state === "expired" || state === "refunded") return "cancelled";
    return undefined;
  }

  function conversationPaymentStateForPayment(
    state: ReservationPaymentActionState
  ): OperationConversation["paymentState"] {
    if (state === "paid") return "completed";
    if (state === "failed") return "failed";
    if (state === "payment_link_sent" || state === "payment_pending") return "pending";
    return "none";
  }

  function applyPaymentProjection(
    conversationId: string,
    event: NonNullable<OperationConversation["latestPaymentEvent"]>
  ) {
    setLocalPaymentEvents((prev) => ({ ...prev, [conversationId]: event }));

    const nextReservationStatus = reservationStatusForPayment(event.state);
    const existingReservation =
      localReservations[conversationId] ??
      CHAT_THREADS[conversationId]?.reservation ??
      demoChatThreads[conversationId]?.reservation;

    if (nextReservationStatus && existingReservation) {
      setLocalReservations((prev) => ({
        ...prev,
        [conversationId]: {
          ...(prev[conversationId] ?? existingReservation),
          status: nextReservationStatus,
        },
      }));
      setConfirmedReservations((prev) => ({
        ...prev,
        [conversationId]: nextReservationStatus === "confirmed",
      }));
    }

    useOperationConversationStore.setState((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              latestPaymentEvent: event,
              paymentState: conversationPaymentStateForPayment(event.state),
              aiSuggestion: paymentSuggestion(event.state),
              bookingValue: event.amount ?? conversation.bookingValue,
              reservation: operationReservationForPayment(conversation, event, nextReservationStatus),
            }
          : conversation
      ),
    }));
  }

  function manychatExternalUserIdFromExternalId(operation: OperationConversation): string | null {
    if (operation.channel !== "instagram" && operation.channel !== "whatsapp") return null;
    const prefix = `manychat:${operation.channel}:`;
    if (!operation.externalId?.startsWith(prefix)) return null;

    const externalUserId = operation.externalId.slice(prefix.length).trim();
    return externalUserId.length > 0 ? externalUserId : null;
  }

  function updateOptimisticDelivery(
    conversationId: string,
    messageId: string,
    deliveryStatus: NonNullable<OperationMessage["meta"]>["deliveryStatus"],
    externalMessageId?: string
  ) {
    useOperationConversationStore
      .getState()
      .updateMessageDelivery(conversationId, messageId, deliveryStatus, externalMessageId);
  }

  async function postManychatOperationReply(
    operation: OperationConversation,
    content: string,
    optimisticMessageId: string
  ) {
    const externalUserId = manychatExternalUserIdFromExternalId(operation);
    if (!externalUserId || (operation.channel !== "instagram" && operation.channel !== "whatsapp")) {
      updateOptimisticDelivery(operation.id, optimisticMessageId, "failed");
      return;
    }

    try {
      const res = await fetch("/api/integrations/manychat/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: operation.hotelId ?? "demo-hotel",
          conversation_id: operation.id,
          external_user_id: externalUserId,
          channel: operation.channel,
          message: content,
          client_message_id: optimisticMessageId,
          secret: process.env.NODE_ENV !== "production" ? "test-secret" : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        deliveryStatus?: "sent" | "mock_sent" | "failed";
        externalMessageId?: string;
      } | null;

      updateOptimisticDelivery(
        operation.id,
        optimisticMessageId,
        data?.success ? (data.deliveryStatus ?? "sent") : "failed",
        data?.externalMessageId
      );
    } catch {
      updateOptimisticDelivery(operation.id, optimisticMessageId, "failed");
    }
  }

  function triggerGuestAiResponse(convId: string, guestMessage: string) {
    const conv = allConvs.find((c) => c.id === convId);
    if (!conv) return;

    const status = localStatuses[convId] ?? conv.status;
    if (status !== "ai_active") return;

    const op = opPanel.getOperationSummary(convId);
    if (op) {
      useOperationConversationStore.getState().simulateAIResponseForConversation(convId, guestMessage);
      return;
    }

    setLocalTyping((prev) => ({ ...prev, [convId]: true }));

    const channel: ChannelType =
      conv.channel === "web"
        ? "web_chat"
        : conv.channel === "instagram"
          ? "instagram"
          : "whatsapp";

    const result = simulateAIResponse(guestMessage, {
      stage: "new_inquiry",
      guestName: conv.contact.name,
      channel,
      language: conv.language,
    });

    window.setTimeout(() => {
      const now = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const msgs: ChatMsg[] = result.operationalEvents.map((event, i) => ({
        id: `sys-${convId}-${Date.now()}-${i}`,
        dir: "system",
        body: event,
        time: now,
      }));
      msgs.push({
        id: `ai-${convId}-${Date.now()}`,
        dir: "out",
        by: "ai",
        body: result.replyText,
        time: now,
      });
      addMessages(convId, msgs);
      setLocalTyping((prev) => ({ ...prev, [convId]: false }));
      setLocalLastMsgs((prev) => ({ ...prev, [convId]: result.replyText }));
      if (result.requiresHuman) {
        setLocalStatuses((prev) => ({ ...prev, [convId]: "human_takeover" }));
        showToast("İnsan desteği öneriliyor", result.suggestedAction, "new");
      }
    }, 1400);
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  // Global "live ops" tick (demo-only presence layer; no backend)
  useEffect(() => {
    const t = setInterval(() => {
      setOpsTick((v) => (v + 1) % 1000);
      setLastSyncAt(Date.now());
      // occasional micro-pulse so UI feels alive, but calm
      if (Math.random() < 0.33) setOpsPulseAt(Date.now());
    }, 2600);
    return () => clearInterval(t);
  }, []);

  // Derive an ops phase for the currently selected conversation.
  useEffect(() => {
    // resolved convs should feel "quiet"
    if (effectiveStatus === "resolved") {
      setOpsPhase("idle");
      return;
    }

    if (effectiveStatus === "human_takeover") {
      setOpsPhase("triage");
      return;
    }

    // AI active
    if (selectedReservationStatus === "pending_payment") {
      setOpsPhase("awaiting_payment");
      return;
    }
    if (selectedReservationStatus === "quoted") {
      // oscillate between offer + follow-up scheduled (calm)
      setOpsPhase(opsTick % 2 === 0 ? "generating_offer" : "follow_up_scheduled");
      return;
    }

    // If AI typing we can imply ongoing checks/offer generation
    if (isAiTyping) {
      setOpsPhase(opsTick % 3 === 0 ? "checking_availability" : "generating_offer");
      return;
    }

    setOpsPhase("triage");
  }, [effectiveStatus, isAiTyping, opsTick, selectedReservationStatus]);

  // Reset per-conversation UI + clear unreads when switching
  useEffect(() => {
    setSentLink(false);
    setReplyText("");
    setLocalUnreads((prev) => ({ ...prev, [selected]: 0 }));
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
  }, [selected]);

  // Auto-scroll when messages or typing state changes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [localMessages, localTyping]);

  useEffect(() => {
    const unsub = useOperationConversationStore.subscribe((state, prev) => {
      if (state.conversations.length > prev.conversations.length) {
        const newest = state.conversations[0];
        if (!newest) return;
        setSelected(newest.id);
        useOperationConversationStore.getState().selectConversation(newest.id);
        showToast(
          op("toastNewInquiry", "tr", { name: newest.guestName }),
          newest.lastMessage.slice(0, 72),
          "new"
        );
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate an incoming follow-up from Ahmet (c1) after 8 seconds
  useEffect(() => {
    const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const incomingId = "c1";
    const timer = setTimeout(() => {
      const msg: ChatMsg = { ...INCOMING_MSG, time: now };
      addMessages(incomingId, [msg]);
      setLocalLastMsgs((prev) => ({ ...prev, [incomingId]: msg.body }));
      void triggerGuestAiResponse(incomingId, msg.body);
      if (selectedRef.current !== incomingId) {
        setLocalUnreads((prev) => ({ ...prev, [incomingId]: (prev[incomingId] ?? 0) + 1 }));
        showToast("Yeni mesaj · Ahmet Yılmaz 🇹🇷", msg.body, "new");
      }
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate a follow-up from Elena Petrov (c3, human_takeover) at 22s
  useEffect(() => {
    const incomingId = "c3";
    const timer = setTimeout(() => {
      const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const msg: ChatMsg = {
        id: "incoming-elena-followup",
        dir: "in",
        body: "Здравствуйте! Я всё ещё жду ответа. Вы можете подтвердить наличие Делюкс-номера?",
        time: now,
      };
      addMessages(incomingId, [msg]);
      setLocalLastMsgs((prev) => ({ ...prev, [incomingId]: "Жду ответа по Делюкс-номеру…" }));
      void triggerGuestAiResponse(incomingId, msg.body);
      if (selectedRef.current !== incomingId) {
        setLocalUnreads((prev) => ({ ...prev, [incomingId]: (prev[incomingId] ?? 0) + 1 }));
        showToast("Yeni mesaj · Elena Petrov 🇷🇺", "Oda onayı için yanıt bekliyor", "new");
      }
    }, 22000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start / stop demo mode when toggle changes
  useEffect(() => {
    demoActiveRef.current = demoMode;
    if (!demoMode) {
      clearDemoTimers();
      return;
    }
    // Small delay so the toggle animation settles, then start first run
    const startTimer = setTimeout(() => {
      if (demoActiveRef.current) runDemoFlow();
    }, 1200);
    return () => {
      demoActiveRef.current = false;
      clearTimeout(startTimer);
      clearDemoTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  // ── Demo helpers ───────────────────────────────────────────────────────────

  function clearDemoTimers() {
    demoTimersRef.current.forEach(clearTimeout);
    demoTimersRef.current = [];
  }

  function addDemoTimeout(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    demoTimersRef.current.push(t);
    return t;
  }

  function runDemoFlow() {
    if (!demoActiveRef.current) return;

    const guest = DEMO_GUESTS[demoRoundRef.current % DEMO_GUESTS.length];
    demoRoundRef.current += 1;

    const convId = `demo-${Date.now()}`;
    const ts = () =>
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const t0 = ts();

    // ── 1. Yeni talep listeye düşer ─────────────────────────────────────────
    const newConv: Conversation = {
      id: convId,
      contact: { name: guest.name, initials: guest.initials, avatarColor: guest.avatarColor, phone: guest.phone },
      lastMessage: guest.inquiry,
      time: "just now",
      language: guest.language,
      status: "ai_active",
      leadStatus: "new",
      unread: 1,
      messageCount: 1,
      channel: "whatsapp",
    };
    setDemoConversations((prev) => [newConv, ...prev]);
    setDemoChatThreads((prev) => ({
      ...prev,
      [convId]: { messages: [{ id: `${convId}-m0`, dir: "in", body: guest.inquiry, time: t0 }] },
    }));
    setLocalUnreads((prev) => ({ ...prev, [convId]: 1 }));
    setLocalLastMsgs((prev) => ({ ...prev, [convId]: guest.inquiry }));
    setSelected(convId);
    showToast(`Yeni talep · ${guest.name} ${guest.flag}`, guest.inquiry.slice(0, 52) + "…", "new");

    // ── 2–3. AI greeting (real provider with scripted fallback) ─────────────
    addDemoTimeout(() => {
      setLocalUnreads((prev) => ({ ...prev, [convId]: 0 }));
      triggerGuestAiResponse(convId, guest.inquiry);
    }, 2200);

    // ── 4. AI starts typing for offer ───────────────────────────────────────
    addDemoTimeout(() => {
      setLocalTyping((prev) => ({ ...prev, [convId]: true }));
    }, 6200);

    // ── 5. AI sends room offer ──────────────────────────────────────────────
    addDemoTimeout(() => {
      setLocalTyping((prev) => ({ ...prev, [convId]: false }));
      addMessages(convId, [{ id: `${convId}-ai2`, dir: "out", by: "ai", body: guest.aiOffer, time: ts() }]);
    }, 9500);

    // ── 6. Reservation card — quoted ────────────────────────────────────────
    addDemoTimeout(() => {
      const total = guest.pricePerNight * guest.nights;
      const reservation: ConvReservation = {
        ref: `GH${Math.floor(1000 + Math.random() * 9000)}`,
        guest: guest.name,
        room: guest.room,
        checkIn: guest.checkIn,
        checkOut: guest.checkOut,
        nights: guest.nights,
        guests: guest.guestCount,
        pricePerNight: guest.pricePerNight,
        total,
        currency: guest.currency,
        status: "quoted",
      };
      setLocalReservations((prev) => ({ ...prev, [convId]: reservation }));
      showToast(
        op("toastQuoteCreated", "tr", { name: guest.name }),
        `${guest.room} · ${guest.currency}${total.toLocaleString()}`,
        "success"
      );
    }, 12500);

    // ── 7. AI typing for payment link ───────────────────────────────────────
    addDemoTimeout(() => {
      setLocalTyping((prev) => ({ ...prev, [convId]: true }));
    }, 15000);

    // ── 8. Payment link sent ────────────────────────────────────────────────
    addDemoTimeout(() => {
      setLocalTyping((prev) => ({ ...prev, [convId]: false }));
      setLocalReservations((prev) =>
        prev[convId] ? { ...prev, [convId]: { ...prev[convId]!, status: "pending_payment" } } : prev
      );
      addMessages(convId, [{ id: `${convId}-ai3`, dir: "out", by: "ai", body: guest.aiPaymentMsg, time: ts() }]);
      const total = guest.pricePerNight * guest.nights;
      showToast(
        op("toastPaymentLinkSent"),
        `${guest.name} · ${guest.currency}${total.toLocaleString()}`,
        "success"
      );
    }, 17500);

    // ── 9. Ödeme onayı → rezervasyon onayı + gelir artışı ───────────────────
    addDemoTimeout(() => {
      const sysTime = ts();
      const total = guest.pricePerNight * guest.nights;
      setLocalReservations((prev) =>
        prev[convId] ? { ...prev, [convId]: { ...prev[convId]!, status: "confirmed" } } : prev
      );
      setConfirmedReservations((prev) => ({ ...prev, [convId]: true }));
      addMessages(convId, [
        { id: `${convId}-sys`, dir: "system", body: `Ödeme alındı · ${guest.currency}${total.toLocaleString()} · ${sysTime}`, time: sysTime },
        { id: `${convId}-ai4`, dir: "out", by: "ai", body: guest.aiConfirm, time: sysTime },
      ]);
      setLocalStatuses((prev) => ({ ...prev, [convId]: "resolved" }));
      showToast(
        op("toastBookingConfirmed"),
        `${guest.name} · ${guest.currency}${total.toLocaleString()}`,
        "success"
      );
    }, 22000);

    // ── Schedule next run (28–38 s from now) ───────────────────────────────
    addDemoTimeout(() => {
      if (demoActiveRef.current) runDemoFlow();
    }, 28000 + Math.floor(Math.random() * 10000));
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function persistPaymentAction(
    paymentAction: PaymentActionSpec,
    amount?: number,
    currency?: string
  ) {
    const paymentResponse = await fetch(`/api/conversations/${selected}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotel_id: selectedOperation?.hotelId ?? "demo-hotel",
        reservation_id: selectedOperation?.reservation?.id,
        amount,
        currency,
        state: paymentAction.state,
        actor: "operator",
        title: paymentAction.title,
        description: paymentAction.description,
      }),
    });
    const paymentData = (await paymentResponse.json().catch(() => null)) as {
      ok?: boolean;
      event?: NonNullable<OperationConversation["latestPaymentEvent"]>;
    } | null;

    if (paymentResponse.ok && paymentData?.ok && paymentData.event) {
      applyPaymentProjection(selected, paymentData.event);
      return true;
    }

    return false;
  }

  function resolvePaymentAmountForAction(
    state: ReservationLifecycleActionState
  ): PaymentAmountView {
    const confirmed = state === "confirmed";
    return resolvePaymentAmount({
      event: selectedPaymentEvent,
      reservation: effectiveReservation,
      bookingValue: selectedOperation?.bookingValue,
      conversationId: selected,
      confirmed,
    });
  }

  async function handleReservationLifecycleAction(action: ReservationLifecycleAction) {
    if (pendingLifecycleAction) return;

    const paymentAction = PAYMENT_ACTIONS[action.state];
    const paymentAmountView = resolvePaymentAmountForAction(action.state);
    const paymentAmount = paymentAmountView.value;
    const paymentCurrency = paymentAmountView.currency;

    if (selectedLifecycleEvent?.state === action.state) {
      if (paymentAction && selectedPaymentEvent?.state !== paymentAction.state) {
        setPendingLifecycleAction(action.state);
        try {
          const persisted = await persistPaymentAction(
            paymentAction,
            paymentAmount,
            paymentCurrency
          );
          showToast(
            persisted ? "Ödeme durumu kaydedildi" : "Ödeme durumu kaydedilemedi",
            action.label,
            persisted ? "success" : "new"
          );
          if (persisted) void liveSync.refresh();
        } catch {
          showToast("Ödeme durumu kaydedilemedi", action.label, "new");
        } finally {
          setPendingLifecycleAction(null);
        }
        return;
      }

      showToast("Aksiyon zaten kayıtlı", action.label, "success");
      return;
    }

    setPendingLifecycleAction(action.state);
    if (action.state === "payment_link_sent") setSentLink(true);

    const optimisticEvent: NonNullable<OperationConversation["latestLifecycleEvent"]> = {
      id: `optimistic-${selected}-${action.state}`,
      hotel_id: selectedOperation?.hotelId ?? "demo-hotel",
      conversation_id: selected,
      reservation_id: selectedOperation?.reservation?.id,
      state: action.state,
      title: action.label,
      description: action.description,
      timestamp: new Date().toISOString(),
      actor: "operator",
      severity: action.severity,
    };
    applyLocalLifecycleProjection(selected, optimisticEvent);
    if (paymentAction) {
      applyPaymentProjection(selected, {
        id: `optimistic-payment-${selected}-${paymentAction.state}`,
        hotel_id: selectedOperation?.hotelId ?? "demo-hotel",
        conversation_id: selected,
        reservation_id: selectedOperation?.reservation?.id,
        amount: paymentAmount,
        currency: paymentCurrency,
        state: paymentAction.state,
        title: paymentAction.title,
        description: paymentAction.description,
        timestamp: optimisticEvent.timestamp,
        actor: "operator",
      });
    }
    const feedChannel: OperationFeedItem["channel"] =
      selectedOperation?.channel === "instagram" || selectedConv?.channel === "instagram"
        ? "instagram"
        : selectedOperation?.channel === "whatsapp" || selectedConv?.channel === "whatsapp"
          ? "whatsapp"
          : "web_chat";

    setOperationFeed((prev) => [
      {
        id: `optimistic-feed-${selected}-${action.state}`,
        channel: feedChannel,
        event_type: "reservation_lifecycle",
        title: action.label,
        description: action.description,
        timestamp: optimisticEvent.timestamp,
        severity: action.severity,
        conversation_id: selected,
      },
      ...prev.filter(
        (event) => !(event.conversation_id === selected && event.title === action.label)
      ),
    ].slice(0, 3));

    applyOperationLifecycleProjection(selected, optimisticEvent);

    try {
      const response = await fetch(`/api/conversations/${selected}/reservation-lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: selectedOperation?.hotelId ?? "demo-hotel",
          reservation_id: selectedOperation?.reservation?.id,
          state: action.state,
          actor: "operator",
          title: action.label,
          description: action.description,
          severity: action.severity,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        event?: NonNullable<OperationConversation["latestLifecycleEvent"]>;
      } | null;

      if (response.ok && data?.ok && data.event) {
        applyLocalLifecycleProjection(selected, data.event);
        if (paymentAction) {
          await persistPaymentAction(paymentAction, paymentAmount, paymentCurrency);
        }
        showToast("Rezervasyon aksiyonu kaydedildi", action.label, "success");
        void liveSync.refresh();
        return;
      }

      showToast("Aksiyon kaydedilemedi", action.label, "new");
    } catch {
      showToast("Aksiyon kaydedilemedi", action.label, "new");
    } finally {
      setPendingLifecycleAction(null);
      if (action.state === "payment_link_sent") {
        window.setTimeout(() => setSentLink(false), 900);
      }
    }
  }

  function handleSendPaymentLink() {
    const action = RESERVATION_LIFECYCLE_ACTIONS.find(
      (item) => item.state === "payment_link_sent"
    );
    if (action) void handleReservationLifecycleAction(action);
  }

  function handleLegacySendPaymentLink() {
    setSentLink(true);
    const r = effectiveReservation;
    showToast(
      op("toastPaymentLinkSent"),
      r && selectedConv
        ? `${selectedConv.contact.name} · ${r.currency}${r.total.toLocaleString()}`
        : undefined
    );

    if (isLivePanel && liveApi.enabled && isLiveConversationId(selected)) {
      void fetch(`/api/conversations/${selected}/reservation-lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: "payment_link_sent",
          actor: "operator",
          title: "Ödeme bağlantısı gönderildi",
          description: "Misafire ödeme bağlantısı gönderildi.",
          severity: "success",
        }),
      }).then(() => {
        setSentLink(false);
        void liveSync.refresh();
      });
      return;
    }

    setTimeout(() => {
      setSentLink(false);
      if (!r) return;

      const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const sysMsg: ChatMsg = {
        id: `sys-payment-${Date.now()}`,
        dir: "system",
        body: `Ödeme alındı · ${r.currency}${r.total.toLocaleString()} · ${now}`,
        time: now,
      };
      const aiBody =
        PAYMENT_CONFIRM_MSGS[selected] ??
        `Ödeme onaylandı. ${r.room} rezervasyonunuz tamamlandı.\n\nOnay bilgisi kanal üzerinden paylaşıldı. ${r.checkIn} tarihinde sizi ağırlamaktan memnuniyet duyarız.`;
      const aiMsg: ChatMsg = {
        id: `ai-confirm-${Date.now()}`,
        dir: "out",
        by: "ai",
        body: aiBody,
        time: now,
      };

      // Mark reservation confirmed before adding messages so the card transitions atomically
      setConfirmedReservations((prev) => ({ ...prev, [selected]: true }));
      addMessages(selected, [sysMsg, aiMsg]);
      showToast(
        op("toastPaymentConfirmed"),
        `${selectedConv?.contact.name ?? "Misafir"} · ${r.currency}${r.total.toLocaleString()}`
      );
    }, 3500);
  }

  void handleLegacySendPaymentLink;

  function handleTakeover() {
    setLocalStatuses((prev) => ({ ...prev, [selected]: "human_takeover" }));
    setLocalTyping((prev) => ({ ...prev, [selected]: false }));
    useConversationAiStore.getState().setHumanActive(selected);
    if (liveApi.enabled && isLiveConversationId(selected)) {
      void liveApi.postTakeover(selected, "takeover");
      showToast(op("operatorJoinedConversation"), op("humanSupportActive"));
    }
  }

  function handleHandToAI() {
    setLocalStatuses((prev) => ({ ...prev, [selected]: "ai_active" }));
    setReplyText("");

    if (liveApi.enabled && isLiveConversationId(selected)) {
      void liveApi.postTakeover(selected, "release_to_ai");
      showToast(op("aiSupportContinuing"));
      return;
    }

    const lastGuest = [...messagesForConv(selected)]
      .reverse()
      .find((m) => m.dir === "in");
    const resumePrompt =
      lastGuest?.body ??
      "Ekip görüşmeyi AI'ya devretti. Misafire kısa ve sıcak bir devam mesajı yaz.";

    void triggerGuestAiResponse(selected, resumePrompt);
  }

  function handleSendReply() {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const operation = opPanel.getOperationSummary(selected);
    if (operation) {
      const optimisticMessage = useOperationConversationStore
        .getState()
        .addOperatorMessage(selected, trimmed);
      setReplyText("");

      if (!optimisticMessage) return;

      if (liveApi.enabled && isLiveConversationId(selected)) {
        void liveApi.postOperatorMessage(selected, trimmed).then((result) => {
          updateOptimisticDelivery(
            selected,
            optimisticMessage.id,
            result.ok ? (result.message?.deliveryStatus ?? "sent") : "failed"
          );
        });
        return;
      }

      if (operation.provider === "manychat") {
        void postManychatOperationReply(operation, trimmed, optimisticMessage.id);
        return;
      }

      updateOptimisticDelivery(selected, optimisticMessage.id, "sent");
      return;
    }

    const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    addMessages(selected, [
      { id: `staff-${Date.now()}`, dir: "out", by: "human", body: trimmed, time: now },
    ]);
    setReplyText("");
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = opPanel.filteredByChannel(
    allConvs.filter((c) => {
      const effectiveConvStatus = localStatuses[c.id] ?? c.status;
      const matchTab = activeTab === "all" || effectiveConvStatus === activeTab;
      const matchSearch =
        !search ||
        c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    })
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Toast */}
      <Toast toast={toast} />

      {isLivePanel ? (
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.03] bg-zinc-950/90 px-5 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-white/35">
            <span className="font-medium text-white/55">Grand Hotel Demo</span>
            <span className="text-white/15">·</span>
            <span>{op("liveHotelOps")}</span>
            {liveSync.enabled ? (
              <span className="ml-1 flex items-center gap-1 text-emerald-400/75">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                {op("liveSyncActive")}
              </span>
            ) : live.mounted ? (
              <span className="ml-1 flex items-center gap-1 text-emerald-400/75">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                AI-assisted
              </span>
            ) : null}
          </div>
          <Link href="/app/operations" className="text-[11px] font-medium text-blue-400/80 hover:text-blue-300">
            {op("operationsCenterLink")}
          </Link>
        </div>
      ) : (
      <div className="flex shrink-0 flex-col gap-2 border-b border-white/[0.03] bg-zinc-950/90 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2 text-[11px] text-white/20">
          <span>Grand Hotel Demo</span>
          <span className="text-white/10">·</span>
          <span>{op("livePanelPreview")}</span>
          {demoMode && (
            <span className="flex items-center gap-1 text-blue-400/60 ml-1">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              {op("autoDemoRunning")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DemoIncomingSimulator
            onIncoming={(id) => {
              selectConversation(id);
              showToast(op("newChannelMessage"), op("addedToQueue"), "new");
            }}
          />
          <DemoOrchestrationPanel onConversationCreated={selectConversation} />
          <button
            onClick={() => setDemoMode((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all active:scale-[0.97]",
              demoMode
                ? "bg-blue-500/15 border-blue-500/25 text-blue-300 hover:bg-blue-500/20"
                : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                demoMode ? "bg-blue-400 animate-pulse" : "bg-white/20"
              )}
            />
            Demo Mode {demoMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      )}

      {/* ── ROI metrics bar ──────────────────────────────────────────────── */}
      <MetricsBar
        confirmedCount={confirmedCount}
        confirmedRevenue={confirmedRevenue}
        opsPulseAt={opsPulseAt}
        lastSyncAt={lastSyncAt}
      />

      <ConversationsMobileTabs
        value={mobilePane}
        onChange={setMobilePane}
        chatDisabled={!selectedConv}
        summaryDisabled={!selectedConv || !thread}
        alertQueue={filtered.some((c) => (localUnreads[c.id] ?? c.unread) > 0)}
        alertChat={conversationAi.status === "awaiting_approval" || isAiTyping}
        alertSummary={Boolean(conversationAi.requiresHuman || selectedOperation?.requiresHuman)}
      />

      {/* ── Main 3-column area ───────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

      {/* ── Left: conversation list ──────────────────────────────────────── */}
      <ConvList
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        search={search}
        setSearch={setSearch}
        selected={selected}
        setSelected={selectConversation}
        mobileCompact
        className={cn(
          "w-full md:w-[300px]",
          mobilePane !== "queue" && "hidden md:flex"
        )}
        filtered={filtered}
        localUnreads={localUnreads}
        localLastMsgs={localLastMsgs}
        localStatuses={localStatuses}
        localLeadStatuses={localLeadStatuses}
        localTyping={localTyping}
        locale="tr"
        queueStats={isLivePanel ? live.queueStats : undefined}
        convOverlays={isLivePanel ? live.convOverlays : undefined}
        channelFilter={opPanel.channelFilter}
        onChannelFilterChange={opPanel.setChannelFilter}
        isPulsing={opPanel.isPulsing}
        onClearPulse={opPanel.clearPulse}
        queueLoading={queueLoading}
      />

      {/* ── Center: chat ─────────────────────────────────────────────────── */}
      {selectedConv && thread && threadLoading ? (
        <ConversationSkeleton
          className={cn(
            "min-w-0 flex-1 border-white/[0.03] md:border-r",
            mobilePane !== "chat" && "hidden md:flex"
          )}
        />
      ) : null}

      {selectedConv && thread && !threadLoading ? (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-white/[0.03] bg-zinc-950/15 animate-panel-fade-in md:border-r",
            mobilePane !== "chat" && "hidden md:flex"
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.03] bg-zinc-950/40 px-4 py-3 backdrop-blur-[6px] md:gap-4 md:px-6 md:py-5">
            <button
              type="button"
              onClick={() => setMobilePane("queue")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/50 md:hidden"
              aria-label="Görüşmelere dön"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white ring-1 ring-white/[0.06]",
                    selectedConv.contact.avatarColor
                  )}
                >
                  {selectedConv.contact.initials}
                </div>
                <span
                  className="pointer-events-none absolute bottom-0 left-0 z-[1] flex h-[15px] w-[15px] translate-x-[-2px] translate-y-[3px] items-center justify-center rounded-md border border-white/[0.1] bg-zinc-950/95 shadow-sm"
                  title={channelDisplayLabel(selectedConv.channel)}
                >
                  <ChannelGlyph channel={selectedConv.channel} className="h-2 w-2" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">
                  {selectedConv.contact.name}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/40">
                  <ChannelBadge channel={selectedConv.channel} className="!py-0" />
                  <span className="text-white/20">·</span>
                  <span className="truncate">
                    {selectedLifecycleEvent
                      ? selectedLifecycleEvent.title
                      : selectedOperation
                      ? stageLabel(selectedOperation.stage)
                      : conversationAi.reservationStage
                        ? aiReservationStageLabel(conversationAi.reservationStage)
                        : "Yeni talep"}
                  </span>
                </p>
                <div className="mt-1.5 hidden flex-wrap items-center gap-2 md:flex">
                  <LanguageFlag lang={selectedConv.language} />
                  <StatusBadge status={effectiveStatus} />
                  <LeadBadge status={effectiveLeadStatus ?? selectedConv.leadStatus} />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTabletSummaryOpen(true);
                  setMobilePane("summary");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/45 transition-colors hover:text-white/70 lg:hidden"
                aria-label="Operasyon özeti"
              >
                <PanelRight className="h-4 w-4" />
              </button>
              {effectiveReservation && (
                <Link
                  href={reservationsHref}
                  className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-white/48 transition-[background-color,color,border-color] duration-200 hover:border-white/[0.1] hover:bg-white/[0.055] hover:text-white/78 lg:flex"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {op("viewBooking")}
                </Link>
              )}
              {effectiveStatus === "ai_active" && (
                <button
                  onClick={handleTakeover}
                  className="hidden items-center gap-1.5 rounded-lg border border-amber-500/18 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-400 transition-[background-color,border-color,transform] duration-200 hover:border-amber-500/26 hover:bg-amber-500/[0.14] active:scale-[0.97] md:flex"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {op("takeOver")}
                </button>
              )}
              {effectiveStatus === "human_takeover" && (
                <button
                  onClick={handleHandToAI}
                  className="hidden items-center gap-1.5 rounded-lg border border-blue-500/18 bg-blue-500/10 px-3 py-1.5 text-[11px] font-medium text-blue-400 transition-[background-color,border-color,transform] duration-200 hover:border-blue-500/26 hover:bg-blue-500/[0.14] active:scale-[0.97] md:flex"
                >
                  <Bot className="w-3.5 h-3.5" />
                  {op("handToAi")}
                </button>
              )}
            </div>
          </div>

          {conversationAi.statusLabel ? (
            <div
              className={cn(
                "shrink-0 border-b border-white/[0.04] px-6 py-2 text-[11px] font-medium",
                conversationAi.status === "human_recommended" || conversationAi.requiresHuman
                  ? "bg-rose-500/[0.06] text-rose-200/85"
                  : conversationAi.status === "error"
                    ? "bg-amber-500/[0.06] text-amber-200/85"
                    : "bg-blue-500/[0.05] text-blue-200/80"
              )}
            >
              {conversationAi.statusLabel}
              {conversationAi.status === "awaiting_approval" && conversationAi.lastResponse ? (
                <span className="ml-2 text-white/35">· AI beklemede</span>
              ) : null}
            </div>
          ) : null}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="conv-scroll flex-1 min-h-0 space-y-0 overflow-y-auto px-5 py-7 sm:px-6"
          >
            <div className="mx-auto w-full max-w-[min(100%,30.5rem)]">
              <div className="mb-7 flex justify-center">
                <span className="rounded-full border border-white/[0.045] bg-white/[0.025] px-4 py-1.5 text-[11px] font-medium text-white/32">
                  {selectedConv.time.includes("d ago") ? "Dün" : "Bugün"}
                </span>
              </div>
              {allMessages.map((msg, i) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  conv={selectedConv}
                  prevMsg={i > 0 ? allMessages[i - 1] : undefined}
                />
              ))}
              {effectiveReservation && (
                <div className="pt-6">
                  <ReservationCard
                    reservation={effectiveReservation}
                    convStatus={effectiveStatus}
                    sentLink={sentLink}
                    onSendPaymentLink={handleSendPaymentLink}
                    reservationsHref={reservationsHref}
                  />
                </div>
              )}
              {isAiTyping && <ChatTypingIndicator phase={typingPhase} locale="tr" />}
              <div className="h-5" />
            </div>
          </div>

          <MobileQuickActions
            status={effectiveStatus}
            hasReservation={Boolean(effectiveReservation)}
            onTakeover={handleTakeover}
            onHandToAI={handleHandToAI}
            onSendPaymentLink={handleSendPaymentLink}
            onOpenSummary={() => setMobilePane("summary")}
          />

          {/* Reply bar */}
          <ReplyBar
            status={effectiveStatus}
            value={replyText}
            onChange={setReplyText}
            onSend={handleSendReply}
            onTakeover={handleTakeover}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-1 items-center justify-center",
            mobilePane !== "chat" && "hidden md:flex"
          )}
        >
          {selectedConv && threadLoading ? (
            <ConversationSkeleton className="h-full w-full max-w-none" />
          ) : (
            <OperationalEmptyState
              icon={selectedConv ? MessageSquare : Inbox}
              title={selectedConv ? op("loadingThread") : op("emptySelectConversation")}
              description={
                selectedConv ? op("emptySelectConversationDetail") : op("emptyQueueDetail")
              }
            />
          )}
        </div>
      )}

      {/* ── Right: operation summary (desktop column / mobile tab / tablet slide-over) ─ */}
      {selectedConv && thread && (mobilePane === "summary" || tabletSummaryOpen) ? (
        <button
          type="button"
          aria-label="Özeti kapat"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => {
            setTabletSummaryOpen(false);
            if (mobilePane === "summary") setMobilePane("chat");
          }}
        />
      ) : null}

      {selectedConv && thread && threadLoading ? (
        <SummaryCardSkeleton
          className={cn(
            "conv-scroll z-50 shrink-0 overflow-y-auto bg-zinc-950/95 animate-panel-fade-in",
            mobilePane === "summary"
              ? "flex w-full md:hidden"
              : tabletSummaryOpen
                ? "fixed inset-y-0 right-0 flex w-full max-w-[320px] border-l border-white/[0.06] shadow-2xl md:flex lg:hidden"
                : "hidden lg:flex lg:w-[284px]"
          )}
        />
      ) : null}

      {selectedConv && thread && !threadLoading ? (
        <div
          className={cn(
            "conv-scroll z-50 flex shrink-0 flex-col overflow-y-auto bg-zinc-950/95 animate-panel-fade-in",
            mobilePane === "summary"
              ? "w-full md:hidden"
              : tabletSummaryOpen
                ? "fixed inset-y-0 right-0 w-full max-w-[320px] border-l border-white/[0.06] shadow-2xl md:flex lg:hidden"
                : "hidden lg:flex lg:w-[284px]"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 lg:hidden">
            <p className="text-sm font-semibold text-white">Operasyon özeti</p>
            <button
              type="button"
              onClick={() => {
                setTabletSummaryOpen(false);
                setMobilePane("chat");
              }}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-white/45 hover:bg-white/[0.06] hover:text-white/70"
            >
              Kapat
            </button>
          </div>
          <GuestSidebar
          compact={mobilePane === "summary" || tabletSummaryOpen}
          conv={selectedConversationForPanel ?? selectedConv}
          thread={thread}
          effectiveStatus={effectiveStatus}
          effectiveReservation={effectiveReservation}
          latestPaymentEvent={selectedPaymentEvent}
          latestLifecycleEvent={selectedLifecycleEvent}
          sentLink={sentLink}
          onSendPaymentLink={handleSendPaymentLink}
          onLifecycleAction={handleReservationLifecycleAction}
          pendingLifecycleAction={pendingLifecycleAction}
          activeLifecycleState={
            selectedLifecycleEvent?.state ??
            (selectedPaymentEvent ? lifecycleStateForPayment(selectedPaymentEvent.state) : undefined)
          }
          onTakeover={handleTakeover}
          onHandToAI={handleHandToAI}
          reservationsHref={reservationsHref}
          locale="tr"
          aiConfidence={
            conversationAi.confidence !== null
              ? confidencePercent(conversationAi.confidence)
              : isLivePanel
                ? live.cognition?.financial.revenueConfidence
                : undefined
          }
          guestSummary={
            conversationAi.guestSummary ??
            (isLivePanel ? live.cognition?.interpretation : undefined)
          }
          suggestedAction={
            conversationAi.suggestedAction
              ? suggestedActionLabel(conversationAi.suggestedAction)
              : isLivePanel
                ? live.cognition?.recommendedAction
                : undefined
          }
          aiReservationStage={
            conversationAi.reservationStage
              ? aiReservationStageLabel(conversationAi.reservationStage)
              : undefined
          }
          requiresHuman={conversationAi.requiresHuman || selectedOperation?.requiresHuman}
          aiStatusLabel={
            selectedOperation?.statusLabel || conversationAi.statusLabel || undefined
          }
          pendingAiReply={
            conversationAi.status === "awaiting_approval"
              ? conversationAi.lastResponse?.reply
              : selectedAiSuggestion?.nextReply
          }
          operationStage={
            selectedLifecycleEvent?.title ??
            (selectedOperation ? stageLabel(selectedOperation.stage) : undefined)
          }
          operationChannel={
            selectedOperation ? channelDisplayLabel(selectedOperation.channel) : undefined
          }
          operationBookingValue={selectedOperation?.bookingValue}
          operationSuggestedAction={
            selectedAiSuggestion?.label ??
            (selectedOperation?.requiresHuman
              ? "İnsan desteği devralsın"
              : selectedOperation?.statusLabel)
          }
          operationLastActivity={
            selectedOperation
              ? new Date(selectedOperation.lastActivityAt).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined
          }
          operationFeed={visibleOperationFeed}
        />
        </div>
      ) : null}
      </div>{/* end 3-column area */}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function lifecycleStateToStage(
  state: NonNullable<OperationConversation["latestLifecycleEvent"]>["state"]
): OperationConversation["stage"] {
  if (state === "quote_prepared" || state === "quote_sent") return "offer_sent";
  if (state === "payment_link_sent" || state === "payment_pending") return "payment_pending";
  if (state === "confirmed") return "confirmed";
  if (state === "human_review_required" || state === "cancelled" || state === "expired") {
    return "human_review";
  }
  return "new_inquiry";
}

function statusForLifecycleState(
  state: NonNullable<OperationConversation["latestLifecycleEvent"]>["state"],
  fallback: OperationReservationSummary["status"] = "quoted"
): OperationReservationSummary["status"] {
  if (state === "confirmed") return "confirmed";
  if (state === "cancelled" || state === "expired") return "cancelled";
  if (state === "payment_link_sent" || state === "payment_pending") return "pending_payment";
  if (state === "quote_sent" || state === "quote_prepared") return "quoted";
  return fallback;
}

function fallbackReservationSummary(
  conversation: OperationConversation,
  status: OperationReservationSummary["status"],
  amount?: number,
  currency?: string
): OperationReservationSummary {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 21);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 5);
  const roomSuggestion = conversation.messages
    .map((message) => message.meta?.roomSuggestion)
    .find(Boolean);

  return {
    id: conversation.reservation?.id ?? `runtime-${conversation.id}`,
    ref: conversation.reservation?.ref ?? `TGO-${conversation.id.slice(-6).toUpperCase()}`,
    roomType: conversation.reservation?.roomType ?? roomSuggestion ?? "Superior Çift Oda",
    checkIn: conversation.reservation?.checkIn ?? checkIn.toISOString(),
    checkOut: conversation.reservation?.checkOut ?? checkOut.toISOString(),
    guestCount: conversation.reservation?.guestCount ?? 2,
    totalAmount: amount ?? conversation.reservation?.totalAmount ?? conversation.bookingValue ?? 12500,
    currency: currency ?? conversation.reservation?.currency ?? "TRY",
    status,
  };
}

function operationReservationForLifecycle(
  conversation: OperationConversation,
  event: NonNullable<OperationConversation["latestLifecycleEvent"]>
): OperationReservationSummary {
  const status = statusForLifecycleState(event.state, conversation.reservation?.status);
  return {
    ...fallbackReservationSummary(conversation, status),
    ...conversation.reservation,
    status,
  };
}

function operationReservationForPayment(
  conversation: OperationConversation,
  event: NonNullable<OperationConversation["latestPaymentEvent"]>,
  nextStatus?: OperationReservationSummary["status"]
): OperationReservationSummary {
  const status = nextStatus ?? conversation.reservation?.status ?? "quoted";
  return {
    ...fallbackReservationSummary(conversation, status, event.amount, event.currency),
    ...conversation.reservation,
    totalAmount: event.amount ?? conversation.reservation?.totalAmount ?? conversation.bookingValue,
    currency: event.currency ?? conversation.reservation?.currency ?? "TRY",
    status,
  };
}

function lifecycleSuggestion(
  state: NonNullable<OperationConversation["latestLifecycleEvent"]>["state"]
): OperationConversation["aiSuggestion"] {
  if (state === "payment_link_sent" || state === "payment_pending") {
    return {
      suggestedAction: "payment_follow_up",
      label: "Misafir yanıt bekliyor",
      nextReply: "Ödeme bağlantısını tekrar paylaşabilirim veya ödeme adımında yardımcı olabilirim.",
    };
  }

  if (state === "human_review_required") {
    return {
      suggestedAction: "human_takeover",
      label: "Operatör aksiyonu gerekli",
      nextReply: "Bu talepte operatör incelemesi gerekiyor.",
    };
  }

  return {
    suggestedAction: "next_reply",
    label: "AI önerisi hazır",
    nextReply: "Talebinizi aldık. Size uygun seçenekleri hazırlıyorum.",
  };
}

function paymentSuggestion(
  state: ReservationPaymentActionState
): OperationConversation["aiSuggestion"] {
  if (state === "payment_link_sent") {
    return {
      suggestedAction: "payment_follow_up",
      label: "Ödeme takibi öneriliyor",
      nextReply: PAYMENT_ACTIONS.payment_link_sent?.suggestion,
    };
  }

  if (state === "payment_pending") {
    return {
      suggestedAction: "payment_follow_up",
      label: "Hatırlatma öneriliyor",
      nextReply: PAYMENT_ACTIONS.payment_pending?.suggestion,
    };
  }

  if (state === "paid") {
    return {
      suggestedAction: "next_reply",
      label: "Onay mesajı öneriliyor",
      nextReply: PAYMENT_ACTIONS.confirmed?.suggestion,
    };
  }

  return {
    suggestedAction: "human_takeover",
    label: "Operatör kontrolü öneriliyor",
    nextReply: "Ödeme durumunu kontrol edin ve misafire net bilgi verin.",
  };
}

function lifecycleStateForPayment(
  state: ReservationPaymentActionState
): ReservationLifecycleActionState | undefined {
  if (state === "payment_link_sent") return "payment_link_sent";
  if (state === "payment_pending") return "payment_pending";
  if (state === "paid") return "confirmed";
  if (state === "expired") return "expired";
  return undefined;
}

function normalizeConversationReservation(
  reservation: ConvReservation,
  input: {
    locallyConfirmed?: boolean;
    lifecycleEvent?: NonNullable<OperationConversation["latestLifecycleEvent"]>;
    paymentEvent?: NonNullable<OperationConversation["latestPaymentEvent"]>;
    effectiveStatus?: ConversationStatus;
  }
): ConvReservation {
  const lifecycleState = input.lifecycleEvent?.state;
  const paymentState = input.paymentEvent?.state;

  // Payment lifecycle is authoritative for "collected". A reservation being created /
  // optioned (or carrying a stale confirmed flag) does NOT mean the money was taken — while
  // the latest payment event says link-sent / pending / failed, the reservation must read as
  // pending_payment, never confirmed. This keeps the center card and the right sidebar in
  // agreement (e.g. Hans payment-risk).
  const paymentNotCollected =
    paymentState === "payment_link_sent" ||
    paymentState === "payment_pending" ||
    paymentState === "failed";

  if (
    reservation.status === "cancelled" ||
    lifecycleState === "cancelled" ||
    lifecycleState === "expired" ||
    paymentState === "expired" ||
    paymentState === "refunded"
  ) {
    return { ...reservation, status: "cancelled" };
  }

  if (
    !paymentNotCollected &&
    (input.locallyConfirmed ||
      reservation.status === "confirmed" ||
      lifecycleState === "confirmed" ||
      paymentState === "paid")
  ) {
    return { ...reservation, status: "confirmed" };
  }

  if (lifecycleState === "human_review_required" || input.effectiveStatus === "human_takeover") {
    return { ...reservation, status: "human_review" };
  }

  if (
    reservation.status === "pending_payment" ||
    lifecycleState === "payment_link_sent" ||
    lifecycleState === "payment_pending" ||
    paymentState === "payment_link_sent" ||
    paymentState === "payment_pending" ||
    paymentState === "failed"
  ) {
    return { ...reservation, status: "pending_payment" };
  }

  if (
    reservation.status === "quoted" ||
    lifecycleState === "quote_prepared" ||
    lifecycleState === "quote_sent"
  ) {
    return { ...reservation, status: "quoted" };
  }

  return reservation;
}

function paymentStateLabel(
  state?: ReservationPaymentActionState,
  reservationStatus?: ConvReservation["status"]
): string {
  if (state === "payment_link_sent") return "Bağlantı gönderildi";
  if (state === "payment_pending") return "Ödeme bekleniyor";
  if (state === "paid") return "Ödendi";
  if (state === "failed") return "Başarısız";
  if (state === "expired") return "Süresi doldu";
  if (state === "refunded") return "İade edildi";
  if (reservationStatus === "confirmed") return "Ödendi";
  if (reservationStatus === "pending_payment") return "Ödeme bekleniyor";
  return "Başlatılmadı";
}

function paymentStateClass(
  state?: ReservationPaymentActionState,
  reservationStatus?: ConvReservation["status"]
): string {
  if (state === "paid" || reservationStatus === "confirmed") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (state === "failed" || state === "expired" || state === "refunded") {
    return "bg-rose-500/15 text-rose-300";
  }

  if (state === "payment_link_sent" || state === "payment_pending" || reservationStatus === "pending_payment") {
    return "bg-amber-500/15 text-amber-300";
  }

  return "bg-white/[0.05] text-white/45";
}

function parsePaymentValue(input?: string): { value: number; currency: string } | undefined {
  if (!input) return undefined;
  const currency = input.match(/[^\d.,\s]+/)?.[0] ?? "₺";
  const numeric = Number(input.replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return undefined;
  return { value: numeric, currency };
}

function resolvePaymentAmount(input: {
  event?: NonNullable<OperationConversation["latestPaymentEvent"]>;
  reservation?: ConvReservation;
  bookingValue?: number;
  conversationId: string;
  confirmed?: boolean;
}): PaymentAmountView {
  const { event, reservation, bookingValue, conversationId, confirmed } = input;

  if (typeof event?.amount === "number") {
    const currency = currencySymbol(event.currency ?? reservation?.currency ?? "TRY");
    return {
      value: event.amount,
      currency,
      label: `${currency}${event.amount.toLocaleString("tr-TR")}`,
    };
  }

  if (reservation) {
    return {
      value: reservation.total,
      currency: reservation.currency,
      label: `${reservation.currency}${reservation.total.toLocaleString("tr-TR")}`,
    };
  }

  if (typeof bookingValue === "number" && Number.isFinite(bookingValue) && bookingValue > 0) {
    return {
      value: bookingValue,
      currency: "₺",
      label: `₺${bookingValue.toLocaleString("tr-TR")}`,
    };
  }

  const parsed = parsePaymentValue(CONV_REVENUE[conversationId]?.value);
  if (parsed) {
    return {
      ...parsed,
      label: `${parsed.currency}${parsed.value.toLocaleString("tr-TR")}`,
    };
  }

  if (confirmed) {
    return {
      value: 12500,
      currency: "₺",
      label: "₺12.500",
    };
  }

  return {
    currency: "₺",
    label: "Tutar bekleniyor",
  };
}

function confirmationStateLabel(
  lifecycleState?: ReservationLifecycleActionState,
  reservationStatus?: ConvReservation["status"]
): string {
  if (lifecycleState === "confirmed" || reservationStatus === "confirmed") return "Onaylandı";
  if (lifecycleState === "payment_pending" || lifecycleState === "payment_link_sent") return "Ödeme adımında";
  if (reservationStatus === "pending_payment") return "Ödeme adımında";
  if (reservationStatus === "cancelled") return "Kapandı";
  return "Onay bekliyor";
}

function operationReservationToPanel(
  reservation: OperationReservationSummary,
  guestName = "Misafir",
  bookingValue?: number
): ConvReservation {
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const checkIn = reservation.checkIn
    ? dateFormatter.format(new Date(reservation.checkIn))
    : "Tarih bekleniyor";
  const checkOut = reservation.checkOut
    ? dateFormatter.format(new Date(reservation.checkOut))
    : "Tarih bekleniyor";
  const checkInDate = reservation.checkIn ? new Date(reservation.checkIn) : null;
  const checkOutDate = reservation.checkOut ? new Date(reservation.checkOut) : null;
  const nights =
    checkInDate && checkOutDate
      ? Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000))
      : 1;
  const total = reservation.totalAmount ?? bookingValue ?? 0;

  return {
    ref: reservation.ref ?? reservation.id.slice(0, 8).toUpperCase(),
    guest: guestName,
    room: reservation.roomType ?? "Rezervasyon talebi",
    checkIn,
    checkOut,
    guests: reservation.guestCount ?? 1,
    nights,
    pricePerNight: nights > 0 ? Math.round(total / nights) : total,
    total,
    currency: currencySymbol(reservation.currency),
    status: reservation.status,
  };
}

function currencySymbol(currency: string): string {
  if (currency === "₺" || currency === "€" || currency === "$") return currency;
  if (currency === "TRY") return "₺";
  if (currency === "EUR") return "€";
  if (currency === "USD") return "$";
  return `${currency} `;
}

function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  const isSuccess = toast.type === "success";
  return (
    <div className="toast-mobile-safe pointer-events-none fixed bottom-5 right-5 z-50 animate-toast-slide">
      <div
        className={cn(
          "flex items-start gap-3 pl-3.5 pr-5 py-3 rounded-xl border shadow-2xl shadow-black/50 min-w-[220px] max-w-[300px]",
          isSuccess
            ? "bg-zinc-900/95 border-emerald-500/30"
            : "bg-zinc-900/95 border-blue-500/20"
        )}
      >
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isSuccess ? "bg-emerald-500/15" : "bg-blue-500/15"
          )}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white/90 leading-tight">{toast.title}</p>
          {toast.sub && (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">{toast.sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── useCountUp ───────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1100): number {
  const [displayed, setDisplayed] = useState(0);
  const frameRef = useRef<number | null>(null);
  const runRef = useRef<{ from: number; to: number; startMs: number } | null>(null);

  useEffect(() => {
    const from = runRef.current?.to ?? 0;
    runRef.current = { from, to: target, startMs: performance.now() };

    function tick(now: number) {
      if (!runRef.current) return;
      const { from, to, startMs } = runRef.current;
      const t = Math.min((now - startMs) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return displayed;
}

function timeAgoCompact(nowMs: number, thenMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - thenMs) / 1000));
  if (s < 3) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

// ─── MetricsBar ───────────────────────────────────────────────────────────────

function MetricsBar({
  confirmedCount,
  confirmedRevenue,
  opsPulseAt,
  lastSyncAt,
}: {
  confirmedCount: number;
  confirmedRevenue: number;
  opsPulseAt: number;
  lastSyncAt: number;
}) {
  const bookings = BASE_METRICS.bookings + confirmedCount;
  const revenue = BASE_METRICS.revenue + confirmedRevenue;
  const otaSaved = Math.round(revenue * 0.15);

  // Animate numbers smoothly on mount and when values change (e.g. after payment confirmation)
  const displayBookings = useCountUp(bookings);
  const displayRevenue = useCountUp(revenue);
  const displayOta = useCountUp(otaSaved);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1200);
    return () => clearInterval(t);
  }, []);

  const values: Record<typeof METRIC_DEFS[number]["key"], { display: string; sub: string; trend: string }> = {
    bookings: {
      display: String(displayBookings),
      sub: `€${(2480 + confirmedRevenue).toLocaleString()} revenue`,
      trend: `+${confirmedCount > 0 ? confirmedCount + 2 : 2} vs yesterday`,
    },
    revenue: {
      display: `€${displayRevenue.toLocaleString()}`,
      sub: "direct bookings · this week",
      trend: `+€${(890 + confirmedRevenue).toLocaleString()} vs last week`,
    },
    ota: {
      display: `€${displayOta.toLocaleString()}`,
      sub: "15% rate on direct only",
      trend: `+€${Math.round((133 + confirmedRevenue * 0.15)).toLocaleString()} this week`,
    },
    response: {
      display: BASE_METRICS.responseTime,
      sub: "vs. 4h industry average",
      trend: "↓ 12s faster than last wk",
    },
    leads: {
      display: String(BASE_METRICS.leadsAfterHours),
      sub: "would've gone unanswered",
      trend: "100% captured",
    },
  };

  return (
    <div className="shrink-0 border-b border-white/[0.03] bg-zinc-950/55">
      <div className="flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/24">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400/70 animate-live-pulse" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            </span>
            Canlı operasyon
          </span>
          <span className="text-white/10">·</span>
          <span className={cn("text-white/22", opsPulseAt ? "animate-tick-fade" : "")}>
            güncellendi {timeAgoCompact(nowMs, lastSyncAt)} önce
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/18">
          <span className="hidden sm:inline">Örnek veri</span>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-medium text-white/22">demo</span>
        </div>
      </div>

      <div className="conv-scroll flex gap-0 overflow-x-auto border-t border-white/[0.03] md:grid md:grid-cols-5 md:overflow-visible">
      {METRIC_DEFS.map((m, i) => {
        const v = values[m.key];
        return (
          <div
            key={m.key}
            className={cn(
              "flex min-w-[148px] shrink-0 items-center gap-3.5 px-4 py-4 md:min-w-0 md:px-5 md:py-5",
              i < METRIC_DEFS.length - 1 && "border-r border-white/[0.03]"
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                m.iconBg
              )}
            >
              <m.icon className={cn("w-3.5 h-3.5", m.color)} />
            </div>

            {/* Value + labels */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-[17px] font-bold tabular-nums leading-none transition-all duration-700",
                    m.color
                  )}
                >
                  {v.display}
                </span>
                {/* Revenue metric gets a larger, more prominent week comparison */}
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-medium leading-none",
                    m.key === "revenue"
                      ? "text-[11px] text-emerald-400/75"
                      : "text-[10px] text-emerald-400/50"
                  )}
                >
                  <ArrowUpRight className={cn("shrink-0", m.key === "revenue" ? "w-3 h-3" : "w-2.5 h-2.5")} />
                  {v.trend}
                </span>
              </div>
              <p className="text-[10px] text-white/42 mt-1.5 truncate font-medium">{m.label}</p>
              <p className="text-[9px] text-white/24 mt-0.5 truncate">{v.sub}</p>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function OpsLiveChip({ phase, pulseKey }: { phase: OpsPhase; pulseKey: number }) {
  const meta = useMemo(() => {
    if (phase === "idle") return null;
    return OPS_PHASES.find((p) => p.phase === phase) ?? OPS_PHASES[0];
  }, [phase]);

  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <span
      key={`${phase}-${pulseKey}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium",
        meta.wrap,
        meta.text,
        "animate-tick-fade"
      )}
      title={meta.sub}
    >
      <Icon className={cn("h-3 w-3 shrink-0", phase === "checking_availability" ? "animate-spin [animation-duration:2.6s]" : "")} />
      <span className="hidden sm:inline">{meta.label}</span>
      <span className="text-white/18 hidden sm:inline">·</span>
      <span className="hidden sm:inline text-white/40">{meta.sub}</span>
      <span className="sm:hidden">AI</span>
    </span>
  );
}

// ─── ConvList ─────────────────────────────────────────────────────────────────

function ConvList({
  activeTab,
  setActiveTab,
  search,
  setSearch,
  selected,
  setSelected,
  filtered,
  localUnreads,
  localLastMsgs,
  localStatuses,
  localLeadStatuses,
  localTyping,
  locale = "tr",
  queueStats,
  convOverlays,
  channelFilter,
  onChannelFilterChange,
  isPulsing,
  onClearPulse,
  queueLoading = false,
  className,
  mobileCompact = false,
}: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  search: string;
  setSearch: (s: string) => void;
  selected: string;
  setSelected: (id: string) => void;
  filtered: typeof CONVERSATIONS;
  localUnreads: Record<string, number>;
  localLastMsgs: Record<string, string>;
  localStatuses: Record<string, ConversationStatus>;
  localLeadStatuses: Record<string, LeadStatus>;
  localTyping: Record<string, boolean>;
  locale?: "tr" | "en";
  queueStats?: LiveQueueStats;
  convOverlays?: Record<string, LiveConvOverlay>;
  channelFilter: import("@/lib/channels/types").ChannelFilter;
  onChannelFilterChange: (f: import("@/lib/channels/types").ChannelFilter) => void;
  isPulsing: (id: string) => boolean;
  onClearPulse: (id: string) => void;
  queueLoading?: boolean;
  className?: string;
  mobileCompact?: boolean;
}) {
  const t = useTranslations("conversations");
  const tCommon = useTranslations("common");
  const headerStats = queueStats
    ? [
        { label: t("stats.active"), value: queueStats.activeCount, color: "text-blue-400", bg: "bg-blue-500/[0.06] border-blue-500/[0.1]" },
        { label: t("stats.atRisk"), value: queueStats.pendingRevenue, color: "text-amber-400", bg: "bg-amber-500/[0.06] border-amber-500/[0.1]" },
        { label: t("stats.confirmed"), value: queueStats.confirmedCount, color: "text-emerald-400", bg: "bg-emerald-500/[0.06] border-emerald-500/[0.1]" },
      ]
    : [
        { label: "Aktif", value: "4", color: "text-blue-400", bg: "bg-blue-500/[0.06] border-blue-500/[0.1]" },
        { label: "Bekleyen gelir", value: "€3.4k", color: "text-amber-400", bg: "bg-amber-500/[0.06] border-amber-500/[0.1]" },
        { label: "Onaylı", value: "3", color: "text-emerald-400", bg: "bg-emerald-500/[0.06] border-emerald-500/[0.1]" },
      ];

  return (
    <div
      className={cn(
        "flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-white/[0.03] bg-zinc-950/35",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "border-b border-white/[0.03] px-4 pb-5 pt-6",
          mobileCompact && "px-3 pb-3 pt-4"
        )}
      >
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-white">
              {t("title")}
            </h1>
            <p className="mt-1 text-[11px] leading-relaxed text-white/30">
              Grand Hotel Demo
              <span className="mx-1.5 text-white/12">·</span>
              <span className="text-blue-400/75">{t("subtitle")}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.08] px-2.5 py-1 transition-colors duration-200 hover:border-blue-500/30 hover:bg-blue-500/[0.11]">
              <Bot className="h-2.5 w-2.5 text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400/95">
                {queueStats
                  ? t("activeProcesses", { count: queueStats.activeCount })
                  : t("activeProcesses", { count: 4 })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400/90" />
              <span className="text-[9px] font-medium uppercase tracking-wide text-white/22">{tCommon("live")}</span>
            </div>
          </div>
        </div>

        {/* KPI stats */}
        <div className={cn("mb-4 mt-5 grid grid-cols-3 gap-2.5", mobileCompact && "hidden")}>
          {headerStats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-lg border px-2.5 py-3 text-center transition-colors duration-200 hover:bg-white/[0.02]",
                stat.bg
              )}
            >
              <p className={cn("text-[16px] font-bold tabular-nums leading-none", stat.color)}>{stat.value}</p>
              <p className="mt-2 text-[9px] font-medium uppercase tracking-wider text-white/28">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* OTA dependency risk insight */}
        <div
          className={cn(
            "mb-4 flex items-center gap-2.5 rounded-lg border border-amber-500/[0.08] bg-amber-500/[0.04] px-3 py-3",
            mobileCompact && "hidden"
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400/55" />
          <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-white/38">
            OTA route costs you{" "}
            <span className="font-semibold text-amber-400/75">15–20%</span> per booking
            <span className="mx-1 text-white/12">·</span>
            <span className="font-medium text-emerald-400/65">€634 saved this week</span>
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/22" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.035] py-2 pl-9 pr-3 text-[12px] text-white placeholder:text-white/22 transition-[border-color,background-color,box-shadow] duration-200 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-blue-500/25 focus:border-blue-500/35"
          />
        </div>
      </div>

      <ChannelFilters value={channelFilter} onChange={onChannelFilterChange} />

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-white/[0.03] px-3 py-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md py-2.5 text-[11px] font-medium transition-colors duration-200 ease-out",
              activeTab === t.id
                ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-white/32 hover:bg-white/[0.04] hover:text-white/55"
            )}
          >
            {t.id === "ai_active" && (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-400/90" />
            )}
            {t.id === "human_takeover" && t.count > 0 && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/90" />
            )}
            <span className="truncate">{t.label}</span>
            <span
              className={cn(
                "min-w-[18px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums transition-colors duration-200",
                activeTab === t.id ? "bg-white/[0.08] text-white/55" : "bg-white/[0.04] text-white/22"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="conv-scroll flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto px-2.5 py-3">
        {queueLoading ? <QueueSkeleton rows={6} /> : null}
        {/* Waiting guests triage — only visible when staff attention is needed */}
        {!queueLoading &&
        (() => {
          const waiting = filtered.filter(
            (c) => c.status === "human_takeover" && (localUnreads[c.id] ?? c.unread) > 0
          );
          if (waiting.length === 0) return null;
          return (
            <div className="mx-2 mb-3 mt-1 rounded-lg border border-amber-500/[0.12] bg-amber-500/[0.04] px-3 py-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400/85" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/75">
                  {op("guestWaitingStaff", "tr", { count: waiting.length })}
                </span>
              </div>
              {waiting.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="mt-1 flex w-full items-center gap-2 rounded-md py-1 text-left text-[10px] text-white/55 transition-colors duration-200 hover:bg-white/[0.04] hover:text-white/75"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", c.contact.avatarColor)} />
                  <span className="truncate font-medium">{c.contact.name}</span>
                  <span className="shrink-0 text-white/12">·</span>
                  <span className="shrink-0 font-medium text-amber-400/70">{c.time}</span>
                </button>
              ))}
            </div>
          );
        })()}

        {!queueLoading &&
        filtered.map((conv) => {
          const revenue = CONV_REVENUE[conv.id];
          const isSelected = selected === conv.id;
          const overlay = convOverlays?.[conv.id];
          const unread = localUnreads[conv.id] ?? overlay?.unread ?? conv.unread;
          const lastMsg = localLastMsgs[conv.id] ?? overlay?.lastMessage ?? conv.lastMessage;
          const hasUnread = unread > 0;
          const effectiveConvStatus = localStatuses[conv.id] ?? overlay?.status ?? conv.status;
          const effectiveConvLeadStatus = localLeadStatuses[conv.id] ?? conv.leadStatus;
          const isAiHandling = effectiveConvStatus === "ai_active";
          const isAiWorking = isAiHandling && (localTyping[conv.id] ?? CHAT_THREADS[conv.id]?.aiTyping ?? false);
          // Show waiting indicator only for human_takeover with unread messages
          const isWaiting = effectiveConvStatus === "human_takeover" && hasUnread && !isSelected;
          const pulsing = isPulsing(conv.id);

          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setSelected(conv.id);
                onClearPulse(conv.id);
              }}
              className={cn(
                "group w-full rounded-lg border-l-2 py-3.5 pl-3.5 pr-3.5 text-left transition-[background-color,border-color,box-shadow] duration-200 ease-out",
                pulsing && "queue-new-glow ring-1 ring-blue-500/20",
                isSelected
                  ? "border-amber-400/60 bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]"
                  : isWaiting
                  ? "border-amber-400/20 bg-amber-500/[0.025] hover:border-amber-400/35 hover:bg-amber-500/[0.045]"
                  : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.035]",
                !isSelected && hasUnread && !isWaiting && "bg-blue-500/[0.02] hover:bg-blue-500/[0.035]"
              )}
            >
              <div className="flex gap-3">
                <div className="relative shrink-0 pt-0.5">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-white ring-1 ring-black/25 ring-inset",
                      conv.contact.avatarColor
                    )}
                  >
                    {conv.contact.initials}
                  </div>
                  <span
                    className="pointer-events-none absolute bottom-0 left-0 z-[2] flex h-[15px] w-[15px] translate-x-[-2px] translate-y-[3px] items-center justify-center rounded-md border border-white/[0.1] bg-zinc-950/95 shadow-sm backdrop-blur-[2px] transition-transform duration-200 group-hover:translate-y-[2px]"
                    title={channelDisplayLabel(conv.channel)}
                  >
                    <ChannelGlyph channel={conv.channel} className="h-2 w-2" />
                  </span>
                  {effectiveConvStatus === "ai_active" && (
                    <span className="absolute -bottom-0.5 -right-0.5 z-[1] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-zinc-950 bg-blue-600 shadow-sm">
                      <Bot className="h-1.5 w-1.5 text-white" />
                    </span>
                  )}
                  {effectiveConvStatus === "human_takeover" && (
                    <span className="absolute -bottom-0.5 -right-0.5 z-[1] h-3.5 w-3.5 rounded-full border-2 border-zinc-950 bg-amber-500 shadow-sm" />
                  )}
                  {effectiveConvStatus === "resolved" && (
                    <span className="absolute -bottom-0.5 -right-0.5 z-[1] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-700 shadow-sm">
                      <CheckCircle2 className="h-2 w-2 text-white/65" />
                    </span>
                  )}
                  {hasUnread && (
                    <span
                      className={cn(
                        "absolute -right-0.5 -top-0.5 z-[3] flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-1 ring-black/35 transition-transform duration-200 group-hover:scale-[1.02]",
                        isWaiting ? "bg-amber-500 animate-ring-amber" : "bg-blue-500/95"
                      )}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-sm font-medium tracking-tight transition-colors duration-200",
                          hasUnread ? "text-white" : "text-white/78 group-hover:text-white/88"
                        )}
                      >
                        {conv.contact.name}
                      </span>
                      <LanguageFlag lang={conv.language} />
                      {isAiWorking && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/18 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-200/80 animate-tick-fade">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400/90 animate-live-pulse" />
                          AI yanıtlıyor
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 pt-0.5 text-[10px] font-medium tabular-nums tracking-tight transition-colors duration-200",
                        isWaiting
                          ? "text-amber-400/75"
                          : isSelected
                          ? "text-white/34"
                          : "text-white/22 group-hover:text-white/34"
                      )}
                    >
                      {isWaiting ? `Waiting · ${conv.time.replace(" ago", "")}` : conv.time}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mb-3 line-clamp-2 text-[11px] leading-relaxed transition-colors duration-200",
                      hasUnread ? "text-white/46" : isSelected ? "text-white/34" : "text-white/26 group-hover:text-white/34"
                    )}
                  >
                    {lastMsg}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", !isSelected && "opacity-[0.85]")}>
                      <StatusBadge status={effectiveConvStatus} />
                      <LeadBadge status={effectiveConvLeadStatus} />
                      {overlay?.paymentRisk ? (
                        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-amber-200/90">
                          {t("paymentBadge")}
                        </span>
                      ) : null}
                      {overlay?.recoveryActive ? (
                        <span className="rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-violet-200/85">
                          AI
                        </span>
                      ) : null}
                    </div>
                    {revenue && (
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-semibold tabular-nums transition-colors duration-200",
                          revenue.status === "confirmed"
                            ? "text-emerald-400/80"
                            : revenue.status === "pending"
                            ? "text-amber-400/80"
                            : "text-blue-400/80"
                          ,
                          !isSelected && "opacity-[0.72] group-hover:opacity-[0.9]"
                        )}
                      >
                        {revenue.value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {!queueLoading && filtered.length === 0 && (
          <OperationalEmptyState
            icon={Inbox}
            title={op("emptyQueue", locale)}
            description={op("emptyQueueDetail", locale)}
            compact
          />
        )}
      </div>
    </div>
  );
}

// ─── GuestSidebar ─────────────────────────────────────────────────────────────

function GuestSidebar({
  conv,
  thread,
  effectiveStatus,
  effectiveReservation,
  latestPaymentEvent,
  latestLifecycleEvent,
  sentLink,
  onSendPaymentLink,
  onLifecycleAction,
  pendingLifecycleAction,
  activeLifecycleState,
  onTakeover,
  onHandToAI,
  reservationsHref,
  locale = "tr",
  compact = false,
  aiConfidence,
  guestSummary,
  suggestedAction,
  aiReservationStage,
  requiresHuman,
  aiStatusLabel,
  pendingAiReply,
  operationStage,
  operationChannel,
  operationBookingValue,
  operationSuggestedAction,
  operationLastActivity,
  operationFeed,
}: {
  conv: Conversation;
  thread: ChatThread;
  effectiveStatus: ConversationStatus;
  effectiveReservation: ConvReservation | undefined;
  latestPaymentEvent?: NonNullable<OperationConversation["latestPaymentEvent"]>;
  latestLifecycleEvent?: NonNullable<OperationConversation["latestLifecycleEvent"]>;
  sentLink: boolean;
  onSendPaymentLink: () => void;
  onLifecycleAction: (action: ReservationLifecycleAction) => void;
  pendingLifecycleAction: ReservationLifecycleActionState | null;
  activeLifecycleState?: ReservationLifecycleActionState;
  onTakeover: () => void;
  onHandToAI: () => void;
  reservationsHref: string;
  locale?: "tr" | "en";
  compact?: boolean;
  aiConfidence?: number;
  guestSummary?: string;
  suggestedAction?: string;
  aiReservationStage?: string;
  requiresHuman?: boolean;
  aiStatusLabel?: string;
  pendingAiReply?: string;
  operationStage?: string;
  operationChannel?: string;
  operationBookingValue?: number;
  operationSuggestedAction?: string;
  operationLastActivity?: string;
  operationFeed?: OperationFeedItem[];
}) {
  const t = useTranslations("conversations");
  const tCommon = useTranslations("common");
  const r = effectiveReservation as ConvReservation;
  const confidence = aiConfidence ?? 87;
  const outcome = deriveOperationalOutcome({
    conv,
    reservation: effectiveReservation,
    latestPaymentEvent,
    latestLifecycleEvent,
    effectiveStatus,
    requiresHuman,
    operationBookingValue,
  });
  const showPaymentBtn = outcome.canSendPaymentLink;
  const lifecycleActions = visibleLifecycleActions(outcome);
  const showLifecycleActions = lifecycleActions.length > 0;
  const confirmedActive =
    r?.status === "confirmed" ||
    latestLifecycleEvent?.state === "confirmed" ||
    latestPaymentEvent?.state === "paid";
  const paymentAmount = resolvePaymentAmount({
    event: latestPaymentEvent,
    reservation: effectiveReservation,
    bookingValue: operationBookingValue,
    conversationId: conv.id,
    confirmed: confirmedActive,
  });
  const paymentDisplayState = confirmedActive ? "paid" : latestPaymentEvent?.state;

  return (
    <div className={cn("flex w-full flex-col", compact ? "bg-transparent" : "conv-scroll shrink-0 overflow-y-auto bg-zinc-950/40 lg:w-[284px]")}>
      {operationChannel ? (
        <div className={cn("border-b border-white/[0.03] px-5 py-4", compact && "px-4 py-3")}>
          <SidebarLabel>{op("channelLabel")}</SidebarLabel>
          <ChannelBadge channel={conv.channel} size="md" />
          {operationStage ? (
            <p className="mt-3 text-[11px] text-white/40">
              {op("reservationStatusLabel")}:{" "}
              <span className="font-medium text-white/70">{operationStage}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Guest profile */}
      <div className="border-b border-white/[0.03] px-5 py-6">
        <SidebarLabel>{t("guest")}</SidebarLabel>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ring-1 ring-white/[0.06]",
                conv.contact.avatarColor
              )}
            >
              {conv.contact.initials}
            </div>
            <span
              className="pointer-events-none absolute bottom-0 left-0 z-[1] flex h-[15px] w-[15px] translate-x-[-2px] translate-y-[3px] items-center justify-center rounded-md border border-white/[0.1] bg-zinc-950/95 shadow-sm"
              title={channelDisplayLabel(conv.channel)}
            >
              <ChannelGlyph channel={conv.channel} className="h-2 w-2" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight tracking-tight text-white">
              {conv.contact.name}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <LanguageFlag lang={conv.language} />
              <span className="text-[11px] text-white/34">
                {conv.language} {op("speakerSuffix")}
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-[11px] text-white/36">
            <Phone className="h-3 w-3 shrink-0 opacity-80" />
            <span className="font-mono">{conv.contact.phone}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-white/34">
            <Clock className="h-3 w-3 shrink-0 opacity-80" />
            <span>
              {conv.messageCount} messages · {conv.time}
            </span>
          </div>
        </div>
      </div>

      <OperationalOutcomeCard outcome={outcome} />

      {/* Booking summary */}
      {false && r && (
        <div className="border-b border-white/[0.03] px-5 py-6">
          <SidebarLabel>{t("reservation")}</SidebarLabel>
          <div
            className={cn(
              "rounded-xl border p-5 transition-all duration-500",
              r.status === "confirmed"
                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                : r.status === "cancelled"
                ? "border-rose-500/20 bg-rose-500/[0.04]"
                : r.status === "pending_payment"
                ? "border-amber-500/24 bg-amber-500/[0.05]"
                : r.status === "human_review"
                ? "border-amber-500/24 bg-amber-500/[0.05]"
                : "border-blue-500/20 bg-blue-500/[0.04]"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-white/38">#{r.ref}</span>
              <span
                className={cn(
                  "text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all duration-500",
                  r.status === "confirmed"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : r.status === "cancelled"
                    ? "bg-rose-500/15 text-rose-300"
                    : r.status === "pending_payment"
                    ? "bg-amber-500/15 text-amber-400"
                    : r.status === "human_review"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-blue-500/15 text-blue-400"
                )}
              >
                {r.status === "confirmed"
                  ? tCommon("confirmed")
                  : r.status === "cancelled"
                  ? "İptal edildi"
                  : r.status === "human_review"
                  ? "Operatör incelemesi"
                  : r.status === "pending_payment"
                  ? tCommon("pendingPayment")
                  : tCommon("quoteSent")}
              </span>
            </div>
            <p className="text-[12px] font-semibold text-white/88 mb-4 leading-snug">{r.room}</p>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-white/45">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" />Check-in</span>
                <span className="text-white/70 font-medium">{r.checkIn}</span>
              </div>
              <div className="flex items-center justify-between text-white/45">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" />Check-out</span>
                <span className="text-white/70 font-medium">{r.checkOut}</span>
              </div>
              <div className="flex items-center justify-between text-white/45">
                <span className="flex items-center gap-1.5"><Users className="w-3 h-3" />Guests</span>
                <span className="text-white/70 font-medium">{r.guests} · {r.nights} nights</span>
              </div>
            </div>
            <div className="mt-5 border-t border-white/[0.045] pt-4 flex items-baseline justify-between">
              <span className="text-[10px] font-medium text-white/32">Total</span>
              <span className="text-[20px] font-bold text-white tabular-nums tracking-tight">
                {r.currency}{r.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {false && (latestPaymentEvent || r || latestLifecycleEvent) ? (
        <div className="border-b border-white/[0.03] px-5 py-6">
          <SidebarLabel>Ödeme durumu</SidebarLabel>
          <div
            className={cn(
              "space-y-3 rounded-xl border p-4",
              confirmedActive
                ? "border-emerald-500/22 bg-emerald-500/[0.045]"
                : "border-white/[0.05] bg-white/[0.025]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-white/38">
                  #{r?.ref ?? latestPaymentEvent?.reservation_id?.slice(0, 8).toUpperCase() ?? "DEMO"}
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-white/88">
                  {r?.room ?? "Rezervasyon kaydı"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                  {confirmedActive ? "Onaylandı" : confirmationStateLabel(latestLifecycleEvent?.state, r?.status)}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", paymentStateClass(paymentDisplayState, r?.status))}>
                  {paymentStateLabel(paymentDisplayState, r?.status)}
                </span>
              </div>
            </div>
            {r ? (
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-3 text-[10px]">
                <div className="text-white/38">
                  Giriş <span className="block font-medium text-white/72">{r.checkIn}</span>
                </div>
                <div className="text-white/38">
                  Çıkış <span className="block font-medium text-white/72">{r.checkOut}</span>
                </div>
                <div className="text-white/38">
                  Misafir <span className="block font-medium text-white/72">{r.guests}</span>
                </div>
                <div className="text-white/38">
                  Gece <span className="block font-medium text-white/72">{r.nights}</span>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-white/36">Tutar</span>
              <span className="text-[18px] font-bold text-white tabular-nums tracking-tight">
                {paymentAmount.label}
              </span>
            </div>
            {latestPaymentEvent ? (
              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-[11px] font-semibold leading-snug text-white/78">
                  {latestPaymentEvent!.title}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                  {latestPaymentEvent!.description}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-white/36">Rezervasyon</span>
              <span className="font-semibold text-white/68">
                {confirmedActive
                  ? "Onaylandı"
                  : confirmationStateLabel(latestLifecycleEvent?.state, r?.status)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="border-b border-white/[0.03] px-5 py-6">
        <SidebarLabel>{t("quickActions")}</SidebarLabel>
        <div className="flex flex-col gap-3">
          {showLifecycleActions ? (
            <div className="grid grid-cols-1 gap-2">
              {lifecycleActions.map((action) => {
                const Icon = action.icon;
                const active = activeLifecycleState === action.state;
                const pending = pendingLifecycleAction === action.state;
                return (
                  <button
                    key={action.state}
                    type="button"
                    onClick={() => onLifecycleAction(action)}
                    disabled={Boolean(pendingLifecycleAction)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[12px] font-semibold transition-[background-color,color,border-color,transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
                      active
                        ? "border-emerald-500/24 bg-emerald-500/10 text-emerald-200"
                        : action.severity === "success"
                          ? "border-blue-500/18 bg-blue-500/[0.07] text-blue-100/85 hover:border-blue-500/28 hover:bg-blue-500/[0.1]"
                          : "border-amber-500/18 bg-amber-500/[0.06] text-amber-100/84 hover:border-amber-500/28 hover:bg-amber-500/[0.1]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{action.label}</span>
                    {pending ? (
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin opacity-70" />
                    ) : active ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {showPaymentBtn && !showLifecycleActions && (
            <button
              type="button"
              onClick={onSendPaymentLink}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12px] font-semibold transition-[background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]",
                sentLink
                  ? "border-emerald-500/22 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/22 bg-amber-500/14 text-amber-200 hover:border-amber-500/30 hover:bg-amber-500/[0.18]"
              )}
            >
              {sentLink ? (
                <><CheckCircle2 className="w-4 h-4 shrink-0" />{t("paymentLinkSent")}</>
              ) : (
                <><CreditCard className="w-4 h-4 shrink-0" />{t("sendPaymentLink")}</>
              )}
            </button>
          )}
          {effectiveStatus === "ai_active" && (
            <button
              type="button"
              onClick={onTakeover}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 text-[12px] font-medium text-white/42 transition-[background-color,color,border-color,transform] duration-200 hover:border-white/[0.09] hover:bg-white/[0.045] hover:text-white/65 active:scale-[0.98]"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              {t("takeover")}
            </button>
          )}
          {effectiveStatus === "human_takeover" && (
            <button
              type="button"
              onClick={onHandToAI}
              className="flex w-full items-center gap-2.5 rounded-xl border border-blue-500/18 bg-blue-500/[0.08] px-3.5 py-2.5 text-[12px] font-medium text-blue-300/90 transition-[background-color,border-color,transform] duration-200 hover:border-blue-500/26 hover:bg-blue-500/[0.12] active:scale-[0.98]"
            >
              <Bot className="w-4 h-4 shrink-0" />
              {t("handToAi")}
            </button>
          )}
          {r && (
            <Link
              href={reservationsHref}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.05] bg-transparent px-3.5 py-2.5 text-[12px] font-medium text-white/34 transition-[background-color,color,border-color,transform] duration-200 hover:border-white/[0.08] hover:bg-white/[0.035] hover:text-white/55 active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {t("viewReservation")}
            </Link>
          )}
        </div>
      </div>

      {operationFeed?.length ? (
        <OperationFeedPanel events={operationFeed} />
      ) : null}

      {/* AI Context */}
      <div className="px-5 py-6 pb-8">
        <SidebarLabel>{t("guestSummary")}</SidebarLabel>
        <div className="flex flex-col gap-5">
          {aiStatusLabel ? (
            <p className="rounded-lg border border-blue-500/18 bg-blue-500/[0.05] px-3 py-2 text-[11px] font-medium text-blue-200/85">
              {aiStatusLabel}
            </p>
          ) : null}
          {requiresHuman ? (
            <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[11px] font-medium text-rose-200/88">
              {op("humanSupportRequired")}
            </p>
          ) : null}
          {pendingAiReply ? (
            <div className="rounded-lg border border-amber-500/18 bg-amber-500/[0.05] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-300/75">
                {op("aiSuggestionPending")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-100/85">{pendingAiReply}</p>
            </div>
          ) : null}
          {guestSummary ? (
            <p className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-white/50">
              {guestSummary}
            </p>
          ) : null}
          {(operationSuggestedAction || suggestedAction) ? (
            <div className="rounded-lg border border-cyan-500/18 bg-cyan-500/[0.04] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400/70">
                {op("suggestedActionLabel")}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-cyan-100/85">
                {operationSuggestedAction ?? suggestedAction}
              </p>
            </div>
          ) : null}
          {operationBookingValue ? (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/26">{op("estimatedBookingValue")}</span>
              <span className="font-semibold text-emerald-400/85 tabular-nums">
                ₺{operationBookingValue.toLocaleString("tr-TR")}
              </span>
            </div>
          ) : null}
          {operationLastActivity ? (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/26">{op("lastActivity")}</span>
              <span className="text-white/55">{operationLastActivity}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="shrink-0 text-white/26">{t("reservationStage")}</span>
            <span
              className={cn(
                "px-2.5 py-1 rounded-full font-semibold shrink-0",
                conv.leadStatus === "confirmed" || aiReservationStage === "Onaylandı"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : conv.leadStatus === "quoted" || aiReservationStage?.includes("Teklif")
                  ? "bg-blue-500/15 text-blue-400"
                  : conv.leadStatus === "qualified"
                  ? "bg-violet-500/15 text-violet-400"
                  : "bg-white/[0.05] text-white/34"
              )}
            >
              {operationStage ??
                aiReservationStage ??
                conv.leadStatus.charAt(0).toUpperCase() + conv.leadStatus.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="shrink-0 text-white/26">{t("handledBy")}</span>
            <span
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold transition-all shrink-0",
                effectiveStatus === "ai_active"
                  ? "bg-blue-500/15 text-blue-400"
                  : effectiveStatus === "human_takeover"
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-white/[0.05] text-white/34"
              )}
            >
              {effectiveStatus === "ai_active" ? (
                <><Bot className="w-3 h-3" />{op("handledByAi")}</>
              ) : effectiveStatus === "human_takeover" ? (
                <><User className="w-3 h-3" />{op("handledByStaff")}</>
              ) : (
                <><CheckCircle2 className="w-3 h-3" />{op("handledByClosed")}</>
              )}
            </span>
          </div>
          {effectiveStatus === "ai_active" && (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="text-white/26">AI destek seviyesi</span>
                <span className="text-white/56 font-semibold tabular-nums">{confidence}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all opacity-[0.9]"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-white/24">
            <TrendingUp className="h-3 w-3 shrink-0 opacity-80" />
            <span>
              {op("viaChannel", "tr", {
                channel: channelDisplayLabel(conv.channel),
                time: conv.time,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SidebarLabel ─────────────────────────────────────────────────────────────

function OperationFeedPanel({ events }: { events: OperationFeedItem[] }) {
  return (
    <div className="border-b border-white/[0.03] px-5 py-6">
      <SidebarLabel>Son operasyon hareketleri</SidebarLabel>
      <div className="space-y-2.5">
        {events.slice(0, 3).map((event) => {
          const view = operationFeedView(event.severity);
          return (
            <div key={event.id} className={cn("rounded-lg border px-3 py-2.5", view.className)}>
              <div className="flex items-start gap-2.5">
                <view.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", view.iconClass)} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold leading-snug text-white/82">{event.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/40">{event.description}</p>
                  <p className="mt-1 text-[10px] text-white/24">{formatOperationEventTime(event.timestamp)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function operationFeedView(severity: OperationFeedItem["severity"]) {
  if (severity === "success") {
    return {
      icon: CheckCircle2,
      iconClass: "text-emerald-300/80",
      className: "border-emerald-500/14 bg-emerald-500/[0.04]",
    };
  }

  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      iconClass: "text-amber-300/80",
      className: "border-amber-500/16 bg-amber-500/[0.045]",
    };
  }

  if (severity === "error") {
    return {
      icon: AlertCircle,
      iconClass: "text-red-300/80",
      className: "border-red-500/16 bg-red-500/[0.045]",
    };
  }

  return {
    icon: MessageSquare,
    iconClass: "text-blue-300/80",
    className: "border-blue-500/14 bg-blue-500/[0.04]",
  };
}

function formatOperationEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "az önce";

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const OUTCOME_TONES: Record<OperationalOutcomeKind, OperationalOutcomeTone> = {
  confirmed: {
    border: "border-emerald-500/22",
    bg: "bg-emerald-500/[0.045]",
    iconBg: "bg-emerald-500/14",
    icon: "text-emerald-300",
    badge: "border-emerald-500/24 bg-emerald-500/14 text-emerald-300",
    dot: "bg-emerald-300",
    amount: "text-emerald-50",
    separator: "border-emerald-500/12",
  },
  payment_pending: {
    border: "border-amber-500/24",
    bg: "bg-amber-500/[0.05]",
    iconBg: "bg-amber-500/14",
    icon: "text-amber-300",
    badge: "border-amber-500/24 bg-amber-500/14 text-amber-300",
    dot: "bg-amber-300 animate-pulse",
    amount: "text-amber-50",
    separator: "border-amber-500/12",
  },
  cancelled: {
    border: "border-rose-500/24",
    bg: "bg-rose-500/[0.045]",
    iconBg: "bg-rose-500/14",
    icon: "text-rose-300",
    badge: "border-rose-500/24 bg-rose-500/14 text-rose-300",
    dot: "bg-rose-300",
    amount: "text-white/78",
    separator: "border-rose-500/12",
  },
  quote: {
    border: "border-blue-500/22",
    bg: "bg-blue-500/[0.045]",
    iconBg: "bg-blue-500/14",
    icon: "text-blue-300",
    badge: "border-blue-500/24 bg-blue-500/14 text-blue-300",
    dot: "bg-blue-300",
    amount: "text-blue-50",
    separator: "border-blue-500/12",
  },
  human_takeover: {
    border: "border-violet-500/22",
    bg: "bg-violet-500/[0.045]",
    iconBg: "bg-violet-500/14",
    icon: "text-violet-300",
    badge: "border-violet-500/24 bg-violet-500/14 text-violet-300",
    dot: "bg-violet-300 animate-pulse",
    amount: "text-white/82",
    separator: "border-violet-500/12",
  },
  closed_without_reservation: {
    border: "border-white/[0.07]",
    bg: "bg-white/[0.025]",
    iconBg: "bg-white/[0.055]",
    icon: "text-white/45",
    badge: "border-white/[0.08] bg-white/[0.05] text-white/48",
    dot: "bg-white/35",
    amount: "text-white/70",
    separator: "border-white/[0.05]",
  },
};

function deriveOperationalOutcome(input: {
  conv: Conversation;
  reservation?: ConvReservation;
  latestPaymentEvent?: NonNullable<OperationConversation["latestPaymentEvent"]>;
  latestLifecycleEvent?: NonNullable<OperationConversation["latestLifecycleEvent"]>;
  effectiveStatus: ConversationStatus;
  requiresHuman?: boolean;
  operationBookingValue?: number;
}): OperationalOutcomeView {
  const { conv, reservation: r, latestPaymentEvent, latestLifecycleEvent } = input;
  const lifecycleState = latestLifecycleEvent?.state;
  const paymentState = latestPaymentEvent?.state;

  const isCancelled =
    r?.status === "cancelled" ||
    lifecycleState === "cancelled" ||
    lifecycleState === "expired" ||
    paymentState === "expired" ||
    paymentState === "refunded";
  // Payment lifecycle is authoritative: a created/optioned (or stale-confirmed) reservation
  // is NOT "paid" while the latest payment event is still link-sent / pending / failed.
  const paymentNotCollected =
    paymentState === "payment_link_sent" ||
    paymentState === "payment_pending" ||
    paymentState === "failed";
  const isPaid =
    !paymentNotCollected &&
    (paymentState === "paid" || r?.status === "confirmed" || lifecycleState === "confirmed");
  const isConfirmed = !isCancelled && isPaid;
  const isHuman =
    !isCancelled &&
    !isConfirmed &&
    (input.requiresHuman || input.effectiveStatus === "human_takeover" || r?.status === "human_review");
  const hasReservationRecord = Boolean(r || latestLifecycleEvent?.reservation_id || latestPaymentEvent?.reservation_id);
  const isPaymentPending =
    !isCancelled &&
    !isConfirmed &&
    !isHuman &&
    (r?.status === "pending_payment" ||
      lifecycleState === "payment_link_sent" ||
      lifecycleState === "payment_pending" ||
      paymentState === "payment_link_sent" ||
      paymentState === "payment_pending" ||
      paymentState === "failed");
  const isQuote =
    !isCancelled &&
    !isConfirmed &&
    !isHuman &&
    !isPaymentPending &&
    (r?.status === "quoted" ||
      lifecycleState === "quote_prepared" ||
      lifecycleState === "quote_sent" ||
      conv.leadStatus === "quoted");

  const kind: OperationalOutcomeKind = isCancelled
    ? "cancelled"
    : isConfirmed
      ? "confirmed"
      : isHuman
        ? "human_takeover"
        : isPaymentPending
          ? "payment_pending"
          : isQuote
            ? "quote"
            : "closed_without_reservation";

  const amount = resolvePaymentAmount({
    event: latestPaymentEvent,
    reservation: r,
    bookingValue: input.operationBookingValue,
    conversationId: conv.id,
    confirmed: isConfirmed,
  });
  const displayAmount = amount.value !== undefined && amount.value > 0 ? amount : undefined;
  const ref = r?.ref ?? latestLifecycleEvent?.reservation_id ?? latestPaymentEvent?.reservation_id;
  const shortRef = ref ? ref.slice(0, 12).toUpperCase() : undefined;
  const idLabel = kind === "quote" ? "Teklif ID" : hasReservationRecord ? "Rezervasyon ID" : undefined;

  const base = {
    idLabel,
    idValue: shortRef,
    offerId: kind === "quote" ? shortRef : undefined,
    room: r?.room,
    checkIn: r?.checkIn,
    checkOut: r?.checkOut,
    guests: r?.guests,
    nights: r?.nights,
    amount: displayAmount,
    tone: OUTCOME_TONES[kind],
  };

  if (kind === "cancelled") {
    return {
      ...base,
      kind,
      icon: AlertCircle,
      title: "Rezervasyon iptal edildi",
      description: "Bu konuşmanın operasyon sonucu iptal olarak kapandı.",
      badge: "İptal",
      lifecycleLabel: "İptal ile kapandı",
      reservationLabel: "Rezervasyon iptal edildi",
      paymentLabel: "Tahsilat kapatıldı",
      canSendPaymentLink: false,
    };
  }

  if (kind === "confirmed") {
    return {
      ...base,
      kind,
      icon: CheckCircle2,
      title: "Operasyon tamamlandı",
      description: "Rezervasyon ve ödeme yaşam döngüsü senkronize kapandı.",
      badge: "Onaylandı",
      lifecycleLabel: "Operasyon tamamlandı",
      reservationLabel: "Rezervasyon onaylandı",
      paymentLabel: "Ödeme onaylandı",
      canSendPaymentLink: false,
    };
  }

  if (kind === "human_takeover") {
    return {
      ...base,
      kind,
      icon: UserCheck,
      title: "Operatör desteği aktif",
      description: "Bu konuşma ekip müdahalesiyle operasyonel takipte.",
      badge: "Destek aktif",
      lifecycleLabel: "İnsan desteği aktif",
      reservationLabel: r ? "Operatör incelemesinde" : "Rezervasyon beklemede",
      paymentLabel: isPaid ? "Ödeme onaylandı" : "Operatör kontrolünde",
      canSendPaymentLink: false,
    };
  }

  if (kind === "payment_pending") {
    const paymentFailed = paymentState === "failed";
    return {
      ...base,
      kind,
      icon: CreditCard,
      title: paymentFailed ? "Ödeme kurtarma aktif" : "Ödeme onayı bekleniyor",
      description: paymentFailed
        ? "Rezervasyon oluşturuldu, ödeme başarısız — kurtarma akışı sürüyor."
        : "Rezervasyon oluşturuldu, tahsilat kapanışı bekleniyor.",
      badge: paymentFailed ? "Kurtarma aktif" : "Ödeme bekliyor",
      lifecycleLabel: paymentFailed ? "Kurtarma aktif" : "Tahsilat bekleniyor",
      reservationLabel: "Rezervasyon oluşturuldu",
      paymentLabel: paymentFailed ? "Ödeme başarısız" : "Ödeme bekleniyor",
      canSendPaymentLink: true,
    };
  }

  if (kind === "quote") {
    return {
      ...base,
      kind,
      icon: FileText,
      title: "Teklif gönderildi",
      description: "Konuşma teklif aşamasında, rezervasyon henüz onaylanmadı.",
      badge: "Teklif",
      lifecycleLabel: "Teklif yanıt bekliyor",
      reservationLabel: "Teklif aşamasında",
      paymentLabel: "Ödeme başlatılmadı",
      canSendPaymentLink: true,
    };
  }

  return {
    ...base,
    kind,
    icon: Inbox,
    title: "Rezervasyonsuz kapandı",
    description: "Bu konuşmada aktif teklif, ödeme veya rezervasyon oluşmadı.",
    badge: "Kapandı",
    lifecycleLabel: "Operasyon kapandı",
    reservationLabel: "Rezervasyon oluşmadı",
    paymentLabel: "Ödeme yok",
    canSendPaymentLink: false,
  };
}

function visibleLifecycleActions(outcome: OperationalOutcomeView): ReservationLifecycleAction[] {
  if (
    outcome.kind === "confirmed" ||
    outcome.kind === "cancelled" ||
    outcome.kind === "closed_without_reservation"
  ) {
    return [];
  }

  if (outcome.kind === "payment_pending") {
    return RESERVATION_LIFECYCLE_ACTIONS.filter((action) =>
      ["payment_link_sent", "payment_pending", "confirmed", "cancelled", "human_review_required"].includes(action.state)
    );
  }

  if (outcome.kind === "quote") {
    return RESERVATION_LIFECYCLE_ACTIONS.filter((action) =>
      ["payment_link_sent", "payment_pending", "cancelled", "human_review_required"].includes(action.state)
    );
  }

  return RESERVATION_LIFECYCLE_ACTIONS.filter((action) =>
    ["confirmed", "cancelled"].includes(action.state)
  );
}

function OperationalOutcomeCard({ outcome }: { outcome: OperationalOutcomeView }) {
  const Icon = outcome.icon;

  return (
    <div className="border-b border-white/[0.03] px-5 py-6">
      <SidebarLabel>Operasyon sonucu</SidebarLabel>
      <div className={cn("rounded-xl border p-4 transition-colors duration-500", outcome.tone.border, outcome.tone.bg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", outcome.tone.iconBg)}>
              <Icon className={cn("h-4 w-4", outcome.tone.icon)} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight text-white/90">{outcome.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/42">{outcome.description}</p>
            </div>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold", outcome.tone.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", outcome.tone.dot)} />
            {outcome.badge}
          </span>
        </div>

        {(outcome.idValue || outcome.room || outcome.amount) ? (
          <div className={cn("mt-4 border-t pt-3", outcome.tone.separator)}>
            <div className="space-y-2.5 text-[11px]">
              {outcome.idValue && outcome.idLabel ? (
                <OutcomeRow label={outcome.idLabel} value={`#${outcome.idValue}`} />
              ) : null}
              {outcome.offerId && outcome.idLabel !== "Teklif ID" ? (
                <OutcomeRow label="Teklif ID" value={`#${outcome.offerId}`} />
              ) : null}
              {outcome.room ? <OutcomeRow label="Oda / paket" value={outcome.room} /> : null}
            </div>

            {(outcome.checkIn || outcome.checkOut || outcome.guests || outcome.nights) ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                {outcome.checkIn ? (
                  <OutcomeMetric icon={CalendarDays} label="Giriş" value={outcome.checkIn} />
                ) : null}
                {outcome.checkOut ? (
                  <OutcomeMetric icon={CalendarDays} label="Çıkış" value={outcome.checkOut} />
                ) : null}
                {outcome.guests ? (
                  <OutcomeMetric icon={Users} label="Misafir" value={String(outcome.guests)} />
                ) : null}
                {outcome.nights ? (
                  <OutcomeMetric icon={Moon} label="Gece" value={String(outcome.nights)} />
                ) : null}
              </div>
            ) : null}

            {outcome.amount ? (
              <div className={cn("mt-4 flex items-baseline justify-between border-t pt-3", outcome.tone.separator)}>
                <span className="text-[10px] font-medium text-white/34">Toplam tutar</span>
                <span className={cn("text-[21px] font-bold tabular-nums tracking-tight", outcome.tone.amount)}>
                  {outcome.amount.label}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={cn("mt-4 space-y-2 border-t pt-3 text-[11px]", outcome.tone.separator)}>
          <OutcomeRow label="Ödeme durumu" value={outcome.paymentLabel} strong />
          <OutcomeRow label="Rezervasyon durumu" value={outcome.reservationLabel} strong />
          <OutcomeRow label="Yaşam döngüsü" value={outcome.lifecycleLabel} strong />
        </div>
      </div>
    </div>
  );
}

function OutcomeRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-white/34">{label}</span>
      <span className={cn("min-w-0 text-right text-white/68", strong && "font-semibold text-white/78")}>{value}</span>
    </div>
  );
}

function OutcomeMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.045] bg-white/[0.025] px-2.5 py-2">
      <Icon className="mb-1 h-3 w-3 text-white/35" />
      <p className="text-[9px] text-white/32">{label}</p>
      <p className="font-medium text-white/76">{value}</p>
    </div>
  );
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/26">
      {children}
    </p>
  );
}

// ─── ReservationCard ──────────────────────────────────────────────────────────

function ReservationCard({
  reservation: r,
  convStatus,
  sentLink,
  onSendPaymentLink,
  reservationsHref,
}: {
  reservation: ConvReservation;
  convStatus: ConversationStatus;
  sentLink: boolean;
  onSendPaymentLink: () => void;
  reservationsHref: string;
}) {
  const statusMap = {
    confirmed: {
      label: op("resConfirmed"),
      icon: CheckCircle2,
      border: "border-emerald-500/25",
      header: "bg-emerald-500/[0.08]",
      iconColor: "text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      dot: "bg-emerald-400",
    },
    pending_payment: {
      label: op("resPendingPayment"),
      icon: AlertCircle,
      border: "border-amber-500/25",
      header: "bg-amber-500/[0.07]",
      iconColor: "text-amber-400",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      dot: "bg-amber-400 animate-pulse",
    },
    quoted: {
      label: op("resQuoted"),
      icon: FileText,
      border: "border-blue-500/25",
      header: "bg-blue-500/[0.07]",
      iconColor: "text-blue-400",
      badge: "bg-blue-500/15 text-blue-400 border-blue-500/25",
      dot: "bg-blue-400",
    },
    cancelled: {
      label: "İptal edildi",
      icon: AlertCircle,
      border: "border-rose-500/25",
      header: "bg-rose-500/[0.07]",
      iconColor: "text-rose-400",
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/25",
      dot: "bg-rose-400",
    },
    human_review: {
      label: "Operatör incelemesi",
      icon: AlertTriangle,
      border: "border-amber-500/25",
      header: "bg-amber-500/[0.07]",
      iconColor: "text-amber-400",
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",
      dot: "bg-amber-400 animate-pulse",
    },
  };

  const s = statusMap[r.status];
  const StatusIcon = s.icon;
  const showPaymentBtn = r.status === "pending_payment" || r.status === "quoted";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-zinc-900/75 shadow-lg shadow-black/20 transition-[border-color,box-shadow] duration-500",
        s.border
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 transition-all duration-500 sm:px-5 sm:py-4", s.header)}>
        <div className="flex items-center gap-2.5">
          <StatusIcon className={cn("w-4 h-4 transition-colors duration-500", s.iconColor)} />
          <div>
            <p className="text-sm font-semibold text-white">
              {r.status === "quoted" ? op("quoteCreated") : op("reservationCreated")}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">Grand Hotel Demo · Ref #{r.ref}</p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-500",
            s.badge
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
          {s.label}
        </span>
      </div>

      {/* Details */}
      <div className="px-4 pt-4 pb-1 sm:px-5 sm:pt-5">
        <p className="mb-3 text-[13px] font-semibold text-white/90 sm:mb-3.5">{r.room}</p>
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <DetailCell icon={CalendarDays} label={op("checkIn")} value={r.checkIn} iconColor="text-blue-400" />
          <DetailCell icon={CalendarDays} label={op("checkOut")} value={r.checkOut} iconColor="text-blue-400" />
          <DetailCell icon={Users} label={op("guestsLabel")} value={String(r.guests)} iconColor="text-violet-400" />
          <DetailCell icon={Moon} label={op("nightsLabel")} value={String(r.nights)} iconColor="text-indigo-400" />
        </div>
        <div className="mb-4 flex items-center justify-between border-t border-white/[0.04] py-4">
          <div>
            <p className="text-[11px] text-white/35 mb-0.5">{op("pricePerNight")}</p>
            <p className="text-[13px] text-white/60">
              {r.currency}{r.pricePerNight.toLocaleString()} × {r.nights} nights
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/35 mb-0.5">{op("totalAmount")}</p>
            <p className="text-lg font-bold text-white tabular-nums tracking-tight sm:text-[22px]">
              {r.currency}{r.total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
        <Link
          href={reservationsHref}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.035] border border-white/[0.07] text-white/55 hover:text-white/75 hover:bg-white/[0.055] active:scale-[0.97] text-xs font-medium transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {op("viewReservation")}
        </Link>
        {showPaymentBtn && (
          <button
            onClick={onSendPaymentLink}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]",
              sentLink
                ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300"
                : r.status === "pending_payment"
                ? "bg-amber-500/16 border border-amber-500/26 text-amber-200 hover:bg-amber-500/20"
                : "bg-blue-500/15 border border-blue-500/24 text-blue-200 hover:bg-blue-500/19"
            )}
          >
            {sentLink ? (
              <><CheckCircle2 className="w-3.5 h-3.5" />{op("linkSent")}</>
            ) : (
              <><Send className="w-3.5 h-3.5" />{op("sendPaymentLink")}</>
            )}
          </button>
        )}
        {convStatus === "ai_active" && (
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-transparent border border-white/[0.06] text-white/34 hover:text-white/55 hover:bg-white/[0.04] text-xs font-medium transition-colors ml-auto">
            <UserCheck className="w-3.5 h-3.5" />
            {op("takeOver")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DetailCell ───────────────────────────────────────────────────────────────

function DetailCell({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.035] bg-white/[0.02] p-2.5 sm:p-3.5">
      <Icon className={cn("w-3.5 h-3.5 mb-2", iconColor)} />
      <p className="text-[10px] text-white/34 mb-1 font-medium">{label}</p>
      <p className="text-[13px] font-semibold text-white/88">{value}</p>
    </div>
  );
}

// ─── ReplyBar ─────────────────────────────────────────────────────────────────

function ReplyBar({
  status,
  value,
  onChange,
  onSend,
  onTakeover,
}: {
  status: ConversationStatus;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTakeover: () => void;
}) {
  if (status === "resolved") {
    return (
      <div className="shrink-0 border-t border-white/[0.03] px-6 py-5">
        <div className="flex items-center justify-center gap-2 py-2">
          <CheckCircle2 className="w-4 h-4 text-white/20" />
          <p className="text-sm text-white/25">{op("conversationResolved")}</p>
        </div>
      </div>
    );
  }

  if (status === "ai_active") {
    return (
      <div className="shrink-0 border-t border-white/[0.03] px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-blue-500/14 bg-blue-500/[0.05] px-4 py-3.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-[13px] text-blue-300/60 flex-1">
            {op("aiHandlingThread")}{" "}
            <button
              onClick={onTakeover}
              className="text-amber-400 font-medium hover:text-amber-300 transition-colors"
            >
              {op("takeOver")}
            </button>{" "}
            {op("aiHandlingThreadTakeover")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-white/[0.03] px-6 py-5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={op("typeReplyPlaceholder")}
          className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.045] px-4 py-2.5 text-sm text-white placeholder:text-white/22 transition-[border-color,background-color] duration-200 focus:border-indigo-500/35 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
