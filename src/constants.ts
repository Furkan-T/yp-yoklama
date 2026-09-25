import type { AttendanceType, AttendanceStatus } from './types';

// Uygulama künyesi
export const APP_VERSION = 'v2.3';
export const APP_NAME = 'Yoklama Takip Sistemi';

// Doğrulama desenleri
export const VALIDATION_PATTERNS = {
  PHONE: /^5\d{9}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

export const ATTENDANCE_TYPES: AttendanceType[] = ['ETUT', 'NAMAZ'];

/**
 * Yoklama türlerinin ekranda görünen adları. 'ETUT' anahtarı veritabanında
 * olduğu gibi kalır; yalnızca etiketi "DAHİLİ DERS" olarak değişmiştir.
 */
export const TYPE_LABELS: Record<AttendanceType, string> = {
  ETUT: 'DAHİLİ DERS',
  NAMAZ: 'NAMAZ',
};

/** Dahili ders grupları — hem talebe kaydında hem yoklama seansı olarak kullanılır. */
export const DERS_GROUPS = [
  'Hazırlık-1',
  'Hazırlık-2',
  'İbtidai',
  'İhzari',
  'Tekamülaltı',
  'Kur\'an-ı Kerim',
];

export const NAMAZ_TIMES = [
  'Sabah Namazı',
  'Öğle Namazı',
  'İkindi Namazı',
  'Akşam Namazı',
  'Yatsı Namazı'
];

/** Seçilen yoklama türünün alt seans listesi. */
export const SUB_TYPES: Record<AttendanceType, string[]> = {
  ETUT: DERS_GROUPS,
  NAMAZ: NAMAZ_TIMES,
};

export const BLOOD_TYPES = [
  'A Rh+', 'A Rh-',
  'B Rh+', 'B Rh-',
  'AB Rh+', 'AB Rh-',
  '0 Rh+', '0 Rh-',
];

/** Namaz yoklamasında "tüm gruplar" seçeneğinin değeri. */
export const ALL_GROUPS = 'HEPSI';

/** Bir talebe kaydında en fazla kaç grup mesulü tutulabilir. */
export const MAX_SUPERVISORS = 2;

/** Durum rozetlerinin ortak etiket ve renkleri (tek kaynak). */
export const STATUS_META: Record<AttendanceStatus, { short: string; label: string; badge: string; bar: string }> = {
  VAR: {
    short: 'VAR',
    label: 'GELDİ',
    badge: 'bg-primary-50 text-primary-700 border-primary-200',
    bar: 'bg-primary-500',
  },
  // GEÇ ve İZİNLİ artık yoklama ekranından girilmiyor; eski kayıtlarda
  // bulundukları için gösterim tarafında korunuyorlar.
  GEC: {
    short: 'GEC',
    label: 'GEÇ GELDİ',
    badge: 'bg-accent-50 text-accent-800 border-accent-200',
    bar: 'bg-accent-500',
  },
  YOK: {
    short: 'YOK',
    label: 'DEVAMSIZ',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
  },
  IZINLI: {
    short: 'IZIN',
    label: 'İZİNLİ',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    bar: 'bg-sky-500',
  },
};
