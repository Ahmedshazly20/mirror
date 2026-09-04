import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { expenseService } from '../services/expenseService';
import { useWorkspaceStore } from '../store';
import { Expense } from '../types';
import { Timestamp } from 'firebase/firestore';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

export default function ExpenseModal({ isOpen, onClose, expense }: ExpenseModalProps) {
  const categories = useWorkspaceStore(state => state.expenseCategories);
  
  const [title, setTitle] = useState(expense?.title || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId || '');
  const [date, setDate] = useState(expense ? new Date(expense.date.toMillis()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(expense?.notes || '');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      setCategoryId(expense.categoryId);
      setDate(new Date(expense.date.toMillis()).toISOString().split('T')[0]);
      setNotes(expense.notes);
    } else {
      setTitle('');
      setAmount('');
      setCategoryId('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || !categoryId) return;

    const selectedCategory = categories.find(c => c.id === categoryId);
    if (!selectedCategory) return;

    setLoading(true);
    try {
      const expenseData = {
        title: title.trim(),
        amount: parseFloat(amount),
        categoryId,
        categoryName: selectedCategory.name,
        date: Timestamp.fromDate(new Date(date)),
        notes: notes.trim()
      };

      if (expense) {
        await expenseService.updateExpense(expense.id, expenseData);
      } else {
        await expenseService.addExpense(expenseData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving expense:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Office Rent"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (EGP)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Extra details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[80px]"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-slate-200 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={loading}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              {loading ? 'Saving...' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
