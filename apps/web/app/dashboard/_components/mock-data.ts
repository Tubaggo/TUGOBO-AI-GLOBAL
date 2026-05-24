export type ConversationStatus = "ai_active" | "human_takeover" | "resolved";
export type LeadStatus = "new" | "qualified" | "quoted" | "confirmed" | "lost";
export type ReservationStatus =
  | "confirmed"
  | "pending_payment"
  | "quoted"
  | "new"
  | "lost";

export type ConversationChannel = "whatsapp" | "instagram" | "web";

export interface Conversation {
  id: string;
  hotelId?: string;
  contact: { name: string; phone: string; initials: string; avatarColor: string };
  lastMessage: string;
  time: string;
  language: string;
  status: ConversationStatus;
  leadStatus: LeadStatus;
  unread: number;
  messageCount: number;
  /** Inbox source — UI only in dashboard preview */
  channel?: ConversationChannel;
  provider?:
    | "manychat"
    | "whatsapp_cloud"
    | "instagram_dm"
    | "instagram"
    | "web_chat"
    | "whatsapp_twilio"
    | "whatsapp_meta";
}

export interface Reservation {
  id: string;
  guest: string;
  initials: string;
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  status: ReservationStatus;
  amount: number | null;
  channel: string;
  bookedAt: string;
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    contact: { name: "Ahmet Yılmaz", phone: "+90 532 123 4567", initials: "AY", avatarColor: "bg-violet-600" },
    lastMessage: "15-20 Temmuz arası çift kişilik odanız müsait mi acaba?",
    time: "2m ago",
    language: "TR",
    status: "ai_active",
    leadStatus: "qualified",
    unread: 2,
    messageCount: 7,
    channel: "whatsapp",
  },
  {
    id: "c2",
    contact: { name: "Hans Mueller", phone: "+49 170 987 6543", initials: "HM", avatarColor: "bg-blue-600" },
    lastMessage: "Haben Sie noch Zimmer für 3 Personen vom 28. Juni?",
    time: "18m ago",
    language: "DE",
    status: "ai_active",
    leadStatus: "quoted",
    unread: 0,
    messageCount: 12,
    channel: "whatsapp",
  },
  {
    id: "c3",
    contact: { name: "Elena Petrov", phone: "+7 916 234 5678", initials: "EP", avatarColor: "bg-rose-600" },
    lastMessage: "Добрый день, есть ли свободные номера на август?",
    time: "43m ago",
    language: "RU",
    status: "human_takeover",
    leadStatus: "new",
    unread: 1,
    messageCount: 4,
    channel: "instagram",
  },
  {
    id: "c4",
    contact: { name: "Sarah Johnson", phone: "+1 310 456 7890", initials: "SJ", avatarColor: "bg-emerald-600" },
    lastMessage: "Perfect, I'll confirm the Deluxe Suite for June 15.",
    time: "1h ago",
    language: "EN",
    status: "resolved",
    leadStatus: "confirmed",
    unread: 0,
    messageCount: 19,
    channel: "web",
  },
  {
    id: "c5",
    contact: { name: "Giulia Romano", phone: "+39 320 765 4321", initials: "GR", avatarColor: "bg-amber-600" },
    lastMessage: "Vorrei prenotare una camera doppia per 5 notti",
    time: "2h ago",
    language: "IT",
    status: "ai_active",
    leadStatus: "quoted",
    unread: 0,
    messageCount: 9,
    channel: "instagram",
  },
  {
    id: "c6",
    contact: { name: "James Park", phone: "+82 10 1234 5678", initials: "JP", avatarColor: "bg-cyan-600" },
    lastMessage: "Can I extend my stay by 2 more nights? June 22–27?",
    time: "3h ago",
    language: "EN",
    status: "ai_active",
    leadStatus: "confirmed",
    unread: 0,
    messageCount: 6,
    channel: "whatsapp",
  },
  {
    id: "c7",
    contact: { name: "Fatma Demir", phone: "+90 541 987 6543", initials: "FD", avatarColor: "bg-pink-600" },
    lastMessage: "Havuzu olan ya da deniz manzaralı odanız var mı?",
    time: "5h ago",
    language: "TR",
    status: "human_takeover",
    leadStatus: "new",
    unread: 3,
    messageCount: 5,
    channel: "whatsapp",
  },
  {
    id: "c8",
    contact: { name: "Mohammed Al-Said", phone: "+971 50 234 5678", initials: "MS", avatarColor: "bg-indigo-600" },
    lastMessage: "Thank you, the booking is confirmed. See you in July!",
    time: "1d ago",
    language: "EN",
    status: "resolved",
    leadStatus: "confirmed",
    unread: 0,
    messageCount: 23,
    channel: "web",
  },
];

export const RESERVATIONS: Reservation[] = [
  {
    id: "r1",
    guest: "Sarah Johnson",
    initials: "SJ",
    room: "Deluxe Suite",
    checkIn: "Jun 15",
    checkOut: "Jun 20",
    guests: 2,
    nights: 5,
    status: "confirmed",
    amount: 850,
    channel: "WhatsApp",
    bookedAt: "Bugün, 09:41",
  },
  {
    id: "r2",
    guest: "Mohammed Al-Said",
    initials: "MS",
    room: "Aile Odası",
    checkIn: "Jul 1",
    checkOut: "Jul 7",
    guests: 4,
    nights: 6,
    status: "confirmed",
    amount: 1200,
    channel: "WhatsApp",
    bookedAt: "Dün",
  },
  {
    id: "r3",
    guest: "Hans Mueller",
    initials: "HM",
    room: "Üç Kişilik Oda",
    checkIn: "Jun 28",
    checkOut: "Jul 3",
    guests: 3,
    nights: 5,
    status: "pending_payment",
    amount: 780,
    channel: "WhatsApp",
    bookedAt: "Bugün, 11:20",
  },
  {
    id: "r4",
    guest: "James Park",
    initials: "JP",
    room: "Deluxe Suite",
    checkIn: "Jun 22",
    checkOut: "Jun 27",
    guests: 2,
    nights: 5,
    status: "confirmed",
    amount: 850,
    channel: "WhatsApp",
    bookedAt: "Bugün, 08:15",
  },
  {
    id: "r5",
    guest: "Giulia Romano",
    initials: "GR",
    room: "Çift Kişilik Oda",
    checkIn: "Jul 10",
    checkOut: "Jul 15",
    guests: 2,
    nights: 5,
    status: "quoted",
    amount: 650,
    channel: "WhatsApp",
    bookedAt: "Bugün, 10:55",
  },
  {
    id: "r6",
    guest: "Ahmet Yılmaz",
    initials: "AY",
    room: "Superior Double",
    checkIn: "Jul 15",
    checkOut: "Jul 20",
    guests: 2,
    nights: 5,
    status: "new",
    amount: null,
    channel: "WhatsApp",
    bookedAt: "Bugün, 12:02",
  },
];
