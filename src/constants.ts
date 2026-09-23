import type { AttendanceType, AttendanceStatus } from './types';

// Uygulama künyesi
export const APP_VERSION = 'v1.3';
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
  'Hazırlık',
  'İbtidai',
  'İzhari',
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

/** Bir talebe kaydında en fazla kaç grup mesulü tutulabilir. */
export const MAX_SUPERVISORS = 2;

/** Durum rozetlerinin ortak etiket ve renkleri (tek kaynak). */
export const STATUS_META: Record<AttendanceStatus, { short: string; label: string; badge: string; bar: string }> = {
  VAR: {
    short: 'VAR',
    label: 'GELDİ',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    bar: 'bg-emerald-500',
  },
  GEC: {
    short: 'GEC',
    label: 'GEÇ GELDİ',
    badge: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
    bar: 'bg-accent-500',
  },
  YOK: {
    short: 'YOK',
    label: 'DEVAMSIZ',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    bar: 'bg-rose-500',
  },
  IZINLI: {
    short: 'IZIN',
    label: 'İZİNLİ',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    bar: 'bg-sky-500',
  },
};
