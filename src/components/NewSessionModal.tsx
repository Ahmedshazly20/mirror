import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../store';
import { sessionService } from '../services/sessionService';
import {
  User, Crown, Check, Zap, Clock, Calculator,
  Phone, DoorOpen, Table2, Users, Search, ChevronDown,
  X, Sparkles, CheckCircle2, Hash, ArrowRight, History,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Customer } from '../types';
import { pricingService, mapRoomToPricingKey, DEFAULT_PRICING_TABLE } from '../services/pricingService';
import { checkRoomConflictInMemory } from '../services/roomAvailabilityService';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewSessionModal({ isOpen, onClose }: NewSessionModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');

  // ─── Workspace Store ─────────────────────────────────────────────────────
  const { settings, sessions: activeSessions, bookings, subscriptions, customers, rooms } = useWorkspaceStore();

  // ─── Available Rooms (settings or fallback) ──────────────────────────────
  const availableRooms = useMemo(() => {
    return (rooms && rooms.length > 0) ? rooms : (settings.rooms || []);
  }, [rooms, settings.rooms]);

  // ─── Form State ──────────────────────────────────────────────────────────
  const [userName, setUserName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [pricingType, setPricingType] = useState<'hourly' | 'daily'>('hourly');
  const [durationMode, setDurationMode] = useState<'fixed' | 'full_day' | 'open'>('fixed');
  const [selectedHours, setSelectedHours] = useState<number>(4);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isMemberPopoverOpen, setIsMemberPopoverOpen] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  // ─── Customer Search State ───────────────────────────────────────────────
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ─── Room / Table State ───────────────────────────────────────────────────
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [groupSizeError, setGroupSizeError] = useState(false);

  // ─── Filtered Active Subscriptions ───────────────────────────────────────
  const activeSubs = useMemo(() => subscriptions.filter(s => s.isActive), [subscriptions]);

  const filteredSubs = useMemo(() => {
    return activeSubs.filter(sub => 
      sub.userName.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      sub.phoneNumber.includes(memberSearchTerm)
    );
  }, [activeSubs, memberSearchTerm]);

  const selectedSub = useMemo(() => {
    return subscriptions.find(s => s.id === selectedSubId) || null;
  }, [subscriptions, selectedSubId]);

  // When selected subscription changes, if it has a linked roomId, auto select that room
  useEffect(() => {
    if (isSubscribed && selectedSub?.roomId && selectedSub.roomId !== 'shared_space') {
      setSelectedRoomId(selectedSub.roomId);
      setSelectedTableId('');
    }
  }, [isSubscribed, selectedSub]);

  // Is there a mismatch between the chosen room and the subscription's room?
  const isPackageRoomMismatch = useMemo(() => {
    if (!isSubscribed || !selectedSub || !selectedSub.roomId || selectedSub.roomId === 'shared_space') {
      return false;
    }
    return selectedRoomId !== selectedSub.roomId;
  }, [isSubscribed, selectedSub, selectedRoomId]);

  // Calculated requested time window for this new session
  const requestedDurationHours = durationMode === 'fixed' ? selectedHours : (durationMode === 'full_day' ? 8 : 1);
  const nowMillis = useMemo(() => Date.now(), [isOpen, selectedHours, durationMode]);
  const reqEndMillis = nowMillis + requestedDurationHours * 3600 * 1000;

  // Check room conflict for the currently selected room
  const currentRoomConflict = useMemo(() => {
    if (!selectedRoomId) return { hasConflict: false };
    return checkRoomConflictInMemory(
      selectedRoomId,
      nowMillis,
      reqEndMillis,
      bookings,
      activeSessions,
      { roomName: availableRooms.find(r => r.id === selectedRoomId)?.name }
    );
  }, [selectedRoomId, nowMillis, reqEndMillis, bookings, activeSessions, availableRooms]);

  // ─── Filtered Customers for Search Dropdown ──────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return [];
    const term = customerSearchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/^#/, '');

    return customers.filter(c => {
      const matchId = c.customerId?.toString().includes(cleanTerm);
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = c.phone.includes(cleanTerm) || c.phone.includes(term);
      const matchEmail = c.email ? c.email.toLowerCase().includes(term) : false;
      return matchId || matchName || matchPhone || matchEmail;
    }).slice(0, 8);
  }, [customers, customerSearchTerm]);

  // Handle selecting a customer from search
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setUserName(customer.name);
    setPhoneNumber(customer.phone);
    setPhoneError(false);
    setCustomerSearchTerm('');
    setIsSearchFocused(false);

    // Look for active subscription or package for this customer
    const matchingSub = activeSubs.find(s => 
      (s.customerId && s.customerId === customer.id) ||
      s.phoneNumber === customer.phone ||
      s.userName.toLowerCase() === customer.name.toLowerCase()
    );

    if (matchingSub) {
      setIsSubscribed(true);
      setSelectedSubId(matchingSub.id);
      toast.success(
        isRTL 
          ? `تم تحديد العميل #${customer.customerId} (${customer.name}) وتفعيل ${matchingSub.type === 'package' ? 'باقة الساعات' : 'الاشتراك الشهري'} تلقائياً` 
          : `Selected #${customer.customerId} (${customer.name}) and linked active subscription`
      );
    } else {
      setIsSubscribed(false);
      setSelectedSubId('');
      toast.success(
        isRTL
          ? `تم اختيار العميل #${customer.customerId} (${customer.name})`
          : `Selected customer #${customer.customerId} (${customer.name})`
      );
    }
  };

  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setUserName('');
    setPhoneNumber('');
    setIsSubscribed(false);
    setSelectedSubId('');
    setCustomerSearchTerm('');
  };

  // Close search suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Try to auto-select sub based on phone if subscribed toggle is enabled
  useMemo(() => {
    if (isSubscribed && phoneNumber.length >= 11) {
      const found = activeSubs.find(s => s.phoneNumber === phoneNumber);
      if (found) {
        setSelectedSubId(found.id);
        if (!userName) setUserName(found.userName);
      }
    }
  }, [isSubscribed, phoneNumber, activeSubs]);

  // ─── Derived: currently occupied table IDs in selected room ──────────────
  const occupiedTableIds = useMemo(() => {
    if (!selectedRoomId) return new Set<string>();
    return new Set(
      activeSessions
        .filter(s => s.roomAssignment?.roomId === selectedRoomId)
        .map(s => s.roomAssignment?.tableId)
        .filter(Boolean) as string[]
    );
  }, [activeSessions, selectedRoomId]);

  const selectedRoom = availableRooms.find(r => r.id === selectedRoomId);
  const selectedTable = selectedRoom?.tables?.find(t => t.id === selectedTableId);

  // ─── Validation ───────────────────────────────────────────────────────────
  const validatePhone = (phone: string) =>
    /^01[0125][0-9]{8}$/.test(phone);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone(phoneNumber)) {
      setPhoneError(true);
      return;
    }

    if (selectedTable && groupSize > selectedTable.capacity) {
      setGroupSizeError(true);
      return;
    }

    if (isPackageRoomMismatch && selectedSub) {
      toast.error(
        isRTL
          ? `هذه الباقة مقيدة بغرفة (${selectedSub.roomName || 'الغرفة المحددة'}) فقط ولا يمكن استخدامها في (${selectedRoom?.name || 'غرفة أخرى'}).`
          : `This package is restricted to (${selectedSub.roomName || 'assigned room'}) only.`
      );
      return;
    }

    if (selectedRoomId && currentRoomConflict.hasConflict) {
      toast.error(
        currentRoomConflict.errorMessage || 
        (isRTL ? 'تعارض في المواعيد: الغرفة غير متاحة للفترة المطلوبة' : 'Room is not available for the requested period.')
      );
      return;
    }

    let roomAssignment = null;
    if (selectedRoomId) {
      const roomName = selectedRoom?.name || 'غرفة';
      const tableLabel = selectedTable?.label || (selectedTable ? `${t('newSession.table')} ${selectedTable.number}` : roomName);
      roomAssignment = {
        roomId: selectedRoomId,
        roomName: roomName,
        tableId: selectedTableId || '',
        tableNumber: selectedTable?.number || 0,
        tableLabel: tableLabel,
        groupSize: groupSize || 1,
      };
    }

    try {
      if (isSubscribed && selectedSubId) {
        const sub = subscriptions.find(s => s.id === selectedSubId);
        if (sub?.type === 'package' && (sub.remainingHours || 0) <= 0) {
          toast.error(t('packages.insufficientHours') || 'Package hours exceeded');
          return;
        }
      }

      await sessionService.startSession(
        userName.trim(),
        phoneNumber.trim(),
        durationMode === 'full_day' ? 'daily' : 'hourly',
        isSubscribed,
        whatsappOptIn,
        roomAssignment,
        selectedSubId || undefined,
        selectedCustomer?.id || undefined,
        undefined,
        undefined,
        undefined,
        durationMode,
        durationMode === 'fixed' ? selectedHours : undefined
      );
      toast.success(t('newSession.started'));
      resetForm();
      onClose();
    } catch (err) {
      toast.error(t('newSession.error'));
    }
  };

  const resetForm = () => {
    setUserName('');
    setPhoneNumber('');
    setWhatsappOptIn(true);
    setPricingType('hourly');
    setDurationMode('fixed');
    setSelectedHours(4);
    setIsSubscribed(false);
    setSelectedSubId('');
    setPhoneError(false);
    setSelectedRoomId('');
    setSelectedTableId('');
    setGroupSize(1);
    setGroupSizeError(false);
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setIsSearchFocused(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800
                   text-slate-900 dark:text-white sm:max-w-[540px] overflow-hidden
                   rounded-[2rem] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {t('newSession.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Customer Search Section (ID / Name / Phone) ──────────────── */}
          <div ref={searchContainerRef} className="relative space-y-2">
            <div className="flex items-center justify-between px-1">
              <Label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Search className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isRTL ? 'بحث سريع عن عميل مسجل (اسم / هاتف / كود ID)' : 'Quick Customer Search (Name / Phone / ID)'}</span>
              </Label>
              {customers.length > 0 && (
                <span className="text-[11px] font-bold text-slate-400">
                  {isRTL ? `${customers.length} عميل مسجل` : `${customers.length} registered`}
                </span>
              )}
            </div>

            <div className="relative group">
              <Search className={cn(
                "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors pointer-events-none",
                isRTL ? "right-4" : "left-4"
              )} />
              <Input
                ref={searchInputRef}
                placeholder={isRTL ? 'اكتب اسم العميل، رقم الهاتف، أو كود ID (#101)...' : 'Search by name, phone, or customer ID (#101)...'}
                value={customerSearchTerm}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsSearchFocused(true);
                }}
                className={cn(
                  "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-12 rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all font-medium text-sm",
                  isRTL ? "pr-11 pl-10" : "pl-11 pr-10"
                )}
              />
              {customerSearchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
                    isRTL ? "left-3" : "right-3"
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Search Results Dropdown */}
            <AnimatePresence>
              {isSearchFocused && customerSearchTerm.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border-2 border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60"
                >
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(cust => {
                      const custSub = activeSubs.find(s => 
                        (s.customerId && s.customerId === cust.id) ||
                        s.phoneNumber === cust.phone ||
                        s.userName.toLowerCase() === cust.name.toLowerCase()
                      );

                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full p-3 flex items-center justify-between hover:bg-cyan-50/80 dark:hover:bg-cyan-950/30 transition-all text-right group cursor-pointer"
                        >
                          <div className={cn("flex items-center gap-3", isRTL ? "flex-row" : "flex-row-reverse")}>
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black text-sm shrink-0 group-hover:scale-105 transition-transform">
                              #{cust.customerId}
                            </div>
                            <div className={cn("text-right", !isRTL && "text-left")}>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors">
                                  {cust.name}
                                </p>
                                {custSub && (
                                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 rounded-md font-bold">
                                    {custSub.type === 'package' ? (isRTL ? `باقة ${custSub.remainingHours}H` : `Pkg ${custSub.remainingHours}H`) : (isRTL ? 'مشترك شهري' : 'Monthly')}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cust.phone}
                                </span>
                                {cust.totalVisits ? (
                                  <span className="text-[10px] text-slate-400 font-sans">
                                    {isRTL ? `${cust.totalVisits} زيارة` : `${cust.totalVisits} visits`}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 group-hover:bg-cyan-500 group-hover:text-white px-2.5 py-1 rounded-xl transition-all">
                              {isRTL ? 'اختيار' : 'Select'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {isRTL ? 'لم يتم العثور على عميل مطابق' : 'No matching customer found'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {isRTL ? 'يمكنك كتابة بيانات العميل الجديد بالأسفل مباشرة لبدء الجلسة.' : 'You can enter new customer details below to start.'}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Customer Banner */}
            {selectedCustomer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    #{selectedCustomer.customerId}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedCustomer.name}
                      </p>
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0 rounded font-bold">
                        {isRTL ? 'عميل محدد' : 'Selected'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{selectedCustomer.phone}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSelectedCustomer}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 rounded-xl px-2"
                >
                  <X className="w-3.5 h-3.5 ml-1 mr-1" />
                  <span>{isRTL ? 'تغيير' : 'Change'}</span>
                </Button>
              </motion.div>
            )}
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {isRTL ? 'بيانات الجلسة' : 'Session Details'}
            </span>
            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
          </div>

          {/* ── Customer Name ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">
              {t('newSession.customerName')}
            </Label>
            <div className="relative group">
              <User className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-cyan-500 transition-colors`} />
              <Input
                placeholder={t('newSession.namePlaceholder')}
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                    setSelectedCustomer(null);
                  }
                }}
                className={`bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800
                            text-slate-900 dark:text-white h-14
                            ${isRTL ? 'pr-12' : 'pl-12'}
                            rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500
                            transition-all font-medium text-base`}
                required
              />
            </div>
          </div>

          {/* ── Phone Number ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">
              {t('newSession.phoneNumber')}
            </Label>
            <div className="relative group">
              <Phone className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-cyan-500 transition-colors`} />
              <Input
                type="tel"
                placeholder={t('newSession.phonePlaceholder')}
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (phoneError) setPhoneError(false);
                  if (selectedCustomer && e.target.value !== selectedCustomer.phone) {
                    setSelectedCustomer(null);
                  }
                }}
                className={`bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800
                            text-slate-900 dark:text-white h-14
                            ${isRTL ? 'pr-12' : 'pl-12'}
                            rounded-2xl focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500
                            transition-all font-mono font-bold text-base
                            ${phoneError ? 'border-rose-500 ring-4 ring-rose-500/10' : ''}`}
                required
              />
            </div>
            {phoneError && (
              <p className="text-[10px] text-rose-500 font-bold px-1">
                {t('sessions.invalidPhone')}
              </p>
            )}
          </div>

          {/* ── Room Selection ────────────────────────────────────────────── */}
          {availableRooms && availableRooms.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-cyan-500" />
                {t('newSession.selectRoom')}
                <span className="text-slate-400 font-normal text-xs">({t('newSession.optional')})</span>
              </Label>

              {/* Room Pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedRoomId(''); setSelectedTableId(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2
                    ${!selectedRoomId
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                >
                  {t('newSession.noRoom')}
                </button>

                {availableRooms.map(room => {
                  const occupiedCount = activeSessions.filter(
                    s => s.roomAssignment?.roomId === room.id
                  ).length;
                  const totalTables = room.tables?.length || 0;
                  const isFull = totalTables > 0 && occupiedCount >= totalTables;

                  const roomConflict = checkRoomConflictInMemory(
                    room.id,
                    nowMillis,
                    reqEndMillis,
                    bookings,
                    activeSessions,
                    { roomName: room.name }
                  );

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        if (isFull) return;
                        setSelectedRoomId(room.id);
                        setSelectedTableId('');
                      }}
                      disabled={isFull}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2
                        ${selectedRoomId === room.id
                          ? (roomConflict.hasConflict 
                              ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400' 
                              : 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400')
                          : isFull
                            ? 'bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                            : roomConflict.hasConflict
                              ? 'bg-rose-500/5 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:border-rose-500'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50'
                        }`}
                    >
                      <span>{room.name}</span>
                      {totalTables > 0 && (
                        <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-xs opacity-70`}>
                          {occupiedCount}/{totalTables}
                        </span>
                      )}
                      {roomConflict.hasConflict && (
                        <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md mr-1 font-extrabold">
                          {isRTL ? 'تعارض موعد' : 'Conflict'}
                        </span>
                      )}
                      {isFull && !roomConflict.hasConflict && (
                        <span className="text-xs bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md mr-1">
                          {t('newSession.full')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Package room constraint notice */}
              {isPackageRoomMismatch && selectedSub && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {isRTL ? 'تنبيه ارتباط الباقة:' : 'Package Room Restriction:'}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      {isRTL
                        ? `هذه الباقة مقيدة للاستخدام في (${selectedSub.roomName || 'الغرفة المحددة'}) فقط.`
                        : `This package is linked to (${selectedSub.roomName || 'assigned room'}) only.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Real-time Room Conflict Banner */}
              {selectedRoomId && currentRoomConflict.hasConflict && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{isRTL ? 'تعارض في المواعيد (الغرفة غير متاحة للفترة بالكامل)' : 'Room Booking Conflict (Room unavailable for entire period)'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
                    {currentRoomConflict.errorMessage}
                  </p>
                </div>
              )}

              {/* Automatic Room Pricing Badge */}
              {selectedRoom && (
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {isRTL ? `تسعير المكان التلقائي (${selectedRoom.name}):` : `Automatic Room Pricing (${selectedRoom.name}):`}
                    </span>
                  </div>
                  <span className="font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-xl">
                    {selectedRoom.pricePerHour} {isRTL ? 'ج.م / ساعة' : 'EGP / hr'}
                  </span>
                </div>
              )}

              {/* Table Grid */}
              <AnimatePresence>
                {selectedRoomId && selectedRoom?.tables && selectedRoom.tables.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-2">
                      <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-cyan-500" />
                        {t('newSession.selectTable')}
                      </Label>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {selectedRoom.tables.map(table => {
                          const isOccupied = occupiedTableIds.has(table.id);
                          const isSelected = selectedTableId === table.id;

                          // Find session at this table
                          const occupant = isOccupied
                            ? activeSessions.find(s => s.roomAssignment?.tableId === table.id)
                            : null;

                          return (
                            <button
                              key={table.id}
                              type="button"
                              disabled={false} // Allow clicking occupied tables to add to group
                              onClick={() => setSelectedTableId(table.id)}
                              className={`relative p-3 rounded-2xl border-2 text-center transition-all
                                ${isSelected
                                  ? 'bg-cyan-500/10 border-cyan-500 shadow-md shadow-cyan-500/10'
                                  : isOccupied
                                    ? 'bg-amber-500/5 border-amber-500/50 hover:border-amber-500'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40'
                                }`}
                              title={isOccupied ? `${occupant?.userName} — ${occupant?.roomAssignment?.groupSize} ${t('newSession.people')}` : ''}
                            >
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              <Table2 className={`w-5 h-5 mx-auto mb-1
                                ${isSelected ? 'text-cyan-500'
                                  : isOccupied ? 'text-amber-500'
                                  : 'text-slate-400'}`}
                              />
                              <div className={`text-xs font-bold
                                ${isSelected ? 'text-cyan-600 dark:text-cyan-400'
                                  : isOccupied ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-600 dark:text-slate-400'}`}
                              >
                                {table.label || `${table.number}`}
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {isOccupied
                                  ? `${occupant?.userName?.split(' ')[0]}`
                                  : `${table.capacity} ${t('newSession.seats')}`}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Occupied table note */}
                      {selectedTableId && occupiedTableIds.has(selectedTableId) && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ {t('newSession.tableOccupied')} —{' '}
                          {activeSessions.find(s => s.roomAssignment?.tableId === selectedTableId)?.userName}{' '}
                          {t('newSession.alreadyThere')}. {t('newSession.addingToGroup')}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Group Size */}
              <AnimatePresence>
                {selectedTableId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-1">
                      <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-500" />
                        {t('newSession.groupSize')}
                        {selectedTable && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({t('newSession.maxCapacity')}: {selectedTable.capacity})
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={selectedTable?.capacity || 99}
                        value={groupSize}
                        onChange={(e) => {
                          setGroupSize(parseInt(e.target.value) || 1);
                          if (groupSizeError) setGroupSizeError(false);
                        }}
                        className={`bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800
                                    text-slate-900 dark:text-white h-12 rounded-2xl
                                    focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500
                                    ${groupSizeError ? 'border-rose-500' : ''}`}
                      />
                      {groupSizeError && (
                        <p className="text-[10px] text-rose-500 font-bold px-1">
                          {t('newSession.groupSizeExceeds')} ({selectedTable?.capacity})
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Subscriber / Guest Toggle ─────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1">
              {t('newSession.monthlySubscriber')}
            </Label>
            <div className="grid grid-cols-2 gap-4">
              {/* Guest */}
              <button
                type="button"
                onClick={() => setIsSubscribed(false)}
                className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-300
                  ${!isSubscribed
                    ? 'bg-cyan-500/5 border-cyan-500 shadow-md shadow-cyan-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
              >
                {!isSubscribed && (
                  <motion.div layoutId="scheck" className="absolute top-3 right-3 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}
                <User className={`w-8 h-8 mb-2 ${!isSubscribed ? 'text-cyan-500' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${!isSubscribed ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`}>
                  {t('sessions.guest')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">{t('newSession.pricingPlan')}</span>
              </button>

              {/* Subscriber */}
              <button
                type="button"
                onClick={() => setIsSubscribed(true)}
                className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-300
                  ${isSubscribed
                    ? 'bg-amber-500/5 border-amber-500 shadow-md shadow-amber-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
              >
                {isSubscribed && (
                  <motion.div layoutId="scheck" className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}
                <Crown className={`w-8 h-8 mb-2 ${isSubscribed ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${isSubscribed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                  {t('sessions.subscriber')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">{t('newSession.subscriberDesc')}</span>
              </button>
            </div>
          </div>

          {/* ── Subscription Picker ────────────────────────────────────────── */}
          <AnimatePresence>
            {isSubscribed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="space-y-3 overflow-hidden p-4 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/20"
              >
                <Popover open={isMemberPopoverOpen} onOpenChange={setIsMemberPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      role="combobox"
                      aria-expanded={isMemberPopoverOpen}
                      className="w-full h-28 rounded-[2.5rem] bg-white dark:bg-slate-900 border-amber-500/20 hover:border-amber-500 transition-all font-bold group shadow-sm flex items-center justify-between px-8"
                    >
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 rounded-[2rem] bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                            <Users className="w-8 h-8 text-amber-500" />
                         </div>
                         <div className={cn("text-left", isRTL && "text-right")}>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">{t('subs.select')}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white truncate max-w-[280px]">
                               {selectedSubId ? activeSubs.find(s => s.id === selectedSubId)?.userName : t('subs.searchPlaceholder')}
                            </p>
                         </div>
                      </div>
                      <ChevronDown className="ml-2 h-7 w-7 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[500px] max-w-[95vw] p-0 rounded-[3rem] border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden bg-white dark:bg-slate-900"
                    align="center"
                  >
                    <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="relative">
                        <Search className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400",
                          isRTL ? "right-6" : "left-6"
                        )} />
                        <Input 
                          placeholder={t('subs.searchPlaceholder')}
                          value={memberSearchTerm}
                          onChange={(e) => setMemberSearchTerm(e.target.value)}
                          className={cn(
                            "h-16 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold focus:ring-8 focus:ring-amber-500/5 transition-all text-xl shadow-sm border-2",
                            isRTL ? "pr-16" : "pl-16"
                          )}
                        />
                      </div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                      {filteredSubs.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubId(sub.id);
                            setUserName(sub.userName);
                            setPhoneNumber(sub.phoneNumber);
                            setIsMemberPopoverOpen(false);
                            setMemberSearchTerm('');
                          }}
                          className={cn(
                            "w-full p-6 rounded-[2.5rem] flex items-center justify-between group transition-all duration-300",
                            selectedSubId === sub.id 
                              ? "bg-amber-500/10 border-2 border-amber-500/50" 
                              : "hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent"
                          )}
                        >
                          <div className={cn("flex items-center gap-6", isRTL ? "flex-row-reverse" : "")}>
                             <div className={cn(
                               "w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl transition-all duration-500 shadow-inner",
                               sub.type === 'package' ? "bg-cyan-500/10 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white" : "bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white"
                             )}>
                               {sub.userName[0].toUpperCase()}
                             </div>
                             <div className={cn("text-left", isRTL && "text-right")}>
                                <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-2 group-hover:text-amber-600 transition-colors">{sub.userName}</p>
                                <p className="text-sm font-bold text-slate-400 flex items-center gap-2 px-0.5">
                                   <Phone className="w-4 h-4 text-slate-300" /> {sub.phoneNumber}
                                </p>
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-3">
                             <Badge className={cn(
                               "rounded-full px-5 py-1.5 text-[11px] font-black uppercase tracking-widest border-none shadow-sm",
                               sub.type === 'package' ? "bg-cyan-500 text-white" : "bg-indigo-500 text-white"
                             )}>
                               {sub.type === 'package' ? t('subs.package') : t('subs.monthly')}
                             </Badge>
                             {sub.type === 'package' && (
                               <div className="text-xs font-black text-emerald-600 bg-emerald-500/10 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-inner">
                                  <Clock className="w-4 h-4" /> {sub.remainingHours}H
                                </div>
                             )}
                          </div>
                        </button>
                      ))}
                      {filteredSubs.length === 0 && (
                        <div className="py-20 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 m-2">
                           <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm grayscale opacity-30">
                              <Users className="w-10 h-10 text-slate-400" />
                           </div>
                           <p className="text-slate-900 dark:text-white text-lg font-black">{t('subs.noSubs')}</p>
                           <p className="text-slate-400 text-sm font-medium mt-1">Try another search term...</p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Duration & Pricing Mode (guests only) ────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!isSubscribed ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between px-1">
                  <Label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-500" />
                    <span>{isRTL ? 'هتقعد كام ساعة؟ (مدة الجلسة)' : 'Session Duration & Pricing'}</span>
                  </Label>
                  {durationMode === 'fixed' && (
                    <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full">
                      {selectedHours} {isRTL ? (selectedHours === 1 ? 'ساعة' : selectedHours === 2 ? 'ساعتان' : selectedHours <= 10 ? 'ساعات' : 'ساعة') : 'Hours'} — {pricingService.calculateSessionModeCost(selectedRoom || 'shared_space', 'fixed', selectedHours, selectedHours * 60, settings.pricingRules || DEFAULT_PRICING_TABLE)} EGP
                    </span>
                  )}
                </div>

                {/* 3 Main Duration Modes */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* 1. Fixed Duration */}
                  <button
                    type="button"
                    onClick={() => {
                      setDurationMode('fixed');
                      setPricingType('hourly');
                    }}
                    className={`relative p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5
                      ${durationMode === 'fixed'
                        ? 'bg-cyan-500/10 border-cyan-500 shadow-md shadow-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40'
                      }`}
                  >
                    {durationMode === 'fixed' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <Clock className={`w-5 h-5 ${durationMode === 'fixed' ? 'text-cyan-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-black">{isRTL ? 'مدة محددة' : 'Fixed Time'}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{isRTL ? '1 إلى 8 ساعات' : '1 - 8 Hours'}</span>
                  </button>

                  {/* 2. Full Day */}
                  <button
                    type="button"
                    onClick={() => {
                      setDurationMode('full_day');
                      setPricingType('daily');
                    }}
                    className={`relative p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5
                      ${durationMode === 'full_day'
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-md shadow-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-500/40'
                      }`}
                  >
                    {durationMode === 'full_day' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <Zap className={`w-5 h-5 ${durationMode === 'full_day' ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-black">{isRTL ? 'يوم كامل' : 'Full Day'}</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {pricingService.getFullDayPrice(selectedRoom || 'shared_space', settings.pricingRules || DEFAULT_PRICING_TABLE)} EGP
                    </span>
                  </button>

                  {/* 3. Open Session */}
                  <button
                    type="button"
                    onClick={() => {
                      setDurationMode('open');
                      setPricingType('hourly');
                    }}
                    className={`relative p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5
                      ${durationMode === 'open'
                        ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
                      }`}
                  >
                    {durationMode === 'open' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <Calculator className={`w-5 h-5 ${durationMode === 'open' ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-black">{isRTL ? 'جلسة مفتوحة' : 'Open Time'}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      {pricingService.getHourlyRate(selectedRoom || 'shared_space', settings.pricingRules || DEFAULT_PRICING_TABLE)} EGP/h
                    </span>
                  </button>
                </div>

                {/* Sub-selector for Fixed Duration */}
                {durationMode === 'fixed' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                      {isRTL ? 'اختر عدد الساعات المطلوب:' : 'Select Duration (Hours):'}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => {
                        const price = pricingService.calculateSessionModeCost(
                          selectedRoom || 'shared_space',
                          'fixed',
                          h,
                          h * 60,
                          settings.pricingRules || DEFAULT_PRICING_TABLE
                        );
                        const isSelected = selectedHours === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setSelectedHours(h)}
                            className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center
                              ${isSelected
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20 scale-105'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-500/50'
                              }`}
                          >
                            <span className="text-xs font-black">
                              {h}{isRTL ? ' س' : 'h'}
                            </span>
                            <span className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-cyan-100' : 'text-cyan-600 dark:text-cyan-400'}`}>
                              {price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Sub-info for Full Day */}
                {durationMode === 'full_day' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
                      <Zap className="w-4 h-4 text-indigo-500" />
                      <span>{isRTL ? 'يوم كامل حتى 8 ساعات' : 'Full Day package up to 8 billable hours'}</span>
                    </div>
                    <div className="font-black text-sm text-indigo-600 dark:text-indigo-400">
                      {pricingService.getFullDayPrice(selectedRoom || 'shared_space', settings.pricingRules || DEFAULT_PRICING_TABLE)} EGP
                    </div>
                  </motion.div>
                )}

                {/* Sub-info for Open Session */}
                {durationMode === 'open' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
                      <Calculator className="w-4 h-4 text-amber-500" />
                      <span>{isRTL ? 'حساب الوقت الفعلي حسب الساعة' : 'Billed according to actual elapsed time'}</span>
                    </div>
                    <div className="font-black text-sm text-amber-600 dark:text-amber-400">
                      {pricingService.getHourlyRate(selectedRoom || 'shared_space', settings.pricingRules || DEFAULT_PRICING_TABLE)} EGP / {isRTL ? 'ساعة' : 'hr'}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400/80 leading-relaxed font-medium">
                  {t('newSession.subscriberMode')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Footer Buttons ────────────────────────────────────────────── */}
          <DialogFooter className="gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-slate-200 dark:border-slate-800 text-slate-600
                         dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800
                         rounded-2xl h-14 font-bold"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!userName.trim()}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl
                         h-14 font-bold shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
            >
              {t('newSession.start')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}