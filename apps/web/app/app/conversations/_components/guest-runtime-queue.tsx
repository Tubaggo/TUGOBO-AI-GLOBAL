"use client";

import type { ConversationThread, Guest, RecoveryFlow } from "@/lib/runtime/entities";
import {
  inferReservationStage,
  reservationStageLabel,
  resolveReservation,
} from "@/lib/runtime/chat-bridge";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

type GuestRuntimeQueueProps = {
  conversations: ConversationThread[];
  guests: Guest[];
  journeys: RecoveryFlow[];
  selectedId?: string;
  onSelect: (id: string) => void;
  pulseActive?: boolean;
};

export function GuestRuntimeQueue({
  conversations,
  guests,
  journeys: _journeys,
  selectedId,
  onSelect,
  pulseActive,
}: GuestRuntimeQueueProps) {
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-white/[0.04] bg-zinc-950/60">
      <div className="shrink-0 border-b border-white/[0.04] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          Misafir kuyruğu
        </p>
        <p className="mt-0.5 text-[11px] text-white/32">
          {conversations.length} active · live routing
        </p>
        {pulseActive ? (
          <span className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-400/70">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            Syncing
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto conv-scroll",
          pulseActive && "runtime-queue-pulse"
        )}
      >
        {conversations.map((c) => {
          const guest = guests.find((g) => g.id === c.guestId);
          const reservation = resolveReservation(c.id);
          const stage = inferReservationStage(c, reservation);
          const selected = c.id === selectedId;
          const urgent = c.flags.paymentRisk || c.flags.vipEscalation || c.flags.recoveryActive;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative w-full border-b border-white/[0.03] px-4 py-3.5 text-left transition-all",
                selected
                  ? "bg-blue-500/[0.05] shadow-[inset_2px_0_0_0_rgba(96,165,250,0.75)]"
                  : "hover:bg-white/[0.02]",
                urgent && !selected && "bg-amber-500/[0.02]"
              )}
            >
              {urgent && pulseActive ? (
                <span
                  className="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-amber-400/70 animate-pulse"
                  aria-hidden
                />
              ) : null}
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    c.avatarColor,
                    c.unread > 0 && "ring-1 ring-blue-400/40"
                  )}
                >
                  {c.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white/92">{c.guestName}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-white/28">{c.time}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-white/38">{c.lastMessage}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-medium text-white/45">
                      {reservationStageLabel(stage)}
                    </span>
                    {c.flags.paymentRisk ? (
                      <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-200/90">
                        Payment
                      </span>
                    ) : null}
                    {c.flags.humanTakeover ? (
                      <span className="rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-medium text-rose-200/90">
                        Staff
                      </span>
                    ) : null}
                    {c.unread > 0 ? (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500/20 px-1 text-[9px] font-bold text-blue-300">
                        {c.unread}
                      </span>
                    ) : (
                      <MessageCircle className="ml-auto h-3 w-3 text-white/18" aria-hidden />
                    )}
                  </div>
                  {guest?.intelligence.operationalStatus ? (
                    <p className="mt-1 text-[9px] text-white/22">{guest.intelligence.operationalStatus}</p>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
