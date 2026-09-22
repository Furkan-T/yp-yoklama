import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

// Firebase web yapılandırması ortam değişkenlerinden okunur (.env.local).
// Bu anahtarlar gizli değildir — projeyi tanımlarlar, kimlik doğrulamazlar;
// erişim denetimi tamamen firestore.rules üzerinden yapılır.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Firebase yapılandırması eksik: ${missing.join(', ')}. ` +
    `.env.example dosyasını .env.local olarak kopyalayıp değerleri doldurun.`
  );
}

const app = initializeApp(firebaseConfig);

// Çevrimdışı önbellek: PWA olarak yüklendiğinde internet kesilse bile
// son senkronize veriler görüntülenebilir/düzenlenebilir, bağlantı dönünce eşitlenir.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
});
