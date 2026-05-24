"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOperationalRuntime,
  selectAlerts,
  selectMounted,
  selectUnreadAlertCount,
} from "@/stores/operational-runtime";
import { OperationalIntelligenceFeedItem } from "./operational-intelligence-feed";

export function AlertCenter() {
  const t = useTranslations("alertCenter");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useOperationalRuntime(selectMounted);
  const alerts = useOperationalRuntime(selectAlerts);
  const unread = useOperationalRuntime(selectUnreadAlertCount);
  const markRead = useOperationalRuntime((s) => s.markAlertRead);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          open ? "bg-white/[0.06] text-white/80" : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
        )}
      >
        <Bell className="h-4 w-4" />
        <span className="font-medium">{t("title")}</span>
        {mounted && unread > 0 ? (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-2 max-h-[420px] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950 shadow-2xl">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-xs font-semibold text-white/90">{t("panelTitle")}</p>
            <p className="text-[10px] text-white/35">
              {mounted
                ? unread > 0
                  ? t("criticalSignals", { count: unread })
                  : t("runtimeClear")
                : t("syncing")}
            </p>
          </div>
          <div className="max-h-[340px] overflow-y-auto divide-y divide-white/[0.05]">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-white/35">{t("noAlerts")}</p>
            ) : (
              alerts.slice(0, 8).map((alert) => (
                <OperationalIntelligenceFeedItem
                  key={alert.id}
                  alert={alert}
                  compact
                  onMarkRead={() => markRead(alert.id)}
                />
              ))
            )}
          </div>
          <p className="border-t border-white/[0.05] px-4 py-2 text-center text-[10px] text-white/25">
            Etki zinciri · misafir hafızası · operasyon sonucu
          </p>
        </div>
      ) : null}
    </div>
  );
}
