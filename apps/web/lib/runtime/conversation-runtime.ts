import type {
  ConversationThread,
  Guest,
  RecoveryFlow,
  ThreadOperationalFlags,
} from "./entities";
import type { AIReasoning } from "./graph/types";
import { buildAIReasoning } from "./graph/reasoning";
import type { OperationalEventType } from "./events/types";
import type { AIAction, UnifiedTimelineEntry } from "./entities";
import { op } from "@/lib/i18n/operationalTexts";

export type OperationalStatusLabel =
  | "ÖDEME SORUNU"
  | "KURTARMA AKTİF"
  | "YÜKSEK DEĞER"
  | "DİREKT REZERVASYON"
  | "MÜDAHALE RİSKİ"
  | "VIP MİSAFİR"
  | "YENİ TALEP"
  | "İNCELEME RİSKİ"
  | "İZLEMEDE"
  | "OPERATÖR DESTEKLİ";

export type GuestRuntimeSignals = {
  operationalStatuses: OperationalStatusLabel[];
  behavioral: string[];
  financial: string[];
  /** Operationally grounded state — not "AI runtime" jargon */
  situation: string[];
};

export type TimelineDisplayKind =
  | "guest_message"
  | "ai_interpretation"
  | "financial"
  | "orchestration"
  | "memory"
  | "propagation"
  | "outcome"
  | "system";

export type TimelinePriority = "high" | "medium" | "low";

export type OperationalTimelineEvent = {
  id: string;
  displayKind: TimelineDisplayKind;
  priority: TimelinePriority;
  timestamp: string;
  title: string;
  detail?: string;
  quote?: string;
  signals?: string[];
  financialEur?: number;
  recoveryProbability?: number;
  confidence?: number;
  affectedSystems?: string[];
  actions?: string[];
  isLive?: boolean;
};

export type CognitionSnapshot = {
  interpretation: string;
  financial: {
    directValueEur: number;
    otaOpportunityEur: number;
    revenueConfidence: number;
  };
  escalation: {
    humanRequired: boolean;
    recoveryConfidence: number;
    escalationProbability: "Low" | "Medium" | "High" | "Critical";
  };
  memoryBullets: string[];
  recommendedAction: string;
  reasoning?: AIReasoning;
};

export type PropagationCausalityStep = {
  label: string;
  active: boolean;
};

type ChronologyBeat = Omit<OperationalTimelineEvent, "priority"> & { priority?: TimelinePriority };

/** Guest-centered operational stories per thread — hybrid chronology source */
const THREAD_CHRONOLOGY: Record<string, ChronologyBeat[]> = {
  c2: [
    {
      id: "c2-g1",
      displayKind: "guest_message",
      timestamp: "11:02",
      title: "Misafir mesajı",
      quote: "Triple room Jun 28–Jul 3 looks good — sending payment now.",
      priority: "medium",
    },
    {
      id: "c2-g2",
      displayKind: "guest_message",
      timestamp: "11:14",
      title: "Misafir mesajı",
      quote: "I already tried the payment link twice. It keeps failing.",
      priority: "high",
    },
    {
      id: "c2-i1",
      displayKind: "ai_interpretation",
      timestamp: "11:15",
      title: "Ödeme kararsızlığı algılandı",
      detail: "Vazgeçme riski artıyor.",
      signals: ["Tekrarlanan ödeme denemesi", "Mesaj tonunda yükselen gerginlik", "Rezervasyon niyeti hâlâ pozitif"],
      priority: "high",
    },
    {
      id: "c2-f1",
      displayKind: "financial",
      timestamp: "11:15",
      title: "€780 rezervasyon riski algılandı",
      detail: "Direkt rezervasyon · Üç Kişilik Oda · 5 gece",
      financialEur: 780,
      recoveryProbability: 78,
      priority: "high",
    },
    {
      id: "c2-r1",
      displayKind: "orchestration",
      timestamp: "11:16",
      title: "Alternatif ödeme kurtarma akışı başladı",
      actions: ["Alternatif ödeme yolu oluşturuldu", "Basitleştirilmiş ödeme etkin", "12 dk sessizlikte vardiya yöneticisi hazır"],
      priority: "high",
    },
    {
      id: "c2-g3",
      displayKind: "guest_message",
      timestamp: "11:18",
      title: "Misafir mesajı",
      quote: "Okay, I'm trying the new link now.",
      priority: "medium",
    },
    {
      id: "c2-m1",
      displayKind: "memory",
      timestamp: "11:16",
      title: "Önceki konaklama örüntüsü uygulandı",
      detail: "Temmuz 2024 — bölünmüş depozito başarılı · WhatsApp tercihli · şikayet geçmişi yok",
      priority: "low",
    },
  ],
  c3: [
    {
      id: "c3-g1",
      displayKind: "guest_message",
      timestamp: "08:38",
      title: "Misafir mesajı",
      quote: "Your policy says free cancellation until 7 days — I am inside that window.",
      priority: "high",
    },
    {
      id: "c3-i1",
      displayKind: "ai_interpretation",
      timestamp: "08:39",
      title: "VIP rezervasyonda iptal riski",
      detail: "Politika anlaşmazlığı · yüksek duygusal ton · €2.180 riskte.",
      signals: ["VIP segment", "Açık iptal dili", "Politika sınır durumu"],
      priority: "high",
    },
    {
      id: "c3-f1",
      displayKind: "financial",
      timestamp: "08:39",
      title: "€2.180 Deluxe Suite riski",
      financialEur: 2180,
      recoveryProbability: 88,
      priority: "high",
    },
    {
      id: "c3-r1",
      displayKind: "orchestration",
      timestamp: "08:42",
      title: "Resepsiyon devri başlatıldı",
      actions: ["Maria L. tam rezervasyon bağlamıyla katıldı", "Politika istisnası hazırlandı", "Misafir Instagram görüşmesinde tutuldu"],
      priority: "high",
    },
    {
      id: "c3-g2",
      displayKind: "guest_message",
      timestamp: "08:48",
      title: "Misafir mesajı",
      quote: "Thank you — that works. Please confirm the suite for Aug 12.",
      priority: "medium",
    },
    {
      id: "c3-o1",
      displayKind: "outcome",
      timestamp: "08:52",
      title: "Rezervasyon güvenceye alındı",
      detail: "€2.180 direkt rezervasyon sürecine döndü · VIP misafir korundu",
      financialEur: 2180,
      priority: "high",
    },
  ],
  c4: [
    {
      id: "c4-g1",
      displayKind: "guest_message",
      timestamp: "09:41",
      title: "Misafir mesajı",
      quote: "Confirmed — see you Jun 15.",
      priority: "medium",
    },
    {
      id: "c4-i1",
      displayKind: "ai_interpretation",
      timestamp: "09:55",
      title: "Rezervasyon sonrası ek satış fırsatı açık",
      detail: "Misafir geçmişte geç çıkış paketlerini kabul etmiş.",
      priority: "medium",
    },
    {
      id: "c4-r1",
      displayKind: "orchestration",
      timestamp: "10:00",
      title: "Geç çıkış + kahvaltı paketi önerildi",
      actions: ["€95 ADR artışı teklif edildi", "Önceki konaklama tercihlerine uyarlandı"],
      priority: "medium",
    },
    {
      id: "c4-g2",
      displayKind: "guest_message",
      timestamp: "10:02",
      title: "Misafir mesajı",
      quote: "Yes, add the late checkout — thank you.",
      priority: "medium",
    },
    {
      id: "c4-o1",
      displayKind: "outcome",
      timestamp: "10:02",
      title: "Ek satış kabul edildi",
      detail: "Onaylı konaklamada €95 ek gelir",
      financialEur: 95,
      priority: "high",
    },
  ],
  c1: [
    {
      id: "c1-g1",
      displayKind: "guest_message",
      timestamp: "2 dk önce",
      title: "Misafir mesajı",
      quote: "15-20 Temmuz arası çift kişilik odanız müsait mi?",
      priority: "medium",
    },
    {
      id: "c1-i1",
      displayKind: "ai_interpretation",
      timestamp: "1 dk önce",
      title: "Yeni tarih talebi — direkt kanal",
      detail: "Uygunluk kontrolü devam ediyor · Türkçe tercihli.",
      priority: "medium",
    },
    {
      id: "c1-r1",
      displayKind: "orchestration",
      timestamp: "Şimdi",
      title: "Teklif hazırlanıyor",
      actions: ["15–20 Tem çift kişilik oda uygunluğu kontrol ediliyor", "Direkt WhatsApp kapanışı için fiyat"],
      priority: "medium",
    },
  ],
};

const STATUS_REMAP: Record<string, OperationalStatusLabel> = {
  "DIRECT CONVERSION": "DİREKT REZERVASYON",
  "VIP MEMORY": "VIP MİSAFİR",
  "PRIORITY PIPELINE": "YENİ TALEP",
  "RUNTIME STABLE": "İZLEMEDE",
  "HUMAN ASSISTED": "OPERATÖR DESTEKLİ",
};

export function deriveOperationalStatuses(
  conversation: ConversationThread,
  guest?: Guest,
  journey?: RecoveryFlow
): OperationalStatusLabel[] {
  const statuses: OperationalStatusLabel[] = [];
  const f = conversation.flags;

  if (f.paymentRisk) statuses.push("ÖDEME SORUNU");
  if (f.recoveryActive || journey?.status === "active") statuses.push("KURTARMA AKTİF");
  if (guest?.segment === "vip" || f.vipEscalation || f.vipHistory) statuses.push("VIP MİSAFİR");
  if (f.humanTakeover) statuses.push("OPERATÖR DESTEKLİ");
  if (f.otaConversion) statuses.push("DİREKT REZERVASYON");
  if (f.directBookingCandidate) statuses.push("DİREKT REZERVASYON");
  if (conversation.revenueExposureEur >= 1500 || (guest?.lifetimeValueEur ?? 0) >= 3000) {
    statuses.push("YÜKSEK DEĞER");
  }
  if (f.priorRiskDetected && !f.recoveryActive) statuses.push("MÜDAHALE RİSKİ");
  if (conversation.status === "ai_active" && conversation.unread > 0 && !f.paymentRisk) {
    statuses.push("YENİ TALEP");
  }
  if (guest?.intelligence.orchestrationRiskLevel === "high") statuses.push("MÜDAHALE RİSKİ");
  if (statuses.length === 0) statuses.push("İZLEMEDE");

  return [...new Set(statuses)];
}

export function deriveGuestRuntimeSignals(
  conversation: ConversationThread,
  guest?: Guest,
  journey?: RecoveryFlow
): GuestRuntimeSignals {
  const intel = guest?.intelligence;
  const behavioral: string[] = [];

  if (conversation.flags.paymentRisk) {
    behavioral.push("Kararsızlık artıyor");
    behavioral.push("Ödeme iki kez soruldu");
  }
  if (conversation.flags.recoveryActive) {
    behavioral.push("Yeni ödeme bağlantısı bekleniyor");
    behavioral.push("Rezervasyon niyeti hâlâ pozitif");
  }
  if (conversation.flags.humanTakeover) {
    behavioral.push("Gergin ton");
    behavioral.push("Politika anlaşmazlığı aktif");
  }
  if (conversation.unread > 0) {
    behavioral.push("Otel yanıtı bekliyor");
  }
  if (intel && intel.orchestrationRiskLevel === "high") {
    behavioral.push("Çözülmezse vazgeçebilir");
  }
  if (behavioral.length === 0) {
    behavioral.push("Sakin etkileşim");
    behavioral.push("Rezervasyon güveni stabil");
  }

  const financial: string[] = [];
  if (conversation.revenueExposureEur > 0) {
    financial.push(`${formatCompactEur(conversation.revenueExposureEur)} risk altında`);
  }
  if (guest?.segment === "ota_origin" || conversation.flags.otaConversion) {
    financial.push("€212 komisyon tasarrufu mümkün");
  }
  if ((guest?.lifetimeValueEur ?? 0) >= 2500) {
    financial.push("Yüksek değerli tekrar misafir");
  }
  if (intel && intel.directBookingPotential >= 80) {
    financial.push("Güçlü direkt rezervasyon uyumu");
  }
  if (conversation.attributions.some((a) => a.kind === "ai_upsell")) {
    financial.push("Ek satış fırsatı açık");
  }
  if (financial.length === 0 && guest) {
    financial.push(`${formatCompactEur(guest.aiInfluencedRevenueEur)} AI etkili gelir`);
  }

  const situation: string[] = [];
  if (conversation.flags.recoveryActive || journey?.status === "active") {
    situation.push("Kurtarma akışı devam ediyor");
  }
  if (conversation.flags.humanTakeover) {
    situation.push("Operatör kapanışı yönetiyor");
  } else if (intel?.orchestrationRiskLevel === "low" && conversation.flags.paymentRisk) {
    situation.push("Henüz yükseltme gerekmiyor");
  }
  if (conversation.flags.memoryAttached && guest) {
    situation.push("Misafir geçmişi mevcut");
  }
  if (intel && conversation.flags.paymentRisk) {
    situation.push(`%${intel.recoverySuccessRatio} kurtarma olasılığı`);
  }
  if (situation.length === 0) {
    situation.push("Standart rezervasyon akışı");
  }

  return {
    operationalStatuses: deriveOperationalStatuses(conversation, guest, journey),
    behavioral: behavioral.slice(0, 3),
    financial: financial.slice(0, 3),
    situation: situation.slice(0, 3),
  };
}

export function buildPropagationCausality(
  conversation: ConversationThread,
  guest?: Guest
): PropagationCausalityStep[] {
  const steps: PropagationCausalityStep[] = [
    { label: "Ödeme başarısız", active: conversation.flags.paymentRisk },
    { label: "Misafir kararsızlığı", active: conversation.flags.paymentRisk || conversation.flags.priorRiskDetected },
    { label: "Rezervasyon riskte", active: conversation.flags.recoveryActive || conversation.revenueExposureEur > 0 },
    { label: "Gelir riski", active: conversation.revenueExposureEur > 0 },
    { label: "Müdahale riski", active: guest?.intelligence.orchestrationRiskLevel === "high" || conversation.flags.vipEscalation },
    { label: "Kurtarma devam ediyor", active: conversation.flags.recoveryActive },
  ];
  if (!steps.some((s) => s.active)) {
    return [
      { label: "Misafir talebi", active: true },
      { label: "Teklif / uygunluk", active: true },
      { label: "Rezervasyon süreci", active: true },
      { label: "Stabil", active: true },
    ];
  }
  return steps;
}

function inferEventType(flags: ThreadOperationalFlags): OperationalEventType {
  if (flags.paymentRisk) return "PAYMENT_FAILED";
  if (flags.humanTakeover) return "HUMAN_TAKEOVER";
  if (flags.otaConversion) return "OTA_CONVERSION";
  if (flags.recoveryActive) return "RECOVERY_STARTED";
  if (flags.vipEscalation) return "VIP_ESCALATION";
  return "BOOKING_CONFIRMED";
}

export function buildCognitionSnapshot(
  conversation: ConversationThread,
  guest?: Guest,
  journey?: RecoveryFlow
): CognitionSnapshot {
  const intel = guest?.intelligence;
  const exposure = conversation.revenueExposureEur;
  const secured = conversation.attributions.reduce((s, a) => s + a.amountEur, 0);
  const directValue = exposure > 0 ? exposure : secured > 0 ? secured : journey?.bookingValueEur ?? 0;

  const eventType = inferEventType(conversation.flags);
  const reasoning = buildAIReasoning(eventType, {
    amountEur: directValue,
    guestLabel: conversation.guestName,
  });

  const amountLabel = `€${directValue.toLocaleString("tr-TR")}`;

  let interpretation = reasoning.headline;
  if (conversation.flags.paymentRisk) {
    interpretation = op("guestSummaryPaymentRisk");
  } else if (conversation.flags.humanTakeover) {
    interpretation = op("guestSummaryHumanTakeover");
  } else if (conversation.flags.recoveryActive) {
    interpretation = op("guestSummaryRecovery", "tr", { amount: amountLabel });
  } else if (conversation.status === "resolved") {
    interpretation = op("guestSummaryResolved");
  } else if (conversation.unread > 0) {
    interpretation = op("guestSummaryNewInquiry");
  } else {
    interpretation = op("guestSummaryDefault");
  }

  const otaOpportunity =
    guest?.segment === "ota_origin" || conversation.flags.otaConversion ? 212 : Math.round(directValue * 0.18);

  const recoveryConfidence =
    intel?.recoverySuccessRatio ?? (journey?.status === "recovered" ? 92 : 79);
  const humanRequired = conversation.flags.humanTakeover || conversation.flags.vipEscalation;
  const escProb: CognitionSnapshot["escalation"]["escalationProbability"] =
    intel?.orchestrationRiskLevel === "critical"
      ? "Critical"
      : intel?.orchestrationRiskLevel === "high"
        ? "High"
        : intel?.orchestrationRiskLevel === "medium"
          ? "Medium"
          : "Low";

  const memoryBullets = [
    ...(guest?.memory.preferences.slice(0, 2) ?? []),
    ...(guest?.memory.recoveryHistory.slice(0, 1) ?? []),
    ...(guest?.memory.financial.slice(0, 1) ?? []),
  ].slice(0, 4);

  let recommendedAction = op("suggestedMonitor");
  if (conversation.flags.paymentRisk) {
    recommendedAction = op("suggestedPaymentAction");
  } else if (conversation.flags.humanTakeover) {
    recommendedAction = op("suggestedHumanClose");
  } else if (conversation.flags.otaConversion) {
    recommendedAction = op("suggestedOtaConversion");
  } else if (conversation.status === "resolved" && guest) {
    recommendedAction = op("suggestedPostConfirm");
  } else if (conversation.unread > 0) {
    recommendedAction = op("suggestedAvailability");
  }

  return {
    interpretation,
    financial: {
      directValueEur: directValue,
      otaOpportunityEur: otaOpportunity,
      revenueConfidence: intel?.recoverySuccessRatio ?? intel?.aiConfidenceScore ?? reasoning.confidence,
    },
    escalation: {
      humanRequired,
      recoveryConfidence,
      escalationProbability: escProb,
    },
    memoryBullets,
    recommendedAction,
    reasoning,
  };
}

export function buildOperationalTimelineEvents(input: {
  conversation: ConversationThread;
  guest?: Guest;
  journeys: RecoveryFlow[];
  timeline: UnifiedTimelineEntry[];
  aiActions: AIAction[];
}): OperationalTimelineEvent[] {
  const { conversation, guest, journeys } = input;
  const journey = journeys.find((j) => j.conversationId === conversation.id);

  const scripted = THREAD_CHRONOLOGY[conversation.id];
  if (scripted) {
    return scripted.map((beat) => ({
      ...beat,
      priority: beat.priority ?? priorityForKind(beat.displayKind, conversation),
    }));
  }

  return buildFallbackChronology(conversation, guest, journey);
}

function buildFallbackChronology(
  conversation: ConversationThread,
  guest?: Guest,
  journey?: RecoveryFlow
): OperationalTimelineEvent[] {
  const events: OperationalTimelineEvent[] = [];

  if (conversation.lastMessage) {
    events.push({
      id: `guest-msg-${conversation.id}`,
      displayKind: "guest_message",
      priority: "high",
      timestamp: conversation.time.replace(" ago", "") || "Şimdi",
      title: "Misafir mesajı",
      quote: conversation.lastMessage,
    });
  }

  if (journey) {
    for (const step of journey.steps) {
      const kind = phaseToDisplayKind(step.phase);
      if (kind === "propagation" || kind === "system") continue;

      events.push({
        id: `journey-${journey.id}-${step.id}`,
        displayKind: kind,
        priority: priorityForKind(kind, conversation),
        timestamp: step.timestamp,
        title: humanizeJourneyStep(step.title, step.phase),
        detail: step.detail,
        financialEur: step.revenueDeltaEur !== undefined ? Math.abs(step.revenueDeltaEur) : undefined,
        recoveryProbability:
          kind === "financial" ? guest?.intelligence.recoverySuccessRatio : undefined,
        actions: kind === "orchestration" ? [step.detail].filter(Boolean) as string[] : undefined,
      });
    }
  }

  if (events.length === 0) {
    events.push({
      id: `idle-${conversation.id}`,
      displayKind: "system",
      priority: "low",
      timestamp: conversation.time,
      title: "Rezervasyon görüşmesi izleniyor",
      detail: "Bu görüşmede aktif risk yok.",
    });
  }

  return events;
}

function phaseToDisplayKind(phase: RecoveryFlow["steps"][number]["phase"]): TimelineDisplayKind {
  const map: Record<RecoveryFlow["steps"][number]["phase"], TimelineDisplayKind> = {
    risk: "financial",
    ai_intervention: "ai_interpretation",
    escalation: "orchestration",
    recovery: "orchestration",
    confirmation: "outcome",
  };
  return map[phase];
}

function humanizeJourneyStep(title: string, phase: RecoveryFlow["steps"][number]["phase"]): string {
  const replacements: [RegExp, string][] = [
    [/payment risk detected/i, "Rezervasyonda ödeme başarısızlığı"],
    [/ai recovery sequence/i, "Alternatif ödeme kurtarma akışı başladı"],
    [/recovery workflow armed/i, "Alternatif ödeme kurtarma akışı başladı"],
    [/ops notified/i, "Vardiya yöneticisi bilgilendirildi"],
    [/human takeover/i, "Resepsiyon devri başlatıldı"],
    [/booking rescued|revenue secured/i, "Rezervasyon güvenceye alındı"],
    [/vip escalation/i, "VIP durum — operatör desteği"],
  ];
  let out = title;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(out)) return replacement;
  }
  if (phase === "ai_intervention") return title.replace(/^ai\s+/i, "");
  return out;
}

function priorityForKind(kind: TimelineDisplayKind, conversation: ConversationThread): TimelinePriority {
  if (kind === "guest_message" && conversation.flags.paymentRisk) return "high";
  if (kind === "guest_message") return "medium";
  if (kind === "financial" && conversation.revenueExposureEur > 0) return "high";
  if (kind === "ai_interpretation" && conversation.flags.paymentRisk) return "high";
  if (kind === "orchestration" && conversation.flags.recoveryActive) return "high";
  if (kind === "outcome") return "high";
  if (kind === "propagation" || kind === "system") return "low";
  if (kind === "memory") return "low";
  return "medium";
}

function formatCompactEur(value: number): string {
  return `€${value.toLocaleString("en-EU", { maximumFractionDigits: 0 })}`;
}

