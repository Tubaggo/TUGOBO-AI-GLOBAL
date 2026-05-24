import type { Guest, GuestMemory, GuestIntelligence } from "../entities";
import type { OperationalEventType } from "../events/types";
import type { OperationalEventContext } from "../events/types";

export const GUEST_MEMORY_SEEDS: Record<string, { memory: GuestMemory; intelligence: GuestIntelligence }> = {
  g1: {
    memory: {
      operational: ["VIP segment · politika hassas", "Tekrar gelen yüksek değerli misafir"],
      financial: ["€2.180 VIP kurtarma katkısı", "Politika anlaşmazlıklarında tarihsel iptal riski yüksek"],
      orchestration: ["Operatör devri 12 Ağu başarılı", "AI bağlamı devir boyunca korundu"],
      preferences: ["Instagram ana kanal", "Rusça dil tercihi"],
      escalationHistory: ["VIP yükseltme 12 Ağu · operatör müdahalesiyle çözüldü"],
      recoveryHistory: ["Ödeme sorunu birincil risk değil — politika sınır durumları"],
      aiNotes: ["İptal politikası diline hassas", "Empatik ton + istisna çerçevesine yanıt veriyor"],
    },
    intelligence: {
      orchestrationRiskLevel: "medium",
      aiConfidenceScore: 91,
      recoverySuccessRatio: 88,
      loyaltyProbability: 92,
      directBookingPotential: 74,
      operationalStatus: "Kurtarma sonrası · takipte",
      memoryAttached: true,
    },
  },
  g2: {
    memory: {
      operational: ["Aktif ödeme kurtarma · Üç Kişilik Oda 28 Haz"],
      financial: ["Güncel teklifte €780 risk", "Önceki teklifler WhatsApp üzerinden tamamlandı"],
      orchestration: ["Kurtarma akışı aktif", "Alternatif bağlantı gönderildi"],
      preferences: ["E-posta yerine WhatsApp tercih ediyor", "Almanca · direkt kanal"],
      escalationHistory: [],
      recoveryHistory: ["Önceki kurtarma parçalı ödemeyle başarılı oldu", "Kart reddi örüntüsü algılandı"],
      aiNotes: ["Depozito bölme önerildiğinde kurtarma olasılığı yüksek", "WhatsApp'ta 15 dk içinde yanıtlıyor"],
    },
    intelligence: {
      orchestrationRiskLevel: "high",
      aiConfidenceScore: 84,
      recoverySuccessRatio: 71,
      loyaltyProbability: 68,
      directBookingPotential: 82,
      operationalStatus: "Kurtarma devam ediyor",
      memoryAttached: true,
    },
  },
  g3: {
    memory: {
      operational: ["OTA kaynaklı · direkt dönüşüm adayı"],
      financial: ["Son kapanışta €212 komisyon önlendi", "Superior Çift Kişilik Oda 2–6 Ağu"],
      orchestration: ["OTA → direkt akış tamamlandı"],
      preferences: ["Booking.com kaynaklı · fiyat eşitliği tekliflerini tercih ediyor"],
      escalationHistory: [],
      recoveryHistory: ["OTA dönüşüm akışı başarılı oldu"],
      aiNotes: ["Tekrar direkt rezervasyon adayı", "Sadakat avantajı kapanış oranını artırıyor"],
    },
    intelligence: {
      orchestrationRiskLevel: "low",
      aiConfidenceScore: 87,
      recoverySuccessRatio: 79,
      loyaltyProbability: 85,
      directBookingPotential: 94,
      operationalStatus: "Direkt kanal takibi",
      memoryAttached: true,
    },
  },
  g4: {
    memory: {
      operational: ["Onaylı misafir · ek satışa açık"],
      financial: ["Onay sonrası €95 ADR artışı", "Deluxe Suite 15–20 Haz"],
      orchestration: ["Çözülmüş görüşme · ek satış paketi kabul edildi"],
      preferences: ["Web kanalı · İngilizce", "Geç çıkış ilgisi sinyali verdi"],
      escalationHistory: [],
      recoveryHistory: [],
      aiNotes: ["Ek satış dönüşüm olasılığı yüksek", "Onay sonrası paketler iyi performans gösteriyor"],
    },
    intelligence: {
      orchestrationRiskLevel: "low",
      aiConfidenceScore: 93,
      recoverySuccessRatio: 95,
      loyaltyProbability: 88,
      directBookingPotential: 90,
      operationalStatus: "Onaylandı · ek satış",
      memoryAttached: true,
    },
  },
};

export function withGuestGraphDefaults(
  guest: Omit<Guest, "memory" | "intelligence">
): Guest {
  const seed = GUEST_MEMORY_SEEDS[guest.id];
  if (!seed) {
    return {
      ...guest,
      memory: emptyMemory(),
      intelligence: defaultIntelligence(),
    };
  }
  return { ...guest, memory: seed.memory, intelligence: seed.intelligence };
}

function emptyMemory(): GuestMemory {
  return {
    operational: [],
    financial: [],
    orchestration: [],
    preferences: [],
    escalationHistory: [],
    recoveryHistory: [],
    aiNotes: [],
  };
}

function defaultIntelligence(): GuestIntelligence {
  return {
    orchestrationRiskLevel: "low",
    aiConfidenceScore: 75,
    recoverySuccessRatio: 70,
    loyaltyProbability: 60,
    directBookingPotential: 50,
    operationalStatus: "İzlemede",
    memoryAttached: false,
  };
}

const MEMORY_DELTAS: Partial<
  Record<OperationalEventType, (m: GuestMemory, ctx: OperationalEventContext) => GuestMemory>
> = {
  PAYMENT_FAILED: (m, ctx) => ({
    ...m,
    operational: [`Ödeme riski · €${ctx.amountEur ?? 780} risk`, ...m.operational].slice(0, 6),
    recoveryHistory: ["Ödeme başarısızlığı algılandı — kurtarma örüntüsü hazır", ...m.recoveryHistory].slice(0, 5),
    aiNotes: ["Süreç alternatif ödeme + depozito bölmeye yönlendirildi", ...m.aiNotes].slice(0, 5),
  }),
  RECOVERY_SUCCESS: (m) => ({
    ...m,
    recoveryHistory: ["Kurtarma başarılı — örüntü sonraki operasyonlar için güçlendirildi", ...m.recoveryHistory].slice(
      0,
      5
    ),
    financial: ["Risk kapatıldı · AI etkili gelir güncellendi", ...m.financial].slice(0, 6),
  }),
  VIP_ESCALATION: (m, ctx) => ({
    ...m,
    escalationHistory: [
      `VIP yükseltme · risk €${ctx.amountEur ?? 2180}`,
      ...m.escalationHistory,
    ].slice(0, 5),
    aiNotes: ["Operatör devri yolu önceliklendirildi", ...m.aiNotes].slice(0, 5),
  }),
  UPSELL_ACCEPTED: (m, ctx) => ({
    ...m,
    financial: [`ADR artışı €${ctx.amountEur ?? 95} kaydedildi`, ...m.financial].slice(0, 6),
  }),
  OTA_CONVERSION: (m) => ({
    ...m,
    orchestration: ["OTA → direkt dönüşüm tamamlandı", ...m.orchestration].slice(0, 5),
    aiNotes: ["Direkt rezervasyon potansiyeli doğrulandı", ...m.aiNotes].slice(0, 5),
  }),
};

export function applyMemoryDelta(
  guest: Guest,
  type: OperationalEventType,
  ctx: OperationalEventContext
): Guest {
  const delta = MEMORY_DELTAS[type];
  const memory = delta ? delta(guest.memory, ctx) : guest.memory;
  const intelligence = applyIntelligenceDelta(guest.intelligence, type);
  return {
    ...guest,
    memory,
    intelligence: { ...intelligence, memoryAttached: true },
  };
}

function applyIntelligenceDelta(
  intel: GuestIntelligence,
  type: OperationalEventType
): GuestIntelligence {
  switch (type) {
    case "PAYMENT_FAILED":
      return {
        ...intel,
        orchestrationRiskLevel: "high",
        aiConfidenceScore: Math.max(70, intel.aiConfidenceScore - 4),
        operationalStatus: "Ödeme riski",
      };
    case "RECOVERY_SUCCESS":
      return {
        ...intel,
        orchestrationRiskLevel: "low",
        recoverySuccessRatio: Math.min(98, intel.recoverySuccessRatio + 6),
        aiConfidenceScore: Math.min(98, intel.aiConfidenceScore + 3),
        operationalStatus: "Kurtarıldı",
      };
    case "VIP_ESCALATION":
      return {
        ...intel,
        orchestrationRiskLevel: "critical",
        operationalStatus: "VIP yükseltme",
      };
    case "OTA_CONVERSION":
      return {
        ...intel,
        directBookingPotential: Math.min(99, intel.directBookingPotential + 5),
        loyaltyProbability: Math.min(99, intel.loyaltyProbability + 4),
      };
    case "UPSELL_ACCEPTED":
      return {
        ...intel,
        loyaltyProbability: Math.min(99, intel.loyaltyProbability + 3),
        aiConfidenceScore: Math.min(98, intel.aiConfidenceScore + 2),
      };
    default:
      return intel;
  }
}
