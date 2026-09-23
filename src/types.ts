import type { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  /** Ad ve soyad ayrı tutulur; `name` bu ikisinden türetilir. */
  firstName?: string;
  lastName?: string;
  /**
   * "Ad Soyad". Firestore sorgusu buna göre sıralandığı ve yoklama kayıtları
   * talebe adını kopyalayarak sakladığı için ayrıca yazılır.
   */
  name: string;
  /** Dahili ders grubu — DERS_GROUPS içindeki bir değer. */
  group?: string;
  /** Grup mesulleri; en fazla iki kişi. */
  supervisors?: string[];
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  faculty?: string;
  department?: string;
  bloodType?: string;
  grade?: string;
  country?: string;
  createdAt?: Timestamp;
  isActive?: boolean;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
}

/**
 * Yoklama türü. 'ETUT' anahtarı arayüzde "DAHİLİ DERS" olarak gösterilir;
 * daha önce kaydedilmiş yoklamalar bu değerle yazıldığı için anahtarın
 * kendisi değiştirilmez (bkz. TYPE_LABELS).
 */
export type AttendanceType = 'ETUT' | 'NAMAZ';

export type AttendanceStatus = 'VAR' | 'GEC' | 'YOK' | 'IZINLI';

export type TabKey = 'dashboard' | 'attendance' | 'students' | 'records' | 'settings';

export type ShowToastFn = (
  msg: string,
  type: 'success' | 'error',
  action?: { label: string; onClick: () => void }
) => void;

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  type: AttendanceType;
  subType: string;
  status: AttendanceStatus;
  date: Timestamp;
  // Kaydın en son ne zaman yazıldığı. `date` gün başına sabitlendiği için
  // aynı gün içindeki seansları sıralamak ancak bu alanla mümkün.
  updatedAt?: Timestamp | null;
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
}
