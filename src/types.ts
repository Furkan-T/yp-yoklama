import type { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  school?: string;
  grade?: string;
  schoolNumber?: string;
  tcNo?: string;
  parentName?: string;
  parentPhone?: string;
  createdAt?: Timestamp;
  isActive?: boolean;
  etut?: string; // ETUT_SESSIONS içindeki bir değer; boşsa tüm etütlerde görünür
  isDeleted?: boolean;
  deletedAt?: Timestamp | null;
}

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
