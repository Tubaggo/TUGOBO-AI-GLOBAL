export default function AnalyticsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Analiz</h1>
      <p className="text-slate-500 mb-8">Dönüşüm hunisi ve AI performansı</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Toplam talep", value: "—" },
          { label: "Teklif", value: "—" },
          { label: "Onaylandı", value: "—" },
          { label: "Dönüşüm", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
        Analiz grafikleri 11. günden itibaren kullanılabilir.
      </div>
    </div>
  );
}
