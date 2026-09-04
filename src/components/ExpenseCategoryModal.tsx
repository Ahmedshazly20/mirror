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
import { expenseService } from '../services/expenseService';
import { ExpenseCategory } from '../types';

interface ExpenseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: ExpenseCategory | null;
}

export default function ExpenseCategoryModal({ isOpen, onClose, category }: ExpenseCategoryModalProps) {
  const [name, setName] = useState(category?.name || '');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (category) setName(category.name);
    else setName('');
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (category) {
        await expenseService.updateCategory(category.id, name.trim());
      } else {
        await expenseService.addCategory(name.trim());
      }
      onClose();
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              placeholder="e.g. Rent, Internet, Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
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
              {loading ? 'Saving...' : 'Save Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
