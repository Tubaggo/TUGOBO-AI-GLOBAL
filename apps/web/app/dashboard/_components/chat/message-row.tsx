"use client";

import { Bot, Sparkles, User } from "lucide-react";
import type { AiMsgMeta, ChatMsg } from "../chat-threads";
import type { Conversation } from "../mock-data";
import { cn } from "@/lib/utils";
import { isAnimatedChatMessageId } from "./animated-chat-message-id";
import { getSystemEventMeta, systemEventKindClasses } from "./system-event-meta";

function formatProvider(p: string): string {
  if (p === "deepseek") return "DeepSeek";
  if (p === "openai") return "OpenAI";
  if (p === "claude") return "Claude";
  if (p === "gemini") return "Gemini";
  if (p === "mock") return "Mock";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function buildAiMetaLabel(meta: AiMsgMeta | undefined): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.provider) parts.push(formatProvider(meta.provider));
  if (meta.model) parts.push(meta.model);
  if (meta.processingMs != null) parts.push((meta.processingMs / 1000).toFixed(1) + "s");
  if (meta.confidence != null) parts.push("conf " + meta.confidence.toFixed(2));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function rowKey(msg: ChatMsg): "guest" | "ai" | "human" | "system" {
  if (msg.dir === "system") return "system";
  if (msg.dir === "in") return "guest";
  return msg.by === "human" ? "human" : "ai";
}

function messageVerticalGap(prev: ChatMsg | undefined, msg: ChatMsg): string {
  if (!prev) return "";
  const a = rowKey(prev);
  const b = rowKey(msg);
  if (a === "system" && b === "system") return "mt-2";
  if (a === "system" || b === "system") return "mt-4";
  if (a !== b) return "mt-6";
  return "mt-3";
}

function SystemTimelineEvent({ msg, className }: { msg: ChatMsg; className?: string }) {
  const { kind, Icon } = getSystemEventMeta(msg.body);
  const styles = systemEventKindClasses(kind);

  return (
    <div className={cn("flex w-full justify-center px-0.5", className)}>
      <div
        className={cn(
          "flex w-full min-w-0 max-w-[min(100%,31rem)] items-center gap-2.5 rounded-lg border px-2.5 py-1.5 sm:px-3",
          styles.shell
        )}
      >
        <div
          className={cn(
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]",
            styles.iconWrap
          )}
        >
          <Icon className={cn("h-2.5 w-2.5", styles.icon)} strokeWidth={2.25} aria-hidden />
        </div>
        <p className={cn("min-w-0 flex-1 text-[11px] leading-relaxed sm:text-[11.5px]", styles.text)}>
          {msg.body}
        </p>
        {msg.time ? (
          <span className={cn("shrink-0 tabular-nums text-[10px] font-medium tracking-tight", styles.time)}>
            {msg.time}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GuestMessageBubble({
  msg,
  conv,
  className,
}: {
  msg: ChatMsg;
  conv: Conversation;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-end justify-start gap-2.5", className)}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/[0.06]",
          conv.contact.avatarColor
        )}
      >
        {conv.contact.initials}
      </div>
      <div className="flex min-w-0 max-w-[min(100%,26rem)] flex-1 justify-start">
        <div
          className={cn(
            "w-fit max-w-full rounded-2xl rounded-bl-md border border-white/[0.045]",
            "bg-zinc-800/[0.42] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
            "px-4 pb-3 pt-3.5 backdrop-blur-[2px]"
          )}
        >
          <p className="whitespace-pre-line text-[13px] leading-[1.62] text-zinc-100/[0.93]">{msg.body}</p>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/[0.035] pt-2.5">
            <span className="text-[10px] font-medium tabular-nums tracking-tight text-white/34">{msg.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiMessageBubble({ msg, className }: { msg: ChatMsg; className?: string }) {
  const metaLabel = buildAiMetaLabel(msg.aiMeta);
  return (
    <div className={cn("flex w-full items-end justify-end gap-2.5", className)}>
      <div className="flex min-w-0 max-w-[min(100%,26rem)] justify-end">
        <div
          className={cn(
            "w-fit max-w-full rounded-2xl rounded-br-md border border-blue-400/14",
            "bg-blue-600/[0.93] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
            "px-4 pb-3 pt-3"
          )}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-blue-100/52">
            <Sparkles className="h-3 w-3 shrink-0 text-blue-200/70" aria-hidden />
            <span className="tracking-wide">{metaLabel ?? "Tugobo · ops"}</span>
          </div>
          <p className="whitespace-pre-line text-[13px] font-normal leading-[1.62] text-white/[0.96]">{msg.body}</p>
          <div className="mt-3 flex justify-end">
            <span className="text-[10px] font-medium tabular-nums tracking-tight text-blue-100/45">{msg.time}</span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "border border-blue-400/22 bg-blue-500/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
        )}
      >
        <Bot className="h-3.5 w-3.5 text-blue-200/95" aria-hidden />
      </div>
    </div>
  );
}

function HumanOperatorMessageBubble({ msg, className }: { msg: ChatMsg; className?: string }) {
  return (
    <div className={cn("flex w-full items-end justify-end gap-2.5", className)}>
      <div className="flex min-w-0 max-w-[min(100%,26rem)] justify-end">
        <div
          className={cn(
            "w-fit max-w-full rounded-2xl rounded-br-md border border-white/[0.065]",
            "bg-zinc-700/[0.55] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.035)]",
            "px-4 pb-3 pt-3"
          )}
        >
          <div className="mb-2">
            <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.07em] text-white/44">
              Human operator
            </span>
          </div>
          <p className="whitespace-pre-line text-[13px] leading-[1.62] text-zinc-100/[0.94]">{msg.body}</p>
          <div className="mt-3 flex justify-end">
            <span className="text-[10px] font-medium tabular-nums tracking-tight text-white/38">{msg.time}</span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "border border-white/[0.1] bg-zinc-600/[0.35]"
        )}
      >
        <User className="h-3.5 w-3.5 text-zinc-200/85" aria-hidden />
      </div>
    </div>
  );
}

export function MessageRow({
  msg,
  conv,
  prevMsg,
}: {
  msg: ChatMsg;
  conv: Conversation;
  prevMsg?: ChatMsg;
}) {
  const gap = messageVerticalGap(prevMsg, msg);
  const animated = isAnimatedChatMessageId(msg.id) ? "animate-msg-in" : "";

  if (msg.dir === "system") {
    return <SystemTimelineEvent msg={msg} className={cn(gap, animated)} />;
  }

  if (msg.dir === "in") {
    return <GuestMessageBubble msg={msg} conv={conv} className={cn(gap, animated)} />;
  }

  const isAI = msg.by !== "human";
  if (isAI) {
    return <AiMessageBubble msg={msg} className={cn(gap, animated)} />;
  }

  return <HumanOperatorMessageBubble msg={msg} className={cn(gap, animated)} />;
}
