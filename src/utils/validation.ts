// Uygulama genelinde kullanılan doğrulama ve biçimlendirme yardımcıları

/**
 * Numarayı rakamlara indirger ve uluslararası önek taşıyıp taşımadığını bildirir.
 */
const splitPhone = (phone: string): { digits: string; isInternational: boolean } => {
    const raw = phone.trim();
    let digits = raw.replace(/\D/g, '');
    const isInternational = raw.startsWith('+') || digits.startsWith('00');
    if (digits.startsWith('00')) digits = digits.slice(2);
    return { digits, isInternational };
};

/**
 * Numara bir Türk cep numarasıysa 10 haneli (5XXXXXXXXX) biçimini verir.
 * 90, 0 ve +90 önekleri kabul edilir.
 * @param phone - çeşitli biçimlerde telefon numarası
 * @returns 10 haneli numara, Türk cep numarası değilse null
 */
export const normalizeTurkishMobile = (phone: string): string | null => {
    let { digits } = splitPhone(phone);
    if (digits.startsWith('90')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    return /^5\d{9}$/.test(digits) ? digits : null;
};

/**
 * Numarayı saklanacak biçime getirir. Türk cep numaraları "5XX XXX XX XX"
 * olarak düzenlenir; yabancı numaralar korunur (uluslararası önek varsa "+" ile).
 * Yurt dışından gelen talebeler için numara biçimi ülkeden ülkeye değiştiğinden
 * zorlayıcı bir kalıp uygulanmaz.
 * @param phone - serbest biçimde numara
 * @returns saklanacak numara, girdi boşsa boş metin
 */
export const formatPhone = (phone: string): string => {
    const { digits, isInternational } = splitPhone(phone);
    if (!digits) return '';

    const turkish = normalizeTurkishMobile(phone);
    if (turkish) {
        return `${turkish.substring(0, 3)} ${turkish.substring(3, 6)} ${turkish.substring(6, 8)} ${turkish.substring(8, 10)}`;
    }

    return isInternational ? `+${digits}` : digits;
};

/**
 * Numaranın makul olup olmadığını söyler. Ülke biçimleri çok çeşitli olduğu için
 * yalnızca hane sayısına bakılır; boş değer geçerlidir, telefon alanları zorunlu değildir.
 * @param phone - serbest biçimde numara
 * @returns kabul edilebilirse true
 */
export const isPlausiblePhone = (phone: string): boolean => {
    if (!phone.trim()) return true;
    const { digits } = splitPhone(phone);
    return digits.length >= 7 && digits.length <= 15; // E.164 en fazla 15 hane
};

/**
 * Telefon numarası için WhatsApp bağlantısı üretir. Türk cep numaralarına 90
 * ülke kodu eklenir; yabancı numaralarda kullanıcının girdiği kod kullanılır.
 * @param phone - telefon numarası
 * @returns wa.me bağlantısı, numara kullanılamazsa null
 */
export const getWhatsAppURL = (phone: string): string | null => {
    const turkish = normalizeTurkishMobile(phone);
    if (turkish) return `https://wa.me/90${turkish}`;

    // Yabancı numara: baştaki sıfırlar (şehir içi önek) atılır
    const international = splitPhone(phone).digits.replace(/^0+/, '');
    return international.length >= 7 ? `https://wa.me/${international}` : null;
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
