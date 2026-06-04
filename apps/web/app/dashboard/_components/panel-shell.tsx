import type { ReactNode } from "react";
import { resolvePanelLocale } from "@/lib/i18n/panel-locale";
import { PanelIntlProvider } from "./panel-intl-provider";
import { PanelBottomNav } from "./panel-bottom-nav";
import { Sidebar } from "./sidebar";

export function PanelShell({
  basePath,
  children,
  banner,
}: {
  basePath: string;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const locale = resolvePanelLocale(basePath);

  const body = (
    <>
      <Sidebar basePath={basePath} />
      <main className="panel-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
      <PanelBottomNav basePath={basePath} />
    </>
  );

  return (
    <PanelIntlProvider locale={locale}>
      {banner ? (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950">
          {banner}
          <div className="flex min-h-0 flex-1 overflow-hidden">{body}</div>
        </div>
      ) : (
        <div className="flex h-[100dvh] overflow-hidden bg-zinc-950">{body}</div>
      )}
    </PanelIntlProvider>
  );
}
