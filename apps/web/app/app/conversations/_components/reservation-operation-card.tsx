"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Moon,
  Users,
} from "lucide-react";
import type { ConvReservation } from "@/app/dashboard/_components/chat-threads";
import type { ConversationStatus } from "@/app/dashboard/_components/mock-data";
import { op } from "@/lib/i18n/operationalTexts";
import { cn } from "@/lib/utils";

function statusMap() {
  return {
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
      icon: AlertCircle,
      border: "border-amber-500/25",
      header: "bg-amber-500/[0.07]",
      iconColor: "text-amber-400",
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",
      dot: "bg-amber-400 animate-pulse",
    },
  } as const;
}

export function ReservationOperationCard({
  reservation: r,
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
  const STATUS_MAP = statusMap();
  const s = STATUS_MAP[r.status];
  const StatusIcon = s.icon;
  const showPaymentBtn = r.status === "pending_payment" || r.status === "quoted";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-zinc-900/75 shadow-lg shadow-black/20",
        s.border
      )}
    >
      <div className={cn("flex items-center justify-between px-5 py-4", s.header)}>
        <div className="flex items-center gap-2.5">
          <StatusIcon className={cn("h-4 w-4", s.iconColor)} />
          <div>
            <p className="text-sm font-semibold text-white">
              {r.status === "quoted" ? op("offerPrepared") : op("reservationInProgress")}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">Ref #{r.ref}</p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
            s.badge
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
          {s.label}
        </span>
      </div>
      <div className="px-5 pb-4 pt-2">
        <p className="mb-3 text-[13px] font-semibold text-white/90">{r.room}</p>
        <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <Meta icon={CalendarDays} label={op("checkIn")} value={r.checkIn} />
          <Meta icon={CalendarDays} label={op("checkOut")} value={r.checkOut} />
          <Meta icon={Users} label={op("guestsLabel")} value={String(r.guests)} />
          <Meta icon={Moon} label={op("nightsLabel")} value={String(r.nights)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-3">
          <Link
            href={reservationsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-white/55 hover:text-white/75"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {op("viewReservation")}
          </Link>
          {showPaymentBtn ? (
            <button
              type="button"
              onClick={onSendPaymentLink}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                sentLink
                  ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border border-amber-500/25 bg-amber-500/12 text-amber-200"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              {sentLink ? op("linkSent") : op("sendPaymentLink")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
      <Icon className="mb-1 h-3 w-3 text-white/35" />
      <p className="text-[9px] text-white/32">{label}</p>
      <p className="font-medium text-white/80">{value}</p>
    </div>
  );
}
