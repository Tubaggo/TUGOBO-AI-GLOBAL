export type MsgDir = "in" | "out" | "system";
export type MsgBy = "ai" | "human";

export interface AiMsgMeta {
  provider?: string;
  model?: string;
  processingMs?: number;
  confidence?: number;
}

export interface ChatMsg {
  id: string;
  dir: MsgDir;
  body: string;
  time: string;
  by?: MsgBy;
  aiMeta?: AiMsgMeta;
}

export interface ConvReservation {
  ref: string;
  guest: string;
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  pricePerNight: number;
  total: number;
  currency: string;
  status: "confirmed" | "pending_payment" | "quoted" | "cancelled" | "human_review";
}

export interface ChatThread {
  messages: ChatMsg[];
  reservation?: ConvReservation;
  aiTyping?: boolean;
}

export const CHAT_THREADS: Record<string, ChatThread> = {
  // ── c1: Ahmet Yılmaz – TR, AI Active, Qualified ──────────────────────────
  c1: {
    aiTyping: true,
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Merhaba, 15-20 Temmuz arası çift kişilik odanız müsait mi acaba?",
        time: "09:41",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Merhaba Ahmet Bey! 👋 Grand Hotel Demo'ya hoş geldiniz. 15-20 Temmuz tarihleri için müsaitlik durumunu kontrol ediyorum...",
        time: "09:41",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI müsaitlik kontrolü yapıyor…",
        time: "09:41",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "Harika haber! 15-20 Temmuz (5 gece) için şu odalarımız müsaittir:\n\n🛏  Standard Çift Oda — ₺2.900 / gece\n⭐  Superior Çift Oda — ₺3.600 / gece\n💎  Deluxe Suite — ₺5.200 / gece\n\nKaç kişi konaklayacak?",
        time: "09:42",
      },
      {
        id: "5",
        dir: "in",
        body: "2 kişi olacağız. Superior Oda hakkında biraz bilgi verebilir misiniz?",
        time: "09:44",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Elbette! Superior Çift Oda'nın öne çıkan özellikleri:\n\n✓  32 m² ferah oda\n✓  Balkondan deniz manzarası\n✓  King-size yatak\n✓  Ücretsiz WiFi & minibar\n✓  Kahvaltı dahil\n\n5 gece × ₺3.600 = ₺18.000 toplam\n\nRezervasyon oluşturmamı ister misiniz?",
        time: "09:44",
      },
      {
        id: "7",
        dir: "in",
        body: "15-20 Temmuz arası çift kişilik odanız müsait mi acaba?",
        time: "09:47",
      },
    ],
  },

  // ── c2: Hans Mueller – DE, AI Active, Quoted ──────────────────────────────
  c2: {
    aiTyping: true,
    reservation: {
      ref: "GHD-2841",
      guest: "Hans Mueller",
      room: "Triple Room Premium",
      checkIn: "Jun 28, 2026",
      checkOut: "Jul 3, 2026",
      guests: 3,
      nights: 5,
      pricePerNight: 156,
      total: 780,
      currency: "€",
      status: "pending_payment",
    },
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Hallo! Haben Sie Zimmer für 3 Personen vom 28. Juni bis 3. Juli?",
        time: "11:05",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Guten Tag, Hans! Willkommen im Grand Hotel Demo. Ich prüfe die Verfügbarkeit für 3 Personen, 28. Juni – 3. Juli (5 Nächte)…",
        time: "11:05",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI uygunluğu kontrol ediyor…",
        time: "11:05",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "Ausgezeichnet! Ich habe das Perfekte für Sie:\n\n🛏  Triple-Zimmer Premium\n✓  3 komfortable Einzelbetten\n✓  Balkon mit Meerblick\n✓  Frühstück für 3 Personen inkl.\n✓  Kostenloser Parkplatz\n\n€156 / Nacht × 5 Nächte = €780 gesamt\n\nSoll ich die Reservierung anlegen?",
        time: "11:06",
      },
      {
        id: "5",
        dir: "in",
        body: "Ja bitte, das klingt ausgezeichnet! Wie lange ist die Reservierung gültig?",
        time: "11:08",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Die Reservierung ist für 24 Stunden reserviert. 🎉\n\nIch sende Ihnen jetzt einen sicheren Zahlungslink. Nach Zahlungseingang erhalten Sie sofort eine Buchungsbestätigung.",
        time: "11:08",
      },
      {
        id: "7",
        dir: "system",
        body: "Reservation #GHD-2841 created · awaiting payment",
        time: "11:08",
      },
      {
        id: "8",
        dir: "in",
        body: "Haben Sie noch Zimmer für 3 Personen vom 28. Juni?",
        time: "11:18",
      },
    ],
  },

  // ── c3: Elena Petrov – RU, Human Takeover, New ────────────────────────────
  c3: {
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Добрый день, есть ли свободные номера на август?",
        time: "10:17",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Добрый день, Елена! Добро пожаловать в Grand Hotel Demo 🌟\n\nНа какие именно даты августа вы планируете приезд и сколько гостей будет?",
        time: "10:17",
      },
      {
        id: "3",
        dir: "in",
        body: "С 10 по 20 августа, нас двое. Также нужна комната для людей с ограниченными возможностями и меню без глютена.",
        time: "10:18",
      },
      {
        id: "4",
        dir: "system",
        body: "AI escalated — accessibility needs & dietary requirements detected",
        time: "10:18",
      },
      {
        id: "5",
        dir: "out",
        by: "human",
        body: "Добрый день, Елена! Меня зовут Мария, я из отдела гостеприимства. Я лично займусь вашим запросом — у нас есть прекрасные номера, оборудованные для гостей с особыми потребностями, и наш шеф-повар подготовит для вас полностью безглютеновое меню. Могу я уточнить несколько деталей?",
        time: "10:19",
      },
      {
        id: "6",
        dir: "in",
        body: "Добрый день, есть ли свободные номера на август?",
        time: "10:43",
      },
    ],
  },

  // ── c4: Sarah Johnson – EN, Resolved, Confirmed ───────────────────────────
  c4: {
    reservation: {
      ref: "GHD-2835",
      guest: "Sarah Johnson",
      room: "Deluxe Suite",
      checkIn: "Jun 15, 2026",
      checkOut: "Jun 20, 2026",
      guests: 2,
      nights: 5,
      pricePerNight: 170,
      total: 850,
      currency: "$",
      status: "confirmed",
    },
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Hi! Do you have availability for June 15–20?",
        time: "09:10",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Hello Sarah! Welcome to Grand Hotel Demo 🌟 Let me check availability for June 15-20 (5 nights)…",
        time: "09:10",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI uygunluğu kontrol ediyor…",
        time: "09:10",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "Great news! Here are your options for June 15–20:\n\n🛏  Standard Double — $130/night · $650 total\n⭐  Superior Room — $160/night · $800 total\n💎  Deluxe Suite — $170/night · $850 total\n\nHow many guests will be staying?",
        time: "09:11",
      },
      {
        id: "5",
        dir: "in",
        body: "Just 2 of us. The Deluxe Suite sounds perfect!",
        time: "09:12",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Excellent choice! The Deluxe Suite includes:\n\n✓  55 m² with panoramic sea view\n✓  King-size bed & sofa lounge\n✓  Private jacuzzi\n✓  Daily breakfast for 2\n✓  Welcome champagne on arrival\n✓  Late checkout until 2 PM\n\n$170/night × 5 nights = $850 total\n\nShall I create your reservation?",
        time: "09:12",
      },
      {
        id: "7",
        dir: "in",
        body: "Yes please! That sounds amazing.",
        time: "09:13",
      },
      {
        id: "8",
        dir: "out",
        by: "ai",
        body: "Your reservation is created! 🎉 Sending you a secure payment link now.",
        time: "09:13",
      },
      {
        id: "9",
        dir: "system",
        body: "Rezervasyon #GHD-2835 oluşturuldu · ödeme bağlantısı gönderildi",
        time: "09:13",
      },
      {
        id: "10",
        dir: "system",
        body: "Ödeme alındı · $850 · 15 Haz, 09:14",
        time: "09:14",
      },
      {
        id: "11",
        dir: "out",
        by: "ai",
        body: "Payment confirmed ✅ Your Deluxe Suite is fully booked!\n\nA confirmation has been sent to your WhatsApp. We look forward to welcoming you on June 15th! 🌊",
        time: "09:14",
      },
      {
        id: "12",
        dir: "in",
        body: "Perfect, I'll confirm the Deluxe Suite for June 15.",
        time: "09:15",
      },
    ],
  },

  // ── c5: Giulia Romano – IT, AI Active, Quoted ─────────────────────────────
  c5: {
    aiTyping: true,
    reservation: {
      ref: "GHD-2849",
      guest: "Giulia Romano",
      room: "Double Room Superior",
      checkIn: "Jul 10, 2026",
      checkOut: "Jul 15, 2026",
      guests: 2,
      nights: 5,
      pricePerNight: 130,
      total: 650,
      currency: "€",
      status: "quoted",
    },
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Buongiorno! Vorrei prenotare una camera doppia per 5 notti dal 10 al 15 luglio",
        time: "10:48",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Buongiorno Giulia! Benvenuta al Grand Hotel Demo 🌊 Sto verificando la disponibilità per il 10-15 luglio…",
        time: "10:48",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI verifica la disponibilità…",
        time: "10:48",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "Perfetto! Abbiamo disponibili per il 10-15 luglio:\n\n🛏  Camera Doppia Standard — €110/notte\n⭐  Camera Doppia Superior — €130/notte · vista mare\n\nPer 5 notti:\n•  Standard: €550 totale\n•  Superior: €650 totale\n\nQuante persone soggiorneranno?",
        time: "10:49",
      },
      {
        id: "5",
        dir: "in",
        body: "Saremo in 2. Preferiamo la Superior. C'è la colazione inclusa?",
        time: "10:50",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Sì, certamente! La Camera Doppia Superior include:\n\n✓  Colazione continentale per 2 persone\n✓  Balcone con vista mare panoramica\n✓  Wi-Fi gratuito\n✓  Servizio in camera 24h\n✓  Check-out flessibile fino alle 13:00\n\n€130/notte × 5 notti = €650 totale\n\nVuole che preparo la prenotazione?",
        time: "10:50",
      },
      {
        id: "7",
        dir: "system",
        body: "Teklif #GHD-2849 oluşturuldu · misafir onayı bekleniyor",
        time: "10:51",
      },
      {
        id: "8",
        dir: "in",
        body: "Vorrei prenotare una camera doppia per 5 notti",
        time: "10:52",
      },
    ],
  },

  // ── c6: James Park – EN, AI Active, Confirmed (extension) ─────────────────
  c6: {
    aiTyping: true,
    reservation: {
      ref: "GHD-2812",
      guest: "James Park",
      room: "Deluxe Suite",
      checkIn: "Jun 22, 2026",
      checkOut: "Jun 27, 2026",
      guests: 2,
      nights: 5,
      pricePerNight: 170,
      total: 850,
      currency: "$",
      status: "confirmed",
    },
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Hi! I'm in room 204, originally booked Jun 22-25. I'd like to extend my stay by 2 nights if possible.",
        time: "08:08",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Hello James! Happy to help with that 😊 Let me check availability for room 204, June 25-27…",
        time: "08:09",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI is checking room 204 availability…",
        time: "08:09",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "Great news — room 204 (Deluxe Suite) is available for June 25-27!\n\nExtension summary:\n•  2 extra nights × $170 = $340\n•  New checkout: June 27\n•  Updated total: $850 (5 nights)\n\nShall I confirm the extension?",
        time: "08:09",
      },
      {
        id: "5",
        dir: "in",
        body: "Yes please!",
        time: "08:10",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Done! Your stay has been extended to June 27 ✅\n\nI'll send a payment link for the 2 additional nights ($340). Your room is secured.",
        time: "08:10",
      },
      {
        id: "7",
        dir: "system",
        body: "Rezervasyon #GHD-2812 güncellendi · 22 Haz → 27 Haz · +$340 ödeme bağlantısı gönderildi",
        time: "08:11",
      },
      {
        id: "8",
        dir: "in",
        body: "Can I extend my stay by 2 more nights? June 22–27?",
        time: "08:14",
      },
    ],
  },

  // ── c7: Fatma Demir – TR, Human Takeover, New ────────────────────────────
  c7: {
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Merhaba! Havuzu olan ya da deniz manzaralı odanız var mı?",
        time: "04:58",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Merhaba Fatma Hanım! 🌊 Grand Hotel Demo'ya hoş geldiniz.\n\nEvet, hem havuza bakan hem de deniz manzaralı güzel oda seçeneklerimiz mevcut! Hangi tarihlerde ve kaç kişilik konaklama düşünüyorsunuz?",
        time: "04:58",
      },
      {
        id: "3",
        dir: "in",
        body: "Haziran 25 - Temmuz 5, 2 yetişkin + 2 çocuk (8 ve 11 yaş). Glutensiz kahvaltı seçeneği var mı? Çocuklar için aktivite programı hakkında da bilgi almak istiyorum.",
        time: "04:59",
      },
      {
        id: "4",
        dir: "system",
        body: "AI escalated — çocuk aktivitesi ve özel diyet talebi personele devredildi",
        time: "04:59",
      },
      {
        id: "5",
        dir: "out",
        by: "human",
        body: "Merhaba Fatma Hanım! Ben Selin, misafir hizmetleri ekibinden. Ailenize özel bir tatil hazırlamak için buradayım 🌟\n\nÇocuklarımıza yönelik sabah 09:00-18:00 arası animasyon programımız var. Kahvaltı büfemizde glutensiz köşe ayrı tutulmakta. Aile odası seçeneklerini ve fiyatları birazdan paylaşıyorum!",
        time: "05:00",
      },
      {
        id: "6",
        dir: "in",
        body: "Havuzu olan ya da deniz manzaralı odanız var mı?",
        time: "05:01",
      },
    ],
  },

  // ── c8: Mohammed Al-Said – EN, Resolved, Confirmed ───────────────────────
  c8: {
    reservation: {
      ref: "GHD-2803",
      guest: "Mohammed Al-Said",
      room: "Family Room",
      checkIn: "Jul 1, 2026",
      checkOut: "Jul 7, 2026",
      guests: 4,
      nights: 6,
      pricePerNight: 200,
      total: 1200,
      currency: "$",
      status: "confirmed",
    },
    messages: [
      {
        id: "1",
        dir: "in",
        body: "Hello, I need accommodation for 4 people from July 1st to 7th.",
        time: "14:20",
      },
      {
        id: "2",
        dir: "out",
        by: "ai",
        body: "Hello Mohammed! Welcome to Grand Hotel Demo. Checking availability for 4 guests, July 1-7 (6 nights)…",
        time: "14:20",
      },
      {
        id: "3",
        dir: "system",
        body: "Tugobo AI uygunluğu kontrol ediyor…",
        time: "14:20",
      },
      {
        id: "4",
        dir: "out",
        by: "ai",
        body: "We have the perfect option for your group! 🎉\n\n🏠  Family Room\n✓  2 queen beds (sleeps 4 comfortably)\n✓  Kitchenette & dining area\n✓  Private pool terrace\n✓  Breakfast for 4 included\n✓  Kids' activity programme access\n\n$200/night × 6 nights = $1,200 total\n\nWould you like to proceed?",
        time: "14:21",
      },
      {
        id: "5",
        dir: "in",
        body: "What time is check-in and check-out?",
        time: "14:22",
      },
      {
        id: "6",
        dir: "out",
        by: "ai",
        body: "Check-in: from 2:00 PM ✅\nCheck-out: by 12:00 PM ✅\n\nEarly check-in (from 10 AM) and late check-out (until 4 PM) available at $50 each, subject to availability.\n\nShall I create the reservation?",
        time: "14:22",
      },
      {
        id: "7",
        dir: "in",
        body: "Yes, please create it for us.",
        time: "14:24",
      },
      {
        id: "8",
        dir: "out",
        by: "ai",
        body: "Family Room reserved for July 1-7! 🎉\n\nI'm sending a secure payment link now. The reservation is held for 24 hours.",
        time: "14:24",
      },
      {
        id: "9",
        dir: "system",
        body: "Rezervasyon #GHD-2803 oluşturuldu · ödeme bağlantısı gönderildi",
        time: "14:24",
      },
      {
        id: "10",
        dir: "system",
        body: "Ödeme alındı · $1,200 · 1 Tem, 14:35",
        time: "14:35",
      },
      {
        id: "11",
        dir: "out",
        by: "ai",
        body: "Payment confirmed ✅ Your Family Room is fully booked for July 1-7!\n\nAll details sent to your WhatsApp. We look forward to hosting you and your family this summer! 🌴",
        time: "14:35",
      },
      {
        id: "12",
        dir: "in",
        body: "Thank you, the booking is confirmed. See you in July!",
        time: "14:40",
      },
    ],
  },
};
