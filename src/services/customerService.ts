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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { recordFirestoreRead, recordFirestoreWrite } from '../lib/firestore-metrics';
import { useWorkspaceStore } from '../store';

// ── In-Memory Search Cache (TTL: 60 seconds) ──────────────────────────────────
interface CacheEntry {
  timestamp: number;
  results: Customer[];
}
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export const customerService = {
  /**
   * Clears the in-memory search cache or invalidates a specific query.
   */
  invalidateSearchCache(term?: string) {
    if (term) {
      searchCache.delete(term.toLowerCase().trim());
    } else {
      searchCache.clear();
    }
  },

  async getCustomers(limitCount = 100): Promise<Customer[]> {
    try {
      const q = query(
        collection(db, 'customers'), 
        orderBy('updatedAt', 'desc'), 
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      recordFirestoreRead('getCustomers', snapshot.size);
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
      recordFirestoreRead('getCustomerById', snap.exists() ? 1 : 0);
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
      recordFirestoreRead('getNextCustomerId', snapshot.size);
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
   * Highly optimized targeted customer search.
   * Eliminates the expensive 30-document recent scan fallback.
   * Handles numeric customer ID searches, phone prefix searches, and normalized name prefix searches.
   */
  async searchCustomers(searchTerm: string, limitCount = 8): Promise<Customer[]> {
    if (!searchTerm || !searchTerm.trim()) return [];
    const term = searchTerm.trim();
    const cacheKey = `${term.toLowerCase()}_${limitCount}`;

    // 0. Check in-memory search cache first (0 Firestore reads!)
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    const cleanTerm = term.replace(/^#/, '').trim();
    const isPureDigits = /^\d+$/.test(cleanTerm);
    const numId = isPureDigits ? Number(cleanTerm) : NaN;
    const resultsMap = new Map<string, Customer>();

    try {
      // 1. If numeric customer ID is provided (e.g. "12" or "#12")
      if (!isNaN(numId) && numId > 0) {
        // Query numeric customerId field
        const idQ = query(
          collection(db, 'customers'),
          where('customerId', '==', numId),
          limit(limitCount)
        );
        const idSnap = await getDocs(idQ);
        recordFirestoreRead('searchCustomers:numericId', idSnap.size);

        idSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));

        // If not found in numeric field, check string customerId field for legacy documents
        if (resultsMap.size === 0) {
          const strIdQ = query(
            collection(db, 'customers'),
            where('customerId', '==', cleanTerm),
            limit(limitCount)
          );
          const strIdSnap = await getDocs(strIdQ);
          recordFirestoreRead('searchCustomers:stringId', strIdSnap.size);
          strIdSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));
        }

        // Numeric match found -> STOP immediately, do not run name search fallback
        if (resultsMap.size > 0) {
          const finalResults = Array.from(resultsMap.values()).slice(0, limitCount);
          searchCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });
          return finalResults;
        }
      }

      // 2. Search by phone number prefix (if input has at least 3 digits)
      if (cleanTerm.length >= 3 && /^\d+$/.test(cleanTerm) && resultsMap.size < limitCount) {
        const phoneQ = query(
          collection(db, 'customers'),
          where('phone', '>=', cleanTerm),
          where('phone', '<=', cleanTerm + '\uf8ff'),
          limit(limitCount - resultsMap.size)
        );
        const phoneSnap = await getDocs(phoneQ);
        recordFirestoreRead('searchCustomers:phone', phoneSnap.size);
        phoneSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));
      }

      // 3. Search by name prefix using normalized nameLower field (requires at least 2 chars)
      if (term.length >= 2 && resultsMap.size < limitCount) {
        const termLower = term.toLowerCase();

        // 3a. Search on normalized nameLower
        const nameLowerQ = query(
          collection(db, 'customers'),
          where('nameLower', '>=', termLower),
          where('nameLower', '<=', termLower + '\uf8ff'),
          limit(limitCount - resultsMap.size)
        );
        const nameLowerSnap = await getDocs(nameLowerQ);
        recordFirestoreRead('searchCustomers:nameLower', nameLowerSnap.size);
        nameLowerSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));

        // 3b. Fallback to exact/capitalized name prefix for legacy records without nameLower
        if (resultsMap.size < limitCount) {
          const rawNameQ = query(
            collection(db, 'customers'),
            where('name', '>=', term),
            where('name', '<=', term + '\uf8ff'),
            limit(limitCount - resultsMap.size)
          );
          const rawNameSnap = await getDocs(rawNameQ);
          recordFirestoreRead('searchCustomers:nameRaw', rawNameSnap.size);
          rawNameSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer));
        }
      }

      const finalResults = Array.from(resultsMap.values()).slice(0, limitCount);
      searchCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });
      return finalResults;
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
        recordFirestoreRead('createCustomer:checkDuplicate', phoneSnap.size);
        if (!phoneSnap.empty) {
          const existing = { id: phoneSnap.docs[0].id, ...phoneSnap.docs[0].data() } as Customer;
          useWorkspaceStore.getState().upsertCustomer(existing);
          return existing;
        }
      }

      const assignedId = customerData.customerId || (await this.getNextCustomerId());
      const trimmedName = customerData.name.trim();

      const data = cleanData({
        ...customerData,
        customerId: assignedId,
        name: trimmedName,
        nameLower: trimmedName.toLowerCase(),
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
      recordFirestoreWrite('createCustomer', 1);

      const createdCustomer = { id: docRef.id, ...data } as Customer;
      
      // Instantly inject into local Zustand cache so customer is immediately searchable without fetching
      useWorkspaceStore.getState().upsertCustomer(createdCustomer);
      this.invalidateSearchCache();

      return createdCustomer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
      throw error;
    }
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      const updatePayload: Record<string, any> = {
        ...data,
        updatedAt: Date.now()
      };
      if (data.name !== undefined) {
        updatePayload.name = data.name.trim();
        updatePayload.nameLower = data.name.trim().toLowerCase();
      }
      if (data.phone !== undefined) {
        updatePayload.phone = data.phone.trim();
      }

      await updateDoc(docRef, cleanData(updatePayload));
      recordFirestoreWrite('updateCustomer', 1);

      // Instantly update in Zustand store
      const currentCustomers = useWorkspaceStore.getState().customers;
      const target = currentCustomers.find(c => c.id === id);
      if (target) {
        useWorkspaceStore.getState().upsertCustomer({ ...target, ...updatePayload });
      }
      this.invalidateSearchCache();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'customers');
      throw error;
    }
  },

  async deleteCustomer(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      await deleteDoc(docRef);
      recordFirestoreWrite('deleteCustomer', 1);
      this.invalidateSearchCache();
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
      recordFirestoreWrite('recordVisit', 1);
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
        const phoneQuery = query(collection(db, 'customers'), where('phone', '==', trimmedPhone), limit(1));
        const phoneSnap = await getDocs(phoneQuery);
        recordFirestoreRead('findOrCreateCustomer:phone', phoneSnap.size);
        if (!phoneSnap.empty) {
          const docItem = phoneSnap.docs[0];
          const existing = { id: docItem.id, ...docItem.data() } as Customer;
          const updatedVisits = (existing.totalVisits || 0) + 1;
          const updatePayload: Partial<Customer> = {
            totalVisits: updatedVisits,
            lastVisit: Date.now(),
            updatedAt: Date.now(),
            nameLower: (existing.name || trimmedName).toLowerCase()
          };
          if ((!existing.name || existing.name.startsWith('عميل #')) && trimmedName) {
            updatePayload.name = trimmedName;
            updatePayload.nameLower = trimmedName.toLowerCase();
          }
          await updateDoc(doc(db, 'customers', existing.id), cleanData(updatePayload));
          recordFirestoreWrite('findOrCreateCustomer:update', 1);
          const fullCust = { ...existing, ...updatePayload };
          useWorkspaceStore.getState().upsertCustomer(fullCust);
          this.invalidateSearchCache();
          return fullCust;
        }
      }

      // 2. Check by name if no phone match
      if (trimmedName) {
        const nameQuery = query(collection(db, 'customers'), where('name', '==', trimmedName), limit(1));
        const nameSnap = await getDocs(nameQuery);
        recordFirestoreRead('findOrCreateCustomer:name', nameSnap.size);
        if (!nameSnap.empty) {
          const docItem = nameSnap.docs[0];
          const existing = { id: docItem.id, ...docItem.data() } as Customer;
          const updatedVisits = (existing.totalVisits || 0) + 1;
          const updatePayload: Partial<Customer> = {
            totalVisits: updatedVisits,
            lastVisit: Date.now(),
            updatedAt: Date.now(),
            nameLower: trimmedName.toLowerCase()
          };
          if (!existing.phone && trimmedPhone) {
            updatePayload.phone = trimmedPhone;
          }
          await updateDoc(doc(db, 'customers', existing.id), cleanData(updatePayload));
          recordFirestoreWrite('findOrCreateCustomer:update', 1);
          const fullCust = { ...existing, ...updatePayload };
          useWorkspaceStore.getState().upsertCustomer(fullCust);
          this.invalidateSearchCache();
          return fullCust;
        }
      }

      // 3. Not found -> Auto-create new Customer document
      const assignedId = await this.getNextCustomerId();
      const newCustomerData = cleanData({
        customerId: assignedId,
        name: trimmedName || `عميل #${assignedId}`,
        nameLower: (trimmedName || `عميل #${assignedId}`).toLowerCase(),
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
      recordFirestoreWrite('findOrCreateCustomer:create', 1);
      const created = { id: docRef.id, ...newCustomerData } as Customer;
      useWorkspaceStore.getState().upsertCustomer(created);
      this.invalidateSearchCache();
      return created;
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
      recordFirestoreRead('subscribeToCustomers:snapshot', snapshot.size);
      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      callback(customers);
    }, (error) => {
      console.error('Error subscribing to customers:', error);
    });
  },

  /**
   * Idempotent migration helper to backfill `nameLower` on existing customers.
   * NOTE: This is NEVER run automatically at application startup.
   * Can be invoked on demand if needed.
   */
  async backfillNameLower(batchSize = 100): Promise<{ processed: number; updated: number }> {
    try {
      const q = query(
        collection(db, 'customers'),
        limit(batchSize)
      );
      const snapshot = await getDocs(q);
      let updated = 0;
      const batch = writeBatch(db);

      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.name && (!data.nameLower || data.nameLower !== data.name.toLowerCase().trim())) {
          batch.update(d.ref, {
            nameLower: data.name.toLowerCase().trim()
          });
          updated++;
        }
      });

      if (updated > 0) {
        await batch.commit();
        recordFirestoreWrite('backfillNameLower', updated);
      }

      return { processed: snapshot.size, updated };
    } catch (e) {
      console.error('Error backfilling nameLower:', e);
      return { processed: 0, updated: 0 };
    }
  }
};
