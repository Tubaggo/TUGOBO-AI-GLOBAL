"use client";

import type {
  OperationalTimelineEvent,
  TimelineDisplayKind,
  TimelinePriority,
} from "@/lib/runtime/conversation-runtime";
import { formatEur } from "@/lib/operational/format";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Brain,
  MessageSquare,
  Radio,
  Sparkles,
  CheckCircle2,
  Circle,
} from "lucide-react";

const KIND_META: Record<
  TimelineDisplayKind,
  { label: string; icon: typeof MessageSquare; accent: string; border: string }
> = {
  guest_message: {
    label: "Guest",
    icon: MessageSquare,
    accent: "text-amber-300/90",
    border: "border-amber-500/20",
  },
  ai_interpretation: {
    label: "Interpretation",
    icon: Sparkles,
    accent: "text-blue-300/90",
    border: "border-blue-500/15",
  },
  financial: {
    label: "Financial",
    icon: Banknote,
    accent: "text-emerald-400",
    border: "border-emerald-500/18",
  },
  orchestration: {
    label: "Recovery action",
    icon: Radio,
    accent: "text-cyan-300",
    border: "border-cyan-500/15",
  },
  memory: {
    label: "Misafir geçmişi",
    icon: Brain,
    accent: "text-violet-400/80",
    border: "border-violet-500/10",
  },
  propagation: {
    label: "Impact",
    icon: Circle,
    accent: "text-white/40",
    border: "border-white/8",
  },
  outcome: {
    label: "Outcome",
    icon: CheckCircle2,
    accent: "text-emerald-300",
    border: "border-emerald-500/20",
  },
  system: {
    label: "Status",
    icon: Circle,
    accent: "text-white/40",
    border: "border-white/8",
  },
};

const PRIORITY_STYLES: Record<TimelinePriority, { row: string; title: string; icon: string }> = {
  high: { row: "", title: "text-white/92", icon: "h-8 w-8" },
  medium: { row: "opacity-95", title: "text-white/80", icon: "h-7 w-7" },
  low: { row: "opacity-70", title: "text-white/55 text-[13px]", icon: "h-6 w-6" },
};

export function OperationalTimeline({ events }: { events: OperationalTimelineEvent[] }) {
  if (events.length === 0) return null;

  const visible = events.filter((e) => e.priority !== "low" || e.displayKind === "guest_message");

  return (
    <section className="runtime-surface rounded-lg px-1 py-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Conversation chronology
          </p>
          <h3 className="text-sm font-semibold text-white/90">Misafir akışı · gelir · kurtarma</h3>
        </div>
        <span className="text-[10px] text-white/28">{visible.length} events</span>
      </div>
      <div className="relative pl-0.5">
        {visible.map((event, i) => (
          <TimelineRow key={event.id} event={event} isLast={i === visible.length - 1} />
        ))}
      </div>
      {events.some((e) => e.priority === "low" && e.displayKind !== "guest_message") ? (
        <p className="mt-3 text-[10px] text-white/22">
          Misafir geçmişi ve süreç güncellemeleri aşağıdaki etki panelinde görünür.
        </p>
      ) : null}
    </section>
  );
}

function TimelineRow({ event, isLast }: { event: OperationalTimelineEvent; isLast: boolean }) {
  const meta = KIND_META[event.displayKind];
  const Icon = meta.icon;
  const isGuest = event.displayKind === "guest_message";
  const p = PRIORITY_STYLES[event.priority];

  return (
    <article className={cn("animate-tick-fade", !isLast && "pb-5", p.row)}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-0.5">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md border bg-zinc-950/90",
              meta.border,
              p.icon,
              event.priority === "high" &&
                event.displayKind === "financial" &&
                "ring-1 ring-emerald-500/20"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", meta.accent)} />
          </div>
          {!isLast ? (
            <div
              className={cn(
                "runtime-causal-line my-1.5 w-px flex-1",
                event.priority === "high"
                  ? "min-h-[28px] animate-runtime-causal-pulse"
                  : "min-h-[20px] opacity-50"
              )}
              aria-hidden
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] tabular-nums font-medium text-white/30">{event.timestamp}</span>
            <span className={cn("text-[9px] font-semibold uppercase tracking-wide", meta.accent)}>
              {meta.label}
            </span>
          </div>
          <p className={cn("mt-0.5 font-medium leading-snug", p.title)}>{event.title}</p>

          {isGuest && event.quote ? (
            <div
              className={cn(
                "mt-2.5 rounded-r-md border-l-2 bg-white/[0.02] py-2 pl-3 pr-2",
                event.priority === "high" ? "border-amber-400/40" : "border-amber-500/20"
              )}
            >
              <p className="text-[13px] leading-relaxed text-white/72">&ldquo;{event.quote}&rdquo;</p>
            </div>
          ) : null}

          {event.signals && event.signals.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {event.signals.map((s) => (
                <li key={s} className="flex gap-2 text-[11px] text-white/48">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400/60" />
                  {s}
                </li>
              ))}
            </ul>
          ) : null}

          {event.recoveryProbability !== undefined && event.financialEur ? (
            <div className="mt-2.5 rounded-md border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2.5">
              {event.detail ? <p className="text-[11px] text-white/48">{event.detail}</p> : null}
              <p className="mt-1 text-xs font-semibold text-emerald-300/90">
                Recovery confidence: {event.recoveryProbability}%
              </p>
            </div>
          ) : event.detail && !isGuest ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/42">{event.detail}</p>
          ) : null}

          {event.actions && event.actions.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {event.actions.map((a) => (
                <li key={a} className="flex gap-2 text-[11px] text-cyan-100/55">
                  <span className="text-cyan-500/45">→</span>
                  {a}
                </li>
              ))}
            </ul>
          ) : null}

          {event.financialEur && event.displayKind === "outcome" ? (
            <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-400/95">
              {formatEur(event.financialEur)} secured
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
