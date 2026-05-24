import type {
  AIAction,
  AuditEvent,
  AttributionKind,
  FinancialAttribution,
  OperationalAlert,
  OperationalState,
  OperationsFeedItem,
  RecoveryFlow,
  RecoveryJourneyStep,
  RevenueEvent,
} from "../entities";
import { applyGraphLayer } from "../graph/enrich";
import type { OperationalEventContext, OperationalEventType } from "./types";

const ts = () => "Şimdi";
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function defaultContext(type: OperationalEventType): OperationalEventContext {
  const defaults: Partial<Record<OperationalEventType, OperationalEventContext>> = {
    PAYMENT_FAILED: {
      amountEur: 780,
      guestLabel: "Hans Mueller",
      guestId: "g2",
      reservationId: "or2",
      conversationId: "c2",
      roomLabel: "Üç Kişilik Oda · 28 Haz–3 Tem",
    },
    RECOVERY_STARTED: {
      amountEur: 780,
      guestLabel: "Hans Mueller",
      guestId: "g2",
      reservationId: "or2",
      conversationId: "c2",
      roomLabel: "Üç Kişilik Oda · 28 Haz–3 Tem",
    },
    RECOVERY_SUCCESS: {
      amountEur: 780,
      guestLabel: "Hans Mueller",
      guestId: "g2",
      reservationId: "or2",
      conversationId: "c2",
    },
    BOOKING_CONFIRMED: {
      amountEur: 780,
      guestLabel: "Hans Mueller",
      guestId: "g2",
      reservationId: "or2",
      conversationId: "c2",
    },
    UPSELL_ACCEPTED: {
      amountEur: 95,
      guestLabel: "Sarah Johnson",
      guestId: "g4",
      reservationId: "or1",
      conversationId: "c4",
    },
    VIP_ESCALATION: {
      amountEur: 2180,
      guestLabel: "Elena Petrov",
      guestId: "g1",
      conversationId: "c3",
    },
    OTA_CONVERSION: {
      amountEur: 212,
      guestLabel: "Sophie Martin",
      guestId: "g3",
    },
    HUMAN_TAKEOVER: {
      amountEur: 2180,
      guestLabel: "Elena Petrov",
      guestId: "g1",
      conversationId: "c3",
    },
  };
  return defaults[type] ?? {};
}

export function dispatchOperationalEvent(
  state: OperationalState,
  type: OperationalEventType,
  context: OperationalEventContext = {}
): OperationalState {
  const ctx = { ...defaultContext(type), ...context };
  const amount = ctx.amountEur ?? 0;
  const guest = ctx.guestLabel ?? "Misafir";

  const revenue = { ...state.revenue };
  const aiImpact = { ...state.aiImpact };
  const ota = { ...state.ota };

  let guests = [...state.guests];
  let reservations = [...state.reservations];
  let threads = [...state.threads];
  let activeRecoveries = [...state.activeRecoveries];
  let alerts = [...state.alerts];
  let aiActions = [...state.aiActions];
  let auditEvents = [...state.auditEvents];
  let revenueEvents = [...state.revenueEvents];
  let operationsFeed = [...state.operationsFeed];

  const feedItem = buildFeedItem(type, ctx);
  if (feedItem) operationsFeed = [feedItem, ...operationsFeed].slice(0, 14);

  const story = buildRevenueEvent(type, ctx);
  if (story) revenueEvents = [story, ...revenueEvents].slice(0, 10);

  const alert = buildAlert(type, ctx);
  if (alert) alerts = [alert, ...alerts].slice(0, 20);

  const aiAction = buildAiAction(type, ctx);
  if (aiAction) aiActions = [aiAction, ...aiActions].slice(0, 16);

  const audit = buildAuditEvent(type, ctx);
  if (audit) auditEvents = [audit, ...auditEvents].slice(0, 24);

  switch (type) {
    case "PAYMENT_FAILED": {
      revenue.revenueAtRisk += amount || 780;
      revenue.recoverySuccessRate = Math.max(60, revenue.recoverySuccessRate - 2);
      aiImpact.aiAssistedRecoveryRate = Math.min(95, aiImpact.aiAssistedRecoveryRate + 3);
      ota.activeRecoveryWorkflows += 1;

      reservations = patchReservation(reservations, ctx.reservationId, (r) => ({
        ...r,
        currentStage: "payment_risk",
        revenueAtRiskEur: amount || r.bookingValueEur,
        attributions: upsertAttribution(r.attributions, {
          kind: "payment_recovery",
          label: "Ödeme kurtarma devam ediyor",
          amountEur: amount || r.bookingValueEur,
          aiContributed: true,
          detail: "Alternatif bağlantı gönderildi",
        }),
        timeline: [
          ...r.timeline,
          {
            stage: "payment_risk",
            label: "Ödeme başarısız",
            timestamp: ts(),
            financialImpactEur: -(amount || r.bookingValueEur),
            actor: "system",
          },
          {
            stage: "recovery",
            label: "AI kurtarma aktif",
            timestamp: ts(),
            actor: "ai",
          },
        ],
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        revenueExposureEur: amount || t.revenueExposureEur,
        lastMessage: "Ödeme başarısız — AI kurtarma akışı başlatıldı",
        time: ts(),
        flags: { ...t.flags, paymentRisk: true, recoveryActive: true },
        attributions: upsertAttribution(t.attributions, {
          kind: "payment_recovery",
          label: "Ödeme riskte",
          amountEur: amount,
          aiContributed: true,
        }),
      }));

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        lastAttribution: {
          kind: "payment_recovery",
          label: "Ödeme riski",
          amountEur: amount,
          aiContributed: true,
        },
      }));

      if (!activeRecoveries.some((r) => r.reservationId === ctx.reservationId && r.status === "active")) {
        const newRecovery: RecoveryFlow = {
          id: uid("rj"),
          kind: "failed_payment",
          guestLabel: guest,
          roomLabel: ctx.roomLabel ?? "Oda · tarihler netleşmedi",
          status: "active",
          bookingValueEur: amount || 780,
          revenueSavedEur: 0,
          reservationId: ctx.reservationId,
          conversationId: ctx.conversationId,
          aiRationale: "Ödeme sorunu — alternatif bağlantı ve depozito bölme gönderildi.",
          steps: [
            {
              id: uid("s"),
              phase: "risk",
              title: "Ödeme riski algılandı",
              detail: `€${amount || 780} risk altında`,
              timestamp: ts(),
              revenueDeltaEur: -(amount || 780),
            },
            {
              id: uid("s"),
              phase: "ai_intervention",
              title: "AI kurtarma akışı",
              detail: "Alternatif ödeme bağlantısı gönderildi",
              timestamp: ts(),
            },
          ],
        };
        activeRecoveries = [newRecovery, ...activeRecoveries].slice(0, 8);
      }
      break;
    }

    case "RECOVERY_STARTED": {
      ota.activeRecoveryWorkflows += 1;
      aiImpact.aiAssistedRecoveryRate = Math.min(95, aiImpact.aiAssistedRecoveryRate + 1);

      reservations = patchReservation(reservations, ctx.reservationId, (r) => ({
        ...r,
        currentStage: "recovery",
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        flags: { ...t.flags, recoveryActive: true },
        lastMessage: "Kurtarma akışı başladı — operasyon katmanı eşitlendi",
        time: ts(),
      }));
      break;
    }

    case "RECOVERY_SUCCESS":
    case "BOOKING_CONFIRMED": {
      const recovered = amount || 780;
      revenue.revenueRecoveredToday += recovered;
      revenue.paymentRecoveryRevenue += recovered;
      revenue.aiInfluencedRevenue += recovered;
      revenue.aiGeneratedRevenue += recovered;
      revenue.revenueAtRisk = Math.max(0, revenue.revenueAtRisk - recovered);
      revenue.recoverySuccessRate = Math.min(95, revenue.recoverySuccessRate + 4);
      aiImpact.aiAssistedRecoveryRate = Math.min(95, aiImpact.aiAssistedRecoveryRate + 2);
      aiImpact.guestRecoveryRate = Math.min(95, aiImpact.guestRecoveryRate + 3);
      aiImpact.revenueInfluencedByAi += recovered;
      ota.activeRecoveryWorkflows = Math.max(0, ota.activeRecoveryWorkflows - 1);

      reservations = patchReservation(reservations, ctx.reservationId, (r) => ({
        ...r,
        currentStage: "confirmation",
        revenueAtRiskEur: 0,
        attributions: upsertAttribution(r.attributions, {
          kind: "payment_recovery",
          label: "Ödeme kurtarıldı",
          amountEur: recovered,
          aiContributed: true,
        }),
        timeline: [
          ...r.timeline,
          {
            stage: "confirmation",
            label: "Rezervasyon onaylandı",
            timestamp: ts(),
            financialImpactEur: recovered,
            actor: "system",
          },
        ],
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        revenueExposureEur: 0,
        status: "resolved",
        lastMessage: "Ödeme onaylandı — rezervasyon güvence altında",
        time: ts(),
        flags: {
          ...t.flags,
          paymentRisk: false,
          recoveryActive: false,
        },
      }));

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        recoveryCount: g.recoveryCount + 1,
        lifetimeValueEur: g.lifetimeValueEur + recovered,
        aiInfluencedRevenueEur: g.aiInfluencedRevenueEur + recovered,
        lastAttribution: {
          kind: "payment_recovery",
          label: "Kurtarma başarılı",
          amountEur: recovered,
          aiContributed: true,
        },
      }));

      activeRecoveries = activeRecoveries.map((j) =>
        j.reservationId === ctx.reservationId && j.status === "active"
          ? {
              ...j,
              status: "recovered" as const,
              revenueSavedEur: recovered,
              steps: [
                ...j.steps,
                {
                  id: uid("s"),
                  phase: "confirmation" as RecoveryJourneyStep["phase"],
                  title: "Kurtarma tamamlandı",
                  detail: `€${recovered} güvence altında`,
                  timestamp: ts(),
                  revenueDeltaEur: recovered,
                },
              ],
            }
          : j
      );
      break;
    }

    case "UPSELL_ACCEPTED": {
      const upsell = amount || 95;
      revenue.upsellRevenueGenerated += upsell;
      revenue.aiInfluencedRevenue += upsell;
      revenue.aiGeneratedRevenue += upsell;
      aiImpact.aiCloseRate = Math.min(45, aiImpact.aiCloseRate + 1);

      reservations = patchReservation(reservations, ctx.reservationId, (r) => ({
        ...r,
        currentStage: "upsell",
        attributions: upsertAttribution(r.attributions, {
          kind: "ai_upsell",
          label: "ADR artışı",
          amountEur: upsell,
          aiContributed: true,
        }),
        timeline: [
          ...r.timeline,
          {
            stage: "upsell",
            label: "Ek satış kabul edildi",
            timestamp: ts(),
            financialImpactEur: upsell,
            actor: "ai",
          },
        ],
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        lastMessage: "Ek satış paketi kabul edildi — ADR artışı kaydedildi",
        time: ts(),
        attributions: upsertAttribution(t.attributions, {
          kind: "ai_upsell",
          label: "AI ek satış",
          amountEur: upsell,
          aiContributed: true,
        }),
      }));

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        aiInfluencedRevenueEur: g.aiInfluencedRevenueEur + upsell,
        lifetimeValueEur: g.lifetimeValueEur + upsell,
        lastAttribution: {
          kind: "ai_upsell",
          label: "ADR artışı",
          amountEur: upsell,
          aiContributed: true,
        },
      }));
      break;
    }

    case "VIP_ESCALATION": {
      const exposure = amount || 2180;
      revenue.escalatedRevenueExposure += exposure;
      aiImpact.escalationPreventionPct = Math.min(90, aiImpact.escalationPreventionPct + 1);

      reservations = patchReservation(reservations, ctx.reservationId, (r) => ({
        ...r,
        currentStage: "escalation",
        revenueAtRiskEur: exposure,
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        revenueExposureEur: exposure,
        status: "human_takeover",
        lastMessage: "VIP yükseltme — AI bağlamıyla operatör devri",
        time: ts(),
        flags: { ...t.flags, vipEscalation: true, humanTakeover: true },
        attributions: upsertAttribution(t.attributions, {
          kind: "vip_intervention",
          label: "VIP yükseltme",
          amountEur: exposure,
          aiContributed: true,
        }),
      }));

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        vipRescueCount: g.vipRescueCount + 1,
        lastAttribution: {
          kind: "vip_intervention",
          label: "VIP yükseltme",
          amountEur: exposure,
          aiContributed: true,
        },
      }));
      break;
    }

    case "OTA_CONVERSION": {
      const commission = amount || 212;
      const booking = 1180;
      revenue.otaCommissionAvoided += commission;
      revenue.aiInfluencedRevenue += commission;
      revenue.directBookingConversionValue += booking;
      ota.recoveredCommissionSavings += commission;
      ota.loyaltyConversions += 1;
      ota.directConversionRate = Math.min(35, ota.directConversionRate + 2);

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        otaConversionCount: g.otaConversionCount + 1,
        aiInfluencedRevenueEur: g.aiInfluencedRevenueEur + commission,
        lastAttribution: {
          kind: "ota_commission",
          label: "OTA → direkt",
          amountEur: commission,
          aiContributed: true,
        },
      }));

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        lastMessage: "OTA misafiri direkt rezervasyona döndü — komisyon önlendi",
        time: ts(),
        flags: { ...t.flags, otaConversion: true },
        attributions: upsertAttribution(t.attributions, {
          kind: "ota_commission",
          label: "OTA dönüşümü",
          amountEur: commission,
          aiContributed: true,
        }),
      }));

      const otaRecovery: RecoveryFlow = {
        id: uid("rj"),
        kind: "ota_to_direct",
        guestLabel: guest,
        roomLabel: ctx.roomLabel ?? "Superior Çift Kişilik Oda",
        status: "recovered",
        bookingValueEur: booking,
        revenueSavedEur: commission,
        conversationId: ctx.conversationId,
        aiRationale: "Direkt fiyat eşlemesi — komisyon içeride kaldı.",
        steps: [
          {
            id: uid("s"),
            phase: "recovery",
            title: "Direkt dönüşüm",
            detail: `€${commission} komisyon önlendi`,
            timestamp: ts(),
            revenueDeltaEur: commission,
          },
        ],
      };
      activeRecoveries = [otaRecovery, ...activeRecoveries].slice(0, 8);
      break;
    }

    case "HUMAN_TAKEOVER": {
      const saved = amount || 2180;
      revenue.humanTakeoverSavedRevenue += saved;
      revenue.aiInfluencedRevenue += saved;
      revenue.escalatedRevenueExposure = Math.max(0, revenue.escalatedRevenueExposure - 500);
      revenue.revenueAtRisk = Math.max(0, revenue.revenueAtRisk - saved);
      aiImpact.humanTakeoverSuccessPct = Math.min(98, aiImpact.humanTakeoverSuccessPct + 1);

      threads = patchThread(threads, ctx.conversationId, (t) => ({
        ...t,
        status: "human_takeover",
        revenueExposureEur: 0,
        lastMessage: "Operatör devri — AI bağlamı korunarak destekli kapanış",
        time: ts(),
        flags: { ...t.flags, humanTakeover: true },
        attributions: upsertAttribution(t.attributions, {
          kind: "takeover_rescue",
          label: "Operatör devri kurtarması",
          amountEur: saved,
          aiContributed: false,
        }),
      }));

      guests = patchGuest(guests, ctx.guestId, (g) => ({
        ...g,
        lifetimeValueEur: g.lifetimeValueEur + saved,
        aiInfluencedRevenueEur: g.aiInfluencedRevenueEur + saved,
        lastAttribution: {
          kind: "takeover_rescue",
          label: "Devralma kurtarması",
          amountEur: saved,
          aiContributed: false,
        },
      }));
      break;
    }
  }

  const next: OperationalState = {
    ...state,
    revenue,
    aiImpact,
    ota,
    guests,
    reservations,
    threads,
    activeRecoveries,
    alerts,
    aiActions,
    auditEvents,
    revenueEvents,
    operationsFeed,
    lastEventAt: Date.now(),
  };

  return applyGraphLayer(next, type, ctx);
}

function patchReservation<T extends OperationalState["reservations"][number]>(
  list: T[],
  id: string | undefined,
  fn: (r: T) => T
): T[] {
  if (!id) return list;
  return list.map((r) => (r.id === id ? fn(r) : r));
}

function patchThread<T extends OperationalState["threads"][number]>(
  list: T[],
  id: string | undefined,
  fn: (t: T) => T
): T[] {
  if (!id) return list;
  return list.map((t) => (t.id === id ? fn(t) : t));
}

function patchGuest<T extends OperationalState["guests"][number]>(
  list: T[],
  id: string | undefined,
  fn: (g: T) => T
): T[] {
  if (!id) return list;
  return list.map((g) => (g.id === id ? fn(g) : g));
}

function upsertAttribution(
  list: FinancialAttribution[],
  next: FinancialAttribution
): FinancialAttribution[] {
  const filtered = list.filter((a) => a.kind !== next.kind);
  return [next, ...filtered];
}

function buildFeedItem(
  type: OperationalEventType,
  ctx: OperationalEventContext
): OperationsFeedItem | null {
  const amount = ctx.amountEur ?? 0;
  const guest = ctx.guestLabel ?? "Misafir";
  const id = uid("f");
  const map: Record<OperationalEventType, OperationsFeedItem> = {
    PAYMENT_FAILED: {
      id,
      title: "Ödeme riski algılandı",
      meta: `${guest} · €${amount} risk altında · kurtarma sıraya alındı`,
      time: ts(),
      tone: "border-l-amber-400/70 bg-amber-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    RECOVERY_STARTED: {
      id,
      title: "Ödeme kurtarma başlatıldı",
      meta: `${guest} · alternatif ödeme yolu hazırlanıyor`,
      time: ts(),
      tone: "border-l-violet-400/70 bg-violet-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    RECOVERY_SUCCESS: {
      id,
      title: "Ödeme alındı",
      meta: `${guest} · rezervasyon güvence altına alındı`,
      time: ts(),
      tone: "border-l-emerald-400/65 bg-emerald-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    BOOKING_CONFIRMED: {
      id,
      title: "Rezervasyon onaylandı",
      meta: `${guest} · direkt kanal · gelir güncellendi`,
      time: ts(),
      tone: "border-l-emerald-400/65 bg-emerald-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    UPSELL_ACCEPTED: {
      id,
      title: "Ek satış kabul edildi",
      meta: `${guest} · ek gelir kaydedildi`,
      time: ts(),
      tone: "border-l-blue-400/70 bg-blue-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    VIP_ESCALATION: {
      id,
      title: "VIP misafir işaretlendi",
      meta: `${guest} · öncelikli ekip desteği önerildi`,
      time: ts(),
      tone: "border-l-rose-400/60 bg-rose-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    OTA_CONVERSION: {
      id,
      title: "OTA → direkt dönüşüm",
      meta: `${guest} · komisyon kaybı önlendi`,
      time: ts(),
      tone: "border-l-violet-400/70 bg-violet-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
    HUMAN_TAKEOVER: {
      id,
      title: "İnsan desteği devraldı",
      meta: `${guest} · görüşme bağlamı korundu`,
      time: ts(),
      tone: "border-l-rose-400/60 bg-rose-500/[0.04]",
      financialEur: amount,
      eventType: type,
    },
  };
  return map[type] ?? null;
}

function buildRevenueEvent(
  type: OperationalEventType,
  ctx: OperationalEventContext
): RevenueEvent | null {
  const amount = ctx.amountEur ?? 0;
  if (!amount) return null;

  const attribution: Record<OperationalEventType, AttributionKind> = {
    PAYMENT_FAILED: "payment_recovery",
    RECOVERY_STARTED: "payment_recovery",
    RECOVERY_SUCCESS: "payment_recovery",
    BOOKING_CONFIRMED: "direct_conversion",
    UPSELL_ACCEPTED: "ai_upsell",
    VIP_ESCALATION: "vip_intervention",
    OTA_CONVERSION: "ota_commission",
    HUMAN_TAKEOVER: "takeover_rescue",
  };

  const headlines: Partial<Record<OperationalEventType, string>> = {
    RECOVERY_SUCCESS: `AI ödeme sorunundan sonra €${amount.toLocaleString()} kurtardı`,
    BOOKING_CONFIRMED: `Rezervasyon onaylandı · €${amount.toLocaleString()} direkt süreç`,
    HUMAN_TAKEOVER: `Operatör devri €${amount.toLocaleString()} güvenceye aldı`,
    OTA_CONVERSION: `OTA dönüşümü €${amount} komisyonu korudu`,
    UPSELL_ACCEPTED: `AI ek satış €${amount} ADR artışı sağladı`,
    VIP_ESCALATION: `VIP yükseltme · €${amount.toLocaleString()} risk yönetildi`,
  };

  const headline = headlines[type];
  if (!headline) return null;

  return {
    id: uid("st"),
    headline,
    narrative: "Operasyon olayı genel bakış, rezervasyon süreci, misafirler ve denetime işlendi.",
    amountEur: amount,
    attribution: attribution[type],
    timestamp: ts(),
    reservationId: ctx.reservationId,
    conversationId: ctx.conversationId,
  };
}

function buildAlert(
  type: OperationalEventType,
  ctx: OperationalEventContext
): OperationalAlert | null {
  const amount = ctx.amountEur;
  const guest = ctx.guestLabel ?? "Misafir";

  const map: Partial<Record<OperationalEventType, Omit<OperationalAlert, "id" | "timestamp" | "read">>> = {
    PAYMENT_FAILED: {
      title: "Ödeme riski algılandı",
      detail: `${guest} · kurtarma akışı aktif`,
      severity: "warning",
      financialEur: amount,
      reservationId: ctx.reservationId,
      guestLabel: guest,
    },
    RECOVERY_SUCCESS: {
      title: "Kurtarma başarılı",
      detail: `${guest} · gelir güvenceye alındı · risk kapatıldı`,
      severity: "success",
      financialEur: amount,
      guestLabel: guest,
    },
    VIP_ESCALATION: {
      title: "VIP misafir yükseltildi",
      detail: `${guest} · operatör devri yolu aktif`,
      severity: "critical",
      financialEur: amount,
      guestLabel: guest,
    },
    HUMAN_TAKEOVER: {
      title: "Operatör aksiyonu gerekli",
      detail: `${guest} · operasyon görüşmeye katıldı · AI bağlamı eşitlendi`,
      severity: "warning",
      financialEur: amount,
      guestLabel: guest,
    },
    OTA_CONVERSION: {
      title: "OTA dönüşümü algılandı",
      detail: `${guest} · direkt rezervasyon · komisyon önlendi`,
      severity: "success",
      financialEur: amount,
      guestLabel: guest,
    },
  };

  const base = map[type];
  if (!base) return null;

  return {
    id: uid("al"),
    timestamp: ts(),
    read: false,
    ...base,
  };
}

function buildAiAction(
  type: OperationalEventType,
  ctx: OperationalEventContext
): AIAction | null {
  const map: Partial<Record<OperationalEventType, { action: string; rationale: string }>> = {
    PAYMENT_FAILED: {
      action: "Ödeme kurtarma akışı başlatıldı",
      rationale: "Kart reddi — politika dahilinde alternatif bağlantı ve depozito bölme.",
    },
    RECOVERY_STARTED: {
      action: "Kurtarma akışı hazırlandı",
      rationale: "Çok adımlı kurtarma rezervasyon süreciyle eşitlendi.",
    },
    RECOVERY_SUCCESS: {
      action: "Ödeme kurtarma tamamlandı",
      rationale: "Misafir ödemeyi onayladı — gelir riski kapandı.",
    },
    UPSELL_ACCEPTED: {
      action: "Onay sonrası ek satış kabul edildi",
      rationale: "ADR paketi doğru yaşam döngüsü anında öne çıkarıldı.",
    },
    VIP_ESCALATION: {
      action: "VIP yükseltme ön değerlendirmesi",
      rationale: "İptal riski skorlandı — operatör devri önerildi.",
    },
    OTA_CONVERSION: {
      action: "OTA → direkt dönüşüm akışı",
      rationale: "Fiyat eşitliği ve sadakat avantajı — komisyon koruma yolu.",
    },
    HUMAN_TAKEOVER: {
      action: "Operatör devri",
      rationale: "Bağlam paketi iletildi — destekli kapanış sürüyor.",
    },
  };

  const base = map[type];
  if (!base) return null;

  return {
    id: uid("ai"),
    action: base.action,
    rationale: base.rationale,
    timestamp: ts(),
    financialImpactEur: ctx.amountEur,
    reservationId: ctx.reservationId,
    conversationId: ctx.conversationId,
  };
}

function buildAuditEvent(
  type: OperationalEventType,
  ctx: OperationalEventContext
): AuditEvent | null {
  const ai = buildAiAction(type, ctx);
  if (!ai) return null;

  const attribution: Partial<Record<OperationalEventType, AttributionKind>> = {
    PAYMENT_FAILED: "payment_recovery",
    RECOVERY_SUCCESS: "payment_recovery",
    BOOKING_CONFIRMED: "direct_conversion",
    UPSELL_ACCEPTED: "ai_upsell",
    VIP_ESCALATION: "vip_intervention",
    OTA_CONVERSION: "ota_commission",
    HUMAN_TAKEOVER: "takeover_rescue",
    RECOVERY_STARTED: "payment_recovery",
  };

  return {
    id: uid("a"),
    action: ai.action,
    actor: type === "HUMAN_TAKEOVER" ? "human" : "ai",
    rationale: ai.rationale,
    timestamp: ts(),
    financialImpactEur: ctx.amountEur,
    attribution: attribution[type],
    reservationId: ctx.reservationId,
  };
}

export type { OperationalEventContext, OperationalEventType };
