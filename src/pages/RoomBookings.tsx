import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Clock, 
  User, 
  DoorOpen, 
  AlertTriangle,
  Info,
  DollarSign,
  Search,
  CheckCircle2,
  Users,
  Wallet,
  Receipt,
  Sparkles,
  Banknote,
  Percent,
  Check,
  CreditCard,
  Zap,
  ArrowLeftRight,
  Crown,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useWorkspaceStore } from '../store';
import { bookingService } from '../services/bookingService';
import { customerService } from '../services/customerService';
import { pricingService, DEFAULT_BOOKABLE_ROOMS } from '../services/pricingService';
import { checkRoomConflictInMemory, isSamePhysicalRoom } from '../services/roomAvailabilityService';
import {
  findEligibleSubscriptionForDate,
  formatPackageBalance,
  getSubscriptionRemainingMinutes
} from '../lib/utils-workspace';
import { toast } from 'sonner';
import { format, startOfToday } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RoomCard } from '../features/bookings/components/RoomCard';
import { BookingCard } from '../features/bookings/components/BookingCard';
import { EditBookingModal } from '../features/bookings/components/EditBookingModal';
import { CancelBookingModal } from '../features/bookings/components/CancelBookingModal';
import { TransferRoomModal } from '../features/bookings/components/TransferRoomModal';
import { Customer, Session, ServiceItem, Booking } from '../types';
import { useActiveSessions } from '../hooks/useActiveSessions';
import { sessionService } from '../services/sessionService';
import { inventoryService } from '../services/inventoryService';
import { ActiveSessionCard } from '../features/sessions/components/ActiveSessionCard';
import { ActiveSessionReviewModal } from '../features/sessions/components/ActiveSessionReviewModal';
import { ActiveAddServiceModal } from '../features/sessions/components/ActiveAddServiceModal';

export default function RoomBookings() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { bookings, settings, rooms, user, customers, subscriptions } = useWorkspaceStore();
  const { sessions } = useActiveSessions();
  const calculateSessionCost = useWorkspaceStore(state => state.calculateSessionCost);
  const isOwner = user?.role === 'owner';
  
  // UI View & Active Rooms Tab
  const [activeTab, setActiveTab] = useState<'bookings' | 'active_rooms'>('bookings');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Active Room Sessions State & Modals
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [addServiceSessionId, setAddServiceSessionId] = useState<string | null>(null);

  // Edit, Cancel & Transfer Modals State
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [transferTargetBooking, setTransferTargetBooking] = useState<Booking | null>(null);
  const [transferTargetSession, setTransferTargetSession] = useState<Session | null>(null);

  // Filter and Deduplicate Active Room Sessions
  const activeRoomSessions = useMemo(() => {
    const seenBookingIds = new Set<string>();
    const seenSessionIds = new Set<string>();
    const result: Session[] = [];

    for (const s of sessions) {
      if (!s || !s.id || s.status !== 'active') continue;
      if (!s.roomAssignment || (!s.roomAssignment.roomId && !s.roomAssignment.roomName)) continue;
      if (seenSessionIds.has(s.id)) continue;
      if (s.bookingId) {
        if (seenBookingIds.has(s.bookingId)) continue;
        seenBookingIds.add(s.bookingId);
      }
      seenSessionIds.add(s.id);
      result.push(s);
    }
    return result;
  }, [sessions]);

  // Dynamic Time Initialization to Current Hour
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [startTimeStr, setStartTimeStr] = useState<string>(() => {
    const curHour = new Date().getHours();
    return `${String(curHour).padStart(2, '0')}:00`;
  });
  const [endTimeStr, setEndTimeStr] = useState<string>(() => {
    const curHour = new Date().getHours();
    const endH = Math.min(23, curHour + 2);
    return `${String(endH).padStart(2, '0')}:00`;
  });

  // Customer State Values
  const [roomId, setRoomId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<'cash' | 'instapay'>('cash');
  const [phoneError, setPhoneError] = useState<boolean>(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
  const [remoteCustomers, setRemoteCustomers] = useState<Customer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);

  // Localization Utilities
  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  // React on deep links or redirect states
  useEffect(() => {
    if (location.state?.openNew) {
      setIsAdding(true);
    }
  }, [location.state]);

  // Debounced targeted customer search fallback (matches NewSessionModal)
  useEffect(() => {
    const term = customerSearchTerm.trim();
    if (!term) {
      setRemoteCustomers([]);
      setIsSearchingCustomer(false);
      return;
    }

    const cleanTerm = term.replace(/^#/, '').trim();
    const isPureDigits = /^\d+$/.test(cleanTerm);
    if (term.length < 2 && !isPureDigits) {
      setRemoteCustomers([]);
      setIsSearchingCustomer(false);
      return;
    }

    setIsSearchingCustomer(true);
    const timer = setTimeout(async () => {
      try {
        const results = await customerService.searchCustomers(term, 8);
        setRemoteCustomers(results);
      } catch (e) {
        console.warn('Error in booking customer search:', e);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  const validatePhone = useCallback((phone: string) => {
    return /^01[0125][0-9]{8}$/.test(phone) || phone.length >= 8;
  }, []);

  // Filter customers for auto-suggest (Store + Remote fallback)
  const suggestedCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return [];
    const term = customerSearchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/^#/, '');
    const map = new Map<string, Customer>();

    customers.forEach(c => {
      const matchId = c.customerId?.toString() === cleanTerm || c.customerId?.toString().includes(cleanTerm);
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = c.phone.includes(cleanTerm) || c.phone.includes(term);
      if (matchId || matchName || matchPhone) {
        map.set(c.id, c);
      }
    });

    remoteCustomers.forEach(c => {
      map.set(c.id, c);
    });

    return Array.from(map.values()).slice(0, 8);
  }, [customers, remoteCustomers, customerSearchTerm]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setUserName(c.name);
    setPhoneNumber(c.phone);
    setCustomerSearchTerm(c.name);
    setShowCustomerDropdown(false);
    setPhoneError(false);
  };

  const handleSetDurationPreset = (hours: number) => {
    const [sHours, sMins] = startTimeStr.split(':').map(Number);
    const startTotalMins = (sHours || 0) * 60 + (sMins || 0);
    const endTotalMins = startTotalMins + hours * 60;
    const eH = Math.floor(endTotalMins / 60) % 24;
    const eM = endTotalMins % 60;
    setEndTimeStr(`${eH.toString().padStart(2, '0')}:${eM.toString().padStart(2, '0')}`);
  };

  // Compute selected time limits (millisecond epochs)
  const selectedTimes = useMemo(() => {
    if (!selectedDate) return null;
    
    const [sHours, sMins] = startTimeStr.split(':').map(Number);
    const [eHours, eMins] = endTimeStr.split(':').map(Number);

    const start = new Date(selectedDate);
    start.setHours(sHours || 0, sMins || 0, 0, 0);

    const end = new Date(selectedDate);
    end.setHours(eHours || 0, eMins || 0, 0, 0);

    return {
      start: start.getTime(),
      end: end.getTime(),
      formattedDate: format(selectedDate, 'yyyy-MM-dd')
    };
  }, [selectedDate, startTimeStr, endTimeStr]);

  // Duration guard
  const isTimeDurationInvalid = useMemo(() => {
    if (!selectedTimes) return false;
    return selectedTimes.end <= selectedTimes.start;
  }, [selectedTimes]);

  // Check if chosen time is in the past for today
  const isPastTimeBooking = useMemo(() => {
    if (!selectedDate || !selectedTimes) return false;
    const todayStr = format(startOfToday(), 'yyyy-MM-dd');
    if (selectedTimes.formattedDate < todayStr) return true;
    if (selectedTimes.formattedDate === todayStr) {
      const now = new Date();
      const currentHourStart = new Date(selectedDate);
      currentHourStart.setHours(now.getHours(), 0, 0, 0);

      // Rule: If now is 10:15, start at 10:00 is allowed, but start < 10:00 (e.g. 09:00) is past!
      // Also, end time must not have already elapsed (end > now.getTime())
      if (selectedTimes.start < currentHourStart.getTime()) return true;
      if (selectedTimes.end <= now.getTime()) return true;
    }
    return false;
  }, [selectedDate, selectedTimes]);

  const roomsList = useMemo(() => {
    const list = (rooms && rooms.length > 0) 
      ? rooms 
      : (settings.rooms && settings.rooms.length > 0 ? settings.rooms : DEFAULT_BOOKABLE_ROOMS);
    return list.filter(r => r.active !== false);
  }, [rooms, settings.rooms]);

  // Instant room-status reactive evaluator checking both Bookings and Active Sessions
  const roomStatuses = useMemo(() => {
    if (!selectedTimes) return {};
    const { start, end, formattedDate } = selectedTimes;
    const statuses: Record<string, {
      status: 'available' | 'partially_booked' | 'fully_booked';
      reason?: string;
    }> = {};

    roomsList.forEach(room => {
      // 1. Comprehensive overlap conflict evaluation (Active Sessions + Bookings)
      const conflict = checkRoomConflictInMemory(
        room.id,
        start,
        end,
        bookings,
        sessions,
        { roomName: room.name }
      );

      if (conflict.hasConflict) {
        statuses[room.id] = {
          status: 'fully_booked',
          reason: conflict.errorMessage || t('bookings.roomReservedError')
        };
      } else {
        // 2. Check if there are other bookings or sessions scheduled on this same date
        const hasOtherSameDayEvents = bookings.some(b => 
          b.status !== 'cancelled' &&
          isSamePhysicalRoom({ id: b.roomId }, { id: room.id, name: room.name }) &&
          format(new Date(b.startTime), 'yyyy-MM-dd') === formattedDate
        ) || sessions.some(s => 
          s.status === 'active' &&
          isSamePhysicalRoom(
            { id: s.roomAssignment?.roomId, name: s.roomAssignment?.roomName },
            { id: room.id, name: room.name }
          )
        );

        statuses[room.id] = {
          status: hasOtherSameDayEvents ? 'partially_booked' : 'available'
        };
      }
    });

    return statuses;
  }, [roomsList, bookings, sessions, selectedTimes, t]);

  // Selected room details
  const selectedRoomData = useMemo(() => {
    return roomsList.find(r => r.id === roomId);
  }, [roomsList, roomId]);

  const bookingDurationHours = useMemo(() => {
    if (!selectedTimes || isTimeDurationInvalid) return 0;
    return (selectedTimes.end - selectedTimes.start) / (1000 * 60 * 60);
  }, [selectedTimes, isTimeDurationInvalid]);

  // Non-linear calculation using Pricing Service Table
  const calculatedTotalPrice = useMemo(() => {
    if (!selectedRoomData || bookingDurationHours <= 0) return 0;
    return pricingService.calculateRoomPrice(
      selectedRoomData,
      bookingDurationHours,
      settings.pricingRules
    );
  }, [selectedRoomData, bookingDurationHours, settings.pricingRules]);

  // Evaluate whether the customer has an eligible subscription specifically on the requested booking date/time
  const subscriptionEligibility = useMemo(() => {
    if (!selectedTimes) {
      return { subscription: null, status: 'none' as const };
    }
    return findEligibleSubscriptionForDate(
      subscriptions,
      {
        customerId: selectedCustomer?.id,
        phoneNumber: phoneNumber.trim(),
        userName: userName.trim()
      },
      selectedTimes.start,
      selectedTimes.end,
      roomId || undefined
    );
  }, [subscriptions, selectedCustomer, phoneNumber, userName, selectedTimes, roomId]);

  const isBookingCoveredBySub =
    subscriptionEligibility.status === 'eligible' && !!subscriptionEligibility.subscription;
  const effectiveTotalPrice = isBookingCoveredBySub ? 0 : calculatedTotalPrice;

  // Confirm booking callback handler
  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimes) return;

    if (!validatePhone(phoneNumber)) {
      setPhoneError(true);
      toast.error(t('sessions.invalidPhone'));
      return;
    }

    if (isTimeDurationInvalid) {
      toast.error(t('bookings.durationError'));
      return;
    }

    if (isPastTimeBooking) {
      toast.error(isRTL ? 'لا يمكن حجز وقت سابق للوقت الحالي' : 'Cannot book time in the past');
      return;
    }

    if (!roomId) {
      toast.error(t('bookings.chooseRoomPrompt'));
      return;
    }

    // Direct active conflict check before submission
    const currentConflict = checkRoomConflictInMemory(
      roomId,
      selectedTimes.start,
      selectedTimes.end,
      bookings,
      sessions,
      { roomName: selectedRoomData?.name }
    );

    if (currentConflict.hasConflict) {
      toast.error(currentConflict.errorMessage || t('bookings.roomReservedError'));
      return;
    }

    const activeStatus = roomStatuses[roomId];
    if (activeStatus?.status === 'fully_booked') {
      toast.error(activeStatus.reason || t('bookings.roomReservedError'));
      return;
    }

    try {
      setIsSubmitLoading(true);
      const paid = isBookingCoveredBySub ? 0 : (parseFloat(paidAmount) || 0);
      const matchedSub = isBookingCoveredBySub ? subscriptionEligibility.subscription : null;

      await bookingService.createBooking({
        roomId,
        roomName: selectedRoomData?.name,
        userName: userName.trim(),
        phoneNumber: phoneNumber.trim(),
        customerId: selectedCustomer?.id || matchedSub?.customerId,
        startTime: selectedTimes.start,
        endTime: selectedTimes.end,
        totalPrice: effectiveTotalPrice,
        paidAmount: paid,
        paymentMethod: paid > 0 ? bookingPaymentMethod : 'cash',
        remainingAmount: Math.max(0, effectiveTotalPrice - paid),
        paymentStatus: isBookingCoveredBySub
          ? 'paid'
          : (paid >= effectiveTotalPrice ? 'paid' : (paid > 0 ? 'partially_paid' : 'unpaid')),
        isSubscribed: isBookingCoveredBySub,
        subscriptionId: matchedSub?.id,
        subscriptionType: matchedSub?.type
      });

      toast.success(
        isBookingCoveredBySub
          ? (isRTL ? 'تم تأكيد الحجز مجاناً ضمن اشتراك العميل بنجاح' : 'Subscribed booking confirmed without extra fees')
          : t('bookings.success')
      );
      
      // Clean components states
      setIsAdding(false);
      setRoomId('');
      setUserName('');
      setPhoneNumber('');
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setPaidAmount('');
      setBookingPaymentMethod('cash');
      setPhoneError(false);
    } catch (err: any) {
      console.error(err);
      if (err.conflictDetails || err.message === 'ROOM_OVERLAP' || err.message?.includes('تعارض') || err.message?.includes('جلسة نشطة')) {
        toast.error(err.message || t('bookings.roomReservedError'));
      } else if (err.message === 'CUSTOMER_OVERLAP_ERR') {
        toast.error(t('bookings.sameCustomerError'));
      } else {
        toast.error(err.message || t('bookings.error'));
      }
    } finally {
      setIsSubmitLoading(false);
    }
  }, [
    selectedTimes,
    roomId,
    userName,
    phoneNumber,
    selectedCustomer,
    paidAmount,
    bookingPaymentMethod,
    effectiveTotalPrice,
    isBookingCoveredBySub,
    subscriptionEligibility,
    roomStatuses,
    selectedRoomData,
    bookings,
    sessions,
    isTimeDurationInvalid,
    isPastTimeBooking,
    validatePhone,
    isRTL,
    t
  ]);

  const handleDelete = useCallback(async (id: string) => {
    if (!isOwner) {
      toast.error(t('bookings.adminOnlyError'));
      return;
    }
    try {
      await bookingService.deleteBooking(id);
      toast.success(t('bookings.deleted'));
    } catch (err) {
      toast.error(t('bookings.deleteError'));
    }
  }, [isOwner, t]);

  const handleToggleAdding = useCallback(() => {
    setIsAdding(prev => !prev);
    setRoomId('');
    setUserName('');
    setPhoneNumber('');
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setPaidAmount('0');
    setPhoneError(false);
  }, []);

  // Active Room Sessions handlers
  const handleOpenReview = useCallback((session: Session) => {
    setSelectedSession(session);
    setIsReviewOpen(true);
  }, []);

  const handleCloseReview = useCallback(() => {
    setIsReviewOpen(false);
    setSelectedSession(null);
  }, []);

  const handleOpenAddService = useCallback((sessionId: string) => {
    setAddServiceSessionId(sessionId);
  }, []);

  const handleCloseAddService = useCallback(() => {
    setAddServiceSessionId(null);
  }, []);

  const handleAddService = useCallback(async (sessionId: string, service: ServiceItem, quantity: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const deductRes = await inventoryService.deductServiceSale(
      service, 
      quantity, 
      sessionId, 
      session.userName
    );

    if (!deductRes.success) {
      toast.error(deductRes.error || (isRTL ? 'فشل خصم المخزون' : 'Failed to deduct stock'));
      return;
    }

    const updatedServices = [
      ...(session.services || []),
      {
        id: service.id,
        serviceId: service.id,
        inventoryItemId: service.inventoryItemId,
        name: service.name,
        price: service.price,
        quantity: quantity
      }
    ];

    const { total } = calculateSessionCost({ ...session, services: updatedServices });
    try {
      await sessionService.addServiceToSession(sessionId, updatedServices, total);
      if (deductRes.remainingStock !== undefined) {
        toast.success(
          isRTL 
            ? `تمت إضافة "${service.name} ×${quantity}" (المخزون المتبقي: ${deductRes.remainingStock})` 
            : `Added "${service.name} x${quantity}" (Remaining: ${deductRes.remainingStock})`
        );
      } else {
        toast.success(t('common.success'));
      }
    } catch (err) {
      console.error('Error adding service to session:', err);
      toast.error(t('sessions.errorLoading'));
    }
  }, [sessions, calculateSessionCost, t, isRTL]);

  const handleRemoveService = useCallback(async (sessionId: string, serviceIndex: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.services || !session.services[serviceIndex]) return;

    const serviceToRemove = session.services[serviceIndex];

    try {
      await inventoryService.returnServiceSale(
        serviceToRemove,
        serviceToRemove.quantity,
        sessionId,
        'إلغاء خدمة من جلسة الغرفة'
      );

      const updatedServices = session.services.filter((_, idx) => idx !== serviceIndex);
      const { total } = calculateSessionCost({ ...session, services: updatedServices });
      await sessionService.addServiceToSession(sessionId, updatedServices, total);
      toast.success(isRTL ? `تم حذف "${serviceToRemove.name}" وإرجاع المخزون` : 'Service removed and stock restored');
    } catch (err) {
      console.error('Error removing service from session:', err);
      toast.error(t('sessions.errorLoading'));
    }
  }, [sessions, calculateSessionCost, t, isRTL]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await sessionService.deleteSession(sessionId);
      toast.success(t('sessions.deleted'));
    } catch (err) {
      console.error('Error deleting session:', err);
      toast.error(t('sessions.errorLoading'));
    }
  }, [t]);

  const handleStartSessionFromBooking = useCallback(async (booking: Booking, room?: any) => {
    // Check if session is already active in state
    const isAlreadyActive = sessions.some(s => (s.bookingId === booking.id || s.id === `booking_${booking.id}` || s.id === booking.activeSessionId) && s.status === 'active');
    if (isAlreadyActive || booking.status === 'active') {
      toast.info(isRTL ? `الجلسة نشطة بالفعل في ${room?.name || booking.roomName || 'الغرفة'}` : `Session is already active`);
      setActiveTab('active_rooms');
      return;
    }

    const resolvedRoomName = room?.name || booking.roomName || 'الغرفة';
    const isBookingSubscribed = Boolean(booking.isSubscribed || booking.subscriptionId);

    try {
      await sessionService.startSession(
        booking.userName,
        booking.phoneNumber,
        'booking',
        isBookingSubscribed,
        true,
        {
          roomId: booking.roomId,
          roomName: resolvedRoomName,
          tableId: room?.tables?.[0]?.id || 'tbl-1',
          tableNumber: room?.tables?.[0]?.number || 1,
          tableLabel: resolvedRoomName,
          groupSize: room?.capacity || 1
        },
        booking.subscriptionId || undefined,
        booking.customerId,
        booking.id,
        booking.totalPrice,
        booking.paidAmount
      );
      toast.success(isRTL ? `تم بدء الجلسة في ${resolvedRoomName} بنجاح` : `Session started in ${resolvedRoomName}`);
      setActiveTab('active_rooms');
    } catch (err) {
      toast.error(isRTL ? 'فشل بدء الجلسة' : 'Failed to start session');
    }
  }, [sessions, isRTL]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* SaaS Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
        <div className={isRTL ? 'text-right' : ''}>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-500">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{t('bookings.title')}</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-semibold">{t('bookings.subtitle')}</p>
        </div>
        <Button 
          onClick={handleToggleAdding}
          className={cn(
            "rounded-2xl px-6 py-5 font-bold text-white transition-all duration-300 shrink-0",
            isAdding 
              ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/10" 
              : "bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/15"
          )}
        >
          <Plus className={cn("w-4 h-4 transition-transform duration-300", isAdding ? 'rotate-45' : '', isRTL ? 'ml-2' : 'mr-2')} />
          {isAdding ? t('bookings.cancel') : t('bookings.new')}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            {/* Step 1 & Step 3 Fields */}
            <div className="xl:col-span-1 space-y-6">
              
              {/* Date & 24-Hour Time configurator */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-500" />
                    <CardTitle className="text-sm font-bold">{t('bookings.step1')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  
                  {/* Calender Picker */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('bookings.date')}</Label>
                    <Popover>
                      <PopoverTrigger
                        className={cn(
                          "w-full rounded-2xl h-11 justify-start font-semibold text-slate-700 dark:text-slate-300 text-left border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors",
                          isRTL ? "text-right" : "text-left"
                        )}
                      >
                        <CalendarDays className={cn("w-4 h-4 text-cyan-500 shrink-0", isRTL ? "ml-2" : "mr-2")} />
                        <span>{selectedDate ? format(selectedDate, "PPP", { locale: dateLocale }) : t('sessions.pickDate')}</span>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          disabled={(date) => date < startOfToday()}
                          initialFocus
                          locale={dateLocale}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* 24-Hour Start & End Time Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isRTL ? 'وقت البدء (24h)' : 'Start Time (24h)'}
                      </Label>
                      <Input 
                        type="time" 
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="rounded-xl h-11 border-slate-200 dark:border-slate-800 font-bold bg-slate-50/50 dark:bg-slate-950 text-center"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isRTL ? 'وقت الانتهاء (24h)' : 'End Time (24h)'}
                      </Label>
                      <Input 
                        type="time" 
                        value={endTimeStr}
                        onChange={(e) => setEndTimeStr(e.target.value)}
                        className="rounded-xl h-11 border-slate-200 dark:border-slate-800 font-bold bg-slate-50/50 dark:bg-slate-950 text-center"
                      />
                    </div>
                  </div>

                  {/* Quick Duration Presets */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isRTL ? 'المدة السريعة:' : 'Quick Duration:'}
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((hrs) => {
                        const isCurrent = Math.abs(bookingDurationHours - hrs) < 0.05;
                        return (
                          <Button
                            key={hrs}
                            type="button"
                            variant={isCurrent ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetDurationPreset(hrs)}
                            className={cn(
                              "rounded-xl text-xs font-bold h-8 transition-all",
                              isCurrent 
                                ? "bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm" 
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-cyan-500"
                            )}
                          >
                            {hrs} {isRTL ? 'ساعات' : 'hrs'}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {isTimeDurationInvalid && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p className="text-[11px] font-bold leading-normal">{t('bookings.durationError')}</p>
                    </div>
                  )}

                  {isPastTimeBooking && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <p className="text-[11px] font-bold leading-normal">
                        {isRTL 
                          ? `⚠️ لا يمكن حجز وقت سابق للوقت الحالي (الوقت المتاح للحجز اليوم يبدأ من ${String(new Date().getHours()).padStart(2, '0')}:00)`
                          : `⚠️ Cannot book past time (Earliest available start time today is ${String(new Date().getHours()).padStart(2, '0')}:00)`}
                      </p>
                    </div>
                  )}

                  {!isTimeDurationInvalid && !isPastTimeBooking && (
                    <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      <span>{t('bookings.hoursSelected')}:</span>
                      <span>{bookingDurationHours.toFixed(bookingDurationHours % 1 === 0 ? 0 : 1)} {t('common.hours')}</span>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Step 3 Layout Forms & Customer Search */}
              {roomId && !isTimeDurationInvalid && !isPastTimeBooking && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md rounded-3xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-cyan-500" />
                        <CardTitle className="text-sm font-bold">{t('bookings.step3')}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                      
                      {/* Customer Auto-Search */}
                      <div className="space-y-2 relative">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {isRTL ? 'العميل (بحث بالاسم أو ID/الهاتف)' : 'Customer (Search by Name or ID/Phone)'}
                        </Label>
                        <div className="relative">
                          <Input 
                            placeholder={isRTL ? 'اكتب اسم العميل أو رقمه...' : 'Type customer name or ID...'}
                            value={customerSearchTerm || userName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomerSearchTerm(val);
                              setUserName(val);
                              setShowCustomerDropdown(true);
                              if (selectedCustomer && selectedCustomer.name !== val) {
                                setSelectedCustomer(null);
                              }
                            }}
                            onFocus={() => setShowCustomerDropdown(true)}
                            className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:border-cyan-500 h-10"
                            required
                          />
                          {isSearchingCustomer && (
                            <Loader2 className={cn("w-4 h-4 animate-spin text-cyan-500 absolute top-3", isRTL ? "left-3" : "right-3")} />
                          )}
                          {!isSearchingCustomer && selectedCustomer && (
                            <Badge className="absolute left-2.5 top-2.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 text-[10px]">
                              #{selectedCustomer.customerId}
                            </Badge>
                          )}
                        </div>

                        {/* Customer Dropdown */}
                        {showCustomerDropdown && suggestedCustomers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                            {suggestedCustomers.map(c => {
                              const hasValidSub = selectedTimes
                                ? findEligibleSubscriptionForDate(
                                    subscriptions,
                                    { customerId: c.id, phoneNumber: c.phone, userName: c.name },
                                    selectedTimes.start,
                                    selectedTimes.end
                                  ).status === 'eligible'
                                : false;

                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(c)}
                                  className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs transition-colors"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                                      {hasValidSub && (
                                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[9px] px-1.5 py-0">
                                          {isRTL ? 'مشترك نشط' : 'Subscribed'}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400" dir="ltr">{c.phone}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">#{c.customerId}</Badge>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('subs.phoneNumber')}</Label>
                        <Input 
                          type="tel"
                          placeholder="01XXXXXXXXX"
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            if (phoneError) setPhoneError(false);
                          }}
                          className={cn(
                            "rounded-xl border-slate-200 dark:border-slate-800 h-10 bg-slate-50/50 dark:bg-slate-950 focus:border-cyan-500",
                            phoneError ? 'border-rose-500 ring-rose-500/15' : ''
                          )}
                          required
                        />
                        {phoneError && <p className="text-[10px] text-rose-500 font-black">{t('sessions.invalidPhone')}</p>}
                      </div>

                      {/* Subscription Coverage Detection Banner */}
                      {isBookingCoveredBySub && subscriptionEligibility.subscription && (
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-violet-500/5 to-cyan-500/10 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                              <Crown className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>
                                {isRTL ? 'مشمول ضمن اشتراك نشط' : 'Covered by Active Subscription'}
                              </span>
                            </div>
                            <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-black">
                              {subscriptionEligibility.subscription.type === 'package'
                                ? (isRTL ? 'باقة ساعات' : 'Hours Package')
                                : (isRTL ? 'اشتراك شهري' : 'Monthly Plan')}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            {subscriptionEligibility.subscription.type === 'package' ? (
                              <span>
                                {isRTL ? 'الرصيد المتاح:' : 'Available Balance:'}{' '}
                                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                  {formatPackageBalance(getSubscriptionRemainingMinutes(subscriptionEligibility.subscription))}
                                </strong>
                              </span>
                            ) : (
                              <span>
                                {isRTL ? 'صالح حتى:' : 'Valid Until:'}{' '}
                                <strong className="font-mono">
                                  {subscriptionEligibility.subscription.endDate
                                    ? format(new Date(subscriptionEligibility.subscription.endDate), 'dd MMM yyyy', { locale: dateLocale })
                                    : (isRTL ? 'مفتوح' : 'No Expiry')}
                                </strong>
                              </span>
                            )}
                            {subscriptionEligibility.subscription.roomName && (
                              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">
                                ({subscriptionEligibility.subscription.roomName})
                              </span>
                            )}
                          </div>

                          <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-emerald-500/15 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>
                              {isRTL
                                ? 'لا توجد رسوم حجز إضافية. لن يتم خصم أي ساعات من الباقة عند الحجز — يتم الخصم عند تشغيل الجلسة الفعلية فقط.'
                                : 'No extra booking charges. Package hours are NOT deducted on booking creation — only when the session runs.'}
                            </span>
                          </div>
                        </div>
                      )}

                      {subscriptionEligibility.status === 'ineligible' && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">
                              {isRTL ? 'اشتراك العميل غير صالح لهذا الموعد' : 'Subscription not eligible on selected date'}
                            </p>
                            <p className="text-[11px] mt-0.5 opacity-90">
                              {subscriptionEligibility.reason === 'expired'
                                ? (isRTL ? 'تاريخ الحجز يقع بعد انتهاء صلاحية الاشتراك — سيتم تطبيق السعر العادي.' : 'Booking date is after subscription expiry — standard pricing applies.')
                                : subscriptionEligibility.reason === 'not_started'
                                  ? (isRTL ? 'الاشتراك لم يبدأ في هذا التاريخ بعد — سيتم تطبيق السعر العادي.' : 'Subscription has not started yet on this date — standard pricing applies.')
                                  : subscriptionEligibility.reason === 'day_not_allowed'
                                    ? (isRTL ? 'هذا اليوم غير مشمول ضمن أيام الاشتراك — سيتم تطبيق السعر العادي.' : 'Selected weekday is not covered by plan — standard pricing applies.')
                                    : subscriptionEligibility.reason === 'exhausted'
                                      ? (isRTL ? 'رصيد ساعات الباقة مستنفد (0 ساعة متبقية) — سيتم تطبيق السعر العادي.' : 'Package balance is exhausted — standard pricing applies.')
                                      : (isRTL ? 'الاشتراك غير نشط — سيتم تطبيق السعر العادي.' : 'Subscription is inactive — standard pricing applies.')}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Professional Paid Amount (Deposit) Section (Only when NOT covered by subscription) */}
                      {!isBookingCoveredBySub && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 border border-slate-200/90 dark:border-slate-800 space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                            {isRTL ? 'المبلغ المدفوع مقدمًا (العربون):' : 'Advance Deposit Paid:'}
                          </Label>
                          {parseFloat(paidAmount) > 0 && (
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1",
                              parseFloat(paidAmount) >= effectiveTotalPrice
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            )}>
                              {parseFloat(paidAmount) >= effectiveTotalPrice ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  {isRTL ? 'مدفوع بالكامل' : 'Fully Paid'}
                                </>
                              ) : (
                                <>
                                  <Percent className="w-3 h-3 text-amber-500" />
                                  {isRTL ? 'عربون جزئي' : 'Partial Deposit'}
                                </>
                              )}
                            </Badge>
                          )}
                        </div>

                        {/* Input Box with Currency & Clear controls */}
                        <div className="relative">
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400 pointer-events-none",
                            isRTL ? "right-3.5" : "left-3.5"
                          )}>
                            <Banknote className="w-4 h-4 text-emerald-500" />
                          </div>

                          <Input 
                            type="number"
                            min="0"
                            max={effectiveTotalPrice || undefined}
                            placeholder={isRTL ? "أدخل قيمة العربون (اختياري)..." : "Enter advance amount..."}
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className={cn(
                              "rounded-xl border-slate-200 dark:border-slate-800 h-12 bg-white dark:bg-slate-900 font-black text-base text-emerald-600 dark:text-emerald-400 shadow-inner focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                              isRTL ? "pr-10 pl-16 text-right" : "pl-10 pr-16 text-left"
                            )}
                          />

                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 font-black text-xs text-slate-400 pointer-events-none px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800",
                            isRTL ? "left-3" : "right-3"
                          )}>
                            {t('common.currency')}
                          </div>
                        </div>

                        {/* Quick Deposit Preset Chips */}
                        {effectiveTotalPrice > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span>{isRTL ? 'خيارات دفع سريعة:' : 'Quick Presets:'}</span>
                              {paidAmount !== '' && (
                                <button
                                  type="button"
                                  onClick={() => setPaidAmount('')}
                                  className="text-slate-400 hover:text-rose-500 transition-colors font-bold"
                                >
                                  {isRTL ? 'مسح العربون' : 'Clear'}
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {/* 0 (Unpaid) */}
                              <button
                                type="button"
                                onClick={() => setPaidAmount('')}
                                className={cn(
                                  "py-1 px-1.5 rounded-lg border text-[10px] font-black transition-all text-center",
                                  paidAmount === '' || paidAmount === '0'
                                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-transparent shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                              >
                                {isRTL ? 'بدون عربون' : 'No Deposit'}
                              </button>

                              {/* 25% */}
                              <button
                                type="button"
                                onClick={() => setPaidAmount(Math.round(effectiveTotalPrice * 0.25).toString())}
                                className={cn(
                                  "py-1 px-1.5 rounded-lg border text-[10px] font-black transition-all text-center",
                                  parseFloat(paidAmount) === Math.round(effectiveTotalPrice * 0.25)
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                              >
                                25% ({Math.round(effectiveTotalPrice * 0.25)})
                              </button>

                              {/* 50% */}
                              <button
                                type="button"
                                onClick={() => setPaidAmount(Math.round(effectiveTotalPrice * 0.5).toString())}
                                className={cn(
                                  "py-1 px-1.5 rounded-lg border text-[10px] font-black transition-all text-center",
                                  parseFloat(paidAmount) === Math.round(effectiveTotalPrice * 0.5)
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                              >
                                50% ({Math.round(effectiveTotalPrice * 0.5)})
                              </button>

                              {/* 100% (Full payment) */}
                              <button
                                type="button"
                                onClick={() => setPaidAmount(effectiveTotalPrice.toString())}
                                className={cn(
                                  "py-1 px-1.5 rounded-lg border text-[10px] font-black transition-all text-center",
                                  parseFloat(paidAmount) === effectiveTotalPrice
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                )}
                              >
                                {isRTL ? 'الكل' : '100%'} ({effectiveTotalPrice})
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Payment Method Selector for Deposit */}
                        {parseFloat(paidAmount) > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                              <span>{isRTL ? 'طريقة تحصيل العربون:' : 'Deposit Payment Method:'}</span>
                              <span className="text-[10px] text-cyan-500 font-bold">
                                {bookingPaymentMethod === 'instapay' ? 'InstaPay ⚡' : 'Cash 💵'}
                              </span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setBookingPaymentMethod('cash')}
                                className={cn(
                                  "flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-black transition-all",
                                  bookingPaymentMethod === 'cash'
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                                    : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                              >
                                <Banknote className="w-4 h-4" />
                                <span>{isRTL ? 'نقدي (Cash)' : 'Cash'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setBookingPaymentMethod('instapay')}
                                className={cn(
                                  "flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-black transition-all",
                                  bookingPaymentMethod === 'instapay'
                                    ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/20"
                                    : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                              >
                                <Zap className="w-4 h-4" />
                                <span>{isRTL ? 'إنستاباي (InstaPay)' : 'InstaPay'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Financial summary breakdown */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{isRTL ? 'نوع القاعة Pricing Matrix:' : 'Pricing Model:'}</span>
                          <span className="font-extrabold text-slate-650 dark:text-slate-300 capitalize">
                            {selectedRoomData?.type || 'Standard'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{t('bookings.hoursSelected')}:</span>
                          <span className="font-extrabold text-slate-650 dark:text-slate-300">{bookingDurationHours.toFixed(1)} {t('common.hours')}</span>
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                        
                        {/* Total Bill Row */}
                        <div className="flex justify-between items-center text-sm font-black">
                          <span className="text-slate-800 dark:text-slate-200">{t('sessions.totalBill')}:</span>
                          <div className="flex items-center gap-2">
                            {isBookingCoveredBySub && calculatedTotalPrice > 0 && (
                              <span className="text-xs line-through text-slate-400 font-semibold">
                                {calculatedTotalPrice} {t('common.currency')}
                              </span>
                            )}
                            <span className={isBookingCoveredBySub ? "text-emerald-500" : "text-cyan-500"}>
                              {effectiveTotalPrice} {t('common.currency')}
                            </span>
                          </div>
                        </div>

                        {/* Advance Paid Row */}
                        {!isBookingCoveredBySub && parseFloat(paidAmount) > 0 && (
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span>{isRTL ? 'المسدد مقدمًا (عربون):' : 'Paid Advance:'}</span>
                            <span>- {parseFloat(paidAmount) || 0} {t('common.currency')}</span>
                          </div>
                        )}

                        {/* Remaining Balance Row */}
                        <div className="flex justify-between items-center text-xs font-extrabold pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          <span className="text-slate-600 dark:text-slate-400">{isRTL ? 'المتبقي عند الحضور:' : 'Remaining Balance:'}</span>
                          <span className={cn(
                            "font-black text-sm",
                            (isBookingCoveredBySub || Math.max(0, effectiveTotalPrice - (parseFloat(paidAmount) || 0)) === 0)
                              ? "text-emerald-500"
                              : "text-amber-500"
                          )}>
                            {isBookingCoveredBySub
                              ? (isRTL ? '0 (مشمول بالاشتراك)' : '0 (Subscribed)')
                              : `${Math.max(0, effectiveTotalPrice - (parseFloat(paidAmount) || 0))} ${t('common.currency')}`}
                          </span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleCreate}
                        disabled={isSubmitLoading || phoneError || !userName || !phoneNumber}
                        className="w-full rounded-2xl h-11 font-bold text-white bg-cyan-500 hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/10"
                      >
                        {isSubmitLoading ? t('bookings.submitting') : t('bookings.confirm')}
                      </Button>

                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Step 2 Layout Selection Cards info */}
            <div className="xl:col-span-2">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-cyan-500" />
                    <div>
                      <CardTitle className="text-sm font-bold">{t('bookings.step2')}</CardTitle>
                      <CardDescription className="text-xs text-slate-400">{t('bookings.selectRoomCard')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isTimeDurationInvalid || isPastTimeBooking ? (
                    <div className="py-24 text-center text-slate-500 bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-850">
                      <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 opacity-75" />
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        {isPastTimeBooking 
                          ? (isRTL ? 'الوقت المحدد في الماضي، يرجى اختيار موعد صالح اليوم أو في المستقبل' : 'Selected time is in the past, please pick a valid time')
                          : t('bookings.emptyRooms')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roomsList.map((room) => {
                        const roomStatus = roomStatuses[room.id] || { status: 'available' };
                        return (
                          <RoomCard
                            key={room.id}
                            room={room}
                            status={roomStatus.status}
                            reason={roomStatus.reason}
                            isSelected={roomId === room.id}
                            onSelect={setRoomId}
                            pricePerHourLabel={t('common.pricePerUnit')}
                            durationHours={bookingDurationHours > 0 ? bookingDurationHours : 4}
                          />
                        );
                      })}
                      {roomsList.length === 0 && (
                        <div className="col-span-full py-16 text-center text-slate-400">
                          <Info className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>{t('bookings.noRooms')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Tabs (Active Rooms vs Bookings Schedule) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-3xl">
          <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('active_rooms')}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                activeTab === 'active_rooms'
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <DoorOpen className="w-4 h-4 text-cyan-500" />
              <span>{isRTL ? 'الغرف والقاعات النشطة حالياً' : 'Active Rooms'}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                activeRoomSessions.length > 0
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              )}>
                {activeRoomSessions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                activeTab === 'bookings'
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <CalendarDays className="w-4 h-4 text-cyan-500" />
              <span>{isRTL ? 'جدول الحجوزات والمواعيد' : 'Bookings Schedule'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {bookings.length}
              </span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-400 px-2">
            {activeTab === 'active_rooms'
              ? (isRTL ? `${activeRoomSessions.length} جلسة غرفة قيد التشغيل` : `${activeRoomSessions.length} active room sessions`)
              : (isRTL ? `${bookings.length} حجز مؤكد ومجدول` : `${bookings.length} scheduled reservations`)}
          </div>
        </div>

        {/* Tab 1: Active Rooms Grid */}
        {activeTab === 'active_rooms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {activeRoomSessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onEnd={handleOpenReview}
                onAddService={handleOpenAddService}
                onRemoveService={handleRemoveService}
                onTransferRoom={(s) => setTransferTargetSession(s)}
                onDelete={handleDeleteSession}
              />
            ))}

            {activeRoomSessions.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-3">
                <DoorOpen className="w-12 h-12 mx-auto opacity-20 text-cyan-500" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  {isRTL ? 'لا توجد غرف أو قاعات نشطة حالياً' : 'No active rooms at the moment'}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {isRTL 
                    ? 'يمكنك بدء جلسة في أي قاعة من زر "حجز جديد" أو من جدول المواعيد بضغطة واحدة.' 
                    : 'You can start a session in any room from the "New Booking" button or directly from the bookings table.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Bookings Schedule Grid */}
        {activeTab === 'bookings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {bookings.map((booking) => {
              const room = roomsList.find(r => r.id === booking.roomId);
              return (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  room={room}
                  onDelete={handleDelete}
                  onEdit={(b) => setEditingBooking(b)}
                  onTransferRoom={(b) => setTransferTargetBooking(b)}
                  onCancel={(b) => setCancellingBooking(b)}
                  onStartSession={handleStartSessionFromBooking}
                  showDelete={isOwner}
                />
              );
            })}

            {bookings.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-20 text-cyan-500" />
                <p className="text-sm font-semibold">{t('bookings.noBookings')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          isOpen={!!editingBooking}
          onClose={() => setEditingBooking(null)}
          booking={editingBooking}
          rooms={roomsList}
          allBookings={bookings}
        />
      )}

      {/* Cancel Booking Modal */}
      {cancellingBooking && (
        <CancelBookingModal
          isOpen={!!cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          booking={cancellingBooking}
          room={roomsList.find(r => r.id === cancellingBooking.roomId)}
        />
      )}

      {/* Transfer Booking Room Modal */}
      {transferTargetBooking && (
        <TransferRoomModal
          isOpen={!!transferTargetBooking}
          onClose={() => setTransferTargetBooking(null)}
          mode="booking"
          booking={transferTargetBooking}
          rooms={roomsList}
        />
      )}

      {/* Transfer Active Session Room Modal */}
      {transferTargetSession && (
        <TransferRoomModal
          isOpen={!!transferTargetSession}
          onClose={() => setTransferTargetSession(null)}
          mode="session"
          session={transferTargetSession}
          rooms={roomsList}
        />
      )}

      {/* Review and Final Checkout Modal */}
      {selectedSession && (
        <ActiveSessionReviewModal
          isOpen={isReviewOpen}
          onClose={handleCloseReview}
          session={selectedSession}
        />
      )}

      {/* Add Service to Active Room Session Modal */}
      {addServiceSessionId && (
        <ActiveAddServiceModal
          isOpen={!!addServiceSessionId}
          onClose={handleCloseAddService}
          sessionId={addServiceSessionId}
          onAddService={handleAddService}
        />
      )}
    </div>
  );
}
