import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import type { Student, ShowToastFn } from '../types';
import { getWhatsAppURL } from '../utils/validation';
import { toStudentDocument, validateStudent, fullName } from '../utils/student';
import { useConfirm } from '../hooks/useConfirm';
import StudentFormModal from '../components/StudentFormModal';
import StudentImportModal from '../components/StudentImportModal';

interface StudentsProps {
  students: Student[];
  loading: boolean;
  showToast: ShowToastFn;
}

const Students: React.FC<StudentsProps> = ({ students, loading, showToast }) => {
  const [draft, setDraft] = useState<Partial<Student> | null>(null);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [showImport, setShowImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr');
    if (!term) return students;
    return students.filter(student =>
      [student.name, student.group, student.faculty, student.department, student.parentName, student.country]
        .some(field => field?.toLocaleLowerCase('tr').includes(term))
    );
  }, [students, searchTerm]);

  const closeModal = () => { setDraft(null); setErrors({}); };

  const openAdd = () => { setMode('add'); setDraft({ isActive: true, supervisors: [] }); setErrors({}); };
  const openEdit = (student: Student) => { setMode('edit'); setDraft({ ...student }); setErrors({}); };

  const openWhatsApp = (phone: string | undefined, who: string) => {
    if (!phone) { showToast(`${who} telefon numarası kayıtlı değil.`, "error"); return; }
    const url = getWhatsAppURL(phone);
    if (!url) { showToast("Geçersiz telefon numarası.", "error"); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async () => {
    if (!draft) return;
    const found = validateStudent(draft, students);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSubmitting(true);
    try {
      if (mode === 'edit' && draft.id) {
        await updateDoc(doc(db, "students", draft.id), toStudentDocument(draft));
        showToast("Bilgiler güncellendi!", "success");
      } else {
        await addDoc(collection(db, "students"), { ...toStudentDocument(draft), createdAt: serverTimestamp() });
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
        <div className="flex-1 bg-dark-900/60 p-3 rounded-2xl border border-primary-900/30 flex items-center gap-2 min-w-0">
          <i className="fa-solid fa-magnifying-glass text-dark-400"></i>
          <input
            type="text"
            placeholder="İsim, grup, fakülte ara..."
            aria-label="Talebe ara"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent w-full text-white outline-none placeholder-dark-500 font-bold min-w-0"
          />
        </div>
        <button
          onClick={() => setShowImport(true)}
          aria-label="Excel'den toplu talebe ekle"
          className="w-14 h-14 rounded-2xl bg-dark-800 border border-primary-900/40 text-primary-300 flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
        >
          <i className="fa-solid fa-file-excel text-lg"></i>
        </button>
        <button
          onClick={openAdd}
          aria-label="Yeni talebe ekle"
          className="w-14 h-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-900/40 active:scale-95 transition-all flex-shrink-0"
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
                  <span className={`truncate ${student.isActive === false ? 'line-through text-dark-400' : ''}`}>
                    {student.name || fullName(student)}
                  </span>
                  {student.isActive === false && (
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest font-extrabold flex-shrink-0">Pasif</span>
                  )}
                </div>
                <div className="text-xs text-dark-400 flex items-center gap-2">
                  <span className="truncate">{student.faculty || student.department || '—'}</span>
                  {student.group && <span className="text-accent-500 font-bold flex-shrink-0">{student.group}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => openWhatsApp(student.parentPhone, `${student.name} velisinin`)} aria-label={`${student.name} velisine WhatsApp'tan yaz`} className="w-9 h-9 flex items-center justify-center rounded-xl text-green-500 bg-green-500/10 hover:bg-green-500 hover:text-white transition-all border border-green-500/10"><i className="fa-brands fa-whatsapp text-lg"></i></button>
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

      {showImport && (
        <StudentImportModal
          students={students}
          showToast={showToast}
          onClose={() => setShowImport(false)}
        />
      )}

      {ConfirmDialog}
      <div className="h-32 w-full"></div>
    </div>
  );
};

export default Students;
