export default function InboxPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Gelen kutusu</h1>
      <p className="text-slate-500 mb-8">AI destekli canlı WhatsApp görüşmeleri</p>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💬</span>
        </div>
        <h2 className="text-slate-700 font-medium mb-1">Henüz görüşme yok</h2>
        <p className="text-slate-400 text-sm">
          Mesaj almaya başlamak için Ayarlar bölümünden WhatsApp kanalını bağlayın.
        </p>
      </div>
    </div>
  );
}
