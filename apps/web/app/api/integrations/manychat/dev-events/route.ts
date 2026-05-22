import { NextRequest, NextResponse } from "next/server";
import {
  clearManychatDevRuntimeEvents,
  getManychatDevRuntimeEventsPath,
  listManychatDevRuntimeEvents,
} from "@/lib/server/integrations/manychat-dev-events";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: true, events: [] });
  }

  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const events = listManychatDevRuntimeEvents(since);
  const lastEventAt = events[events.length - 1]?.createdAt ?? since ?? null;

  return NextResponse.json({
    ok: true,
    events,
    lastEventAt,
  });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  clearManychatDevRuntimeEvents();

  return NextResponse.json({
    ok: true,
    reset: true,
    path: getManychatDevRuntimeEventsPath(),
  });
}
