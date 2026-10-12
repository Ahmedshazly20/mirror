import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  onSnapshot, 
  orderBy, 
  getDocs,
  where,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const customerService = {
  async getCustomers(limitCount = 100): Promise<Customer[]> {
    try {
      const q = query(
        collection(db, 'customers'), 
        orderBy('updatedAt', 'desc'), 
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  },

  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      const docRef = doc(db, 'customers', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error fetching customer by id:', error);
      return null;
    }
  },

  /**
   * Optimized O(1) read for the highest customer ID instead of reading the entire collection.
   */
  async getNextCustomerId(): Promise<number> {
    try {
      const q = query(
        collection(db, 'customers'), 
        orderBy('customerId', 'desc'), 
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return 1;
      const topCust = snapshot.docs[0].data();
      const topId = Number(topCust.customerId);
      return !isNaN(topId) && topId > 0 ? topId + 1 : 1;
    } catch (error) {
      console.error('Error generating next customerId:', error);
      return Math.floor(Date.now() / 1000) % 100000;
    }
  },

  /**
   * On-demand search for customers using limited targeted queries.
   */
  async searchCustomers(searchTerm: string, limitCount = 8): Promise<Customer[]> {
    if (!searchTerm || !searchTerm.trim()) return [];
    const term = searchTerm.trim();
    const cleanTerm = term.replace(/^#/, '');
    const numId = Number(cleanTerm);
    const resultsMap = new Map<string, Customer>();

    try {
      // 1. If numeric, search by customerId
      if (!isNaN(numId) && numId > 0) {
        const idQ = query(
          collection(db, 'customers'),
          where('customerId', '==', numId),
          limit(limitCount)
        );
        const idSnap = await getDocs(idQ);
        idSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));
      }

      // 2. Search by phone match if space available
      if (cleanTerm.length >= 3 && resultsMap.size < limitCount) {
        const phoneQ = query(
          collection(db, 'customers'),
          where('phone', '>=', cleanTerm),
          where('phone', '<=', cleanTerm + '\uf8ff'),
          limit(limitCount - resultsMap.size)
        );
        const phoneSnap = await getDocs(phoneQ);
        phoneSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));
      }

      // 3. Fallback recent scan if not enough results
      if (resultsMap.size < limitCount) {
        const fallbackQ = query(
          collection(db, 'customers'),
          orderBy('updatedAt', 'desc'),
          limit(30)
        );
        const fallbackSnap = await getDocs(fallbackQ);
        const termLower = term.toLowerCase();
        fallbackSnap.docs.forEach(d => {
          if (resultsMap.size >= limitCount) return;
          const c = { id: d.id, ...d.data() } as Customer;
          if (
            c.customerId?.toString().includes(cleanTerm) ||
            c.name?.toLowerCase().includes(termLower) ||
            c.phone?.includes(cleanTerm) ||
            (c.email && c.email.toLowerCase().includes(termLower))
          ) {
            resultsMap.set(d.id, c);
          }
        });
      }

      return Array.from(resultsMap.values()).slice(0, limitCount);
    } catch (e) {
      console.warn('Error searching customers:', e);
      return [];
    }
  },

  async createCustomer(customerData: Omit<Customer, 'id' | 'customerId' | 'createdAt'> & { customerId?: number }): Promise<Customer> {
    try {
      // Check phone duplicate
      const phone = customerData.phone.trim();
      if (phone) {
        const phoneQuery = query(collection(db, 'customers'), where('phone', '==', phone), limit(1));
        const phoneSnap = await getDocs(phoneQuery);
        if (!phoneSnap.empty) {
          const existing = { id: phoneSnap.docs[0].id, ...phoneSnap.docs[0].data() } as Customer;
          return existing;
        }
      }

      const assignedId = customerData.customerId || (await this.getNextCustomerId());

      const data = cleanData({
        ...customerData,
        customerId: assignedId,
        name: customerData.name.trim(),
        phone: phone,
        email: customerData.email ? customerData.email.trim() : '',
        totalVisits: customerData.totalVisits || 0,
        totalBookings: customerData.totalBookings || 0,
        totalSpent: customerData.totalSpent || 0,
        outstandingBalance: customerData.outstandingBalance || 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const docRef = await addDoc(collection(db, 'customers'), data);
      return { id: docRef.id, ...data } as Customer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
      throw error;
    }
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      await updateDoc(docRef, cleanData({ ...data, updatedAt: Date.now() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'customers');
      throw error;
    }
  },

  async deleteCustomer(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
      throw error;
    }
  },

  async recordVisit(visitData: {
    customerId: string;
    customerName: string;
    customerPhone?: string;
    type: 'session' | 'booking' | 'visit';
    referenceId?: string;
    notes?: string;
  }): Promise<void> {
    try {
      const data = cleanData({
        ...visitData,
        date: Date.now(),
        createdAt: Date.now(),
      });
      await addDoc(collection(db, 'visits'), data);
    } catch (error) {
      console.warn('Error recording visit:', error);
    }
  },

  async findOrCreateCustomer(
    name: string, 
    phone: string, 
    extra?: Partial<Customer>
  ): Promise<Customer | null> {
    try {
      const trimmedName = name ? name.trim() : '';
      const trimmedPhone = phone ? phone.trim() : '';
      if (!trimmedName && !trimmedPhone) return null;

      // 1. Check by phone first if provided
      if (trimmedPhone) {
        const phoneQuery = query(collection(db, 'customers'), where('phone', '==', trimmedPhone));
        const phoneSnap = await getDocs(phoneQuery);
        if (!phoneSnap.empty) {
          const docItem = phoneSnap.docs[0];
          const existing = { id: docItem.id, ...docItem.data() } as Customer;
          const updatedVisits = (existing.totalVisits || 0) + 1;
          const updatePayload: Partial<Customer> = {
            totalVisits: updatedVisits,
            lastVisit: Date.now(),
            updatedAt: Date.now()
          };
          if ((!existing.name || existing.name.startsWith('عميل #')) && trimmedName) {
            updatePayload.name = trimmedName;
          }
          await updateDoc(doc(db, 'customers', existing.id), cleanData(updatePayload));
          return { ...existing, ...updatePayload };
        }
      }

      // 2. Check by name if no phone match
      if (trimmedName) {
        const nameQuery = query(collection(db, 'customers'), where('name', '==', trimmedName));
        const nameSnap = await getDocs(nameQuery);
        if (!nameSnap.empty) {
          const docItem = nameSnap.docs[0];
          const existing = { id: docItem.id, ...docItem.data() } as Customer;
          const updatedVisits = (existing.totalVisits || 0) + 1;
          const updatePayload: Partial<Customer> = {
            totalVisits: updatedVisits,
            lastVisit: Date.now(),
            updatedAt: Date.now()
          };
          if (!existing.phone && trimmedPhone) {
            updatePayload.phone = trimmedPhone;
          }
          await updateDoc(doc(db, 'customers', existing.id), cleanData(updatePayload));
          return { ...existing, ...updatePayload };
        }
      }

      // 3. Not found -> Auto-create new Customer document
      const assignedId = await this.getNextCustomerId();
      const newCustomerData = cleanData({
        customerId: assignedId,
        name: trimmedName || `عميل #${assignedId}`,
        phone: trimmedPhone || '',
        email: extra?.email || '',
        notes: extra?.notes || '',
        totalVisits: 1,
        lastVisit: Date.now(),
        totalBookings: 0,
        totalSpent: 0,
        outstandingBalance: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const docRef = await addDoc(collection(db, 'customers'), newCustomerData);
      return { id: docRef.id, ...newCustomerData } as Customer;
    } catch (error) {
      console.error('Error in findOrCreateCustomer:', error);
      return null;
    }
  },

  subscribeToCustomers(callback: (customers: Customer[]) => void, limitCount = 50) {
    const q = query(
      collection(db, 'customers'), 
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      callback(customers);
    }, (error) => {
      console.error('Error subscribing to customers:', error);
    });
  }
};
