import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Visit } from '../types';
import { cleanData } from '../lib/utils';

export const visitService = {
  async recordVisit(visitData: Omit<Visit, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      if (!visitData.customerId) return null;

      // Prevent exact duplicate visit for same referenceId
      if (visitData.referenceId) {
        const q = query(
          collection(db, 'visits'), 
          where('referenceId', '==', visitData.referenceId)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          return existing.docs[0].id;
        }
      }

      const data = cleanData({
        ...visitData,
        date: visitData.date || Date.now(),
        createdAt: Date.now()
      });

      const docRef = await addDoc(collection(db, 'visits'), data);

      // Update customer stats (totalVisits, lastVisit)
      try {
        const customerRef = doc(db, 'customers', visitData.customerId);
        const snap = await getDoc(customerRef);
        if (snap.exists()) {
          const customerData = snap.data() as { totalVisits?: number } | undefined;
          const currentVisits = customerData?.totalVisits || 0;
          await updateDoc(customerRef, {
            totalVisits: currentVisits + 1,
            lastVisit: visitData.date || Date.now()
          });
        }
      } catch (err) {
        console.warn('Could not update customer visit stats:', err);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error recording visit:', error);
      return null;
    }
  },

  subscribeToVisits(callback: (visits: Visit[]) => void) {
    const q = query(collection(db, 'visits'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const visits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Visit[];
      callback(visits);
    }, (error) => {
      console.error('Error subscribing to visits:', error);
    });
  }
};
