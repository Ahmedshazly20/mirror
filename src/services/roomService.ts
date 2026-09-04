import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Room } from '../types';
import { DEFAULT_BOOKABLE_ROOMS } from './pricingService';
import { settingsService } from './settingsService';
import { cleanData } from '../lib/utils';

export const roomService = {
  /**
   * Ensures the 6 standard bookable rooms exist in Firestore `rooms` collection
   * and in `settings/main`.
   */
  async ensureDefaultRooms(): Promise<Room[]> {
    try {
      const roomsRef = collection(db, 'rooms');
      const snapshot = await getDocs(roomsRef);
      
      const existingRooms = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Room[];

      // Check if all 6 standard rooms are present in Firestore
      const requiredIds = DEFAULT_BOOKABLE_ROOMS.map(r => r.id);
      const existingIds = new Set(existingRooms.map(r => r.id));
      const hasMissingRooms = requiredIds.some(id => !existingIds.has(id));

      if (snapshot.empty || hasMissingRooms || existingRooms.length === 0) {
        // Seed default rooms to Firestore
        for (const defaultRoom of DEFAULT_BOOKABLE_ROOMS) {
          const roomDocRef = doc(db, 'rooms', defaultRoom.id);
          const existing = existingRooms.find(r => r.id === defaultRoom.id);
          const dataToSave = {
            id: defaultRoom.id,
            name: defaultRoom.name,
            type: defaultRoom.type,
            pricingType: defaultRoom.pricingType,
            capacity: defaultRoom.capacity,
            pricePerHour: defaultRoom.pricePerHour,
            status: defaultRoom.status || 'available',
            active: defaultRoom.active !== false,
            tables: existing?.tables || defaultRoom.tables || [],
            updatedAt: Date.now(),
            createdAt: existing?.createdAt || Date.now()
          };
          await setDoc(roomDocRef, cleanData(dataToSave), { merge: true });
        }

        // Also sync settings.rooms in settings/main
        try {
          const currentSettings = await settingsService.getSettings();
          if (currentSettings) {
            const updatedRooms = [...DEFAULT_BOOKABLE_ROOMS];
            await settingsService.updateSettings({
              ...currentSettings,
              rooms: updatedRooms
            });
          }
        } catch (settingsErr) {
          console.warn('Could not sync default rooms to settings doc:', settingsErr);
        }

        return DEFAULT_BOOKABLE_ROOMS;
      }

      return existingRooms;
    } catch (error) {
      console.error('Error ensuring default rooms in Firestore:', error);
      return DEFAULT_BOOKABLE_ROOMS;
    }
  },

  /**
   * Subscribes to real-time updates for rooms from Firestore collection `rooms`.
   */
  subscribeToRooms(callback: (rooms: Room[]) => void) {
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef);

    return onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Automatically seed if collection is completely empty
        const seeded = await roomService.ensureDefaultRooms();
        callback(seeded);
        return;
      }

      const rooms = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Room[];

      callback(rooms);
    }, (error) => {
      console.error("Error subscribing to rooms collection:", error);
      // Fallback callback with default rooms if permission or network issue occurs
      callback(DEFAULT_BOOKABLE_ROOMS);
    });
  },

  /**
   * Get all rooms once
   */
  async getRooms(): Promise<Room[]> {
    try {
      const snapshot = await getDocs(collection(db, 'rooms'));
      if (snapshot.empty) {
        return await this.ensureDefaultRooms();
      }
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Room[];
    } catch (e) {
      console.error('Error fetching rooms:', e);
      return DEFAULT_BOOKABLE_ROOMS;
    }
  },

  /**
   * Create a new room in Firestore `rooms` collection and sync settings
   */
  async createRoom(room: Room): Promise<string> {
    const roomId = room.id || `room-${Date.now()}`;
    const docRef = doc(db, 'rooms', roomId);
    const roomData = cleanData({
      ...room,
      id: roomId,
      active: room.active !== false,
      status: room.status || 'available',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await setDoc(docRef, roomData);

    // Sync with settings/main
    try {
      const settings = await settingsService.getSettings();
      if (settings) {
        const currentRooms = settings.rooms || [];
        if (!currentRooms.some(r => r.id === roomId)) {
          await settingsService.updateSettings({
            ...settings,
            rooms: [...currentRooms, roomData]
          });
        }
      }
    } catch (e) {
      console.warn('Sync to settings failed:', e);
    }

    return roomId;
  },

  /**
   * Update an existing room in Firestore
   */
  async updateRoom(id: string, data: Partial<Room>) {
    const docRef = doc(db, 'rooms', id);
    const updatedData = cleanData({
      ...data,
      updatedAt: Date.now()
    });
    await updateDoc(docRef, updatedData);

    // Sync with settings/main
    try {
      const settings = await settingsService.getSettings();
      if (settings && settings.rooms) {
        const updatedRooms = settings.rooms.map(r => r.id === id ? { ...r, ...updatedData } : r);
        await settingsService.updateSettings({
          ...settings,
          rooms: updatedRooms
        });
      }
    } catch (e) {
      console.warn('Sync to settings failed:', e);
    }
  },

  /**
   * Delete a room from Firestore
   */
  async deleteRoom(id: string) {
    const docRef = doc(db, 'rooms', id);
    await deleteDoc(docRef);

    // Sync with settings/main
    try {
      const settings = await settingsService.getSettings();
      if (settings && settings.rooms) {
        const updatedRooms = settings.rooms.filter(r => r.id !== id);
        await settingsService.updateSettings({
          ...settings,
          rooms: updatedRooms
        });
      }
    } catch (e) {
      console.warn('Sync to settings failed:', e);
    }
  },

  /**
   * Restores all 6 standard rooms in Firestore and Settings
   */
  async resetToDefaultRooms(): Promise<Room[]> {
    for (const room of DEFAULT_BOOKABLE_ROOMS) {
      const docRef = doc(db, 'rooms', room.id);
      await setDoc(docRef, cleanData({
        ...room,
        status: 'available',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }), { merge: true });
    }

    try {
      const settings = await settingsService.getSettings();
      if (settings) {
        await settingsService.updateSettings({
          ...settings,
          rooms: [...DEFAULT_BOOKABLE_ROOMS]
        });
      }
    } catch (e) {
      console.warn('Sync to settings failed:', e);
    }

    return DEFAULT_BOOKABLE_ROOMS;
  }
};
