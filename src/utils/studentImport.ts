import type { Student } from '../types';
import { DERS_GROUPS, BLOOD_TYPES, MAX_SUPERVISORS } from '../constants';
import { IMPORT_COLUMNS, validateStudent, fullName } from './student';

export interface ImportRow {
  /** Excel'deki satır numarası — hata mesajlarında kullanıcıya gösterilir. */
  rowNumber: number;
  student: Partial<Student>;
  errors: Record<string, string>;
}

export interface ImportResult {
  rows: ImportRow[];
  /** Dosyada tanınamayan sütun başlıkları. */
  unknownColumns: string[];
}

type Target = keyof Student | 'supervisor';

/** Başlıkları harf dışındaki her şeyden arındırıp küçük harfe çevirir. */
const normalizeHeader = (header: string): string =>
  String(header).toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

/**
 * Sütun başlığı eşlemeleri. Kullanıcılar başlıkları birebir yazmak zorunda
 * kalmasın diye yaygın yazımlar da kabul edilir.
 */
const HEADER_ALIASES: Record<string, Target> = {};
const alias = (target: Target, ...headers: string[]) => {
  headers.forEach(h => { HEADER_ALIASES[normalizeHeader(h)] = target; });
};

alias('firstName', 'Adı', 'Ad', 'Adi', 'İsim', 'Isim');
alias('lastName', 'Soyadı', 'Soyad', 'Soyadi');
alias('group', 'Dahili Ders Grubu', 'Ders Grubu', 'Grubu', 'Grup');
alias('supervisor', 'Grup Mesulü', 'Grup Mesulu', 'Mesul');
alias('phone', 'Talebe Cep No', 'Talebe Telefon', 'Cep No', 'Telefon');
alias('parentName', 'Veli Adı', 'Veli Adi', 'Veli');
alias('parentPhone', 'Veli Cep No', 'Veli Telefon', 'Veli Tel');
alias('faculty', 'Fakülte', 'Fakulte');
alias('department', 'Bölüm', 'Bolum', 'Bölümü', 'Bolumu');
alias('bloodType', 'Kan Grubu', 'Kan');
alias('grade', 'Sınıf', 'Sinif', 'Sınıfı');
alias('country', 'Ülke', 'Ulke');

/** "Grup Mesulü 1" gibi numaralı başlıkları da tanır. */
const resolveHeader = (header: string): Target | null => {
  const normalized = normalizeHeader(header);
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];
  const withoutIndex = normalized.replace(/\d+$/, '');
  return HEADER_ALIASES[withoutIndex] ?? null;
};

/**
 * Hücre değerlerini karşılaştırmak için sadeleştirir: Türkçe harfleri ASCII
 * karşılığına indirger ama + ve - işaretlerini korur — "0 Rh+" ile "0 Rh-"
 * aksi halde aynı değere düşer ve kan grubu yanlış eşleşirdi.
 */
const normalizeValue = (value: string): string =>
  String(value).toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9+-]/g, '');

/**
 * Serbest yazılmış bir değeri geçerli seçeneklerden birine oturtur.
 * "izhari" -> "İzhari", "0rh-" -> "0 Rh-" gibi.
 */
const matchOption = (value: string, options: string[]): string => {
  const normalized = normalizeValue(value);
  if (!normalized) return '';
  return options.find(o => normalizeValue(o) === normalized) ?? value.trim();
};

/**
 * Excel/CSV dosyasını okuyup doğrulanmış talebe satırlarına çevirir.
 * SheetJS yalnızca bu işlem sırasında yüklenir (dinamik import).
 * @param file - kullanıcının seçtiği .xlsx/.xls/.csv dosyası
 * @param existing - mükerrer kontrolü için mevcut talebeler
 */
export const parseStudentFile = async (
  file: File,
  existing: Student[]
): Promise<ImportResult> => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Dosyada sayfa bulunamadı.');

  const grid = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,   // sayıları da metin olarak al (telefonlar bozulmasın)
    defval: '',
    blankrows: false,
  });

  const headerIndex = grid.findIndex(row => row.some(cell => resolveHeader(cell || '')));
  if (headerIndex === -1) {
    throw new Error('Başlık satırı bulunamadı. Şablonu indirip sütun adlarını koruyun.');
  }

  const headers = grid[headerIndex].map(h => String(h || '').trim());
  const unknownColumns = headers.filter(h => h && !resolveHeader(h));

  // Aynı dosya içindeki mükerrerleri de yakalamak için biriktirilir
  const seen: Partial<Student>[] = existing.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, name: s.name }));
  const rows: ImportRow[] = [];

  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const student: Partial<Student> = { supervisors: [] };
    let hasValue = false;

    headers.forEach((header, column) => {
      const target = resolveHeader(header);
      if (!target) return;

      const value = String(cells[column] ?? '').trim();
      if (!value) return;
      hasValue = true;

      if (target === 'supervisor') {
        if ((student.supervisors?.length ?? 0) < MAX_SUPERVISORS) {
          student.supervisors = [...(student.supervisors || []), value];
        }
      } else if (target === 'group') {
        student.group = matchOption(value, DERS_GROUPS);
      } else if (target === 'bloodType') {
        student.bloodType = matchOption(value, BLOOD_TYPES);
      } else {
        (student as Record<string, unknown>)[target] = value;
      }
    });

    if (!hasValue) return; // tamamen boş satırları atla

    const errors = validateStudent(student, seen);
    if (Object.keys(errors).length === 0) {
      seen.push({ id: `satır-${offset}`, firstName: student.firstName, lastName: student.lastName });
    }

    rows.push({
      rowNumber: headerIndex + offset + 2, // Excel satırları 1'den başlar
      student,
      errors,
    });
  });

  return { rows, unknownColumns };
};

/** Doğru sütun başlıklarını ve bir örnek satırı içeren şablonu indirir. */
export const downloadTemplate = async (): Promise<void> => {
  const XLSX = await import('xlsx');

  const example = [
    'Ahmet', 'Yılmaz', DERS_GROUPS[0], 'Mehmet Hoca', '',
    '532 111 22 33', 'Mustafa Yılmaz', '533 444 55 66',
    'İlahiyat Fakültesi', 'İlahiyat', BLOOD_TYPES[0], '1', 'Türkiye',
  ];

  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, example]);
  sheet['!cols'] = IMPORT_COLUMNS.map(header => ({ wch: Math.max(header.length + 4, 14) }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Talebeler');
  XLSX.writeFile(book, 'Talebe_Sablonu.xlsx');
};

/** Önizleme başlığı için kısa özet. */
export const summarize = (rows: ImportRow[]) => {
  const valid = rows.filter(r => Object.keys(r.errors).length === 0);
  return { total: rows.length, valid: valid.length, invalid: rows.length - valid.length, validRows: valid };
};

export { fullName };
