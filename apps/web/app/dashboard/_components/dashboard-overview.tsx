import Link from "next/link";
import {
  MessageSquare,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Bot,
  Clock,
  ChevronRight,
  Sparkles,
  FileText,
  CalendarCheck,
  Banknote,
  ShieldAlert,
  UserPlus,
  Radio,
  PiggyBank,
  Users,
} from "lucide-react";
import { CONVERSATIONS, RESERVATIONS } from "./mock-data";
import { StatusBadge, LanguageFlag } from "./badges";

const metrics = [
  {
    label: "Direkt gelir",
    value: "$12.4k",
    delta: "+$2.1k",
    icon: DollarSign,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    sub: "direkt · son 7 gün",
  },
  {
    label: "Direkt rezervasyon",
    value: "18",
    delta: "+5",
    icon: CalendarCheck,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    sub: "geçen haftaya göre",
  },
  {
    label: "OTA komisyon tasarrufu",
    value: "$1,860",
    delta: "+$320",
    icon: PiggyBank,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    sub: "yalnızca direkt rezervasyon",
  },
  {
    label: "Kaçırılmayan talep",
    value: "37",
    delta: "+9",
    icon: ShieldAlert,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
    sub: "mesai dışı yakalanan",
  },
  {
    label: "Ort. yanıt süresi",
    value: "38s",
    delta: "↓ 6s",
    icon: Clock,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
    sub: "misafir bekleme süresi",
  },
];

const PIPELINE_STAGES = [
  { key: "inquiry", labelEn: "Yeni talep", label: "Talep", count: 6, color: "text-slate-300", ring: "border-white/[0.08] bg-white/[0.03]" },
  { key: "qualified", labelEn: "Uygunluk", label: "Nitelendirildi", count: 4, color: "text-violet-300", ring: "border-violet-500/20 bg-violet-500/[0.06]" },
  { key: "offer", labelEn: "Teklif gönderildi", label: "Teklif", count: 3, color: "text-blue-300", ring: "border-blue-500/20 bg-blue-500/[0.06]" },
  { key: "payment", labelEn: "Ödeme bekleniyor", label: "Ödeme", count: 2, color: "text-amber-300", ring: "border-amber-500/20 bg-amber-500/[0.06]" },
  { key: "confirmed", labelEn: "Onaylandı", label: "Onaylı", count: 11, color: "text-emerald-300", ring: "border-emerald-500/25 bg-emerald-500/[0.08]" },
] as const;

const OPERATIONS_FEED = [
  {
    icon: TrendingUp,
    title: "Yüksek niyetli talep algılandı",
    meta: "Sophie M. · Instagram · skor 0.91",
    time: "2 dk önce",
    tone: "border-l-violet-400/70 bg-violet-500/[0.04]",
  },
  {
    icon: Banknote,
    title: "Ödeme bekleniyor",
    meta: "Hans M. · €780 · bağlantı 41 dk içinde doluyor",
    time: "6 dk önce",
    tone: "border-l-amber-400/70 bg-amber-500/[0.04]",
  },
  {
    icon: UserPlus,
    title: "Operatör devri öneriliyor",
    meta: "Elena P. · politika kontrolü · Rusça görüşme",
    time: "12 dk önce",
    tone: "border-l-rose-400/60 bg-rose-500/[0.04]",
  },
  {
    icon: Bot,
    title: "AI kaçan talebi geri kazandı",
    meta: "Ahmet Y. yeniden yanıtladı · WhatsApp · 22:04",
    time: "34 dk önce",
    tone: "border-l-blue-400/70 bg-blue-500/[0.04]",
  },
  {
    icon: PiggyBank,
    title: "OTA komisyonu önlendi",
    meta: "Direkt kapanış · Superior oda · tahmini €118",
    time: "1 sa önce",
    tone: "border-l-emerald-400/65 bg-emerald-500/[0.04]",
  },
] as const;

const OPS_AUTOMATION_BARS = [
  { label: "Direkt rezervasyon kapsamı", value: "82%", bar: 82 },
  { label: "Operasyon otomasyonu", value: "76%", bar: 76 },
  { label: "Operatör devri rezervi", value: "24%", bar: 24 },
] as const;

const COLLABORATION_SIGNALS = [
  { label: "AI operasyonu yönetiyor", detail: "18 görüşme · ort. 6.2 mesaj", icon: Bot, color: "text-blue-400" },
  { label: "Operatör katıldı", detail: "Maria L. · Sophie Martin · 09:12", icon: Users, color: "text-emerald-400" },
  { label: "Operatör devri önerildi", detail: "2 görüşme · vardiya yöneticisi bekleniyor", icon: Radio, color: "text-amber-400" },
  { label: "Rezervasyon kartı oluşturuldu", detail: "6 kart oluşturuldu · 4 ödeme alındı", icon: FileText, color: "text-violet-400" },
] as const;

export function DashboardOverview({ linkPrefix }: { linkPrefix: string }) {
  const conv = `${linkPrefix}/conversations`;
  const res = `${linkPrefix}/reservations`;
  const recentConvs = CONVERSATIONS.slice(0, 5);
  const recentRes = RESERVATIONS.slice(0, 4);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-7 max-w-[1300px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28 mb-1.5">Operasyon merkezi</p>
            <h1 className="text-xl font-semibold text-white">Günaydın</h1>
            <p className="text-sm text-white/40 mt-0.5">
              Cumartesi, 25 Nisan · Grand Hotel Demo · canlı operasyon
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Operasyon aktif</span>
            </div>
            <Link
              href={conv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-xs font-medium text-white"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Operasyon kuyruğu
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 mb-6">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="bg-zinc-900 border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.10] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-9 h-9 rounded-lg ${m.iconBg} flex items-center justify-center`}>
                  <m.icon className={`w-4 h-4 ${m.iconColor}`} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" />
                  {m.delta}
                </div>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{m.value}</p>
              <p className="text-xs text-white/40 mt-1 leading-snug">{m.label}</p>
              <p className="text-[10px] text-white/22 mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-white/[0.06] rounded-xl p-5 mb-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28">Rezervasyon süreci</p>
              <h2 className="text-sm font-semibold text-white mt-0.5">Aşama dağılımı · operasyon görünümü</h2>
            </div>
            <Link href={res} className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0">
              Süreci aç →
            </Link>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
            {PIPELINE_STAGES.map((st, i) => (
              <div key={st.key} className="flex flex-1 min-w-0 items-stretch gap-2 md:flex-row">
                <div className={`flex flex-1 flex-col rounded-xl border px-3 py-3 md:px-3.5 md:py-3.5 ${st.ring}`}>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white/22">{st.labelEn}</span>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className={`text-lg font-bold tabular-nums ${st.color}`}>{st.count}</span>
                    <span className="text-[11px] font-medium text-white/35 truncate">{st.label}</span>
                  </div>
                </div>
                {i < PIPELINE_STAGES.length - 1 ? (
                  <div className="hidden md:flex items-center justify-center px-0.5 shrink-0">
                    <ChevronRight className="h-4 w-4 text-white/10" aria-hidden />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 mb-5 lg:grid-cols-[1fr_360px]">
          <div className="bg-zinc-900 border border-white/[0.06] rounded-xl overflow-hidden min-h-[320px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-white/40" />
                  <h2 className="text-sm font-semibold text-white">Misafir operasyonları</h2>
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">Birleşik kuyruk · AI ve operatör bağlamı korunur</p>
              </div>
              <Link href={conv} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                Tümünü gör <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {recentConvs.map((c) => (
                <Link
                  key={c.id}
                  href={conv}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors group"
                >
                  <div
                    className={`w-9 h-9 rounded-full ${c.contact.avatarColor} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                  >
                    {c.contact.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/90">{c.contact.name}</span>
                        <LanguageFlag lang={c.language} />
                      </div>
                      <span className="text-[11px] text-white/30 shrink-0">{c.time}</span>
                    </div>
                    <p className="text-xs text-white/40 truncate">{c.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={c.status} />
                    {c.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900 border border-white/[0.06] rounded-xl overflow-hidden flex flex-col max-h-[min(420px,52vh)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] shrink-0">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400/80" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">Operasyon akışı</h2>
                    <p className="text-[10px] text-white/30">Gelir, risk ve kurtarma sinyalleri</p>
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto divide-y divide-white/[0.04] flex-1">
                {OPERATIONS_FEED.map((item) => (
                  <div key={item.title} className={`flex gap-3 px-4 py-3 border-l-2 ${item.tone}`}>
                    <div className="mt-0.5 shrink-0">
                      <item.icon className="w-4 h-4 text-white/45" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white/90 leading-snug">{item.title}</p>
                      <p className="text-[11px] text-white/38 mt-0.5 leading-relaxed">{item.meta}</p>
                      <p className="text-[10px] text-white/22 mt-1">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/15 flex items-center justify-center border border-white/[0.06]">
                  <Sparkles className="w-4 h-4 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">AI ve operatör işbirliği</h2>
                  <p className="text-[11px] text-white/35">Son 24 saat · Grand Hotel Demo</p>
                </div>
              </div>
              <div className="space-y-3.5 mb-5">
                {OPS_AUTOMATION_BARS.map((stat) => (
                  <div key={stat.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-white/50">{stat.label}</span>
                      <span className="text-[11px] font-semibold text-white">{stat.value}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500/90 rounded-full"
                        style={{ width: `${stat.bar}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5 border-t border-white/[0.05] pt-4">
                {COLLABORATION_SIGNALS.map((row) => (
                  <div key={row.label} className="flex gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                    <row.icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${row.color}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-white/75">{row.label}</p>
                      <p className="text-[10px] text-white/35 leading-relaxed">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
            <div>
              <h2 className="text-sm font-semibold text-white">Son rezervasyonlar</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Tutarlar direkt kanal geliri olarak gösterilir</p>
            </div>
            <Link href={res} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0">
              Tümünü gör <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Misafir", "Oda", "Giriş", "Çıkış", "Kişi", "Aşama", "Tutar"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[11px] font-semibold text-white/30 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentRes.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] font-bold text-white/60">
                          {r.initials}
                        </div>
                        <span className="text-sm text-white/80 font-medium">{r.guest}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-white/50">{r.room}</td>
                    <td className="px-5 py-3.5 text-sm text-white/50">{r.checkIn}</td>
                    <td className="px-5 py-3.5 text-sm text-white/50">{r.checkOut}</td>
                    <td className="px-5 py-3.5 text-sm text-white/50">{r.guests}</td>
                    <td className="px-5 py-3.5">
                      <ReservationBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-white/80">
                      {r.amount ? `$${r.amount.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Onaylandı", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    pending_payment: { label: "Ödeme bekleniyor", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    quoted: { label: "Teklif gönderildi", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    new: { label: "Yeni talep", cls: "bg-white/[0.07] text-white/50 border-white/[0.08]" },
    lost: { label: "Kaybedildi", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
  };
  const s = map[status] ?? map.new;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}
