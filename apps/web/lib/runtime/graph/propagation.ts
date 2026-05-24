import { graphNodeLabel } from "@/lib/i18n/operational-copy";
import type { OperationalEventType } from "../events/types";
import type { GraphPropagation, PropagationNode } from "./types";

const EVENT_NODES: Record<OperationalEventType, PropagationNode[]> = {
  PAYMENT_FAILED: [
    "revenue",
    "reservation",
    "thread",
    "guest",
    "recovery",
    "alert",
    "audit",
    "ai_action",
    "memory",
    "timeline",
  ],
  RECOVERY_STARTED: [
    "recovery",
    "reservation",
    "thread",
    "alert",
    "audit",
    "ai_action",
    "memory",
    "timeline",
  ],
  RECOVERY_SUCCESS: [
    "revenue",
    "reservation",
    "thread",
    "guest",
    "recovery",
    "alert",
    "audit",
    "memory",
    "timeline",
  ],
  BOOKING_CONFIRMED: ["reservation", "revenue", "guest", "timeline", "audit"],
  UPSELL_ACCEPTED: ["revenue", "reservation", "guest", "thread", "audit", "timeline"],
  VIP_ESCALATION: [
    "thread",
    "guest",
    "alert",
    "audit",
    "ai_action",
    "memory",
    "timeline",
    "recovery",
  ],
  OTA_CONVERSION: ["revenue", "guest", "recovery", "alert", "audit", "memory", "timeline"],
  HUMAN_TAKEOVER: ["thread", "guest", "revenue", "alert", "audit", "ai_action", "memory", "timeline"],
};

const EVENT_SUMMARY: Record<OperationalEventType, string> = {
  PAYMENT_FAILED: "Ödeme riski gelir, rezervasyon, misafir hafızası ve kurtarma katmanına işlendi",
  RECOVERY_STARTED: "Kurtarma akışı rezervasyon ve görüşme durumuyla eşitlendi",
  RECOVERY_SUCCESS: "Finansal risk kapatıldı · misafir zekası ve hafıza güncellendi",
  BOOKING_CONFIRMED: "Rezervasyon onaylandı · direkt süreç ve zaman akışı güncellendi",
  UPSELL_ACCEPTED: "ADR artışı kaydedildi · misafir finansal hafızası zenginleşti",
  VIP_ESCALATION: "VIP yükseltme zinciri etkinleşti · operatör yolu hazırlandı",
  OTA_CONVERSION: "OTA dönüşümü komisyonu korudu · sadakat hafızası güncellendi",
  HUMAN_TAKEOVER: "Operatör devri tam AI bağlamıyla işlendi",
};

export function buildGraphPropagation(type: OperationalEventType): GraphPropagation {
  return {
    id: `prop-${Date.now()}`,
    eventType: type,
    triggeredAt: Date.now(),
    nodes: EVENT_NODES[type],
    summary: EVENT_SUMMARY[type],
  };
}

export function nodeLabel(node: PropagationNode): string {
  return graphNodeLabel(node);
}

/** @deprecated Use nodeLabel() — kept for imports */
export const NODE_LABELS: Record<PropagationNode, string> = new Proxy({} as Record<PropagationNode, string>, {
  get: (_target, prop: string) => graphNodeLabel(prop),
});
