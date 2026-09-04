import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Receipt, 
  BarChart3,
  Filter,
  Tag
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useWorkspaceStore } from '../store';
import { formatCurrency, toMillis } from '../lib/utils-workspace';
import { expenseService } from '../services/expenseService';
import { useExpenses } from '../hooks/useExpenses';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseCategoryModal from '../components/ExpenseCategoryModal';
import { ExpenseCard } from '../features/expenses/components/ExpenseCard';
import { Expense, ExpenseCategory } from '../types';
import { cn } from '@/lib/utils';

export default function Expenses() {
  const { t, i18n } = useTranslation();
  const { loading } = useExpenses();
  const expenses = useWorkspaceStore(state => state.expenses);
  const categories = useWorkspaceStore(state => state.expenseCategories);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const isRTL = i18n.language.startsWith('ar');

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter(expense => {
      const matchesSearch = expense.title.toLowerCase().includes(q) ||
                          expense.notes.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || expense.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, selectedCategory]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredExpenses]);

  const handleDeleteExpense = useCallback(async (id: string) => {
    if (confirm(t('expenses.deleteConfirm'))) {
      try {
        await expenseService.deleteExpense(id);
      } catch (err) {
        console.error("Error deleting expense:", err);
      }
    }
  }, [t]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    if (confirm('Are you sure you want to delete this category? (Only works if no expenses are linked)')) {
      try {
        await expenseService.deleteCategory(id);
      } catch (err: any) {
        alert(err.message || "Error deleting category");
      }
    }
  }, []);

  const handleEditExpense = useCallback((expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  }, []);

  const handleCreateExpenseClick = useCallback(() => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  }, []);

  const handleCreateCategoryClick = useCallback(() => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  }, []);

  if (loading && expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">{t('expenses.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-50 dark:border-slate-800/50 mb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-500" />
              {t('expenses.recent')}
            </CardTitle>
            <Button 
              onClick={handleCreateExpenseClick}
              className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('expenses.add')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRTL ? 'right-3' : 'left-3')} />
                <Input 
                  placeholder={t('expenses.search')} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", isRTL ? 'pr-10' : 'pl-10')}
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-background px-3 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors outline-none cursor-pointer">
                    <Filter className={cn("w-4 h-4", isRTL ? 'ml-2' : 'mr-2')} />
                    {selectedCategory === 'all' ? t('expenses.allCategories') : categories.find(c => c.id === selectedCategory)?.name}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <DropdownMenuItem onClick={() => setSelectedCategory('all')}>{t('expenses.allCategories')}</DropdownMenuItem>
                    {categories.map(cat => (
                      <DropdownMenuItem key={cat.id} onClick={() => setSelectedCategory(cat.id)}>
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="space-y-4">
              {filteredExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onEdit={handleEditExpense}
                  onDelete={handleDeleteExpense}
                />
              ))}
              {filteredExpenses.length === 0 && (
                <div className="py-20 text-center text-slate-500">
                  <p>{t('expenses.noExpenses')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-emerald-500 text-white border-none shadow-lg shadow-emerald-500/20 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <Badge className="bg-white/20 text-white border-none">{t('expenses.expenditure')}</Badge>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">{t('expenses.total')}</h3>
              <p className="text-4xl font-black mb-2">{formatCurrency(totalExpenses)}</p>
              <p className="text-xs opacity-70">Based on filtered results</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-50 dark:border-slate-800/50 mb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-cyan-500" />
                {t('expenses.categories')}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-cyan-500 hover:bg-cyan-500/10"
                onClick={handleCreateCategoryClick}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 group"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-slate-400 hover:text-cyan-500"
                      onClick={() => {
                        setEditingCategory(cat);
                        setIsCategoryModalOpen(true);
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-slate-400 hover:text-rose-500"
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-500">No categories added</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        expense={editingExpense}
      />
      <ExpenseCategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        category={editingCategory}
      />
    </div>
  );
}
