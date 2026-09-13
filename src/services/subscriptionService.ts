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

  async recordPayment(id: string, amount: number, paymentMethod: 'cash' | 'instapay', note?: string) {
    try {
      const subRef = doc(db, 'subscriptions', id);
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(subRef);
      if (!snap.exists()) throw new Error('Subscription not found');
      
      const data = snap.data() as Subscription;
      const currentPaid = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === 'unpaid' ? 0 : data.price);
      const newPaid = currentPaid + amount;
      const total = data.price || 0;
      const newRemaining = Math.max(0, total - newPaid);
      const newStatus = newRemaining === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

      await updateDoc(subRef, cleanData({
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        paymentStatus: newStatus
      }));

      // Log in payments collection
      const { paymentService } = await import('./paymentService');
      await paymentService.addPayment({
        subscriptionId: id,
        customerId: data.customerId,
        amount,
        paymentMethod,
        notes: note || `تحصيل اشتراك / باقة (${data.userName})`,
        date: Date.now()
      });

      // Update customer ledger
      if (data.customerId) {
        const { customerService } = await import('./customerService');
        const cust = await customerService.getCustomerById(data.customerId);
        if (cust) {
          await customerService.updateCustomer(data.customerId, {
            totalSpent: (cust.totalSpent || 0) + amount,
            outstandingBalance: Math.max(0, (cust.outstandingBalance || 0) - amount)
          });
        }
      }

      return {
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        paymentStatus: newStatus
      };
    } catch (error) {
      console.error('Error recording subscription payment:', error);
      throw error;
    }
  },

  async deductMinutes(id: string, minutes: number) {
    try {
      const subRef = doc(db, 'subscriptions', id);
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(subRef);
      if (snap.exists()) {
        const data = snap.data();
        let currentRemainingMinutes = 0;
        if (typeof data.remainingMinutes === 'number') {
          currentRemainingMinutes = data.remainingMinutes;
        } else if (typeof data.remainingHours === 'number') {
          currentRemainingMinutes = Math.round(data.remainingHours * 60);
        } else if (typeof data.totalHours === 'number') {
          currentRemainingMinutes = Math.round(data.totalHours * 60);
        }

        const newRemainingMinutes = Math.max(0, currentRemainingMinutes - Math.round(minutes));
        const newRemainingHours = Number((newRemainingMinutes / 60).toFixed(2));
        const currentUsedMinutes = data.usedMinutes || (data.usedHours ? Math.round(data.usedHours * 60) : 0);
        const newUsedMinutes = currentUsedMinutes + Math.round(minutes);

        await updateDoc(subRef, cleanData({
          remainingMinutes: newRemainingMinutes,
          remainingHours: newRemainingHours,
          usedMinutes: newUsedMinutes,
          usedHours: Number((newUsedMinutes / 60).toFixed(2))
        }));

        return {
          newRemainingMinutes,
          newRemainingHours
        };
      }
    } catch (error) {
      console.error("Error deducting minutes:", error);
      throw error;
    }
  },

  async deductHours(id: string, hours: number) {
    return this.deductMinutes(id, Math.round(hours * 60));
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
