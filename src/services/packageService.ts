import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Package } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cleanData } from '../lib/utils';

export const packageService = {
  async addPackage(packageData: Omit<Package, 'id' | 'createdAt'>) {
    try {
      const data = cleanData({
        ...packageData,
        createdAt: Date.now()
      });
      const docRef = await addDoc(collection(db, 'packages'), data);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'packages');
    }
  },

  async updatePackage(id: string, data: Partial<Package>) {
    const docRef = doc(db, 'packages', id);
    await updateDoc(docRef, cleanData(data));
  },

  async deletePackage(id: string) {
    const docRef = doc(db, 'packages', id);
    await deleteDoc(docRef);
  },

  subscribeToPackages(callback: (packages: Package[]) => void) {
    const q = query(
      collection(db, 'packages'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const packages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Package[];
      callback(packages);
    }, (error) => {
      console.error("Error subscribing to packages:", error);
    });
  }
};
