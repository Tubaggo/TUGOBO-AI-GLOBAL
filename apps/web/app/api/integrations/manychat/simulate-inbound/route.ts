import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MANYCHAT_LOCAL_TEST_HOTEL_ID,
  MANYCHAT_LOCAL_TEST_SECRET,
} from "@/lib/server/integrations/manychat-config";

export const runtime = "nodejs";

// Dev/demo-only Instagram inbound simulator. It does NOT create a parallel
// ingestion path: it builds a realistic ManyChat-style Instagram DM payload and
// forwards it to the existing inbound endpoint, so the message flows through the
// exact same pipeline a real ManyChat webhook would use (conversation/contact
// creation, channel health, operation feed). The local-dev hotel id + shared
// secret are injected here, server-side, so they never ship in the client bundle.

type SimGuest = {
  guestName: string;
  username: string;
  message: string;
};

const GUEST_POOL: SimGuest[] = [
  {
    guestName: "Elif Demir",
    username: "elif.demir",
    message:
      "Merhaba! Gelecek hafta sonu için 2 kişilik deniz manzaralı oda müsait mi? Fiyat bilgisi alabilir miyim?",
  },
  {
    guestName: "Marco Rossi",
    username: "marco.rossi",
    message:
      "Hello! Do you have availability for 3 nights in August? What is the price for a double room with breakfast?",
  },
  {
    guestName: "Anna Schmidt",
    username: "anna.schmidt",
    message:
      "Guten Tag, haben Sie ein Familienzimmer für 2 Erwachsene und 2 Kinder frei? Wir kommen Ende Juli.",
  },
  {
    guestName: "Ayşe Yıldız",
    username: "ayse.yildiz",
    message:
      "İyi günler, balayı için özel bir paketiniz var mı? Check-in ve check-out saatlerini de öğrenebilir miyim?",
  },
  {
    guestName: "Daniyar A…",
    username: "daniyar.k",
    message:
      "Здравствуйте! Есть ли свободные номера на следующие выходные? Какая цена за двухместный номер?",
  },
];

const simulateSchema = z
  .object({
    message: z.string().trim().min(1).max(4000).optional(),
    guestName: z.string().trim().max(120).optional(),
  })
  .optional();

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  const parsed = simulateSchema.safeParse(body ?? {});
  const overrides = parsed.success ? parsed.data ?? {} : {};

  const sample = GUEST_POOL[Math.floor(Math.random() * GUEST_POOL.length)]!;
  const suffix = Math.random().toString(36).slice(2, 8);
  const externalUserId = `ig_${Date.now().toString(36)}_${suffix}`;
  const guestName = overrides.guestName?.trim() || sample.guestName;
  const username = sample.username;
  const message = overrides.message?.trim() || sample.message;
  const timestamp = new Date().toISOString();

  const payload = {
    hotel_id: MANYCHAT_LOCAL_TEST_HOTEL_ID,
    secret: MANYCHAT_LOCAL_TEST_SECRET,
    provider: "manychat" as const,
    channel: "instagram" as const,
    external_user_id: externalUserId,
    guest_name: guestName,
    username,
    message,
    timestamp,
  };

  try {
    const url = new URL("/api/integrations/manychat/inbound", new URL(req.url).origin);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; conversationId?: string }
      | null;

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { ok: false, error: "ingest_failed", message: "Simülasyon mesajı işlenemedi." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId: data.conversationId,
      simulated: {
        channel: "instagram",
        externalUserId,
        guestName,
        username,
        message,
        timestamp,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "simulate_failed", message: "Simülasyon çalıştırılamadı." },
      { status: 503 }
    );
  }
}
