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

/**
 * Türkçe harfleri ASCII karşılığına indirger.
 *
 * Önce Türkçe kurallarıyla küçük harfe çevrilir: "I" -> "ı", "İ" -> "i".
 * Ardından NFD ile ayrıştırılıp birleşik aksan işaretleri atılır; bazı
 * programlar "ü" harfini tek karakter yerine "u + ¨" olarak yazdığından
 * bu adım olmadan o yazımlar tanınmaz.
 * Son olarak ayrıştırması olmayan Türkçe harfler tek tek eşlenir ("ı" gibi).
 */
const deaccent = (value: string): string =>
  String(value)
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');

/** Başlıkları harf ve rakam dışındaki her şeyden arındırır. */
const normalizeHeader = (header: string): string =>
  deaccent(header).replace(/[^a-z0-9]/g, '');

/**
 * Hücre değerlerini karşılaştırmak için sadeleştirir: + ve - işaretlerini
 * korur — "0 Rh+" ile "0 Rh-" aksi halde aynı değere düşer ve kan grubu
 * yanlış eşleşirdi.
 */
const normalizeValue = (value: string): string =>
  deaccent(value).replace(/[^a-z0-9+-]/g, '');

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

/** Uzun takma adlar önce denensin ki "Veli Adı" yanlışlıkla "Ad"a düşmesin. */
const HEADER_KEYS_BY_LENGTH = Object.keys(HEADER_ALIASES).sort((a, b) => b.length - a.length);

/**
 * Başlıktaki yıl gibi ekleri ("2026 Grup") ve sondaki sıra numarasını
 * ("Grup Mesulü 1") yok sayarak sütunu tanır.
 * @param header - ham sütun başlığı
 * @returns eşleşen alan, tanınmadıysa null
 */
const resolveHeader = (header: string): Target | null => {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];

  // Rakamları at: "2026 Grup" -> "grup", "Grup Mesulü 1" -> "grupmesulu"
  const withoutDigits = normalized.replace(/\d+/g, '');
  if (HEADER_ALIASES[withoutDigits]) return HEADER_ALIASES[withoutDigits];

  // Son çare: başlığın içinde geçen en uzun takma adı kullan
  const contained = HEADER_KEYS_BY_LENGTH.find(key => key.length >= 3 && withoutDigits.includes(key));
  return contained ? HEADER_ALIASES[contained] : null;
};

/**
 * Grupların elle yazılırken sık kullanılan kısaltmaları. Grubun kendi adı
 * ayrıca eklenir, bu yüzden burada yalnızca kısaltmalar listelenir.
 */
const GROUP_ABBREVIATIONS: Record<string, string[]> = {
  'Hazırlık': ['hazirlk', 'hzrlk', 'hzrl', 'hazir', 'haz'],
  'İbtidai': ['ibtida', 'ibtdi', 'ibtd', 'ibt'],
  // "İhzari" yazımı da sahada kullanılıyor; aynı gruba eşlenir.
  'İzhari': ['izhar', 'izhri', 'izhr', 'izh', 'ihzari', 'ihzar', 'ihzri', 'ihzr', 'ihz'],
  'Tekamülaltı': ['tekamul', 'tkmlalti', 'tkmlalt', 'tkml', 'tka'],
  'Kur\'an-ı Kerim': ['kurankerim', 'kkerim', 'kkerm', 'kkrm', 'kuran', 'kkk', 'kk'],
};

/**
 * Kanonik grup adı -> kabul edilen yazımlar. Liste DERS_GROUPS'tan türetilir,
 * böylece yeni bir grup eklendiğinde en azından kendi adıyla eşleşir.
 */
const GROUP_ALIASES: Record<string, string[]> = Object.fromEntries(
  DERS_GROUPS.map(group => [
    group,
    [normalizeHeader(group), ...(GROUP_ABBREVIATIONS[group] ?? [])],
  ])
);

/**
 * Grup hücresinde anlam taşımayan kelimeler. "2026 Grup Hazırlık" gibi
 * yazımlarda bunlar atıldıktan sonra geriye grup adı kalır.
 */
const GROUP_STOP_WORDS = new Set([
  'grup', 'grubu', 'gurup', 'grb', 'grp',
  'sinif', 'sinifi', 'sube', 'subesi',
  'dahili', 'ders', 'dersi', 'dersleri',
  'yil', 'yili', 'donem', 'donemi', 'egitim', 'ogretim', 'sene', 'senesi',
]);

/**
 * Grup değerini kanonik ada oturtur. Yıl ve "grup" gibi ekler atılır,
 * ardından kısaltmalara bakılır: "2026 K.Kerim" -> "Kur'an-ı Kerim".
 * @param value - hücredeki ham değer
 * @returns eşleşen grup adı, tanınmadıysa değerin kendisi
 */
const matchGroup = (value: string): string => {
  const raw = deaccent(value);
  if (!raw.trim()) return '';

  // Anlamlı parçaları ayıkla: rakamlar ve genel kelimeler düşer
  const core = raw
    .split(/[^a-z0-9]+/)
    .filter(token => token && !/^\d+$/.test(token) && !GROUP_STOP_WORDS.has(token))
    .join('');

  if (!core) return value.trim();

  for (const [canonical, aliases] of Object.entries(GROUP_ALIASES)) {
    if (aliases.includes(core)) return canonical;
  }

  // Yine de eşleşmezse, içinde geçen en uzun kısaltmayı ara
  let best: { canonical: string; length: number } | null = null;
  for (const [canonical, aliases] of Object.entries(GROUP_ALIASES)) {
    for (const a of aliases) {
      if (a.length >= 3 && core.includes(a) && (!best || a.length > best.length)) {
        best = { canonical, length: a.length };
      }
    }
  }

  return best ? best.canonical : value.trim();
};

/**
 * Serbest yazılmış bir değeri geçerli seçeneklerden birine oturtur.
 * "0rh-" -> "0 Rh-" gibi.
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
        student.group = matchGroup(value);
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

  // İki örnek satır: biri yurt içi, biri yurt dışı numara biçimi için
  const examples = [
    [
      'Ahmet', 'Yılmaz', DERS_GROUPS[0], 'Mehmet Hoca', '',
      '0532 111 22 33', 'Mustafa Yılmaz', '0533 444 55 66',
      'İlahiyat Fakültesi', 'İlahiyat', BLOOD_TYPES[0], '1', 'Türkiye',
    ],
    [
      'Bilol', 'Rahimov', DERS_GROUPS[1], 'Ali Hoca', '',
      '+998 90 123 45 67', 'Aziz Rahimov', '+998 91 234 56 78',
      'İlahiyat Fakültesi', 'İlahiyat', BLOOD_TYPES[2], '2', 'Özbekistan',
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, ...examples]);
  sheet['!cols'] = IMPORT_COLUMNS.map(header => ({ wch: Math.max(header.length + 4, 14) }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Talebeler');

  // İkinci sayfa: seçenekli alanlarda hangi değerlerin kabul edildiği
  const reference = XLSX.utils.aoa_to_sheet([
    ['DAHİLİ DERS GRUPLARI', 'Kabul edilen kısaltmalar'],
    ...DERS_GROUPS.map(group => [group, (GROUP_ABBREVIATIONS[group] ?? []).join(', ')]),
    [],
    ['KAN GRUPLARI'],
    ...BLOOD_TYPES.map(type => [type]),
    [],
    ['NOT'],
    ['Grup hücresinde yıl veya "grup" gibi ekler kullanılabilir: "2026 Grup Hazırlık" kabul edilir.'],
    ['Yurt dışı telefon numaralarını ülke koduyla ve + ile yazın: +998 90 123 45 67'],
  ]);
  reference['!cols'] = [{ wch: 24 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(book, reference, 'Değerler');

  XLSX.writeFile(book, 'Talebe_Sablonu.xlsx');
};

/** Önizleme başlığı için kısa özet. */
export const summarize = (rows: ImportRow[]) => {
  const valid = rows.filter(r => Object.keys(r.errors).length === 0);
  return { total: rows.length, valid: valid.length, invalid: rows.length - valid.length, validRows: valid };
};

export { fullName };
