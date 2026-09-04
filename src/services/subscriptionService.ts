import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  onSnapshot,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { Subscription } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cleanData } from '../lib/utils';

export const subscriptionService = {
  async createSubscription(subData: Omit<Subscription, 'id' | 'createdAt'>) {
    try {
      const data = cleanData({
        ...subData,
        createdAt: Date.now()
      });
      const docRef = await addDoc(collection(db, 'subscriptions'), data);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'subscriptions');
    }
  },

  async updateSubscription(id: string, data: Partial<Subscription>) {
    const docRef = doc(db, 'subscriptions', id);
    await updateDoc(docRef, cleanData(data));
  },

  async deleteSubscription(id: string) {
    const docRef = doc(db, 'subscriptions', id);
    await deleteDoc(docRef);
  },

  async deductHours(id: string, hours: number) {
    try {
      const subRef = doc(db, 'subscriptions', id);
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(subRef);
      if (snap.exists()) {
        const data = snap.data();
        const currentRemaining = data.remainingHours || 0;
        await updateDoc(subRef, {
          remainingHours: Math.max(0, currentRemaining - hours)
        });
      }
    } catch (error) {
      console.error("Error deducting hours:", error);
      throw error;
    }
  },

  subscribeToSubscriptions(callback: (subs: Subscription[]) => void) {
    const q = query(
      collection(db, 'subscriptions'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subscription[];
      callback(subs);
    }, (error) => {
      console.error("Error subscribing to subscriptions:", error);
    });
  }
};
