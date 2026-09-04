import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { UserProfile, Role } from '../types';

export const authService = {
  async login(email: string, pass: string) {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    return user;
  },

  async logout() {
    await signOut(auth);
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  },

  async getAllStaff(): Promise<UserProfile[]> {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs
      .map(doc => doc.data() as UserProfile)
      .filter(u => u.role === 'staff');
  },

  async createUserProfile(uid: string, email: string, role: Role = 'staff') {
    const profile: UserProfile = {
      uid,
      email,
      role,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'users', uid), profile);
    return profile;
  },

  async createStaff(email: string, pass: string) {
    // We use a secondary firebase app to create a user without logging out the current admin
    const secondaryAppName = `secondary-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await this.createUserProfile(user.uid, email, 'staff');
      await signOut(secondaryAuth);
      return user;
    } finally {
      // Clean up the secondary app to avoid memory leaks
      // Note: firebase v9+ doesn't have a direct deleteApp in standard bundle usually
      // but we can just leave it or use the name only once.
    }
  },

  async deleteStaff(uid: string) {
    // Note: This only deletes the Firestore profile. 
    // Deleting from Firebase Auth requires a backend or specialized admin setup.
    // For now, we delete the profile which blocks access if rules check the profile.
    await deleteDoc(doc(db, 'users', uid));
  },

  onAuthChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
};
