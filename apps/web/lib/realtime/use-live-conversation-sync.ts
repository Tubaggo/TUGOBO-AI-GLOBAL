"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveConversation, LiveMessage } from "@/lib/conversation/models";
import {
  isLiveConversationId,
  liveConversationToOperation,
  liveMessageToOperation,
} from "@/lib/conversation/live-sync";
import { useOperationConversationStore } from "@/lib/stores/operation-conversation-store";
import { resolvePilotHotelIdClient } from "@/lib/runtime/live/config";
import {
  subscribeConversationMessages,
  subscribeHotelConversations,
} from "./subscribe";

type LiveOpsState = {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  return res.json() as Promise<T>;
}

export function useLiveConversationSync(selectedId: string | null): LiveOpsState {
  const hotelId = resolvePilotHotelIdClient();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef(selectedId);
  const devCursorRef = useRef<string | null>(null);
  const seenDevEventIdsRef = useRef<Set<string>>(new Set());
  selectedRef.current = selectedId;

  const mergeLiveList = useCallback((items: LiveConversation[]) => {
    const store = useOperationConversationStore.getState();
    const liveIds = new Set(items.map((c) => c.id));
    const preserved = store.conversations.filter((c) => !liveIds.has(c.id));
    const merged = [
      ...items.map((live) => {
        const existing = store.conversations.find((conv) => conv.id === live.id);
        return liveConversationToOperation(live, existing?.messages.map((message) => ({
          id: message.id,
          conversationId: message.conversationId,
          role: message.sender,
          content: message.content,
          timestamp: message.timestamp,
          deliveryStatus: "delivered",
          aiGenerated: Boolean(message.meta?.aiGenerated),
          humanOverride: Boolean(message.meta?.takeoverSuggested),
          channel: message.channel,
          provider: existing?.provider,
        })));
      }),
      ...preserved,
    ];
    useOperationConversationStore.setState({ conversations: merged });
  }, []);

  const appendLiveMessage = useCallback(
    async (conversationId: string) => {
      const data = await fetchJson<{ ok: boolean; messages?: LiveMessage[] }>(
        `/api/conversations/${conversationId}/messages`
      );
      if (!data.ok || !data.messages) return;

      useOperationConversationStore.setState((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            messages: data.messages!.map(liveMessageToOperation),
            lastMessage:
              data.messages![data.messages!.length - 1]?.content ?? c.lastMessage,
            lastActivityAt:
              data.messages![data.messages!.length - 1]?.timestamp ?? c.lastActivityAt,
          };
        }),
      }));
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!hotelId) {
      setEnabled(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{
        ok: boolean;
        live?: boolean;
        conversations?: LiveConversation[];
      }>("/api/conversations");

      if (!data.ok || !data.live) {
        setEnabled(false);
        return;
      }

      setEnabled(true);
      mergeLiveList(data.conversations ?? []);

      const sel = selectedRef.current;
      if (sel && data.conversations?.some((c) => c.id === sel)) {
        await appendLiveMessage(sel);
        void fetch(`/api/conversations/${sel}/messages`, { method: "PATCH" });
      }
    } catch {
      setError("sync_failed");
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [appendLiveMessage, hotelId, mergeLiveList]);

  const syncDevFallbackEvents = useCallback(async () => {
    if (process.env.NODE_ENV === "production") return;

    try {
      const params = devCursorRef.current
        ? `?since=${encodeURIComponent(devCursorRef.current)}`
        : "";
      const data = await fetchJson<{
        ok: boolean;
        events?: Array<{
          id: string;
          messageId?: string;
          hotelId: string;
          provider: "manychat";
          channel: "instagram" | "whatsapp";
          senderType?: "guest" | "staff";
          externalUserId: string;
          externalId: string;
          guestName?: string;
          guestPhone?: string;
          message: string;
          createdAt: string;
        }>;
        lastEventAt?: string | null;
      }>(`/api/integrations/manychat/dev-events${params}`);

      if (!data.ok || !data.events?.length) {
        if (data.lastEventAt) {
          devCursorRef.current = data.lastEventAt;
        }
        return;
      }

      for (const event of data.events) {
        if (seenDevEventIdsRef.current.has(event.id)) continue;
        seenDevEventIdsRef.current.add(event.id);

        const state = useOperationConversationStore.getState();
        const existing = state.conversations.find(
          (conversation) =>
            conversation.externalId === event.externalId ||
            conversation.id === `demo-manychat-${event.channel}-${event.externalUserId}`
        );

        if (event.senderType === "staff") {
          if (existing) {
            state.addOperatorMessage(
              existing.id,
              event.message,
              event.messageId ?? event.id,
              event.createdAt,
              "mock_sent"
            );
          }
          continue;
        }

        state.addIncomingMessage({
          hotelId: event.hotelId,
          channel: event.channel,
          provider: event.provider,
          guestName: event.guestName ?? "Misafir",
          guestPhone: event.guestPhone,
          message: event.message,
          externalId: event.externalId,
          conversationId: existing?.id,
          // Stable id so a replayed dev event (re-polled after refresh) is deduped.
          messageId: event.messageId ?? event.id,
          unreadCount: existing ? (existing.unreadCount ?? 0) + 1 : 1,
          skipLocalAi: true,
        });
      }

      devCursorRef.current = data.lastEventAt ?? data.events[data.events.length - 1]?.createdAt ?? null;
    } catch {
      // Keep fallback sync silent; live runtime should not break on dev polling misses.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (hotelId) {
        void refresh();
      }
      void syncDevFallbackEvents();
    }, 4000);

    void syncDevFallbackEvents();

    return () => window.clearInterval(interval);
  }, [hotelId, refresh, syncDevFallbackEvents]);

  useEffect(() => {
    if (!enabled || !hotelId) return;

    const unsubHotel = subscribeHotelConversations(hotelId, {
      onConversation: () => {
        void refresh();
      },
    });

    return unsubHotel;
  }, [enabled, hotelId, refresh]);

  useEffect(() => {
    if (!enabled || !selectedId) return;

    const unsub = subscribeConversationMessages(selectedId, {
      onMessage: () => {
        void appendLiveMessage(selectedId);
        useOperationConversationStore.setState((state) => ({
          pulsingConversationIds: { ...state.pulsingConversationIds, [selectedId]: true },
        }));
      },
    });

    void appendLiveMessage(selectedId);

    return unsub;
  }, [appendLiveMessage, enabled, selectedId]);

  useEffect(() => {
    if (!selectedId || !isLiveConversationId(selectedId)) return;

    void fetch(`/api/conversations/${selectedId}/messages`, { method: "PATCH" });
    useOperationConversationStore.setState((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === selectedId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      ),
    }));
  }, [selectedId]);

  return { enabled, loading, error, refresh };
}
