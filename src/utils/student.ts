import type { Student } from '../types';
import { DERS_GROUPS, BLOOD_TYPES, MAX_SUPERVISORS } from '../constants';
import { sanitizeInput, validateAndFormatPhone } from './validation';

export type StudentFieldKind = 'text' | 'tel' | 'select';

export interface StudentFieldDef {
  key: keyof Student;
  /** Hem form etiketi hem de Excel sütun başlığı olarak kullanılır. */
  label: string;
  kind: StudentFieldKind;
  required?: boolean;
  options?: string[];
  /** Formda iki alanı yan yana dizmek için. */
  half?: boolean;
}

/**
 * Talebe kaydının alanları. Form ve Excel içe aktarma aynı listeden beslenir,
 * böylece bir alan eklendiğinde iki yer birbirinden ayrı düşmez.
 */
export const STUDENT_FIELDS: StudentFieldDef[] = [
  { key: 'firstName', label: 'Adı', kind: 'text', required: true, half: true },
  { key: 'lastName', label: 'Soyadı', kind: 'text', required: true, half: true },
  { key: 'group', label: 'Dahili Ders Grubu', kind: 'select', options: DERS_GROUPS },
  { key: 'phone', label: 'Talebe Cep No', kind: 'tel', half: true },
  { key: 'parentName', label: 'Veli Adı', kind: 'text', half: true },
  { key: 'parentPhone', label: 'Veli Cep No', kind: 'tel', half: true },
  { key: 'faculty', label: 'Fakülte', kind: 'text', half: true },
  { key: 'department', label: 'Bölüm', kind: 'text', half: true },
  { key: 'grade', label: 'Sınıf', kind: 'text', half: true },
  { key: 'bloodType', label: 'Kan Grubu', kind: 'select', options: BLOOD_TYPES, half: true },
  { key: 'country', label: 'Ülke', kind: 'text', half: true },
];

/** Grup mesulü sütunları: "Grup Mesulü 1", "Grup Mesulü 2". */
export const SUPERVISOR_LABELS = Array.from(
  { length: MAX_SUPERVISORS },
  (_, i) => `Grup Mesulü ${i + 1}`
);

/** Excel şablonunun sütun başlıkları — alan sırasıyla aynı. */
export const IMPORT_COLUMNS = [
  'Adı',
  'Soyadı',
  'Dahili Ders Grubu',
  ...SUPERVISOR_LABELS,
  'Talebe Cep No',
  'Veli Adı',
  'Veli Cep No',
  'Fakülte',
  'Bölüm',
  'Kan Grubu',
  'Sınıf',
  'Ülke',
];

export const fullName = (student: Partial<Student>): string =>
  [student.firstName, student.lastName].map(p => p?.trim()).filter(Boolean).join(' ');

/** Boş mesul satırlarını atar, en fazla MAX_SUPERVISORS tane bırakır. */
export const cleanSupervisors = (supervisors: (string | undefined)[] | undefined): string[] =>
  (supervisors || [])
    .map(s => sanitizeInput(s || ''))
    .filter(Boolean)
    .slice(0, MAX_SUPERVISORS);

/**
 * Formdan veya Excel satırından gelen veriyi Firestore'a yazılacak biçime getirir.
 * Telefonlar "5XX XXX XX XX" olarak normalize edilir; geçersizse boş bırakılır.
 */
export const toStudentDocument = (student: Partial<Student>) => ({
  firstName: sanitizeInput(student.firstName || ''),
  lastName: sanitizeInput(student.lastName || ''),
  name: sanitizeInput(fullName(student)),
  group: student.group || '',
  supervisors: cleanSupervisors(student.supervisors),
  phone: validateAndFormatPhone(student.phone || '') || '',
  parentName: sanitizeInput(student.parentName || ''),
  parentPhone: validateAndFormatPhone(student.parentPhone || '') || '',
  faculty: sanitizeInput(student.faculty || ''),
  department: sanitizeInput(student.department || ''),
  bloodType: student.bloodType || '',
  grade: sanitizeInput(student.grade || ''),
  country: sanitizeInput(student.country || ''),
  isActive: student.isActive !== false,
});

/**
 * Bir talebe kaydını doğrular.
 * @param student - doğrulanacak kayıt
 * @param others - mükerrer kontrolü için karşılaştırılacak diğer kayıtlar
 * @returns alan adı -> hata mesajı eşlemesi (boşsa kayıt geçerli)
 */
export const validateStudent = (
  student: Partial<Student>,
  others: Partial<Student>[] = []
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!student.firstName?.trim()) errors.firstName = "Ad gereklidir";
  if (!student.lastName?.trim()) errors.lastName = "Soyad gereklidir";

  (['phone', 'parentPhone'] as const).forEach(key => {
    const value = student[key];
    if (value && !validateAndFormatPhone(value)) {
      errors[key] = "Geçersiz numara (5XX XXX XX XX)";
    }
  });

  if (student.group && !DERS_GROUPS.includes(student.group)) {
    errors.group = `Geçersiz grup (${DERS_GROUPS.join(', ')})`;
  }

  if (student.bloodType && !BLOOD_TYPES.includes(student.bloodType)) {
    errors.bloodType = `Geçersiz kan grubu (${BLOOD_TYPES.join(', ')})`;
  }

  // Aynı ad-soyad ikinci kez girilmesin. Yeni kayıtta (id henüz yok) listedeki
  // her kayıt karşılaştırmaya girer; düzenlemede yalnızca kaydın kendisi atlanır.
  const name = fullName(student).toLocaleLowerCase('tr');
  const isOther = (o: Partial<Student>) => !student.id || o.id !== student.id;
  if (name && others.some(o => isOther(o) && fullName(o).toLocaleLowerCase('tr') === name)) {
    errors.lastName = "Bu ad ve soyadla kayıtlı bir talebe zaten var";
  }

  return errors;
};
