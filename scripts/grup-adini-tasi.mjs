/**
 * Tek seferlik taşıma: "İzhari" olarak kaydedilmiş dahili ders grubunu
 * "İhzari" olarak günceller.
 *
 * Grup adı hem talebe kaydında (students.group) hem de yoklama kayıtlarında
 * (attendance.subType) saklandığı için ikisi birden güncellenir; aksi halde
 * eski yoklamalar Geçmiş ekranındaki vakit filtresinde görünmez.
 *
 * Kullanım (proje kökünden):
 *   node scripts/grup-adini-tasi.mjs           # yalnızca rapor verir, yazmaz
 *   node scripts/grup-adini-tasi.mjs --apply   # değişiklikleri uygular
 *
 * Yönetici e-posta ve şifresi sorulur; bunlar hiçbir yere kaydedilmez.
 */
import { readFileSync } from 'node:fs';
import readline from 'node:readline';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

const ESKI = 'İzhari';
const YENI = 'İhzari';
const BATCH_LIMIT = 450;
const apply = process.argv.includes('--apply');

/** .env.local dosyasını okur (Node kendiliğinden yüklemez). */
const readEnv = () => {
  const env = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
};

const ask = (question, hidden = false) => new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Şifre yazılırken ekrana basılmasın
    rl._writeToOutput = function (text) {
      if (text.includes(question)) rl.output.write(text);
    };
  }
  rl.question(question, answer => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
});

/** Bir koleksiyondaki eşleşen belgeleri bulur ve istenirse günceller. */
const migrate = async (db, collectionName, field) => {
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', ESKI)));
  const docs = snapshot.docs.filter(d => !d.data().isDeleted);
  const skipped = snapshot.size - docs.length;

  console.log(`  ${collectionName}.${field}: ${docs.length} kayıt${skipped ? ` (+${skipped} silinmiş, atlandı)` : ''}`);
  docs.slice(0, 5).forEach(d => console.log(`    - ${d.data().name || d.data().studentName || d.id}`));
  if (docs.length > 5) console.log(`    ... ve ${docs.length - 5} tane daha`);

  if (!apply || docs.length === 0) return docs.length;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.update(doc(db, collectionName, d.id), { [field]: YENI }));
    await batch.commit();
  }
  return docs.length;
};

const main = async () => {
  const env = readEnv();
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });

  console.log(`Proje: ${env.VITE_FIREBASE_PROJECT_ID}`);
  console.log(apply ? 'Mod: UYGULA (veri yazılacak)\n' : 'Mod: RAPOR (hiçbir şey yazılmaz)\n');

  const email = await ask('Yönetici e-posta: ');
  const password = await ask('Şifre: ', true);
  await signInWithEmailAndPassword(getAuth(app), email, password);

  const db = getFirestore(app);
  console.log(`\n"${ESKI}" -> "${YENI}"`);
  const students = await migrate(db, 'students', 'group');
  const records = await migrate(db, 'attendance', 'subType');

  const total = students + records;
  console.log();
  if (total === 0) console.log('Güncellenecek kayıt yok.');
  else if (apply) console.log(`${total} kayıt güncellendi.`);
  else console.log(`${total} kayıt güncellenecek. Uygulamak için: node scripts/grup-adini-tasi.mjs --apply`);

  process.exit(0);
};

main().catch(error => {
  console.error('\nHata:', error.code === 'auth/invalid-credential' ? 'E-posta veya şifre hatalı.' : error.message);
  process.exit(1);
});
