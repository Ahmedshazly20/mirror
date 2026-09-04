import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  DoorOpen
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
import { Customer } from '../types';
import { toast } from 'sonner';
import { format, addDays, isAfter, differenceInDays, differenceInCalendarDays } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { Progress } from '../components/ui/progress';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

export default function Subscriptions() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { subscriptions, settings, packages, customers } = useWorkspaceStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      await subscriptionService.createSubscription({
        userName: newSub.userName.trim(),
        phoneNumber: newSub.phoneNumber.trim(),
        customerId: linkedCustomerId || undefined,
        startDate: start,
        endDate: end,
        validityDays: durationDays,
        isActive: true,
        price,
        type: newSub.type,
        packageId: newSub.packageId || null,
        totalHours: totalHours || null,
        remainingHours: remainingHours || null,
        roomId: targetRoomId,
        roomName: targetRoomName
      });

      toast.success(t('subs.success'));
      setIsAdding(false);
      setSelectedCustomer(null);
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

  const handleDelete = async (id: string) => {
    try {
      await subscriptionService.deleteSubscription(id);
      toast.success(t('subs.removed'));
    } catch (err) {
      toast.error(t('subs.removeError'));
    }
  };

  // Find customer by phone or customerId or name for card display
  const getCustomerCode = (sub: typeof subscriptions[0]) => {
    if (sub.customerId) {
      const match = customers.find(c => c.id === sub.customerId);
      if (match) return `#${match.customerId}`;
    }
    if (sub.phoneNumber) {
      const match = customers.find(c => c.phone === sub.phoneNumber);
      if (match) return `#${match.customerId}`;
    }
    const matchName = customers.find(c => c.name.toLowerCase() === sub.userName.toLowerCase());
    if (matchName) return `#${matchName.customerId}`;
    return null;
  };

  const filteredSubs = useMemo(() => {
    if (!searchTerm.trim()) return subscriptions;
    const term = searchTerm.toLowerCase().trim();
    const cleanId = term.replace(/^#/, '');

    return subscriptions.filter(sub => {
      const matchName = sub.userName.toLowerCase().includes(term);
      const matchPhone = sub.phoneNumber && sub.phoneNumber.includes(term);
      
      // Match customer ID
      let matchId = false;
      const cust = customers.find(c => 
        (sub.customerId && c.id === sub.customerId) || 
        (sub.phoneNumber && c.phone === sub.phoneNumber)
      );
      if (cust && (cust.customerId.toString() === cleanId || cust.customerId.toString().includes(cleanId))) {
        matchId = true;
      }

      return matchName || matchPhone || matchId;
    });
  }, [subscriptions, searchTerm, customers]);

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

      {/* Subscriptions Search Panel */}
      <div className="relative max-w-md">
        <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none", isRTL ? 'right-3.5' : 'left-3.5')} />
        <Input 
          placeholder={isRTL ? "البحث بالاسم أو رقم الهاتف أو كود العميل (#12)..." : "Search by name, phone, or customer #ID..."}
          className={cn(
            "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl h-11 font-medium shadow-sm transition-colors duration-200", 
            isRTL ? 'pr-10' : 'pl-10'
          )}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Existing subscriptions list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {filteredSubs.map((sub) => {
          const endDateObj = sub.endDate ? new Date(sub.endDate) : null;
          const isExpired = endDateObj ? isAfter(new Date(), endDateObj) : false;
          const remainingDays = endDateObj ? differenceInCalendarDays(endDateObj, new Date()) : null;
          const customerCode = getCustomerCode(sub);

          return (
            <Card key={sub.id} className="relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden group hover:shadow-md transition-all duration-300 rounded-[1.75rem]">
              {/* Colored status wire strip */}
              <div className={cn("h-1.5 w-full", isExpired ? "bg-rose-500" : "bg-gradient-to-r from-cyan-500 to-purple-500")} />
              
              {/* Premium Confirm Delete Inline Overlay */}
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
                      isExpired ? "bg-rose-500/10 text-rose-500" : "bg-cyan-500/10 text-cyan-500"
                    )}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{sub.userName}</h3>
                        {customerCode && (
                          <span className="text-[10px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.2 rounded-md font-mono shrink-0">
                            {customerCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">{sub.phoneNumber || '---'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeletingId(sub.id)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Validity Badge & Status */}
                <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 mb-3">
                  <div className="flex items-center gap-1.5">
                    {isExpired ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase tracking-wide">
                        <XCircle className="w-3.5 h-3.5" /> {t('subs.expired')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-wide">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('subs.active')}
                      </span>
                    )}
                  </div>

                  {remainingDays !== null && (
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1",
                      isExpired 
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                        : remainingDays <= 3 
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse" 
                          : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                    )}>
                      <Timer className="w-3 h-3" />
                      {isExpired 
                        ? (isRTL ? `منتهي منذ ${Math.abs(remainingDays)} يوم` : `Expired ${Math.abs(remainingDays)}d ago`)
                        : remainingDays === 0
                          ? (isRTL ? 'ينتهي اليوم!' : 'Expires Today!')
                          : (isRTL ? `باقي ${remainingDays} يوم` : `${remainingDays} days left`)}
                    </span>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>{t('subs.type')}</span>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide shadow-inner",
                      sub.type === 'package'
                        ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-100/80 dark:border-purple-900/30"
                        : "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-300 border-cyan-100/80 dark:border-cyan-900/30"
                    )}>
                      {sub.type === 'package' ? t('subs.package') : t('subs.monthly')}
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
                  
                  {sub.type === 'package' && sub.totalHours !== undefined && sub.remainingHours !== undefined && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500 dark:text-slate-400">{t('subs.remainingHours')}</span>
                        <span className="text-purple-600 dark:text-purple-400 font-extrabold">{sub.remainingHours} / {sub.totalHours} {t('common.hours')}</span>
                      </div>
                      <Progress value={sub.totalHours > 0 ? (sub.remainingHours / sub.totalHours) * 100 : 0} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
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
                  
                  <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                    <span className="text-slate-500 dark:text-slate-400">{t('subs.pricePaid')}</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-black">
                      {sub.price} {t('common.currency')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredSubs.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="font-bold text-sm">{t('subs.noSubs')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

