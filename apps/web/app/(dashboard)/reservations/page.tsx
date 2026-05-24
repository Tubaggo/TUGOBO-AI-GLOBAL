export default function ReservationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Rezervasyonlar</h1>
      <p className="text-slate-500 mb-8">İlk mesajdan onaylı rezervasyona kadar tüm süreci takip edin</p>

      <div className="grid grid-cols-4 gap-4">
        {["Yeni talep", "Teklif", "Onaylandı", "Kaybedildi"].map((col) => (
          <div key={col} className="bg-slate-100 rounded-xl p-4">
            <h3 className="font-medium text-slate-700 text-sm mb-3">{col}</h3>
            <div className="text-slate-400 text-xs text-center py-8">Henüz talep yok</div>
          </div>
        ))}
      </div>
    </div>
  );
}
