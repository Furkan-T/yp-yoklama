// Uygulama genelinde kullanılan doğrulama ve biçimlendirme yardımcıları

/**
 * Telefon numarasını doğrular ve "5XX XXX XX XX" biçimine getirir.
 * @param phone - çeşitli biçimlerde telefon numarası
 * @returns biçimlendirilmiş numara, geçersizse null
 */
export const validateAndFormatPhone = (phone: string): string | null => {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return `${normalized.substring(0, 3)} ${normalized.substring(3, 6)} ${normalized.substring(6, 8)} ${normalized.substring(8, 10)}`;
};

/**
 * Telefon numarasını 10 haneli (5XXXXXXXXX) sade biçime indirger.
 * @param phone - çeşitli biçimlerde telefon numarası
 * @returns 10 haneli numara, geçersizse null
 */
export const normalizePhone = (phone: string): string | null => {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('90')) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

    return /^5\d{9}$/.test(cleaned) ? cleaned : null;
};

/**
 * Telefon numarası için WhatsApp bağlantısı üretir.
 * @param phone - telefon numarası
 * @returns wa.me bağlantısı, numara geçersizse null
 */
export const getWhatsAppURL = (phone: string): string | null => {
    const normalized = normalizePhone(phone);
    return normalized ? `https://wa.me/90${normalized}` : null;
};

/**
 * E-posta biçimini doğrular.
 * @param email - e-posta adresi
 * @returns geçerliyse true
 */
export const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Kullanıcı girdisini HTML'e kaçış uygulayarak temizler.
 * @param input - ham girdi
 * @returns temizlenmiş metin
 */
export const sanitizeInput = (input: string): string => {
    return input
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

/**
 * Verilen tarihin gelecekte olup olmadığını söyler.
 * @param dateString - YYYY-MM-DD biçiminde tarih
 * @returns tarih gelecekteyse true
 */
export const isFutureDate = (dateString: string): boolean => {
    const selectedDate = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate > today;
};

/**
 * Bugünün tarihini yerel saat dilimine göre YYYY-MM-DD olarak verir.
 * (new Date().toISOString() UTC kaymasına yol açtığı için kullanılmaz.)
 * @returns YYYY-MM-DD biçiminde tarih
 */
export const getLocalDateISO = (): string => {
    return formatDateISO(new Date());
};

/**
 * Bir Date nesnesini yerel saat dilimine göre YYYY-MM-DD biçimine çevirir.
 * @param d - tarih
 * @returns YYYY-MM-DD biçiminde tarih
 */
export const formatDateISO = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Firestore Timestamp'ini yerel YYYY-MM-DD biçimine çevirir.
 * Tarih karşılaştırmaları uygulama genelinde bu fonksiyonla yapılır.
 * @param date - saniye cinsinden zaman damgası taşıyan nesne
 * @returns YYYY-MM-DD biçiminde tarih, damga yoksa null
 */
export const timestampToDateISO = (date: { seconds: number } | null | undefined): string | null => {
    return date ? formatDateISO(new Date(date.seconds * 1000)) : null;
};

/**
 * Tarihi Türkçe biçimde gösterir.
 * @param date - Date nesnesi veya milisaniye
 * @returns gg.aa.yyyy biçiminde tarih
 */
export const formatDateTR = (date: Date | number): string => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString('tr-TR');
};

/**
 * Saati Türkçe biçimde gösterir.
 * @param date - Date nesnesi veya milisaniye
 * @returns ss:dd biçiminde saat
 */
export const formatTimeTR = (date: Date | number): string => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Seans adındaki parantezli ek bilgiyi ayıklar.
 * Örn: "Etüt 1 (17.00-17.45)" -> "Etüt 1"
 * @param subType - ham seans adı
 * @returns normalize edilmiş seans adı
 */
export const normalizeSubType = (subType: string): string =>
    subType.replace(/\s*\([^)]*\)\s*/g, '').trim();
