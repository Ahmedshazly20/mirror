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
  getDoc,
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem, InventoryMovement, StockMovementType, ServiceItem } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const inventoryService = {
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
    } catch (error) {
      console.error('Error getting inventory items:', error);
      return [];
    }
  },

  async addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<string> {
    try {
      const data = cleanData({
        ...itemData,
        currentStock: Math.max(0, Number(itemData.currentStock) || 0),
        minimumStock: Math.max(0, Number(itemData.minimumStock) || 0),
        purchasePrice: Number(itemData.purchasePrice) || 0,
        sellingPrice: Number(itemData.sellingPrice) || 0,
        active: itemData.active ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      const docRef = await addDoc(collection(db, 'inventory'), data);
      const inventoryId = docRef.id;

      // Automatically sync/create a corresponding service in the Services catalog
      try {
        await this.syncInventoryItemToService(inventoryId, {
          name: itemData.name,
          sellingPrice: Number(itemData.sellingPrice) || 0,
          unit: itemData.unit,
          active: itemData.active ?? true
        });
      } catch (syncErr) {
        console.warn('Could not auto-create linked service:', syncErr);
      }

      return inventoryId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
      throw error;
    }
  },

  async updateInventoryItem(id: string, itemData: Partial<InventoryItem>): Promise<void> {
    try {
      const docRef = doc(db, 'inventory', id);
      const cleaned = cleanData({ 
        ...itemData, 
        currentStock: itemData.currentStock !== undefined ? Math.max(0, Number(itemData.currentStock) || 0) : undefined,
        updatedAt: Date.now() 
      });
      await updateDoc(docRef, cleaned);

      // Sync name & sellingPrice to linked service if updated
      if (itemData.name !== undefined || itemData.sellingPrice !== undefined || itemData.active !== undefined) {
        try {
          await this.syncInventoryItemToService(id, {
            name: itemData.name,
            sellingPrice: itemData.sellingPrice !== undefined ? Number(itemData.sellingPrice) : undefined,
            unit: itemData.unit,
            active: itemData.active
          });
        } catch (syncErr) {
          console.warn('Could not update linked service:', syncErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory');
      throw error;
    }
  },

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'inventory', id);
      await deleteDoc(docRef);

      // Clean up linked service
      try {
        const servicesSnap = await getDocs(
          query(collection(db, 'services'), where('inventoryItemId', '==', id))
        );
        for (const sDoc of servicesSnap.docs) {
          await deleteDoc(doc(db, 'services', sDoc.id));
        }
      } catch (cleanErr) {
        console.warn('Could not clean linked services on delete:', cleanErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory');
      throw error;
    }
  },

  /**
   * Synchronizes an inventory item with the `services` collection
   */
  async syncInventoryItemToService(
    inventoryItemId: string,
    data: { name?: string; sellingPrice?: number; unit?: string; active?: boolean }
  ): Promise<string | null> {
    try {
      const servicesSnap = await getDocs(
        query(collection(db, 'services'), where('inventoryItemId', '==', inventoryItemId))
      );

      let serviceCategory = 'drinks';
      const u = (data.unit || '').toLowerCase();
      if (u.includes('food') || u.includes('meal') || u.includes('وجبة')) {
        serviceCategory = 'food';
      } else if (u.includes('snack') || u.includes('سناك')) {
        serviceCategory = 'snacks';
      }

      if (!servicesSnap.empty) {
        const existingDoc = servicesSnap.docs[0];
        const updatePayload: Record<string, any> = { updatedAt: Date.now() };
        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.sellingPrice !== undefined) updatePayload.price = Number(data.sellingPrice) || 0;
        if (data.active !== undefined) updatePayload.active = data.active;
        await updateDoc(doc(db, 'services', existingDoc.id), cleanData(updatePayload));
        return existingDoc.id;
      } else if (data.name) {
        const newService = cleanData({
          name: data.name.trim(),
          price: Number(data.sellingPrice) || 0,
          category: serviceCategory,
          inventoryItemId,
          inventoryComponents: [{ inventoryItemId, quantity: 1 }],
          active: data.active ?? true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        const createdRef = await addDoc(collection(db, 'services'), newService);
        return createdRef.id;
      }
      return null;
    } catch (error) {
      console.error('Error syncing inventory item to service:', error);
      return null;
    }
  },

  /**
   * Ensures all inventory items are represented in the `services` collection
   */
  async syncAllInventoryItemsToServices(): Promise<void> {
    try {
      const [inventorySnap, servicesSnap] = await Promise.all([
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'services'))
      ]);

      const existingLinkedInventoryIds = new Set<string>();
      const existingServiceNames = new Set<string>();

      servicesSnap.docs.forEach(d => {
        const s = d.data() as ServiceItem;
        if (s.inventoryItemId) existingLinkedInventoryIds.add(s.inventoryItemId);
        if (s.name) existingServiceNames.add(s.name.trim().toLowerCase());
      });

      for (const invDoc of inventorySnap.docs) {
        const item = { id: invDoc.id, ...invDoc.data() } as InventoryItem;
        if (!existingLinkedInventoryIds.has(item.id)) {
          // Check if there is a matching service by name to link it
          const matchingByName = servicesSnap.docs.find(
            d => (d.data() as ServiceItem).name?.trim().toLowerCase() === item.name.trim().toLowerCase()
          );

          if (matchingByName) {
            await updateDoc(doc(db, 'services', matchingByName.id), {
              inventoryItemId: item.id,
              inventoryComponents: [{ inventoryItemId: item.id, quantity: 1 }],
              price: item.sellingPrice || matchingByName.data().price || 0,
              updatedAt: Date.now()
            });
            existingLinkedInventoryIds.add(item.id);
          } else {
            // Create a new linked service
            await this.syncInventoryItemToService(item.id, {
              name: item.name,
              sellingPrice: item.sellingPrice,
              unit: item.unit,
              active: item.active
            });
            existingLinkedInventoryIds.add(item.id);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing all inventory items to services:', error);
    }
  },

  async recordStockMovement(
    inventoryItemId: string,
    type: StockMovementType,
    quantity: number,
    referenceType?: string,
    referenceId?: string,
    notes?: string
  ): Promise<{ previousStock: number; newStock: number } | null> {
    try {
      const itemRef = doc(db, 'inventory', inventoryItemId);
      const itemSnap = await getDoc(itemRef);
      if (!itemSnap.exists()) return null;

      const itemData = itemSnap.data() as InventoryItem;
      const previousStock = Number(itemData.currentStock) || 0;
      
      let newStock = previousStock;
      if (type === 'restock' || type === 'return') {
        newStock = previousStock + quantity;
      } else if (type === 'sale' || type === 'waste') {
        newStock = Math.max(0, previousStock - quantity);
      } else if (type === 'adjustment') {
        newStock = Math.max(0, quantity);
      }

      await updateDoc(itemRef, { currentStock: newStock, updatedAt: Date.now() });

      const movementData = cleanData({
        inventoryItemId,
        inventoryItemName: itemData.name,
        type,
        quantity,
        previousStock,
        newStock,
        referenceType: referenceType || 'manual',
        referenceId: referenceId || '',
        notes: notes || '',
        createdAt: Date.now()
      });

      await addDoc(collection(db, 'inventoryMovements'), movementData);
      return { previousStock, newStock };
    } catch (error) {
      console.error('Error recording stock movement:', error);
      return null;
    }
  },

  /**
   * Helper to find corresponding inventory item for a service
   */
  findInventoryItemForService(
    service: { id?: string; name: string; inventoryItemId?: string },
    inventoryItems: InventoryItem[]
  ): InventoryItem | undefined {
    if (!inventoryItems || inventoryItems.length === 0) return undefined;
    
    // 1. Check direct inventoryItemId
    if (service.inventoryItemId) {
      const found = inventoryItems.find(i => i.id === service.inventoryItemId);
      if (found) return found;
    }

    // 2. Check by service.id == inventory.id
    if (service.id) {
      const found = inventoryItems.find(i => i.id === service.id);
      if (found) return found;
    }

    // 3. Check by exact name match (case-insensitive & trimmed)
    const normalizedName = service.name.trim().toLowerCase();
    return inventoryItems.find(i => i.name.trim().toLowerCase() === normalizedName);
  },

  /**
   * Deducts inventory stock for a service added to a session with full validation
   */
  async deductServiceSale(
    service: { id?: string; name: string; price: number; inventoryItemId?: string },
    quantity: number,
    sessionId: string,
    sessionUserName?: string
  ): Promise<{ success: boolean; remainingStock?: number; error?: string }> {
    try {
      // Find inventory item in DB
      let invDocRef: any = null;
      let currentStock = 0;
      let invItemName = service.name;

      if (service.inventoryItemId) {
        const itemRef = doc(db, 'inventory', service.inventoryItemId);
        const snap = await getDoc(itemRef);
        if (snap.exists()) {
          invDocRef = itemRef;
          const data = snap.data() as InventoryItem;
          currentStock = Number(data.currentStock) || 0;
          invItemName = data.name;
        }
      }

      if (!invDocRef) {
        // Look up by name
        const q = query(collection(db, 'inventory'), where('name', '==', service.name.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docFound = snap.docs[0];
          invDocRef = doc(db, 'inventory', docFound.id);
          const data = docFound.data() as InventoryItem;
          currentStock = Number(data.currentStock) || 0;
          invItemName = data.name;
        }
      }

      if (!invDocRef) {
        // If not tracked in inventory, allow without stock deduction
        return { success: true };
      }

      if (currentStock < quantity) {
        return { 
          success: false, 
          error: `الكمية المطلوبة (${quantity}) غير متوفرة في المخزون! المتاح حاليًا: ${currentStock}` 
        };
      }

      const previousStock = currentStock;
      const newStock = Math.max(0, previousStock - quantity);

      await updateDoc(invDocRef, { currentStock: newStock, updatedAt: Date.now() });

      const movementData = cleanData({
        inventoryItemId: invDocRef.id,
        inventoryItemName: invItemName,
        type: 'sale',
        quantity,
        previousStock,
        newStock,
        referenceType: 'session',
        referenceId: sessionId,
        notes: `طلب خدمة للجلسة: ${service.name} (الكمية: ${quantity})${sessionUserName ? ` - العميل: ${sessionUserName}` : ''}`,
        createdAt: Date.now()
      });

      await addDoc(collection(db, 'inventoryMovements'), movementData);

      return { success: true, remainingStock: newStock };
    } catch (error: any) {
      console.error('Error deducting service sale:', error);
      return { success: false, error: error.message || 'Error deducting inventory stock' };
    }
  },

  /**
   * Restores inventory stock if a service order is removed from an active session
   */
  async returnServiceSale(
    service: { id?: string; name: string; price: number; inventoryItemId?: string },
    quantity: number,
    sessionId: string,
    reason: string = 'إلغاء خدمة من الجلسة'
  ): Promise<boolean> {
    try {
      let invDocRef: any = null;
      let currentStock = 0;
      let invItemName = service.name;

      if (service.inventoryItemId) {
        const itemRef = doc(db, 'inventory', service.inventoryItemId);
        const snap = await getDoc(itemRef);
        if (snap.exists()) {
          invDocRef = itemRef;
          const data = snap.data() as InventoryItem;
          currentStock = Number(data.currentStock) || 0;
          invItemName = data.name;
        }
      }

      if (!invDocRef) {
        const q = query(collection(db, 'inventory'), where('name', '==', service.name.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docFound = snap.docs[0];
          invDocRef = doc(db, 'inventory', docFound.id);
          const data = docFound.data() as InventoryItem;
          currentStock = Number(data.currentStock) || 0;
          invItemName = data.name;
        }
      }

      if (!invDocRef) return true;

      const previousStock = currentStock;
      const newStock = previousStock + quantity;

      await updateDoc(invDocRef, { currentStock: newStock, updatedAt: Date.now() });

      const movementData = cleanData({
        inventoryItemId: invDocRef.id,
        inventoryItemName: invItemName,
        type: 'return',
        quantity,
        previousStock,
        newStock,
        referenceType: 'session',
        referenceId: sessionId,
        notes: `${reason}: ${service.name} (الكمية: ${quantity})`,
        createdAt: Date.now()
      });

      await addDoc(collection(db, 'inventoryMovements'), movementData);
      return true;
    } catch (error) {
      console.error('Error returning service sale:', error);
      return false;
    }
  },

  async deductStockForServices(
    servicesList: { id?: string; name: string; quantity: number }[],
    referenceType: 'session' | 'service' | 'booking' = 'session',
    referenceId?: string
  ): Promise<void> {
    try {
      const servicesSnap = await getDocs(collection(db, 'services'));
      const serviceMap = new Map<string, ServiceItem>();
      servicesSnap.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as ServiceItem;
        serviceMap.set(doc.id, data);
        serviceMap.set(data.name.trim().toLowerCase(), data);
      });

      for (const item of servicesList) {
        const matched = (item.id ? serviceMap.get(item.id) : null) || serviceMap.get(item.name.trim().toLowerCase());
        if (matched && matched.inventoryComponents && matched.inventoryComponents.length > 0) {
          for (const comp of matched.inventoryComponents) {
            const deductQty = comp.quantity * item.quantity;
            await this.recordStockMovement(
              comp.inventoryItemId,
              'sale',
              deductQty,
              referenceType,
              referenceId,
              `Deducted for service: ${item.name} (Qty: ${item.quantity})`
            );
          }
        } else if (matched && matched.inventoryItemId) {
          await this.recordStockMovement(
            matched.inventoryItemId,
            'sale',
            item.quantity,
            referenceType,
            referenceId,
            `Deducted for service: ${item.name} (Qty: ${item.quantity})`
          );
        }
      }
    } catch (error) {
      console.error('Error deducting stock for services:', error);
    }
  },

  subscribeToInventoryItems(callback: (items: InventoryItem[]) => void) {
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      callback(items);
    }, (error) => {
      console.error('Error subscribing to inventory:', error);
    });
  },

  subscribeToMovements(callback: (movements: InventoryMovement[]) => void) {
    const q = query(collection(db, 'inventoryMovements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const movements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryMovement[];
      callback(movements);
    }, (error) => {
      console.error('Error subscribing to inventory movements:', error);
    });
  }
};

