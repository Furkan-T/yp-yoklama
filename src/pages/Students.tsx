import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import type { Student, ShowToastFn } from '../types';
import { validateTCNo, validateAndFormatPhone, sanitizeInput, getWhatsAppURL } from '../utils/validation';
import { useConfirm } from '../hooks/useConfirm';
import StudentFormModal from '../components/StudentFormModal';

interface StudentsProps {
  students: Student[];
  loading: boolean;
  showToast: ShowToastFn;
}

const Students: React.FC<StudentsProps> = ({ students, loading, showToast }) => {
  const [draft, setDraft] = useState<Partial<Student> | null>(null);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr');
    if (!term) return students;
    return students.filter(student =>
      student.name.toLocaleLowerCase('tr').includes(term) ||
      student.school?.toLocaleLowerCase('tr').includes(term) ||
      student.parentName?.toLocaleLowerCase('tr').includes(term)
    );
  }, [students, searchTerm]);

  const closeModal = () => { setDraft(null); setErrors({}); };

  const openAdd = () => { setMode('add'); setDraft({ isActive: true }); setErrors({}); };
  const openEdit = (student: Student) => { setMode('edit'); setDraft({ ...student }); setErrors({}); };

  const openWhatsApp = (phone: string | undefined) => {
    if (!phone) { showToast("Telefon numarası kayıtlı değil.", "error"); return; }
    const url = getWhatsAppURL(phone);
    if (!url) { showToast("Geçersiz telefon numarası.", "error"); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const validate = (student: Partial<Student>): boolean => {
    const found: Record<string, string> = {};

    if (!student.name?.trim()) found.name = "İsim gereklidir";
    if (student.tcNo && !validateTCNo(student.tcNo)) found.tcNo = "Geçersiz TC Kimlik No";
    if (student.parentPhone && !validateAndFormatPhone(student.parentPhone)) {
      found.parentPhone = "Geçersiz numara (5XX XXX XX XX)";
    }

    const tcNo = student.tcNo?.replace(/\s/g, '');
    if (tcNo && students.some(s => s.tcNo?.replace(/\s/g, '') === tcNo && s.id !== student.id)) {
      found.tcNo = "Bu TC No başka bir talebede kayıtlı";
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  /** Firestore'a yazılacak temiz alanlar. */
  const toDocument = (student: Partial<Student>) => ({
    name: sanitizeInput(student.name || ''),
    school: sanitizeInput(student.school || ''),
    grade: sanitizeInput(student.grade || ''),
    schoolNumber: sanitizeInput(student.schoolNumber || ''),
    tcNo: student.tcNo?.replace(/\s/g, '') || '',
    parentName: sanitizeInput(student.parentName || ''),
    parentPhone: validateAndFormatPhone(student.parentPhone || '') || '',
    isActive: student.isActive !== false,
    etut: student.etut || '',
  });

  const handleSubmit = async () => {
    if (!draft || !validate(draft)) return;

    setIsSubmitting(true);
    try {
      if (mode === 'edit' && draft.id) {
        await updateDoc(doc(db, "students", draft.id), toDocument(draft));
        showToast("Bilgiler güncellendi!", "success");
      } else {
        await addDoc(collection(db, "students"), { ...toDocument(draft), createdAt: serverTimestamp() });
        showToast("Talebe başarıyla eklendi!", "success");
      }
      closeModal();
    } catch (error) {
      console.error(error);
      showToast(mode === 'edit' ? "Güncelleme başarısız." : "Ekleme başarısız.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const restoreStudent = async (id: string) => {
    try {
      await updateDoc(doc(db, "students", id), { isDeleted: false, deletedAt: null });
      showToast("Talebe geri alındı.", "success");
    } catch (error) {
      console.error(error);
      showToast("Geri alma başarısız.", "error");
    }
  };

  const handleDelete = async (student: Student) => {
    const ok = await confirm({ message: `${student.name} kaydını silmek istediğinize emin misiniz?`, confirmLabel: 'Sil' });
    if (!ok) return;
    try {
      await updateDoc(doc(db, "students", student.id), { isDeleted: true, deletedAt: serverTimestamp() });
      showToast("Talebe silindi.", "success", { label: "Geri Al", onClick: () => restoreStudent(student.id) });
    } catch (error) {
      console.error(error);
      showToast("Silme işlemi başarısız.", "error");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in w-full px-4 pt-6">
      <div className="flex gap-2">
        <div className="flex-1 bg-dark-900/60 p-3 rounded-2xl border border-primary-900/30 flex items-center gap-2">
          <i className="fa-solid fa-magnifying-glass text-dark-400"></i>
          <input
            type="text"
            placeholder="İsim, okul veya veli adı ara..."
            aria-label="Talebe ara"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent w-full text-white outline-none placeholder-dark-500 font-bold"
          />
        </div>
        <button
          onClick={openAdd}
          aria-label="Yeni talebe ekle"
          className="w-14 h-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-900/40 active:scale-95 transition-all"
        >
          <i className="fa-solid fa-plus text-xl"></i>
        </button>
      </div>

      <div className="space-y-3 w-full pb-40">
        {loading && <p className="text-center text-dark-400 py-4">Yükleniyor...</p>}
        {!loading && filteredStudents.length === 0 && <p className="text-center text-dark-400 py-4">Talebe bulunamadı.</p>}

        {filteredStudents.map((student, index) => (
          <div key={student.id} className="bg-dark-900/60 p-4 rounded-2xl border border-dark-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold border shadow-inner flex-shrink-0 ${student.isActive === false ? 'bg-dark-900 border-dark-800 text-dark-500' : 'bg-dark-800 border-dark-700 text-primary-300'}`}>
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className={`truncate ${student.isActive === false ? 'line-through text-dark-400' : ''}`}>{student.name}</span>
                  {student.isActive === false && (
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest font-extrabold flex-shrink-0">Pasif</span>
                  )}
                </div>
                <div className="text-xs text-dark-400 flex items-center gap-2">
                  <span className="truncate">{student.school || '—'}</span>
                  {student.etut && <span className="text-accent-500 font-bold flex-shrink-0">{student.etut}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => openWhatsApp(student.parentPhone)} aria-label={`${student.name} velisine WhatsApp'tan yaz`} className="w-9 h-9 flex items-center justify-center rounded-xl text-green-500 bg-green-500/10 hover:bg-green-500 hover:text-white transition-all border border-green-500/10"><i className="fa-brands fa-whatsapp text-lg"></i></button>
              <button onClick={() => openEdit(student)} aria-label={`${student.name} bilgilerini düzenle`} className="w-9 h-9 flex items-center justify-center rounded-xl text-accent-400 bg-accent-500/10 hover:bg-accent-500 hover:text-dark-950 transition-all border border-accent-500/10"><i className="fa-solid fa-pen"></i></button>
              <button onClick={() => handleDelete(student)} aria-label={`${student.name} kaydını sil`} className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/10"><i className="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <StudentFormModal
          mode={mode}
          value={draft}
          errors={errors}
          isSubmitting={isSubmitting}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      )}

      {ConfirmDialog}
      <div className="h-32 w-full"></div>
    </div>
  );
};

export default Students;
