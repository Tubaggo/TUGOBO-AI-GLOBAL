import type { ChannelType, ConversationStage } from "./types";

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  web_chat: "Web sohbet",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  manual: "Manuel",
};

export const STAGE_LABELS: Record<ConversationStage, string> = {
  new_inquiry: "Yeni talep",
  qualified: "Uygunluk kontrolü",
  offer_sent: "Teklif gönderildi",
  payment_pending: "Ödeme bekleniyor",
  payment_problem: "Ödeme sorunu",
  confirmed: "Rezervasyon onaylandı",
  human_review: "İnsan desteği",
};

export const STAGE_STATUS_LABELS: Record<ConversationStage, string> = {
  new_inquiry: "Misafir talebi alındı",
  qualified: "Uygun seçenekler hazırlanıyor",
  offer_sent: "Teklif misafire iletildi",
  payment_pending: "Ödeme bekleniyor",
  payment_problem: "Ödeme tamamlanamadı",
  confirmed: "Rezervasyon onaylandı",
  human_review: "Ekip desteği öneriliyor",
};

export function channelLabel(channel: ChannelType): string {
  return CHANNEL_LABELS[channel];
}

export function stageLabel(stage: ConversationStage): string {
  return STAGE_LABELS[stage];
}
