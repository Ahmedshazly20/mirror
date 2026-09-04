import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: "AIzaSyAwuwPv-j_e_kE51M9JEvPZCpQJeN8KqGA",
  authDomain: "mirror-coworking.firebaseapp.com",
  projectId: "mirror-coworking",
  storageBucket: "mirror-coworking.firebasestorage.app",
  messagingSenderId: "218783771697",
  appId: "1:218783771697:web:a29944f5bad453af9bb910"
};

const app = initializeApp(firebaseConfig);

// ── Offline Persistence (Firestore v9.20+) ────────────────────────────────────
// persistentLocalCache يخزن كل الداتا في IndexedDB
// لما التطبيق يفتح تاني يقرأ من الـ cache مباشرة → zero reads
// persistentMultipleTabManager يدعم أكتر من نافذة (مهم في Electron)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});

// isSupported()
//   .then((yes) => { if (yes) getAnalytics(app); })
//   .catch((err) => console.error('Analytics not supported:', err));

export const auth = getAuth(app);
export default app;