import { defaultLocale, type PanelLocale } from "./config";

/** Dynamic operational copy — UI labels, AI hints, cognition summaries */
export const operationalTexts = {
  tr: {
    guestSummaryPaymentRisk:
      "Misafir rezervasyonu tamamlamak istiyor ancak ödeme sürecinde sorun yaşıyor.",
    guestSummaryHumanTakeover:
      "Politika veya özel talep için ekip kararı gerekiyor; rezervasyon bağlamı hazır.",
    guestSummaryRecovery:
      "Rezervasyon tamamlanmaya çalışılıyor — alternatif ödeme yolu paylaşıldı, {amount} risk altında.",
    guestSummaryResolved:
      "Rezervasyon onaylandı; varış öncesi ek satış ve misafir hazırlığı açık.",
    guestSummaryNewInquiry:
      "Yeni talep doğrudan kanaldan geldi — OTA kaybı olmadan müsaitlik paylaşılmalı.",
    guestSummaryDefault: "Görüşme izleniyor; misafir beklentisi ve rezervasyon bağlamı güncel.",

    suggestedPaymentAction: "Ödeme bağlantısını yeniden gönder",
    suggestedHumanClose: "Ekibin kapatmasına izin ver; ödeme linki ve notlar görünür kalsın",
    suggestedOtaConversion: "OTA komisyonu kaybolmadan direkt fiyat teklif et",
    suggestedPostConfirm: "Geç çıkış veya kahvaltı paketi öner — onay sonrası kabul eğilimi yüksek",
    suggestedAvailability: "Misafirin dilinde müsaitlik ve direkt fiyat paylaş",
    suggestedMonitor: "Görüşmeyi izle ve SLA içinde yanıtla",

    aiHandlingThread: "Tugobo AI bu görüşmeyi yönetiyor.",
    aiHandlingThreadTakeover: "Manuel yanıt için görüşmeyi devralabilirsiniz.",
    conversationResolved: "Görüşme tamamlandı",
    typeReplyPlaceholder: "Yanıtınızı yazın…",
    replyAsStaffPlaceholder: "Ekip olarak yanıtlayın…",
    aiHandlingCannotReply: "AI yanıtlıyor — yanıtlamak için devralın",

    aiSupport: "AI destek",
    staffSupport: "Ekip desteği",
    handledByStaff: "Ekip",
    handledByAi: "AI destek",
    handledByClosed: "Tamamlandı",
    speakerSuffix: "konuşuyor",

    statusAiActive: "AI destek",
    statusHumanTakeover: "Ekip devraldı",
    statusResolved: "Kapandı",
    statusOpsAuto: "AI destek",

    leadNew: "Yeni talep",
    leadQualified: "Uygunluk kontrolü",
    leadQuoted: "Teklif gönderildi",
    leadConfirmed: "Onaylandı",
    leadLost: "Kayıp",

    resConfirmed: "Onaylandı",
    resPendingPayment: "Ödeme bekleniyor",
    resQuoted: "Teklif gönderildi",
    resNew: "Yeni talep",
    resLost: "Kayıp",

    quoteCreated: "Teklif oluşturuldu",
    reservationCreated: "Rezervasyon oluşturuldu",
    viewReservation: "Rezervasyonu aç",
    sendPaymentLink: "Ödeme bağlantısı gönder",
    linkSent: "Bağlantı gönderildi",
    takeOver: "Devral",
    handToAi: "AI'ya devret",
    viewBooking: "Rezervasyonu gör",

    pricePerNight: "Gecelik fiyat",
    totalAmount: "Toplam tutar",
    nightsLabel: "gece",
    checkIn: "Giriş",
    checkOut: "Çıkış",
    guestsLabel: "Misafir",

    paymentReceived: "Ödeme alındı",
    paymentLinkSentToast: "Ödeme bağlantısı gönderildi",
    paymentConfirmedToast: "Ödeme onaylandı",
    newChannelMessage: "Yeni kanal mesajı",
    addedToQueue: "Operasyon kuyruğuna eklendi",

    guestWaitingStaff: "{count} misafir ekip bekliyor",
    viaChannel: "{channel} · {time}",

    humanSupportRequired: "İnsan desteği öneriliyor · Ekip müdahalesi gerekebilir",
    aiSuggestionPending: "AI önerisi (onay bekliyor)",
    estimatedBookingValue: "Tahmini rezervasyon değeri",
    lastActivity: "Son aktivite",
    channelLabel: "Kanal",
    reservationStatusLabel: "Rezervasyon durumu",
    suggestedActionLabel: "Önerilen işlem",
    humanTakeoverRecommended: "İnsan desteği öneriliyor",

    suggestedHumanTakeover: "İnsan desteği devralsın",
    suggestedContinueWatch: "Görüşmeyi izlemeye devam et",

    preparingPaymentRoute: "Alternatif ödeme yolu hazırlanıyor…",
    connectingStaff: "Resepsiyon ekibine bağlanılıyor…",

    staffAssistingMoment: "Ekip yanıtlıyor — AI beklemede",
    staffLeadingConversation: "Ekip bu görüşmeyi yönetiyor.",
    humanSupportActive: "İnsan destek aktif",
    aiSupportContinuing: "AI destek devam ediyor",
    operatorJoinedConversation: "Operatör görüşmeye katıldı",
    noStaffTakeoverYet: "Henüz ekip devri gerekmedi.",

    offerPrepared: "Teklif hazırlandı",
    reservationInProgress: "Rezervasyon süreci devam ediyor",

    eventRequestReceived: "Talep geldi",
    eventAiChecking: "AI müsaitlik kontrol ediyor",
    eventOfferReady: "Teklif hazırlandı",
    eventPaymentLinkSent: "Ödeme bağlantısı gönderildi",
    eventPaymentPending: "Ödeme bekleniyor",
    eventHumanSuggested: "İnsan desteği öneriliyor",
    eventBookingConfirmed: "Rezervasyon onaylandı",

    aiReplyHumanReview:
      "Bu görüşmede ekip desteği öneriyorum. Kısa süre içinde sizinle ilgileneceğiz.",
    aiReplyConfirmed: "Harika 😊 Ödemenizi aldık. Rezervasyon onayınızı hemen paylaşıyorum.",
    aiReplyPaymentProblem:
      "Ödeme bağlantısını tekrar paylaşabilirim. İsterseniz resepsiyon ekibimiz de yardımcı olabilir.",
    aiReplyPaymentPending:
      "Ödeme bağlantınızı güvenli şekilde iletiyorum. Tamamladığınızda hemen onaylayacağım.",
    aiReplyOffer: "İlgili tarihler için uygun seçenekleri hazırlıyorum. Birkaç dakika içinde teklifinizi paylaşacağım.",
    aiReplyAvailability: "Tabii 😊 Hemen müsaitlik durumunu kontrol ediyorum.",
    aiReplyDefault: "Teşekkür ederim, talebinizi not aldım. Size en uygun seçenekleri hazırlıyorum.",

    actionShareAvailability: "Müsaitlik ve oda seçeneklerini paylaş",
    actionConfirmOffer: "Teklifi onayla ve ödeme adımına geçir",
    actionTrackPayment: "Ödeme durumunu takip et",
    actionResendPayment: "Ödeme bağlantısını yeniden gönder",
    actionSendConfirmation: "Onay mesajını gönder",
    actionStaffGreet: "Misafiri ekip üyesi karşılasın",

    livePanelPreview: "Operasyon paneli önizlemesi",
    liveHotelOps: "Canlı otel operasyonu",
    operationsCenterLink: "Operasyon merkezi →",
    autoDemoRunning: "Otomatik demo çalışıyor",
    selectConversation: "Bir görüşme seçin",
    loadingThread: "Bu görüşme için mesaj geçmişi yükleniyor…",
    emptyQueue: "Henüz aktif misafir konuşması yok.",
    emptyQueueDetail: "Yeni mesajlar burada görünecek.",
    emptyReservations: "Aktif rezervasyon süreci boş.",
    emptyReservationsDetail:
      "Yeni talepler ve teklifler onaylandıkça bu ekranda görünür.",
    emptyGuests: "Misafir profilleri operasyon geçmişi oluştukça görünür.",
    emptyGuestsDetail:
      "Konuşma ve rezervasyon verisi biriktikçe misafir kartları burada listelenir.",
    emptyPaymentsPending: "Bekleyen ödeme operasyonu bulunmuyor.",
    emptyPaymentsPendingDetail:
      "Ödeme bağlantıları ve kurtarma adımları oluştuğunda burada takip edilir.",
    emptySelectConversation: "Bir görüşme seçin",
    emptySelectConversationDetail:
      "Sol kuyruktan bir görüşme seçerek misafir geçmişini ve önerilen işlemleri görüntüleyin.",
    emptyPaymentRisks: "Bekleyen ödeme operasyonu bulunmuyor.",
    emptyPaymentRisksDetail: "Ödeme sorunları oluştuğunda kurtarma akışı burada listelenir.",
    emptyPendingOperations: "Şu anda kritik operasyon uyarısı yok.",
    emptyPendingOperationsDetail: "Yeni operasyon sinyalleri anlık olarak bu akışta görünür.",
    emptyHumanInterventions: "AI destekli süreçler stabil çalışıyor.",
    emptyHumanInterventionsDetail: "İnsan desteği gerektiğinde ekip koordinasyonu burada listelenir.",
    emptyAlerts: "Şu anda kritik operasyon uyarısı yok.",
    emptyAlertsDetail: "Ödeme riski veya SLA ihlali olduğunda uyarılar burada görünür.",

    liveSyncActive: "Operasyon güncellendi",
    liveSyncIdle: "Canlı operasyon hazır",
    messageRouting: "Mesaj yönlendiriliyor…",
    paymentVerifying: "Ödeme doğrulanıyor…",

    aiTypingThinking: "AI düşünüyor…",
    aiTypingComposing: "AI yanıt hazırlıyor…",
    aiTypingCheckingAvailability: "AI müsaitlik kontrol ediyor…",
    aiTypingCheckingPayment: "AI ödeme durumunu kontrol ediyor…",
    aiTypingPreparingReservation: "AI rezervasyon detaylarını hazırlıyor…",

    messagesUnit: "mesaj",

    toastNewMessage: "Yeni mesaj · {name}",
    toastNewInquiry: "Yeni talep · {name}",
    toastQuoteCreated: "Teklif oluşturuldu · {name}",
    toastPaymentLinkSent: "Ödeme bağlantısı gönderildi",
    toastPaymentConfirmed: "Ödeme onaylandı",
    toastBookingConfirmed: "Rezervasyon onaylandı 🎉",
    systemPaymentReceived: "Ödeme alındı · {amount} · {time}",

    momentPaymentMonitor: "AI ödeme durumunu izliyor…",
    momentRecoveryPrep: "Alternatif ödeme yolu hazırlanıyor…",
    momentVipEscalation: "Bu misafir için insan desteği öneriliyor",
    momentStaffAssist: "Ekip yanıtlıyor — AI beklemede",
    momentCheckingAvail: "AI müsaitlik kontrol ediyor…",
    momentOtaOffer: "Direkt fiyat eşlemesi hazırlanıyor…",
    momentAiSupervising: "AI rezervasyon sürecini destekliyor",
    momentBookingDone: "Rezervasyon onaylandı — varış öncesi ek satış hazır",

    cognitionTitle: "Operasyon özeti",
    cognitionSubtitle: "Öncelik · gelir · sonraki adım",
    cognitionSeeing: "Durum",
    cognitionRevenue: "Gelir görünümü",
    cognitionEscalation: "Destek kontrolü",
    cognitionBookingValue: "Rezervasyon değeri",
    cognitionOtaRetention: "OTA tutma",
    cognitionCloseConfidence: "Tamamlama güveni",
    cognitionRecoveryConfidence: "Kurtarma güveni",
    cognitionEscalationRisk: "Müdahale ihtimali",
    cognitionGuestHistory: "Misafir geçmişi",
    cognitionNoHistory: "Kayıtlı önceki konaklama notu yok.",
    cognitionSuggestedStep: "Önerilen sonraki adım",
  },
  en: {
    guestSummaryPaymentRisk:
      "Guest wants to complete the booking but is stuck in payment.",
    guestSummaryHumanTakeover:
      "Policy or special request needs a staff decision; booking context is ready.",
    guestSummaryRecovery:
      "Recovery in progress — alternate payment sent, {amount} still at risk.",
    guestSummaryResolved:
      "Booking confirmed; post-stay upsell and pre-arrival nurture remain open.",
    guestSummaryNewInquiry:
      "New direct-channel inquiry — share availability before OTA leakage.",
    guestSummaryDefault: "Thread monitored; guest context is up to date.",

    suggestedPaymentAction: "Resend one-click payment link",
    suggestedHumanClose: "Let staff close; keep payment link and notes visible",
    suggestedOtaConversion: "Offer direct rate before OTA commission is lost",
    suggestedPostConfirm: "Offer late checkout or breakfast bundle post-confirmation",
    suggestedAvailability: "Send availability and direct rate in guest language",
    suggestedMonitor: "Monitor thread and respond within SLA",

    aiHandlingThread: "Tugobo AI is handling this conversation.",
    aiHandlingThreadTakeover: "Take over to reply manually.",
    conversationResolved: "Conversation resolved",
    typeReplyPlaceholder: "Type a reply…",
    replyAsStaffPlaceholder: "Reply as hotel staff…",
    aiHandlingCannotReply: "AI is handling this — take over to reply",

    aiSupport: "AI support",
    staffSupport: "Staff support",
    handledByStaff: "Staff",
    handledByAi: "AI support",
    handledByClosed: "Resolved",
    speakerSuffix: "speaker",

    statusAiActive: "AI support",
    statusHumanTakeover: "Staff takeover",
    statusResolved: "Closed",
    statusOpsAuto: "AI support",

    leadNew: "Inquiry",
    leadQualified: "Qualified",
    leadQuoted: "Offer sent",
    leadConfirmed: "Confirmed",
    leadLost: "Lost",

    resConfirmed: "Confirmed",
    resPendingPayment: "Payment pending",
    resQuoted: "Offer sent",
    resNew: "Inquiry",
    resLost: "Lost",

    quoteCreated: "Quote created",
    reservationCreated: "Reservation created",
    viewReservation: "View reservation",
    sendPaymentLink: "Send payment link",
    linkSent: "Link sent",
    takeOver: "Take over",
    handToAi: "Hand to AI",
    viewBooking: "View booking",

    pricePerNight: "Price per night",
    totalAmount: "Total amount",
    nightsLabel: "nights",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guestsLabel: "Guests",

    paymentReceived: "Payment received",
    paymentLinkSentToast: "Payment link sent",
    paymentConfirmedToast: "Payment confirmed",
    newChannelMessage: "New channel message",
    addedToQueue: "Added to operations queue",

    guestWaitingStaff: "{count} guest(s) waiting for staff",
    viaChannel: "{channel} · {time}",

    humanSupportRequired: "Human support recommended · Staff may need to step in",
    aiSuggestionPending: "AI suggestion (awaiting approval)",
    estimatedBookingValue: "Estimated booking value",
    lastActivity: "Last activity",
    channelLabel: "Channel",
    reservationStatusLabel: "Reservation status",
    suggestedActionLabel: "Suggested action",
    humanTakeoverRecommended: "Human support recommended",

    suggestedHumanTakeover: "Hand over to staff",
    suggestedContinueWatch: "Continue monitoring",

    preparingPaymentRoute: "Preparing alternate payment route…",
    connectingStaff: "Connecting front desk to this conversation…",

    staffAssistingMoment: "Staff assisting — AI on standby",
    staffLeadingConversation: "Staff is leading this conversation.",
    humanSupportActive: "Human support active",
    aiSupportContinuing: "AI support continues",
    operatorJoinedConversation: "Operator joined the conversation",
    noStaffTakeoverYet: "No staff takeover needed yet.",

    offerPrepared: "Offer prepared",
    reservationInProgress: "Reservation in progress",

    eventRequestReceived: "Request received",
    eventAiChecking: "AI checking availability",
    eventOfferReady: "Offer prepared",
    eventPaymentLinkSent: "Payment link sent",
    eventPaymentPending: "Payment pending",
    eventHumanSuggested: "Human support recommended",
    eventBookingConfirmed: "Booking confirmed",

    aiReplyHumanReview:
      "I recommend staff support for this conversation. We will follow up shortly.",
    aiReplyConfirmed: "Great — payment received. Sharing your confirmation now.",
    aiReplyPaymentProblem:
      "I can resend the payment link. Our front desk team can also assist.",
    aiReplyPaymentPending:
      "Sending your secure payment link. I will confirm as soon as it is completed.",
    aiReplyOffer: "Preparing suitable options for your dates. I will share your quote shortly.",
    aiReplyAvailability: "Checking availability for you now.",
    aiReplyDefault: "Thank you — I have noted your request and am preparing the best options.",

    actionShareAvailability: "Share availability and room options",
    actionConfirmOffer: "Confirm offer and move to payment",
    actionTrackPayment: "Track payment status",
    actionResendPayment: "Resend payment link",
    actionSendConfirmation: "Send confirmation message",
    actionStaffGreet: "Have a team member greet the guest",

    livePanelPreview: "Operations panel preview",
    liveHotelOps: "Live hotel operations",
    operationsCenterLink: "Operations center →",
    autoDemoRunning: "Auto-demo running",
    selectConversation: "Select a conversation",
    loadingThread: "Loading message history…",
    emptyQueue: "No active guest conversations yet.",
    emptyQueueDetail: "New messages will appear here.",
    emptyReservations: "Reservation pipeline is empty.",
    emptyReservationsDetail: "New inquiries and confirmations will appear here.",
    emptyGuests: "Guest profiles appear as operational history builds.",
    emptyGuestsDetail: "Profiles list here as conversation and booking data accumulates.",
    emptyPaymentsPending: "No pending payment operations.",
    emptyPaymentsPendingDetail: "Payment links and recovery steps will list here when active.",
    emptySelectConversation: "Select a conversation",
    emptySelectConversationDetail:
      "Pick a thread from the queue to view guest context and suggested actions.",
    emptyPaymentRisks: "No payment risks right now.",
    emptyPaymentRisksDetail: "Failed or stuck payments will surface here for recovery.",
    emptyPendingOperations: "Operations are running normally.",
    emptyPendingOperationsDetail: "New operational signals appear in this feed in real time.",
    emptyHumanInterventions: "AI-assisted flows are stable.",
    emptyHumanInterventionsDetail: "Staff coordination items appear here when human support is needed.",
    emptyAlerts: "No critical operational alerts right now.",
    emptyAlertsDetail: "Payment risk and SLA items will show here when they need attention.",

    liveSyncActive: "Operations updated",
    liveSyncIdle: "Live operations ready",
    messageRouting: "Routing message…",
    paymentVerifying: "Verifying payment…",

    aiTypingThinking: "AI is thinking…",
    aiTypingComposing: "AI is preparing a reply…",
    aiTypingCheckingAvailability: "AI is checking availability…",
    aiTypingCheckingPayment: "AI is checking payment status…",
    aiTypingPreparingReservation: "AI is preparing reservation details…",

    messagesUnit: "messages",

    toastNewMessage: "New message · {name}",
    toastNewInquiry: "New inquiry · {name}",
    toastQuoteCreated: "Quote created · {name}",
    toastPaymentLinkSent: "Payment link sent",
    toastPaymentConfirmed: "Payment confirmed",
    toastBookingConfirmed: "Booking confirmed 🎉",
    systemPaymentReceived: "Payment received · {amount} · {time}",

    momentPaymentMonitor: "AI is monitoring payment status…",
    momentRecoveryPrep: "Preparing alternate payment route…",
    momentVipEscalation: "Human takeover recommended for this guest",
    momentStaffAssist: "Staff assisting — AI on standby",
    momentCheckingAvail: "AI is checking availability…",
    momentOtaOffer: "Preparing direct rate match offer…",
    momentAiSupervising: "AI supervising reservation flow",
    momentBookingDone: "Booking confirmed — pre-arrival upsell ready",

    cognitionTitle: "Operations brief",
    cognitionSubtitle: "What matters now · revenue · next step",
    cognitionSeeing: "What we're seeing",
    cognitionRevenue: "Revenue picture",
    cognitionEscalation: "Escalation check",
    cognitionBookingValue: "Booking value",
    cognitionOtaRetention: "OTA retention",
    cognitionCloseConfidence: "Close confidence",
    cognitionRecoveryConfidence: "Recovery confidence",
    cognitionEscalationRisk: "Escalation risk",
    cognitionGuestHistory: "Guest history",
    cognitionNoHistory: "No prior stay notes on file.",
    cognitionSuggestedStep: "Suggested next step",
  },
} as const;

export type OperationalTextKey = keyof (typeof operationalTexts)["tr"];

export function op(
  key: OperationalTextKey,
  locale: PanelLocale = defaultLocale,
  params?: Record<string, string | number>
): string {
  const dict = operationalTexts[locale] ?? operationalTexts.tr;
  let text: string = dict[key] ?? operationalTexts.tr[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Map guest language code to panel locale for AI simulation */
export function localeFromGuestLanguage(language?: string): PanelLocale {
  const code = (language ?? "TR").toUpperCase();
  if (code === "EN" || code.startsWith("EN")) return "en";
  return "tr";
}
