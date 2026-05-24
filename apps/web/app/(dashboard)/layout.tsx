import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Calendar, BookOpen, Settings, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/inbox", label: "Kutu", icon: MessageSquare },
  { href: "/reservations", label: "Rezervasyonlar", icon: Calendar },
  { href: "/knowledge", label: "Bilgi merkezi", icon: BookOpen },
  { href: "/analytics", label: "Analiz", icon: BarChart3 },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center px-4 py-4 border-b border-slate-200">
          <Link href="/" className="inline-flex items-center px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition-colors shadow-md">
            <Image
              src="/Logo.png"
              alt="Tugobo AI"
              width={200}
              height={34}
              className="h-[34px] w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors group"
            >
              <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User stub */}
        <div className="px-4 py-4 border-t border-slate-200">
          <p className="text-xs text-slate-400 truncate">hotel@example.com</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
