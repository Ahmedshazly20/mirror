import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Trash2, 
  User, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Ticket, 
  Phone, 
  Calendar, 
  Coins, 
  Activity, 
  Check, 
  Gem,
  Award,
  Zap,
  CheckCircle,
  HelpCircle,
  Hash,
  X,
  History,
  Timer,
  CalendarDays,
  DoorOpen,
  Table,
  LayoutGrid,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '../store';
import { subscriptionService } from '../services/subscriptionService';
import { customerService } from '../services/customerService';
import { paymentService } from '../services/paymentService';
import { Customer, Subscription } from '../types';
import { toast } from 'sonner';
import { format, addDays, isAfter, differenceInDays, differenceInCalendarDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { Progress } from '../components/ui/progress';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  formatCurrency, 
  formatPackageBalance, 
  getSubscriptionRemainingMinutes, 
  getSubscriptionTotalMinutes 
} from '../lib/utils-workspace';
import { Banknote, AlertCircle, Wallet, DollarSign } from 'lucide-react';

export default function Subscriptions() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { subscriptions, setSubscriptions, settings, packages, customers } = useWorkspaceStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // View, Filter, Sort and Pagination States
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [tabFilter, setTabFilter] = useState<'all' | 'active' | 'expired' | 'packages' | 'monthly' | 'due'>('all');
  const [selectedPackageFilter, setSelectedPackageFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'balance' | 'expiring' | 'due'>('newest');
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (location.state?.openNew) {
      setIsAdding(true);
    }
  }, [location.state]);
  
  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  // ─── Customer Search State ─────────────────────────────────────────────────
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const [newSub, setNewSub] = useState({
    userName: '',
    phoneNumber: '',
    customerId: '',
    startDate: new Date(),
    validityDays: 30,
    type: 'monthly' as 'monthly' | 'package',
    packageId: ''
  });
  const [phoneError, setPhoneError] = useState(false);
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay'>('cash');

  // Paying due on existing sub modal
  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<'cash' | 'instapay'>('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Close customer search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validatePhone = (phone: string) => {
    return /^01[0125][0-9]{8}$/.test(phone);
  };

  const activePackages = useMemo(() => {
    return packages.filter(p => p.isActive);
  }, [packages]);

  // Set default package if switching to package type and none selected
  useEffect(() => {
    if (newSub.type === 'package') {
      if (!newSub.packageId && activePackages.length > 0) {
        const firstPkg = activePackages[0];
        setNewSub(prev => ({ 
          ...prev, 
          packageId: firstPkg.id,
          validityDays: firstPkg.validityDays || 30
        }));
      }
    } else {
      // Monthly
      setNewSub(prev => ({
        ...prev,
        validityDays: settings?.subscriptions?.durationDays ?? 30
      }));
    }
  }, [newSub.type, activePackages, settings?.subscriptions?.durationDays]);

  // When a specific package is selected, pre-fill its validityDays if configured
  const handleSelectPackage = (pkg: typeof activePackages[0]) => {
    setNewSub(prev => ({
      ...prev,
      packageId: pkg.id,
      validityDays: pkg.validityDays || prev.validityDays || 30
    }));
  };

  // Filtered customer list for quick selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return [];
    const term = customerSearchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/^#/, '');

    return customers.filter(c => {
      const matchId = c.customerId.toString() === cleanTerm || c.customerId.toString().includes(cleanTerm);
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = c.phone && c.phone.includes(term);
      return matchId || matchName || matchPhone;
    }).slice(0, 7);
  }, [customers, customerSearchTerm]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setNewSub(prev => ({
      ...prev,
      userName: customer.name,
      phoneNumber: customer.phone,
      customerId: customer.id
    }));
    setCustomerSearchTerm('');
    setIsCustomerDropdownOpen(false);
    setPhoneError(false);
  };

  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setNewSub(prev => ({
      ...prev,
      userName: '',
      phoneNumber: '',
      customerId: ''
    }));
  };

  const computedEndDate = useMemo(() => {
    try {
      const startDateObj = newSub.startDate;
      if (!startDateObj || isNaN(startDateObj.getTime())) return null;
      const days = Number(newSub.validityDays) > 0 ? Number(newSub.validityDays) : 30;
      return addDays(startDateObj, days);
    } catch {
      return null;
    }
  }, [newSub.startDate, newSub.validityDays]);

  const computedPrice = useMemo(() => {
    if (newSub.type === 'monthly') {
      return settings?.subscriptions?.monthlyPrice ?? 1000;
    } else {
      const pkg = packages.find(p => p.id === newSub.packageId);
      return pkg ? pkg.price : 0;
    }
  }, [newSub.type, newSub.packageId, packages, settings?.subscriptions?.monthlyPrice]);

  const computedHours = useMemo(() => {
    if (newSub.type === 'monthly') {
      return null;
    } else {
      const pkg = packages.find(p => p.id === newSub.packageId);
      return pkg ? pkg.totalHours : null;
    }
  }, [newSub.type, newSub.packageId, packages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(newSub.phoneNumber)) {
      setPhoneError(true);
      return;
    }

    try {
      const startDate = newSub.startDate;
      if (!startDate || isNaN(startDate.getTime())) {
        toast.error(t('sessions.invalidDate') || 'Invalid Date');
        return;
      }
      
      const start = startDate.getTime();
      const durationDays = Number(newSub.validityDays) > 0 ? Number(newSub.validityDays) : 30;
      const end = addDays(start, durationDays).getTime();
      let price = settings.subscriptions?.monthlyPrice || 0;
      let totalHours = 0;
      let remainingHours = 0;

      let targetRoomId = 'shared_space';
      let targetRoomName = 'Shared Space';

      if (newSub.type === 'monthly') {
        price = settings.subscriptions?.monthlyPrice || 1000;
      } else {
        const pkg = packages.find(p => p.id === newSub.packageId);
        if (!pkg) {
          toast.error(t('subs.noPackage'));
          return;
        }
        price = pkg.price;
        totalHours = pkg.totalHours;
        remainingHours = pkg.totalHours;
        if (pkg.roomId) {
          targetRoomId = pkg.roomId;
          targetRoomName = pkg.roomName || 'Room';
        }
      }

      // Ensure customer exists in customers database
      let linkedCustomerId = newSub.customerId || selectedCustomer?.id;
      try {
        const customer = await customerService.findOrCreateCustomer(newSub.userName, newSub.phoneNumber);
        if (customer) {
          linkedCustomerId = customer.id;
        }
      } catch (err) {
        console.warn('Customer auto-link warning in sub creation:', err);
      }

      const totalMinutes = totalHours ? Math.round(totalHours * 60) : undefined;
      const remainingMinutes = remainingHours ? Math.round(remainingHours * 60) : undefined;
      
      const paid = paidAmountInput !== '' ? Math.min(price, Math.max(0, Number(paidAmountInput) || 0)) : price;
      const remainingAmount = Math.max(0, price - paid);
      const paymentStatus = remainingAmount === 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'unpaid');

      const createdId = await subscriptionService.createSubscription({
        userName: newSub.userName.trim(),
        phoneNumber: newSub.phoneNumber.trim(),
        customerId: linkedCustomerId || undefined,
        startDate: start,
        endDate: end,
        validityDays: durationDays,
        isActive: true,
        price,
        paidAmount: paid,
        remainingAmount,
        paymentStatus,
        paymentMethod,
        type: newSub.type,
        packageId: newSub.packageId || null,
        totalHours: totalHours || null,
        remainingHours: remainingHours || null,
        totalMinutes: totalMinutes || null,
        remainingMinutes: remainingMinutes || null,
        usedMinutes: 0,
        roomId: targetRoomId,
        roomName: targetRoomName
      });

      // If paid amount > 0, log in payments collection for revenue tracking
      if (paid > 0 && createdId) {
        await paymentService.addPayment({
          subscriptionId: createdId,
          customerId: linkedCustomerId || undefined,
          amount: paid,
          paymentMethod,
          notes: `اشتراك / باقة جديدة (${newSub.userName.trim()})`,
          date: Date.now()
        });
      }

      // Update customer ledger
      if (linkedCustomerId) {
        try {
          const cust = await customerService.getCustomerById(linkedCustomerId);
          if (cust) {
            await customerService.updateCustomer(linkedCustomerId, {
              totalSpent: (cust.totalSpent || 0) + paid,
              outstandingBalance: (cust.outstandingBalance || 0) + remainingAmount
            });
          }
        } catch (err) {
          console.warn('Customer ledger update error in sub creation:', err);
        }
      }

      toast.success(t('subs.success'));
      setIsAdding(false);
      setSelectedCustomer(null);
      setPaidAmountInput('');
      setNewSub({ 
        userName: '', 
        phoneNumber: '', 
        customerId: '',
        startDate: new Date(),
        validityDays: 30,
        type: 'monthly',
        packageId: ''
      });
      setPhoneError(false);
    } catch (err) {
      toast.error(t('subs.error'));
    }
  };

  const handleRecordDuePayment = async () => {
    if (!payingSub) return;
    const amount = Number(collectAmount);
    const remainingDue = payingSub.remainingAmount !== undefined ? payingSub.remainingAmount : (payingSub.price - (payingSub.paidAmount || 0));
    
    if (isNaN(amount) || amount <= 0) {
      toast.error(isRTL ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }

    if (amount > remainingDue) {
      toast.error(isRTL ? `المبلغ لا يمكن أن يتجاوز المتبقي (${remainingDue} ج.م)` : `Amount cannot exceed due (${remainingDue} EGP)`);
      return;
    }

    try {
      setIsProcessingPayment(true);
      await subscriptionService.recordPayment(payingSub.id, amount, collectMethod);
      toast.success(isRTL ? 'تم تسجيل السداد بنجاح' : 'Payment recorded successfully');
      setPayingSub(null);
      setCollectAmount('');
    } catch (err) {
      console.error('Error recording payment:', err);
      toast.error(isRTL ? 'حدث خطأ أثناء تسجيل السداد' : 'Failed to record payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await subscriptionService.deleteSubscription(id);
      toast.success(t('subs.removed'));
    } catch (err) {
      toast.error(t('subs.removeError'));
    }
  };

  // Precomputed fast lookup maps for customers
  const customerLookupMaps = useMemo(() => {
    const byId = new Map<string, Customer>();
    const byPhone = new Map<string, Customer>();
    const byNumericId = new Map<number, Customer>();
    const byName = new Map<string, Customer>();

    (customers || []).forEach(c => {
      if (c.id) byId.set(c.id, c);
      if (c.phone) byPhone.set(c.phone.trim(), c);
      if (c.customerId !== undefined && c.customerId !== null) {
        byNumericId.set(Number(c.customerId), c);
      }
      if (c.name) byName.set(c.name.trim().toLowerCase(), c);
    });

    return { byId, byPhone, byNumericId, byName };
  }, [customers]);

  const getCustomerCode = useCallback((sub: Subscription) => {
    if (sub.customerId) {
      const match = customerLookupMaps.byId.get(sub.customerId);
      if (match) return `#${match.customerId}`;
    }
    if (sub.phoneNumber) {
      const match = customerLookupMaps.byPhone.get(sub.phoneNumber.trim());
      if (match) return `#${match.customerId}`;
    }
    if (sub.userName) {
      const match = customerLookupMaps.byName.get(sub.userName.trim().toLowerCase());
      if (match) return `#${match.customerId}`;
    }
    return null;
  }, [customerLookupMaps]);

  const getSubStatus = useCallback((sub: Subscription) => {
    const endDateObj = sub.endDate ? new Date(sub.endDate) : null;
    const isExpired = endDateObj ? isAfter(new Date(), endDateObj) : false;
    const remainingDays = endDateObj ? differenceInCalendarDays(endDateObj, new Date()) : null;

    const remainingMinutes = getSubscriptionRemainingMinutes(sub);
    const totalMinutes = getSubscriptionTotalMinutes(sub);
    const isPackage = sub.type === 'package';
    const isExhausted = isPackage && remainingMinutes <= 0;

    const price = sub.price || 0;
    const paid = sub.paidAmount !== undefined ? sub.paidAmount : (sub.paymentStatus === 'unpaid' ? 0 : price);
    const remainingDue = sub.remainingAmount !== undefined ? sub.remainingAmount : Math.max(0, price - paid);
    const hasDue = remainingDue > 0;

    const isActive = !isExpired && !isExhausted && sub.isActive !== false;

    return {
      isExpired,
      remainingDays,
      remainingMinutes,
      totalMinutes,
      isPackage,
      isExhausted,
      price,
      paid,
      remainingDue,
      hasDue,
      isActive,
      customerCode: getCustomerCode(sub)
    };
  }, [getCustomerCode]);

  // Overall Statistics across all subscriptions
  const subStats = useMemo(() => {
    let activeCount = 0;
    let expiredCount = 0;
    let exhaustedCount = 0;
    let packagesCount = 0;
    let monthlyCount = 0;
    let hasDueCount = 0;
    let totalDueAmount = 0;

    subscriptions.forEach(sub => {
      const status = getSubStatus(sub);
      if (status.isActive) activeCount++;
      if (status.isExpired) expiredCount++;
      if (status.isExhausted) exhaustedCount++;
      if (status.isPackage) packagesCount++;
      else monthlyCount++;
      if (status.hasDue) {
        hasDueCount++;
        totalDueAmount += status.remainingDue;
      }
    });

    return {
      total: subscriptions.length,
      activeCount,
      expiredCount,
      exhaustedCount,
      packagesCount,
      monthlyCount,
      hasDueCount,
      totalDueAmount
    };
  }, [subscriptions, getSubStatus]);

  // Filtered and Sorted list across ALL subscriptions (Search & filters apply before pagination)
  const filteredAndSortedSubs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const cleanId = term.replace(/^#/, '');

    const filtered = subscriptions.filter(sub => {
      const status = getSubStatus(sub);

      // 1. Tab Status Filter
      if (tabFilter === 'active' && !status.isActive) return false;
      if (tabFilter === 'expired' && !status.isExpired) return false;
      if (tabFilter === 'packages' && !status.isPackage) return false;
      if (tabFilter === 'monthly' && status.isPackage) return false;
      if (tabFilter === 'due' && !status.hasDue) return false;

      // 2. Specific Package Filter
      if (selectedPackageFilter !== 'all') {
        if (selectedPackageFilter === 'monthly') {
          if (sub.type === 'package') return false;
        } else {
          if (sub.packageId !== selectedPackageFilter) return false;
        }
      }

      // 3. Search query
      if (term) {
        const matchName = sub.userName?.toLowerCase().includes(term);
        const matchPhone = sub.phoneNumber && sub.phoneNumber.includes(term);
        const matchCode = status.customerCode && (status.customerCode.toLowerCase().includes(cleanId) || status.customerCode.includes(term));
        const matchRoom = sub.roomName && sub.roomName.toLowerCase().includes(term);

        const cust = 
          (sub.customerId && customerLookupMaps.byId.get(sub.customerId)) ||
          (sub.phoneNumber && customerLookupMaps.byPhone.get(sub.phoneNumber.trim()));
        const custNumId = cust?.customerId?.toString() || '';
        const matchCustId = Boolean(custNumId && (custNumId === cleanId || custNumId.includes(cleanId)));

        if (!matchName && !matchPhone && !matchCode && !matchRoom && !matchCustId) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const statusA = getSubStatus(a);
      const statusB = getSubStatus(b);

      switch (sortBy) {
        case 'newest': {
          const aTime = typeof a.createdAt === 'number' ? a.createdAt : (a.startDate || 0);
          const bTime = typeof b.createdAt === 'number' ? b.createdAt : (b.startDate || 0);
          return bTime - aTime;
        }
        case 'oldest': {
          const aTime = typeof a.createdAt === 'number' ? a.createdAt : (a.startDate || 0);
          const bTime = typeof b.createdAt === 'number' ? b.createdAt : (b.startDate || 0);
          return aTime - bTime;
        }
        case 'name':
          return (a.userName || '').localeCompare(b.userName || '', isRTL ? 'ar' : 'en');
        case 'balance':
          return statusB.remainingMinutes - statusA.remainingMinutes;
        case 'expiring': {
          const aEnd = a.endDate || 9999999999999;
          const bEnd = b.endDate || 9999999999999;
          return aEnd - bEnd;
        }
        case 'due':
          return statusB.remainingDue - statusA.remainingDue;
        default:
          return 0;
      }
    });

    return filtered;
  }, [subscriptions, searchTerm, tabFilter, selectedPackageFilter, sortBy, getSubStatus, customerLookupMaps, isRTL]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tabFilter, selectedPackageFilter, sortBy]);

  // Refresh handler
  const handleRefreshSubs = async () => {
    try {
      setIsRefreshing(true);
      const all = await subscriptionService.getAllSubscriptions();
      if (all && all.length > 0) {
        setSubscriptions(all);
      }
      toast.success(isRTL ? 'تم تحديث قائمة المشتركين' : 'Subscribers refreshed');
    } catch (e) {
      console.warn('Failed to refresh subscribers:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Paginated View Slice
  const totalResults = filteredAndSortedSubs.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(1, totalResults) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalResults / effectivePageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedSubs = useMemo(() => {
    if (pageSize === 'all') return filteredAndSortedSubs;
    const startIndex = (validCurrentPage - 1) * effectivePageSize;
    return filteredAndSortedSubs.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredAndSortedSubs, validCurrentPage, effectivePageSize, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('subs.title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t('subs.subtitle')}</p>
        </div>
        <Button 
          onClick={() => setIsAdding(!isAdding)}
          className={cn(
            "rounded-2xl font-bold text-xs h-10 px-5 shadow-md flex items-center transition-all duration-300",
            isAdding 
              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700" 
              : "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white"
          )}
        >
          <Plus className={cn("w-4 h-4 transition-transform duration-300", isAdding ? "rotate-45" : "", isRTL ? 'ml-1.5' : 'mr-1.5')} />
          {isAdding ? t('subs.cancel') : t('subs.new')}
        </Button>
      </div>

      {isAdding && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-top-4 duration-300">
          
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-cyan-400 via-cyan-500 to-purple-500 pointer-events-none" />
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-500" />
                  {t('subs.create')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {newSub.type === 'monthly' ? (
                    <span className="font-medium text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 dark:bg-cyan-500/20">
                      <Sparkles className="w-3 h-3" />
                      {t('subs.plan')}: {settings.subscriptions?.monthlyPrice ?? 1000} {t('common.currency')} / {newSub.validityDays} {isRTL ? 'يوم' : 'Days'}
                    </span>
                  ) : (
                    <span className="font-medium text-purple-600 dark:text-purple-400 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 dark:bg-purple-500/20">
                      <Ticket className="w-3 h-3" />
                      {t('subs.package')}: {computedHours || 0} {isRTL ? 'ساعة' : 'Hrs'} / {newSub.validityDays} {isRTL ? 'يوم صلاحية' : 'Days validity'}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 pt-0">
                <form onSubmit={handleCreate} className="space-y-6">
                  
                  {/* Step 1: Member Data with Customer Search */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-[10px] font-bold">1</span>
                        {isRTL ? 'بيانات المشترك أو اختيار من العملاء' : 'Member Data & Customer Selection'}
                      </h3>
                      {selectedCustomer && (
                        <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {isRTL ? `عميل مسجل #${selectedCustomer.customerId}` : `Registered Customer #${selectedCustomer.customerId}`}
                        </span>
                      )}
                    </div>

                    {/* Quick Search registered customer */}
                    <div ref={customerSearchRef} className="relative">
                      <div className="relative">
                        <Search className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 pointer-events-none",
                          isRTL ? "right-3.5" : "left-3.5"
                        )} />
                        <Input
                          placeholder={isRTL ? "🔍 ابحث برقم الهاتف أو الاسم أو كود العميل (#12) للربط الفوري..." : "🔍 Search by phone, name, or customer ID (#12)..."}
                          value={customerSearchTerm}
                          onChange={(e) => {
                            setCustomerSearchTerm(e.target.value);
                            setIsCustomerDropdownOpen(true);
                          }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          className={cn(
                            "bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-200/80 dark:border-cyan-900/60 rounded-xl h-11 text-xs font-medium focus:ring-cyan-500/20",
                            isRTL ? "pr-10" : "pl-10"
                          )}
                        />
                        {customerSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearchTerm('')}
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                              isRTL ? "left-3" : "right-3"
                            )}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown search results */}
                      {isCustomerDropdownOpen && customerSearchTerm.trim() && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => handleSelectCustomer(customer)}
                                className="w-full px-4 py-3 text-start hover:bg-cyan-50/70 dark:hover:bg-cyan-950/40 flex items-center justify-between transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-xs font-black">
                                    #{customer.customerId}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors">
                                      {customer.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-400">
                                      {customer.phone || 'بدون هاتف'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-end">
                                  <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700">
                                    {customer.totalVisits || 0} {isRTL ? 'زيارات' : 'visits'}
                                  </Badge>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400 font-medium">
                              {isRTL ? 'لا يوجد عميل مطابق — يمكنك إدخال البيانات أدناه وسيتم حفظه تلقائياً' : 'No customer found — enter details below to auto-save'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Customer Active Pill */}
                    {selectedCustomer && (
                      <div className="p-3 bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                            #{selectedCustomer.customerId}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearSelectedCustomer}
                          className="h-7 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg px-2"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          {isRTL ? 'تغيير' : 'Change'}
                        </Button>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('subs.member')}</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <Input 
                            placeholder={isRTL ? 'مثال: أحمد علي' : 'e.g. Ahmed Ali'}
                            value={newSub.userName}
                            onChange={(e) => setNewSub({...newSub, userName: e.target.value})}
                            className="bg-slate-50/50 dark:bg-slate-950 font-medium pl-10 rounded-xl border-slate-200/80 dark:border-slate-800/80 h-11"
                            required
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('subs.phoneNumber')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <Input 
                            type="tel"
                            placeholder="01XXXXXXXXX"
                            value={newSub.phoneNumber}
                            onChange={(e) => {
                              setNewSub({...newSub, phoneNumber: e.target.value});
                              if (phoneError) setPhoneError(false);
                            }}
                            className={cn(
                              "bg-slate-50/50 dark:bg-slate-950 font-mono font-medium pl-10 rounded-xl border-slate-200/80 dark:border-slate-800/80 h-11",
                              phoneError ? 'border-rose-500 ring-rose-500/10' : ''
                            )}
                            required
                          />
                        </div>
                        {phoneError && <p className="text-[10px] text-rose-500 font-bold mt-1">{t('sessions.invalidPhone')}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Choose Tier */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-[10px] font-bold">2</span>
                      {isRTL ? 'اختر خطة الاشتراك' : 'Choose Subscription Tier'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Monthly Plan Select Box */}
                      <div 
                        onClick={() => setNewSub({ ...newSub, type: 'monthly', packageId: '', validityDays: settings?.subscriptions?.durationDays ?? 30 })}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden select-none",
                          newSub.type === 'monthly'
                            ? "border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 shadow-sm shadow-cyan-500/5"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                        )}
                      >
                        {newSub.type === 'monthly' && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                            newSub.type === 'monthly' ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={cn(
                              "font-bold text-sm transition-colors",
                              newSub.type === 'monthly' 
                                ? "text-cyan-600 dark:text-cyan-400 font-extrabold" 
                                : "text-slate-900 dark:text-white"
                            )}>{t('subs.monthly')}</p>
                            <p className={cn(
                              "text-[10px] font-medium leading-none mt-1 transition-colors",
                              newSub.type === 'monthly' ? "text-cyan-600/80 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"
                            )}>{isRTL ? 'وصول غير محدود بالأيام' : 'Unlimited daily access'}</p>
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={cn(
                            "text-2xl font-black transition-colors",
                            newSub.type === 'monthly' ? "text-cyan-600 dark:text-cyan-400" : "text-slate-900 dark:text-white"
                          )}>
                            {settings.subscriptions?.monthlyPrice ?? 1000}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">EGP</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-450 font-medium ml-1">/ {newSub.validityDays} {isRTL ? 'يوم' : 'days'}</span>
                        </div>
                      </div>

                      {/* Package Hours Select Box */}
                      <div 
                        onClick={() => setNewSub({ ...newSub, type: 'package' })}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden select-none",
                          newSub.type === 'package'
                            ? "border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 shadow-sm shadow-purple-500/5"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                        )}
                      >
                        {newSub.type === 'package' && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                            newSub.type === 'package' ? "bg-purple-500/20 text-purple-600 dark:text-purple-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            <Ticket className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={cn(
                              "font-bold text-sm transition-colors",
                              newSub.type === 'package' 
                                ? "text-purple-600 dark:text-purple-400 font-extrabold" 
                                : "text-slate-900 dark:text-white"
                            )}>{t('subs.package')}</p>
                            <p className={cn(
                              "text-[10px] font-medium leading-none mt-1 transition-colors",
                              newSub.type === 'package' ? "text-purple-600/80 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"
                            )}>{isRTL ? 'باقات ساعات مشحونة مقدماً ومحددة بالوقت' : 'Prepaid time-bounded hours'}</p>
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={cn(
                            "text-2xl font-black transition-colors",
                            newSub.type === 'package' ? "text-purple-600 dark:text-purple-400" : "text-slate-900 dark:text-white"
                          )}>
                            {activePackages.length > 0 ? `${Math.min(...activePackages.map(p => p.price))}+` : '---'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">EGP</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-450 font-medium ml-1">/ {isRTL ? 'مدة صلاحية مخصصة' : 'Custom validity'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Choose Active Package Cards (Conditional) */}
                  {newSub.type === 'package' && (
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-3 duration-250">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center text-[10px] font-bold">3</span>
                        {isRTL ? 'اختر باقة الساعات' : 'Select Hour Package Plan'}
                      </h3>

                      {activePackages.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
                          <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
                          <p className="text-sm font-bold">{t('packages.noPackages') || 'No active packages in settings'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {activePackages.map((pkg) => {
                            const isSelected = newSub.packageId === pkg.id;
                            const hourlyRateEquivalent = pkg.totalHours > 0 ? Math.round(pkg.price / pkg.totalHours) : 0;
                            return (
                              <div
                                key={`pkg-card-${pkg.id}`}
                                onClick={() => handleSelectPackage(pkg)}
                                className={cn(
                                  "p-4 rounded-[1.25rem] border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between relative select-none hover:shadow-sm",
                                  isSelected
                                    ? "border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 shadow-sm shadow-purple-500/5"
                                    : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                                )}
                              >
                                {isSelected && (
                                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={cn(
                                      "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm",
                                      isSelected ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    )}>
                                      <Zap className="w-4 h-4" />
                                    </div>
                                    <h4 className={cn(
                                      "font-extrabold text-sm line-clamp-1",
                                      isSelected ? "text-purple-600 dark:text-purple-400" : "text-slate-900 dark:text-white"
                                    )}>{pkg.name}</h4>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
                                    <span>{t('packages.hours')}</span>
                                    <span className="text-purple-600 dark:text-purple-400 font-extrabold text-sm">
                                      {pkg.totalHours} {isRTL ? 'ساعة' : 'H'}
                                    </span>
                                  </div>

                                  <div className="pt-1.5 flex items-center gap-1">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-200/40 flex items-center gap-1">
                                      <DoorOpen className="w-3 h-3 text-purple-500" />
                                      {pkg.roomName || 'Shared Space'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-baseline justify-between border-t border-slate-200 dark:border-slate-800 pt-2.5 mt-2.5">
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {pkg.validityDays ? `${pkg.validityDays} ${isRTL ? 'يوم' : 'd'}` : `${hourlyRateEquivalent} EGP/hr`}
                                  </span>
                                  <span className="text-base font-black text-emerald-500 dark:text-emerald-400">
                                    {pkg.price} <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">EGP</span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Validity Duration in Days (صلاحية الباقة / الاشتراك بالأيام) */}
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-[10px] font-bold">
                          {newSub.type === 'package' ? '4' : '3'}
                        </span>
                        {isRTL ? 'تحديد مدة الصلاحية للاستهلاك (بالأيام)' : 'Package / Subscription Validity in Days'}
                      </h3>
                      <span className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400">
                        {newSub.validityDays} {isRTL ? 'يوم' : 'Days'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-cyan-500" />
                          {isRTL ? 'عدد الأيام المسموح فيها باستهلاك الباقة:' : 'Number of validity days:'}
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            max="730"
                            required
                            value={newSub.validityDays || ''}
                            onChange={(e) => setNewSub({ ...newSub, validityDays: parseInt(e.target.value) || 1 })}
                            className="bg-slate-50/50 dark:bg-slate-950 font-black text-base pl-4 pr-12 rounded-xl border-slate-200/80 dark:border-slate-800/80 h-11 text-cyan-600 dark:text-cyan-400"
                          />
                          <span className={cn(
                            "absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none",
                            isRTL ? "left-3.5" : "right-3.5"
                          )}>
                            {isRTL ? 'يوم' : 'Days'}
                          </span>
                        </div>
                      </div>

                      {/* Quick preset buttons */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-400">{isRTL ? 'خيارات شائعة سريعة:' : 'Quick Presets:'}</Label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[5, 10, 15, 20, 30, 45, 60, 90, 365].map(days => (
                            <button
                              key={`days-chip-${days}`}
                              type="button"
                              onClick={() => setNewSub({ ...newSub, validityDays: days })}
                              className={cn(
                                "text-xs px-2.5 py-1.5 rounded-xl border font-bold transition-all active:scale-95",
                                newSub.validityDays === days
                                  ? "bg-cyan-500 text-white border-cyan-500 shadow-sm shadow-cyan-500/20"
                                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              {days} {isRTL ? 'ي' : 'd'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Activation Date */}
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-[10px] font-bold">
                        {newSub.type === 'package' ? '5' : '4'}
                      </span>
                      {t('subs.startDate')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="relative">
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className={cn(
                              "w-full rounded-xl h-11 justify-start font-semibold text-slate-700 dark:text-slate-300 text-left border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3.5 flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors",
                              isRTL ? "text-right flex-row-reverse" : "text-left"
                            )}
                          >
                            <Calendar className={cn("w-4 h-4 text-cyan-500 shrink-0", isRTL ? "ml-2" : "mr-2")} />
                            <span className="truncate">
                              {newSub.startDate ? format(newSub.startDate, "PPP", { locale: dateLocale }) : t('sessions.pickDate')}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto z-50" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={newSub.startDate}
                              onSelect={(date) => date && setNewSub({ ...newSub, startDate: date })}
                              initialFocus
                              locale={dateLocale}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Expiration date preview indicator */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-purple-500" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{isRTL ? 'تاريخ الانتهاء:' : 'Expires On:'}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                          {computedEndDate ? format(computedEndDate, 'dd MMM yyyy', { locale: dateLocale }) : '---'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 6: Payment & Settlement */}
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                        {newSub.type === 'package' ? '6' : '5'}
                      </span>
                      {isRTL ? 'بيانات التحصيل والدفع (Revenue Settlement)' : 'Payment & Revenue Settlement'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Payment Method Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={cn(
                              "flex items-center justify-center gap-2 h-11 px-3 rounded-xl border text-xs font-bold transition-all",
                              paymentMethod === 'cash'
                                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <Banknote className="w-4 h-4" />
                            <span>{isRTL ? 'كاش (Cash)' : 'Cash'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('instapay')}
                            className={cn(
                              "flex items-center justify-center gap-2 h-11 px-3 rounded-xl border text-xs font-bold transition-all",
                              paymentMethod === 'instapay'
                                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <Wallet className="w-4 h-4" />
                            <span>InstaPay</span>
                          </button>
                        </div>
                      </div>

                      {/* Paid Amount Input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {isRTL ? 'المبلغ المسدد الآن (ج.م)' : 'Paid Amount (EGP)'}
                          </Label>
                          <span className="text-[11px] font-mono text-slate-400">
                            {isRTL ? 'الإجمالي: ' : 'Total: '}{computedPrice} {t('common.currency')}
                          </span>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max={computedPrice}
                            placeholder={`${computedPrice}`}
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            className="h-11 rounded-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Payment Presets */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPaidAmountInput(`${computedPrice}`)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 transition-all"
                      >
                        {isRTL ? `سداد كامل (${computedPrice} ج.م)` : `Full (${computedPrice} EGP)`}
                      </button>
                      {computedPrice > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaidAmountInput(`${Math.round(computedPrice / 2)}`)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20 transition-all"
                        >
                          {isRTL ? `سداد النصف (${Math.round(computedPrice / 2)} ج.م)` : `Half (${Math.round(computedPrice / 2)} EGP)`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPaidAmountInput('0')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20 transition-all"
                      >
                        {isRTL ? 'بدون دفع (0 ج.م - آجل)' : 'Unpaid (0 EGP)'}
                      </button>
                    </div>

                    {/* Settlement Summary Banner */}
                    {(() => {
                      const actualPaid = paidAmountInput !== '' ? Math.min(computedPrice, Math.max(0, Number(paidAmountInput) || 0)) : computedPrice;
                      const actualRemaining = Math.max(0, computedPrice - actualPaid);
                      return (
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <p className="text-slate-400 text-[10px] font-bold">{isRTL ? 'المطلوب' : 'Total'}</p>
                            <p className="font-bold text-slate-800 dark:text-white font-mono">{computedPrice} ج.م</p>
                          </div>
                          <div>
                            <p className="text-emerald-500 text-[10px] font-bold">{isRTL ? 'إيراد محصل (Cash In)' : 'Revenue Received'}</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{actualPaid} ج.م</p>
                          </div>
                          <div>
                            <p className="text-amber-500 text-[10px] font-bold">{isRTL ? 'متبقي مستحق (Due)' : 'Outstanding'}</p>
                            <p className={cn("font-bold font-mono", actualRemaining > 0 ? "text-amber-500" : "text-slate-400")}>
                              {actualRemaining} ج.م
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl px-10 h-11 font-bold text-sm shadow-md"
                    >
                      {t('subs.activate')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Membership Pass Live Preview (Right column) */}
          <div className="space-y-4 lg:sticky lg:top-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
              {isRTL ? 'معاينة بطاقة العضوية' : 'Membership Pass Preview'}
            </h3>

            {/* Glowing VIP Pass Ticket design */}
            <div className="relative group overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-6 flex flex-col justify-between min-h-[380px] shadow-xl text-white select-none">
              
              {/* Cyber Grid Holographic lines background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:24px_24px] rounded-[2rem] pointer-events-none" />
              
              {/* Ambient glowing radial lens blur */}
              <div className="absolute top-[-20%] left-[-20%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.12),transparent_60%)] pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.08),transparent_50%)] pointer-events-none" />

              {/* Top Section */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-cyan-450 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-wider uppercase text-cyan-400 leading-none">NEW WAY</p>
                    <p className="text-[7px] tracking-widest text-slate-400 uppercase mt-0.5">CO-WORKING SPACE</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <div className="px-2 py-0.5 rounded-md text-[8px] font-black tracking-wide border border-emerald-500/30 bg-emerald-500/10 text-emerald-450 animate-pulse flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {isRTL ? 'جاهز للتفعيل' : 'LIVE PASS'}
                  </div>
                </div>
              </div>

              {/* Center Section: Large Plan Type Info */}
              <div className="my-6 z-10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">
                    {isRTL ? 'نوع المرور والاشتراك' : 'MEMBERSHIP TIER'}
                  </p>
                  <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    {newSub.validityDays} {isRTL ? 'يوم صلاحية' : 'days validity'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight leading-tight uppercase line-clamp-1">
                  {newSub.type === 'monthly' 
                    ? (isRTL ? 'عضوية شهرية متميزة' : 'MONTHLY CO-WORKING PASS')
                    : (packages.find(p => p.id === newSub.packageId)?.name || (isRTL ? 'باقة ساعات مرنة' : 'HOURS SESSION PASS'))
                  }
                </h3>
                
                {/* Large Value Metrics */}
                <div className="mt-3.5 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                    {computedPrice}
                  </span>
                  <span className="text-[10px] font-bold text-slate-450 uppercase">
                    EGP
                  </span>
                  {computedHours !== null && (
                    <span className="text-xs font-bold text-slate-400 border-l border-slate-800 pl-2 ml-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      {computedHours} {isRTL ? 'ساعة' : 'Hours'}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer Section: User Details and Barcode */}
              <div className="pt-4 border-t border-slate-900 z-10 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-wider text-slate-500 mb-0.5">{isRTL ? 'اسم العضو' : 'MEMBER'}</p>
                    <p className="text-xs font-bold truncate text-slate-200">
                      {newSub.userName || (isRTL ? 'ـ ـ ـ' : '---')}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-wider text-slate-500 mb-0.5">{isRTL ? 'رقم الهاتف' : 'CONTACT'}</p>
                    <p className="text-xs font-mono font-bold truncate text-slate-300">
                      {newSub.phoneNumber || (isRTL ? 'ـ ـ ـ' : '---')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-end justify-between gap-4 pt-1">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-slate-500 mb-0.5">{isRTL ? 'الفترة الزمنية للبطاقة' : 'VALIDITY PERIOD'}</p>
                    <p className="text-[9px] font-semibold text-slate-400">
                      {format(newSub.startDate, 'MMM dd', { locale: dateLocale })} - {computedEndDate ? format(computedEndDate, 'MMM dd, yyyy', { locale: dateLocale }) : '---'}
                    </p>
                  </div>
                  
                  {/* Decorative Custom Micro Barcode */}
                  <div className="flex items-end gap-[1.5px] h-7 bg-white/5 p-1 rounded-sm border border-white/5 shadow-inner">
                    {[2, 4, 1, 3, 2, 4, 1, 2, 3, 1, 4, 3, 2, 1, 3, 4, 1, 2, 1, 3].map((h, idx) => (
                      <div 
                        key={`bar-${idx}`} 
                        style={{ height: `${h * 20 + 20}%` }} 
                        className={cn(
                          "w-[1.5px] rounded-[1px] bg-white transition-all duration-300", 
                          idx % 4 === 0 ? "opacity-30" : "opacity-80"
                        )} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview Statistics Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-1">
        <div 
          onClick={() => setTabFilter('all')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer select-none",
            tabFilter === 'all'
              ? "bg-cyan-500/10 border-cyan-500 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي المشتركين' : 'Total Subscribers'}</span>
            <User className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{subStats.total}</span>
            <span className="text-[10px] text-slate-400 font-bold">{isRTL ? 'عضو' : 'members'}</span>
          </div>
        </div>

        <div 
          onClick={() => setTabFilter('active')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer select-none",
            tabFilter === 'active'
              ? "bg-emerald-500/10 border-emerald-500 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{isRTL ? 'الاشتراكات النشطة' : 'Active Members'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{subStats.activeCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">{isRTL ? 'نشط' : 'active'}</span>
          </div>
        </div>

        <div 
          onClick={() => setTabFilter('expired')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer select-none",
            tabFilter === 'expired'
              ? "bg-rose-500/10 border-rose-500 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{isRTL ? 'المنتهية صلاحيتهم' : 'Expired'}</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{subStats.expiredCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">{isRTL ? 'منتهي' : 'expired'}</span>
          </div>
        </div>

        <div 
          onClick={() => setTabFilter('packages')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer select-none",
            tabFilter === 'packages'
              ? "bg-purple-500/10 border-purple-500 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{isRTL ? 'باقات الساعات' : 'Hourly Packages'}</span>
            <Ticket className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">{subStats.packagesCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">
              {subStats.exhaustedCount > 0 ? `(${subStats.exhaustedCount} ${isRTL ? 'نفذت' : 'empty'})` : (isRTL ? 'باقة' : 'packages')}
            </span>
          </div>
        </div>

        <div 
          onClick={() => setTabFilter('due')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer select-none col-span-2 sm:col-span-1",
            tabFilter === 'due'
              ? "bg-amber-500/10 border-amber-500 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{isRTL ? 'مستحقات مالية' : 'Due Balances'}</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {subStats.hasDueCount} <span className="text-xs font-normal">{isRTL ? 'عميل' : 'due'}</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
              {formatCurrency(subStats.totalDueAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Status Tabs & Search / Filter Controls ── */}
      <div className="space-y-3 pt-2">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: isRTL ? 'الكل' : 'All', count: subStats.total },
            { id: 'active', label: isRTL ? 'النشطين' : 'Active', count: subStats.activeCount },
            { id: 'expired', label: isRTL ? 'المنتهية' : 'Expired', count: subStats.expiredCount },
            { id: 'packages', label: isRTL ? 'باقات ساعات' : 'Packages', count: subStats.packagesCount },
            { id: 'monthly', label: isRTL ? 'اشتراكات شهرية' : 'Monthly', count: subStats.monthlyCount },
            { id: 'due', label: isRTL ? 'عليهم متبقي' : 'Has Due', count: subStats.hasDueCount }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabFilter(tab.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border",
                tabFilter === tab.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-md font-mono font-black",
                tabFilter === tab.id
                  ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none", isRTL ? 'right-3.5' : 'left-3.5')} />
            <Input 
              placeholder={isRTL ? "البحث بالاسم، رقم الهاتف، كود العميل (#12)، أو الغرفة..." : "Search by name, phone, customer #ID, room..."}
              className={cn(
                "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl h-11 font-medium shadow-sm transition-colors", 
                isRTL ? 'pr-10 pl-9' : 'pl-10 pr-9'
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                  isRTL ? 'left-3' : 'right-3'
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Controls: Package Filter, Sort, View Toggle, Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Package Filter Select */}
            <select
              value={selectedPackageFilter}
              onChange={(e) => setSelectedPackageFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl h-10 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none"
            >
              <option value="all">{isRTL ? 'جميع أنواع الباقات' : 'All Package Types'}</option>
              <option value="monthly">{isRTL ? 'اشتراك شهري عادي' : 'Monthly Plan'}</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.totalHours}h)</option>
              ))}
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl h-10 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none"
            >
              <option value="newest">{isRTL ? 'الأحدث تسجيلاً' : 'Newest'}</option>
              <option value="oldest">{isRTL ? 'الأقدم تسجيلاً' : 'Oldest'}</option>
              <option value="name">{isRTL ? 'الاسم (أ - ي)' : 'Name (A-Z)'}</option>
              <option value="balance">{isRTL ? 'الأعلى رصيد ساعات' : 'Remaining Hours'}</option>
              <option value="expiring">{isRTL ? 'الأقرب انتهاءً' : 'Expiring Soon'}</option>
              <option value="due">{isRTL ? 'الأعلى متبقي مالي' : 'Highest Due'}</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title={isRTL ? 'عرض الجدول' : 'Table View'}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'table'
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Table className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title={isRTL ? 'عرض البطاقات' : 'Cards View'}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'cards'
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefreshSubs}
              disabled={isRefreshing}
              title={isRTL ? 'تحديث القائمة' : 'Refresh'}
              className="h-10 w-10 rounded-xl border-slate-200/80 dark:border-slate-800 text-slate-500 hover:text-cyan-600"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-cyan-500")} />
            </Button>
          </div>
        </div>

        {/* Results Counter and Active Filter Reset */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1 pt-1">
          <div>
            {isRTL ? (
              <span>
                عرض <strong className="text-slate-900 dark:text-white font-mono">{paginatedSubs.length}</strong> من إجمالي <strong className="text-slate-900 dark:text-white font-mono">{totalResults}</strong> مشترك مطابق
                {subscriptions.length !== totalResults && (
                  <span className="text-slate-400"> (من أصل {subscriptions.length} مشترك مسجل)</span>
                )}
              </span>
            ) : (
              <span>
                Showing <strong className="text-slate-900 dark:text-white font-mono">{paginatedSubs.length}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{totalResults}</strong> matching members
                {subscriptions.length !== totalResults && (
                  <span className="text-slate-400"> (out of {subscriptions.length} total)</span>
                )}
              </span>
            )}
          </div>

          {(searchTerm || tabFilter !== 'all' || selectedPackageFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setTabFilter('all');
                setSelectedPackageFilter('all');
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-bold"
            >
              <RotateCcw className="w-3 h-3" />
              {isRTL ? 'إعادة تعيين الفلاتر' : 'Reset Filters'}
            </button>
          )}
        </div>
      </div>

      {/* ── View 1: High-Density Table View ── */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-3.5 px-4 text-start font-black">{isRTL ? 'العميل' : 'Member'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'الهاتف' : 'Phone'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'نوع الاشتراك والغرفة' : 'Plan & Room'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'الصلاحية والتواريخ' : 'Validity & Dates'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'رصيد الساعات' : 'Hours Balance'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="py-3.5 px-3 text-start font-black">{isRTL ? 'الموقف المالي' : 'Financials'}</th>
                  <th className="py-3.5 px-4 text-end font-black">{isRTL ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {paginatedSubs.map(sub => {
                  const status = getSubStatus(sub);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Customer Name & Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs",
                            status.isExpired 
                              ? "bg-rose-500/10 text-rose-500" 
                              : "bg-cyan-500/10 text-cyan-500"
                          )}>
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white truncate">{sub.userName}</span>
                              {status.customerCode && (
                                <span className="text-[10px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.2 rounded-md font-mono shrink-0">
                                  {status.customerCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                        {sub.phoneNumber || '---'}
                      </td>

                      {/* Plan Type & Room */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border",
                            status.isPackage
                              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/40"
                              : "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-900/40"
                          )}>
                            {status.isPackage ? t('subs.package') : t('subs.monthly')}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <DoorOpen className="w-3 h-3 text-slate-400" />
                            {sub.roomName || 'Shared Space'}
                          </span>
                        </div>
                      </td>

                      {/* Validity Period & Remaining Days */}
                      <td className="py-3 px-3">
                        <div className="text-[11px] space-y-0.5">
                          <p className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                            {format(new Date(sub.startDate), 'MMM dd', { locale: dateLocale })} - {sub.endDate ? format(new Date(sub.endDate), 'MMM dd, yyyy', { locale: dateLocale }) : '---'}
                          </p>
                          {status.remainingDays !== null && (
                            <span className={cn(
                              "text-[10px] font-black inline-flex items-center gap-1 px-1.5 py-0.2 rounded",
                              status.isExpired
                                ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                                : status.remainingDays <= 3
                                  ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                  : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
                            )}>
                              <Timer className="w-3 h-3" />
                              {status.isExpired 
                                ? (isRTL ? `منتهي منذ ${Math.abs(status.remainingDays)} يوم` : `Expired ${Math.abs(status.remainingDays)}d ago`)
                                : (isRTL ? `باقي ${status.remainingDays} يوم` : `${status.remainingDays}d left`)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Hours Balance (Packages) */}
                      <td className="py-3 px-3">
                        {status.isPackage ? (
                          <div className="space-y-1 min-w-[110px]">
                            <div className="flex items-center justify-between text-[11px] font-black font-mono">
                              <span className={cn(
                                status.isExhausted ? "text-rose-500" : "text-purple-600 dark:text-purple-400"
                              )}>
                                {formatPackageBalance(status.remainingMinutes)}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                / {formatPackageBalance(status.totalMinutes)}
                              </span>
                            </div>
                            {(() => {
                              const pct = status.totalMinutes > 0 ? (status.remainingMinutes / status.totalMinutes) * 100 : 0;
                              return <Progress value={pct} className="h-1.5 bg-slate-100 dark:bg-slate-800" />;
                            })()}
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">
                            {isRTL ? 'غير محدود' : 'Unlimited'}
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3">
                        {status.isExpired ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                            <XCircle className="w-3 h-3" /> {t('subs.expired')}
                          </span>
                        ) : status.isExhausted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" /> {isRTL ? 'نفذت الساعات' : 'Out of Hours'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> {t('subs.active')}
                          </span>
                        )}
                      </td>

                      {/* Financials: Price, Paid, Due */}
                      <td className="py-3 px-3 font-mono">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[10px]">{isRTL ? 'سعر:' : 'Price:'}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{status.price} {t('common.currency')}</span>
                          </div>
                          {status.hasDue ? (
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-black text-[10px] bg-amber-500/10 px-1.5 py-0.2 rounded w-fit">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{isRTL ? 'متبقي: ' : 'Due: '}{status.remainingDue} {t('common.currency')}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {isRTL ? 'مسدد بالكامل' : 'Paid'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {status.hasDue && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setPayingSub(sub);
                                setCollectAmount(`${status.remainingDue}`);
                                setCollectMethod('cash');
                              }}
                              className="h-7 px-2 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm"
                            >
                              <DollarSign className="w-3 h-3 mr-0.5" />
                              {isRTL ? 'تحصيل' : 'Collect'}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(sub.id)}
                            className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View 2: Cards Grid View ── */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
          {paginatedSubs.map((sub) => {
            const status = getSubStatus(sub);

            return (
              <Card key={sub.id} className="relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden group hover:shadow-md transition-all duration-300 rounded-[1.75rem]">
                {/* Colored status wire strip */}
                <div className={cn(
                  "h-1.5 w-full", 
                  status.isExpired 
                    ? "bg-rose-500" 
                    : status.isExhausted 
                      ? "bg-amber-500" 
                      : "bg-gradient-to-r from-cyan-500 to-purple-500"
                )} />
                
                {/* Confirm Delete Inline Overlay */}
                {deletingId === sub.id && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center z-10 animate-in fade-in duration-200">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-full text-rose-500 mb-2.5">
                      <Trash2 className="w-5.5 h-5.5 animate-bounce" />
                    </div>
                    <h4 className="font-extrabold text-[13px] text-slate-900 dark:text-white mb-1">
                      {isRTL ? 'إلغاء الاشتراك؟' : 'Delete Subscription?'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-[200px] leading-relaxed">
                      {isRTL 
                        ? `هل أنت متأكد من رغبتك في حذف اشتراك العميل (${sub.userName}) من قاعدة البيانات؟`
                        : `Are you sure you want to delete subscription for ${sub.userName}?`}
                    </p>
                    <div className="flex gap-2 w-full max-w-[200px]">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 rounded-xl text-xs font-bold h-9 border-slate-200 dark:border-slate-800" 
                        onClick={() => setDeletingId(null)}
                      >
                        {isRTL ? 'تراجع' : 'Cancel'}
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex-1 rounded-xl text-xs font-bold h-9 text-white bg-rose-500 hover:bg-rose-600 border-none" 
                        onClick={() => {
                          handleDelete(sub.id);
                          setDeletingId(null);
                        }}
                      >
                        {isRTL ? 'حذف' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                )}

                <CardContent className="p-5">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                        status.isExpired ? "bg-rose-500/10 text-rose-500" : "bg-cyan-500/10 text-cyan-500"
                      )}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{sub.userName}</h3>
                          {status.customerCode && (
                            <span className="text-[10px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.2 rounded-md font-mono shrink-0">
                              {status.customerCode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">{sub.phoneNumber || '---'}</p>
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeletingId(sub.id)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Validity Badge & Status */}
                  <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 mb-3">
                    <div className="flex items-center gap-1.5">
                      {status.isExpired ? (
                        <span className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase tracking-wide">
                          <XCircle className="w-3.5 h-3.5" /> {t('subs.expired')}
                        </span>
                      ) : status.isExhausted ? (
                        <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-wide">
                          <Clock className="w-3.5 h-3.5" /> {isRTL ? 'نفذت الساعات' : 'Out of Hours'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-wide">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('subs.active')}
                        </span>
                      )}
                    </div>

                    {status.remainingDays !== null && (
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1",
                        status.isExpired 
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                          : status.remainingDays <= 3 
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse" 
                            : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                      )}>
                        <Timer className="w-3 h-3" />
                        {status.isExpired 
                          ? (isRTL ? `منتهي منذ ${Math.abs(status.remainingDays)} يوم` : `Expired ${Math.abs(status.remainingDays)}d ago`)
                          : status.remainingDays === 0
                            ? (isRTL ? 'ينتهي اليوم!' : 'Expires Today!')
                            : (isRTL ? `باقي ${status.remainingDays} يوم` : `${status.remainingDays} days left`)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{t('subs.type')}</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide shadow-inner",
                        status.isPackage
                          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-100/80 dark:border-purple-900/30"
                          : "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-300 border-cyan-100/80 dark:border-cyan-900/30"
                      )}>
                        {status.isPackage ? t('subs.package') : t('subs.monthly')}
                      </span>
                    </div>

                    {/* Linked Room */}
                    <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">{isRTL ? 'الغرفة المخصصة' : 'Assigned Room'}</span>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-200/50 font-bold text-[11px] px-2 py-0.5 flex items-center gap-1">
                        <DoorOpen className="w-3 h-3 text-purple-500" />
                        <span>{sub.roomName || 'Shared Space'}</span>
                      </Badge>
                    </div>
                    
                    {status.isPackage && (
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-500 dark:text-slate-400">{t('subs.remainingHours')}</span>
                          <span className={cn(
                            "font-extrabold font-mono",
                            status.isExhausted ? "text-rose-500" : "text-purple-600 dark:text-purple-400"
                          )}>
                            {formatPackageBalance(status.remainingMinutes)} / {formatPackageBalance(status.totalMinutes)}
                          </span>
                        </div>
                        {(() => {
                          const pct = status.totalMinutes > 0 ? (status.remainingMinutes / status.totalMinutes) * 100 : 0;
                          return <Progress value={pct} className="h-1.5 bg-slate-100 dark:bg-slate-800" />;
                        })()}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">{t('subs.period')}</span>
                      <span className="text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {format(new Date(sub.startDate), 'MMM dd', { locale: dateLocale })} - {sub.endDate ? format(new Date(sub.endDate), 'MMM dd, yyyy', { locale: dateLocale }) : '---'}
                      </span>
                    </div>

                    {sub.validityDays && (
                      <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                        <span className="text-slate-500 dark:text-slate-400">{isRTL ? 'مدة الصلاحية' : 'Validity Duration'}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                          {sub.validityDays} {isRTL ? 'يوم' : 'Days'}
                        </span>
                      </div>
                    )}
                    
                    {/* Financial Settlement & Revenue Breakdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400">{isRTL ? 'سعر الاشتراك' : 'Subscription Price'}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-black font-mono">
                          {status.price} {t('common.currency')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {isRTL ? 'المسدد' : 'Paid'}
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                          {status.paid} {t('common.currency')}
                        </span>
                      </div>

                      {status.hasDue ? (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{isRTL ? 'متبقي مستحق (Due)' : 'Outstanding Due'}</p>
                            <p className="text-xs font-black font-mono text-amber-700 dark:text-amber-300">{status.remainingDue} {t('common.currency')}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayingSub(sub);
                              setCollectAmount(`${status.remainingDue}`);
                              setCollectMethod('cash');
                            }}
                            className="h-7 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm"
                          >
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            {isRTL ? 'تحصيل' : 'Collect'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                          <span>{isRTL ? 'الحالة المالية' : 'Payment Status'}</span>
                          <span className="flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {isRTL ? 'مسدد بالكامل' : 'Fully Paid'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {paginatedSubs.length === 0 && (
        <div className="py-20 text-center text-slate-500 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-3">
          <CreditCard className="w-12 h-12 mx-auto opacity-20 text-slate-400" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{t('subs.noSubs')}</p>
          {(searchTerm || tabFilter !== 'all' || selectedPackageFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setTabFilter('all');
                setSelectedPackageFilter('all');
              }}
              className="rounded-xl font-bold text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {isRTL ? 'مسح الفلاتر والبحث' : 'Clear Filters & Search'}
            </Button>
          )}
        </div>
      )}

      {/* ── Pagination Controls ── */}
      {totalResults > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span>{isRTL ? 'عرض في الصفحة:' : 'Items per page:'}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg h-8 px-2 text-xs font-bold font-mono focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value="all">{isRTL ? 'الكل' : 'All'}</option>
            </select>
          </div>

          {/* Navigation */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 rounded-lg px-2.5 font-bold text-xs"
              >
                <ChevronRight className={cn("w-3.5 h-3.5", isRTL ? "" : "rotate-180")} />
                <span>{isRTL ? 'السابق' : 'Prev'}</span>
              </Button>

              <span className="font-mono font-bold px-2 text-slate-800 dark:text-slate-200">
                {validCurrentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 rounded-lg px-2.5 font-bold text-xs"
              >
                <span>{isRTL ? 'التالي' : 'Next'}</span>
                <ChevronLeft className={cn("w-3.5 h-3.5", isRTL ? "" : "rotate-180")} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Collect Due Payment Dialog */}
      <Dialog open={!!payingSub} onOpenChange={(open) => !open && setPayingSub(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <span>{isRTL ? 'تحصيل دفعة من اشتراك / باقة' : 'Collect Subscription Payment'}</span>
            </DialogTitle>
          </DialogHeader>

          {payingSub && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">{isRTL ? 'العميل:' : 'Customer:'}</span>
                  <span className="text-slate-900 dark:text-white font-black">{payingSub.userName}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">{isRTL ? 'إجمالي السعر:' : 'Total Price:'}</span>
                  <span className="font-mono text-slate-900 dark:text-white">{payingSub.price} ج.م</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">{isRTL ? 'المسدد سابقاً:' : 'Already Paid:'}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{payingSub.paidAmount || 0} ج.م</span>
                </div>
                <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                  <span>{isRTL ? 'المتبقي المستحق:' : 'Outstanding Due:'}</span>
                  <span className="font-mono font-black">
                    {payingSub.remainingAmount !== undefined ? payingSub.remainingAmount : (payingSub.price - (payingSub.paidAmount || 0))} ج.م
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'طريقة التحصيل' : 'Payment Method'}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectMethod('cash')}
                    className={cn(
                      "flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all",
                      collectMethod === 'cash'
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{isRTL ? 'كاش (Cash)' : 'Cash'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMethod('instapay')}
                    className={cn(
                      "flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-xs font-bold transition-all",
                      collectMethod === 'instapay'
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>InstaPay</span>
                  </button>
                </div>
              </div>

              {/* Amount to Pay */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'المبلغ المراد تحصيله الآن (ج.م)' : 'Amount to Collect Now (EGP)'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={payingSub.remainingAmount !== undefined ? payingSub.remainingAmount : (payingSub.price - (payingSub.paidAmount || 0))}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="h-11 rounded-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 text-base"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 flex-row justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPayingSub(null)}
                  disabled={isProcessingPayment}
                  className="rounded-xl font-bold text-xs h-10"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleRecordDuePayment}
                  disabled={isProcessingPayment}
                  className="rounded-xl font-bold text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center gap-2">
                      <Timer className="w-4 h-4 animate-spin" />
                      {isRTL ? 'جاري التسجيل...' : 'Processing...'}
                    </span>
                  ) : (
                    <span>{isRTL ? 'تأكيد تسجيل السداد' : 'Confirm Payment'}</span>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

