export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Ayarlar</h1>
      <p className="text-slate-500 mb-8">Otel profili, WhatsApp kanalı ve AI persona ayarları</p>

      <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-2xl">
        <p className="text-sm text-slate-500">
          Ayar düzenleyicisi 2. günde açılacak. Otel adı, saat dilimi, çalışma saatleri ve AI persona burada yönetilecek.
        </p>
      </div>
    </div>
  );
}
