import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { Expense, ExpenseCategory } from '../types';
import { cleanData } from '../lib/utils';

export const expenseService = {
  // Categories
  async addCategory(name: string) {
    const categoryData = {
      name,
      createdAt: Timestamp.now()
    };
    return await addDoc(collection(db, 'expenseCategories'), categoryData);
  },

  async updateCategory(id: string, name: string) {
    const docRef = doc(db, 'expenseCategories', id);
    // Note: In a real app, we might want to update all expenses with this category name
    // for denormalization consistency. But since we optimized for minimal writes,
    // we'll explicitly handle this if needed or just update the new expenses.
    // The requirement said "Minimal Firestore reads/writes", so let's check if we should update all.
    // Usually, denormalization means you have to update the copies too.
    
    await updateDoc(docRef, cleanData({ name }));
    
    // Batch update expenses category name
    const q = query(collection(db, 'expenses'), where('categoryId', '==', id));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((d) => {
      batch.update(d.ref, cleanData({ categoryName: name }));
    });
    await batch.commit();
  },

  async deleteCategory(id: string) {
    // Check if expenses exist for this category
    const q = query(collection(db, 'expenses'), where('categoryId', '==', id));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error('Cannot delete category with associated expenses');
    }
    await deleteDoc(doc(db, 'expenseCategories', id));
  },

  // Expenses
  async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>) {
    const expenseData = cleanData({
      ...expense,
      createdAt: Timestamp.now()
    });
    return await addDoc(collection(db, 'expenses'), expenseData);
  },

  async updateExpense(id: string, expense: Partial<Expense>) {
    const docRef = doc(db, 'expenses', id);
    await updateDoc(docRef, cleanData(expense));
  },

  async deleteExpense(id: string) {
    await deleteDoc(doc(db, 'expenses', id));
  }
};
