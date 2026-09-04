import React from 'react';
import { Receipt, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, toMillis } from '../../../lib/utils-workspace';
import { Expense } from '../../../types';

interface ExpenseCardProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => Promise<void>;
}

export const ExpenseCard = React.memo(function ExpenseCard({
  expense,
  onEdit,
  onDelete
}: ExpenseCardProps) {
  
  const handleEditClick = React.useCallback(() => {
    onEdit(expense);
  }, [onEdit, expense]);

  const handleDeleteClick = React.useCallback(() => {
    onDelete(expense.id);
  }, [onDelete, expense.id]);

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 group">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">{expense.title}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{format(toMillis(expense.date), 'MMM dd, yyyy')}</span>
            <span>•</span>
            <Badge variant="outline" className="text-[10px] py-0 border-slate-200 dark:border-slate-800 pointer-events-none">
              {expense.categoryName}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-lg font-black text-rose-500">-{formatCurrency(expense.amount)}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-cyan-500"
            onClick={handleEditClick}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-rose-500"
            onClick={handleDeleteClick}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});
