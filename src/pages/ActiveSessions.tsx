import React, { useState, useCallback, useMemo } from 'react';
import { Timer, DoorOpen, LayoutGrid, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '../store';
import { useActiveSessions } from '../hooks/useActiveSessions';
import { sessionService } from '../services/sessionService';
import { inventoryService } from '../services/inventoryService';
import { ActiveSessionCard } from '../features/sessions/components/ActiveSessionCard';
import { ActiveSessionReviewModal } from '../features/sessions/components/ActiveSessionReviewModal';
import { ActiveAddServiceModal } from '../features/sessions/components/ActiveAddServiceModal';
import { toast } from 'sonner';
import { Session, ServiceItem } from '../types';
import { cn } from '@/lib/utils';

export default function ActiveSessions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const { sessions, loading, error } = useActiveSessions();
  const calculateSessionCost = useWorkspaceStore(state => state.calculateSessionCost);

  const [filterType, setFilterType] = useState<'all' | 'rooms' | 'space'>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [addServiceSessionId, setAddServiceSessionId] = useState<string | null>(null);

  const deduplicatedSessions = useMemo(() => {
    const seenBookingIds = new Set<string>();
    const seenSessionIds = new Set<string>();
    const result: Session[] = [];

    for (const s of sessions) {
      if (!s || !s.id || s.status !== 'active' || seenSessionIds.has(s.id)) continue;
      if (s.bookingId) {
        if (seenBookingIds.has(s.bookingId)) continue;
        seenBookingIds.add(s.bookingId);
      }
      seenSessionIds.add(s.id);
      result.push(s);
    }
    return result;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (filterType === 'rooms') {
      return deduplicatedSessions.filter(s => s.roomAssignment && (s.roomAssignment.roomId || s.roomAssignment.roomName));
    }
    if (filterType === 'space') {
      return deduplicatedSessions.filter(s => !s.roomAssignment || (!s.roomAssignment.roomId && !s.roomAssignment.roomName));
    }
    return deduplicatedSessions;
  }, [deduplicatedSessions, filterType]);

  const roomCount = useMemo(() => {
    return deduplicatedSessions.filter(s => s.roomAssignment && (s.roomAssignment.roomId || s.roomAssignment.roomName)).length;
  }, [deduplicatedSessions]);

  const spaceCount = useMemo(() => {
    return deduplicatedSessions.filter(s => !s.roomAssignment || (!s.roomAssignment.roomId && !s.roomAssignment.roomName)).length;
  }, [deduplicatedSessions]);

  // Memoized handlers to stop re-render cascades
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

    // 1. Deduct stock directly from Inventory and record movement
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

    // 2. Append service to active session
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
      // 1. Restore stock to Inventory
      await inventoryService.returnServiceSale(
        serviceToRemove,
        serviceToRemove.quantity,
        sessionId,
        'إلغاء خدمة من الجلسة'
      );

      // 2. Remove from session
      const updatedServices = session.services.filter((_, idx) => idx !== serviceIndex);
      const { total } = calculateSessionCost({ ...session, services: updatedServices });
      await sessionService.addServiceToSession(sessionId, updatedServices, total);

      toast.success(
        isRTL 
          ? `تم إلغاء "${serviceToRemove.name}" واسترجاع الكمية (${serviceToRemove.quantity}) للمخزون بنجاح` 
          : `Removed "${serviceToRemove.name}" and returned stock`
      );
    } catch (err) {
      console.error('Error removing service from session:', err);
      toast.error(t('common.error'));
    }
  }, [sessions, calculateSessionCost, isRTL, t]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (window.confirm(t('sessions.deleteConfirm'))) {
      try {
        await sessionService.deleteSession(id);
        toast.success(t('common.delete') + ' ' + t('sessions.completed'));
      } catch (err) {
        toast.error(t('sessions.errorLoading'));
      }
    }
  }, [t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">{t('sessions.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400">
        <p className="font-bold">{t('sessions.errorLoading')}</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Quick Filter */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1.5 rounded-2xl w-fit shadow-sm">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
              filterType === 'all'
                ? "bg-cyan-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{isRTL ? 'الكل' : 'All'}</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-md text-[10px] font-black",
              filterType === 'all' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {sessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('space')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
              filterType === 'space'
                ? "bg-cyan-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isRTL ? 'المساحة المشتركة' : 'Shared Space'}</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-md text-[10px] font-black",
              filterType === 'space' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {spaceCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('rooms')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
              filterType === 'rooms'
                ? "bg-cyan-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>{isRTL ? 'الغرف والقاعات' : 'Rooms'}</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-md text-[10px] font-black",
              filterType === 'rooms' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {roomCount}
            </span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredSessions.map((session) => (
          <ActiveSessionCard 
            key={session.id} 
            session={session} 
            onEnd={handleOpenReview}
            onAddService={handleOpenAddService}
            onRemoveService={handleRemoveService}
            onDelete={handleDeleteSession}
          />
        ))}
        {filteredSessions.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500">
            <Timer className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('sessions.noActive')}</p>
            <p className="text-sm">{t('sessions.startPrompt')}</p>
          </div>
        )}
      </div>

      {/* Extracted modals loaded lazily or cleanly to avoid heavy initial bundle processing */}
      <ActiveAddServiceModal
        sessionId={addServiceSessionId}
        isOpen={addServiceSessionId !== null}
        onClose={handleCloseAddService}
        onAdd={handleAddService}
      />

      <ActiveSessionReviewModal
        session={selectedSession}
        isOpen={isReviewOpen}
        onClose={handleCloseReview}
      />
    </div>
  );
}

