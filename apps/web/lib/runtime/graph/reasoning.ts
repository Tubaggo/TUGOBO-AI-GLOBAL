import type { OperationalEventContext, OperationalEventType } from "../events/types";
import type { AIReasoning, EscalationLevel } from "./types";

export function buildAIReasoning(
  type: OperationalEventType,
  ctx: OperationalEventContext
): AIReasoning {
  const amount = ctx.amountEur ?? 0;
  const guest = ctx.guestLabel ?? "Misafir";

  const map: Record<OperationalEventType, AIReasoning> = {
    PAYMENT_FAILED: {
      headline: "Ödeme riski süreci başlatıldı",
      factors: [
        "Aktif rezervasyon sürecinde kart yetkilendirmesi başarısız oldu",
        `Tahmini risk ${amount ? `€${amount.toLocaleString()}` : "yüksek"}`,
        "Misafir profili önceki kurtarma toleransını gösteriyor — parçalı ödeme uygun",
        "Tekrar ödeme olasılığı %71 olarak modellendi",
        "Sonraki adım alternatif ödeme bağlantısına yönlendirildi",
      ],
      confidence: 84,
      escalationLevel: "urgent",
    },
    RECOVERY_STARTED: {
      headline: "Kurtarma akışı hazırlandı",
      factors: [
        `${guest} aktif ödeme kurtarma akışına bağlandı`,
        "Çok adımlı kurtarma rezervasyon ve görüşmeyle eşitlendi",
        "AI hafızası: önceki kurtarma parçalı ödemeyle başarılı oldu",
        "Misafir 12 dk sessiz kalırsa vardiya yöneticisi hazır",
      ],
      confidence: 88,
      escalationLevel: "watch",
    },
    RECOVERY_SUCCESS: {
      headline: "Kurtarma tamamlandı — risk kapatıldı",
      factors: [
        "Ödeme onaylandı · riskteki gelir temizlendi",
        "Misafir hafızası başarılı kurtarma örüntüsüyle güncellendi",
        "AI etkili gelir operasyon genelinde yeniden hesaplandı",
        "Süreç takip moduna döndü",
      ],
      confidence: 92,
      escalationLevel: "none",
    },
    BOOKING_CONFIRMED: {
      headline: "Direkt rezervasyon onaylandı",
      factors: [
        "Yaşam döngüsü onay aşamasına ilerledi",
        "Direkt kanal katkısı kilitlendi",
        "Misafir sadakat olasılığı yükseldi",
      ],
      confidence: 90,
      escalationLevel: "none",
    },
    UPSELL_ACCEPTED: {
      headline: "Onay sonrası ek satış kabul edildi",
      factors: [
        "Onay sonrası ADR artışı fırsatı algılandı",
        "Misafir hafızası: yüksek ek satış dönüşüm olasılığı",
        "Paket konaklama örüntüsüyle eşleşti",
      ],
      confidence: 86,
      escalationLevel: "none",
    },
    VIP_ESCALATION: {
      headline: "Operatör devri önerildi",
      factors: [
        "VIP misafir segmenti algılandı",
        "İptal olasılığı 0.82'ye yükseldi",
        "İlgili görüşmelerde önceki ödeme sorunu algılandı",
        `Tahmini risk €${amount.toLocaleString()}`,
        "Politika sınırı AI bağlamıyla insan kararı gerektiriyor",
      ],
      confidence: 91,
      escalationLevel: "critical",
    },
    OTA_CONVERSION: {
      headline: "OTA → direkt dönüşüm akışı",
      factors: [
        "OTA kaynaklı misafir · komisyon kaybı işaretlendi",
        "Fiyat eşitliği + sadakat avantajı öne çıkarıldı",
        "Direkt rezervasyon potansiyeli yükseldi",
        "Komisyon önleme yolu önceliklendirildi",
      ],
      confidence: 87,
      escalationLevel: "watch",
    },
    HUMAN_TAKEOVER: {
      headline: "AI bağlamıyla operatör devri başlatıldı",
      factors: [
        "Destekli kapanış için yükseltme eşiği aşıldı",
        "Tam operasyon hafızası görüşmeye eklendi",
        "AI güveni stabil — operatör müdahalesi geliri koruyor",
        `Gelir kurtarma hedefi €${amount.toLocaleString()}`,
      ],
      confidence: 89,
      escalationLevel: "urgent",
    },
  };

  return map[type];
}

export { escalationLabel } from "@/lib/i18n/runtime-copy";
