import type { AttendanceType, AttendanceStatus } from './types';

// Uygulama künyesi
export const APP_VERSION = 'v1.0';
export const APP_NAME = 'Yoklama Takip Sistemi';

// Doğrulama desenleri
export const VALIDATION_PATTERNS = {
  TC_NO: /^\d{11}$/,
  PHONE: /^5\d{9}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

export const ATTENDANCE_TYPES: AttendanceType[] = ['ETUT', 'NAMAZ'];

export const NAMAZ_TIMES = [
  'Sabah Namazı',
  'Öğle Namazı',
  'İkindi Namazı',
  'Akşam Namazı',
  'Yatsı Namazı'
];

export const ETUT_SESSIONS = [
  'Etüt 1',
  'Etüt 2',
  'Etüt 3',
  'Etüt 4',
  'Etüt 5',
];

/** Seçilen yoklama türünün alt seans listesi. */
export const SUB_TYPES: Record<AttendanceType, string[]> = {
  ETUT: ETUT_SESSIONS,
  NAMAZ: NAMAZ_TIMES,
};

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
