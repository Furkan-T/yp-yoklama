import type { Student, AttendanceRecord } from '../types';
import { NAMAZ_TIMES, APP_NAME } from '../constants';
import { formatDateISO, timestampToDateISO, normalizeSubType } from './validation';

/** Rapor haftası cumartesi başlar, cuma biter. */
export const WEEK_LENGTH = 7;

export interface WeekRange {
  start: Date;
  end: Date;
  /** Haftanın günleri, YYYY-MM-DD biçiminde. */
  days: string[];
}

export interface StudentReportRow {
  student: Student;
  /** Gelmediği dahili ders sayısı. */
  ders: number;
  /** Vakit adına göre gelmediği namaz sayısı. */
  namaz: Record<string, number>;
  namazToplam: number;
  toplam: number;
  /** Hafta boyunca adına yazılan yoklama sayısı — sıfır devamsızlığı yorumlamak için. */
  alinanYoklama: number;
}

export interface AbsenceDetail {
  date: string;
  dayName: string;
  type: string;
  subType: string;
  studentName: string;
  group: string;
}

export interface WeeklyReport {
  range: WeekRange;
  rows: StudentReportRow[];
  details: AbsenceDetail[];
  toplamDevamsizlik: number;
  devamsizTalebeSayisi: number;
}

/**
 * Verilen güne göre rapor haftasının başlangıcını (cumartesi) bulur.
 * Cumartesi günü çalıştırıldığında yeni başlayan haftayı değil, biten haftayı
 * verir; rapor genelde hafta kapandıktan sonra alınır.
 * @param from - referans gün (varsayılan: bugün)
 */
export const defaultWeekStart = (from: Date = new Date()): Date => {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const daysSinceSaturday = (d.getDay() + 1) % 7; // Cmt=0, Paz=1, ... Cum=6
  d.setDate(d.getDate() - daysSinceSaturday - (daysSinceSaturday === 0 ? WEEK_LENGTH : 0));
  return d;
};

/** Başlangıç gününden itibaren yedi günlük aralığı üretir. */
export const buildWeek = (start: Date): WeekRange => {
  const days: string[] = [];
  for (let i = 0; i < WEEK_LENGTH; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(formatDateISO(d));
  }
  const end = new Date(start);
  end.setDate(start.getDate() + WEEK_LENGTH - 1);
  return { start: new Date(start), end, days };
};

const TR_DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const TR_DAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });

/** "19 Eylül Cumartesi – 25 Eylül Cuma" biçiminde başlık. */
export const formatRange = (range: WeekRange): string =>
  `${TR_DATE.format(range.start)} ${TR_DAY.format(range.start)} – ${TR_DATE.format(range.end)} ${TR_DAY.format(range.end)}`;

/**
 * Haftalık devamsızlık raporunu hesaplar.
 *
 * "Gelmedi" yalnızca YOK durumunu kapsar; VAR gelmiş demektir, eski
 * kayıtlardaki GEÇ ise geç de olsa gelmiş sayılır.
 *
 * @param students - tüm talebeler
 * @param records - tüm yoklama kayıtları (silinmişler zaten elenmiş olur)
 * @param start - hafta başlangıcı (cumartesi)
 */
export const buildWeeklyReport = (
  students: Student[],
  records: AttendanceRecord[],
  start: Date
): WeeklyReport => {
  const range = buildWeek(start);
  const inWeek = new Set(range.days);

  const weekRecords = records.filter(r => {
    const day = timestampToDateISO(r.date);
    return day !== null && inWeek.has(day);
  });

  const emptyNamaz = () => Object.fromEntries(NAMAZ_TIMES.map(t => [t, 0]));
  const rowsById = new Map<string, StudentReportRow>(
    students.map(s => [s.id, {
      student: s,
      ders: 0,
      namaz: emptyNamaz(),
      namazToplam: 0,
      toplam: 0,
      alinanYoklama: 0,
    }])
  );

  const details: AbsenceDetail[] = [];

  weekRecords.forEach(r => {
    const row = rowsById.get(r.studentId);
    if (row) row.alinanYoklama += 1;
    if (r.status !== 'YOK') return;

    const subType = normalizeSubType(r.subType);
    if (row) {
      if (r.type === 'ETUT') {
        row.ders += 1;
      } else if (subType in row.namaz) {
        row.namaz[subType] += 1;
      } else {
        // Listede olmayan bir vakit adı (eski kayıt) toplama yine de girsin
        row.namaz[subType] = (row.namaz[subType] ?? 0) + 1;
      }
      row.namazToplam = Object.values(row.namaz).reduce((sum, v) => sum + v, 0);
      row.toplam = row.ders + row.namazToplam;
    }

    const day = timestampToDateISO(r.date)!;
    details.push({
      date: day,
      dayName: TR_DAY.format(new Date(`${day}T12:00:00`)),
      type: r.type === 'ETUT' ? 'Dahili Ders' : 'Namaz',
      subType,
      studentName: r.studentName,
      group: row?.student.group || '',
    });
  });

  const rows = [...rowsById.values()].sort((a, b) =>
    b.toplam - a.toplam || a.student.name.localeCompare(b.student.name, 'tr')
  );

  details.sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'tr') || a.date.localeCompare(b.date)
  );

  return {
    range,
    rows,
    details,
    toplamDevamsizlik: rows.reduce((sum, r) => sum + r.toplam, 0),
    devamsizTalebeSayisi: rows.filter(r => r.toplam > 0).length,
  };
};

/**
 * Raporu iki sayfalı bir Excel dosyası olarak indirir:
 * "Özet" talebe başına sayıları, "Devamsızlık Detayı" hangi gün hangi vakit
 * gelinmediğini listeler.
 */
export const downloadWeeklyReport = async (report: WeeklyReport): Promise<void> => {
  const XLSX = await import('xlsx');
  const { range, rows, details } = report;

  // --- Sayfa 1: Özet ---
  const ozetBaslik = [
    'Ad Soyad', 'Grup', 'Dahili Ders',
    ...NAMAZ_TIMES.map(t => t.replace(' Namazı', '')),
    'Namaz Toplam', 'GENEL TOPLAM', 'Alınan Yoklama',
  ];

  const ozet = XLSX.utils.aoa_to_sheet([
    [`${APP_NAME} — Haftalık Devamsızlık Raporu`],
    [formatRange(range)],
    [`Toplam devamsızlık: ${report.toplamDevamsizlik}`, `Devamsızlığı olan talebe: ${report.devamsizTalebeSayisi} / ${rows.length}`],
    [],
    ozetBaslik,
    ...rows.map(r => [
      r.student.name,
      r.student.group || '',
      r.ders,
      ...NAMAZ_TIMES.map(t => r.namaz[t] ?? 0),
      r.namazToplam,
      r.toplam,
      r.alinanYoklama,
    ]),
  ]);
  ozet['!cols'] = [
    { wch: 26 }, { wch: 16 }, { wch: 12 },
    ...NAMAZ_TIMES.map(() => ({ wch: 9 })),
    { wch: 13 }, { wch: 15 }, { wch: 15 },
  ];
  // --- Sayfa 2: Devamsızlık Detayı ---
  const detay = XLSX.utils.aoa_to_sheet([
    ['Ad Soyad', 'Grup', 'Tarih', 'Gün', 'Tür', 'Vakit / Grup'],
    ...details.map(d => [
      d.studentName,
      d.group,
      new Date(`${d.date}T12:00:00`).toLocaleDateString('tr-TR'),
      d.dayName,
      d.type,
      d.subType,
    ]),
  ]);
  detay['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, ozet, 'Özet');
  XLSX.utils.book_append_sheet(book, detay, 'Devamsızlık Detayı');

  const stamp = formatDateISO(range.start).replace(/-/g, '');
  XLSX.writeFile(book, `Haftalik_Rapor_${stamp}.xlsx`);
};
