import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceItem, InventoryItem } from '../types';
import { cleanData } from '../lib/utils';
import { inventoryService } from './inventoryService';

export const serviceItemService = {
  async getServices(): Promise<ServiceItem[]> {
    const snapshot = await getDocs(collection(db, 'services'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ServiceItem[];
  },

  async addService(service: Omit<ServiceItem, 'id'>) {
    const docRef = await addDoc(collection(db, 'services'), cleanData({
      ...service,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));

    // If linked to an inventory item, update the inventory item's selling price
    if (service.inventoryItemId && service.price > 0) {
      try {
        await updateDoc(doc(db, 'inventory', service.inventoryItemId), {
          sellingPrice: Number(service.price) || 0,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn('Could not sync selling price to inventory item:', err);
      }
    }

    return docRef.id;
  },

  async updateService(id: string, service: Partial<ServiceItem>) {
    const serviceRef = doc(db, 'services', id);
    const serviceSnap = await getDoc(serviceRef);
    const currentService = serviceSnap.exists() ? (serviceSnap.data() as ServiceItem) : null;

    await updateDoc(serviceRef, cleanData({
      ...service,
      updatedAt: Date.now()
    }));

    // If price or name was updated, propagate to linked inventory item
    const targetInventoryId = service.inventoryItemId || currentService?.inventoryItemId;
    if (targetInventoryId) {
      try {
        const invPayload: Record<string, any> = { updatedAt: Date.now() };
        if (service.price !== undefined) invPayload.sellingPrice = Number(service.price) || 0;
        if (service.name !== undefined) invPayload.name = service.name.trim();
        await updateDoc(doc(db, 'inventory', targetInventoryId), cleanData(invPayload));
      } catch (err) {
        console.warn('Could not update linked inventory item:', err);
      }
    }
  },

  async deleteService(id: string) {
    const docRef = doc(db, 'services', id);
    await deleteDoc(docRef);
  },

  async syncAllFromInventory(): Promise<void> {
    await inventoryService.syncAllInventoryItemsToServices();
  },

  subscribeToServices(callback: (services: ServiceItem[]) => void) {
    return onSnapshot(collection(db, 'services'), (snapshot) => {
      const services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceItem[];
      callback(services);
    });
  }
};

