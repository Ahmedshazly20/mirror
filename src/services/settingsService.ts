import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { WorkspaceSettings } from '../types';
import { cleanData } from '../lib/utils';

const SETTINGS_DOC_ID = 'main';

export const settingsService = {
  async getSettings(): Promise<WorkspaceSettings | null> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as WorkspaceSettings;
    }
    return null;
  },

  async updateSettings(settings: WorkspaceSettings) {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, cleanData(settings));
  },

  subscribeToSettings(callback: (settings: WorkspaceSettings) => void) {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as WorkspaceSettings);
      }
    });
  }
};
