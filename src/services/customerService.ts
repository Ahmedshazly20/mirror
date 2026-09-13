import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  orderBy, 
  getDocs,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    try {
      const q = query(collection(db, 'customers'), orderBy('customerId', 'asc'));
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
      const snapshot = await getDocs(query(collection(db, 'customers'), where('__name__', '==', id)));
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error fetching customer by id:', error);
      return null;
    }
  },

  async getNextCustomerId(): Promise<number> {
    try {
      const snapshot = await getDocs(collection(db, 'customers'));
      if (snapshot.empty) return 1;
      let maxId = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.customerId && typeof data.customerId === 'number') {
          if (data.customerId > maxId) maxId = data.customerId;
        } else if (data.customerId && !isNaN(Number(data.customerId))) {
          const num = Number(data.customerId);
          if (num > maxId) maxId = num;
        }
      });
      return maxId + 1;
    } catch (error) {
      console.error('Error generating next customerId:', error);
      return Date.now() % 100000;
    }
  },

  async createCustomer(customerData: Omit<Customer, 'id' | 'customerId' | 'createdAt'> & { customerId?: number }): Promise<Customer> {
    try {
      // Check phone duplicate
      const phone = customerData.phone.trim();
      if (phone) {
        const phoneQuery = query(collection(db, 'customers'), where('phone', '==', phone));
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

  subscribeToCustomers(callback: (customers: Customer[]) => void) {
    const q = query(collection(db, 'customers'), orderBy('customerId', 'asc'));
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
