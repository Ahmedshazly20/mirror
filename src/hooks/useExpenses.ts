import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useWorkspaceStore } from '../store';
import { Expense, ExpenseCategory } from '../types';

export function useExpenses() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { setExpenses, setExpenseCategories } = useWorkspaceStore();

  useEffect(() => {
    // Listen to categories
    const categoriesQuery = query(collection(db, 'expenseCategories'), orderBy('name', 'asc'));
    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExpenseCategory[];
      setExpenseCategories(categories);
    }, (err) => {
      console.error("Error listening to expense categories:", err);
      setError(err);
    });

    // Listen to expenses - Fetching all and caching in Zustand as requested
    // The requirement said "Use onSnapshot once and cache results"
    const expensesQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expenses);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to expenses:", err);
      setError(err);
      setLoading(false);
    });

    return () => {
      unsubCategories();
      unsubExpenses();
    };
  }, [setExpenses, setExpenseCategories]);

  return { loading, error };
}
