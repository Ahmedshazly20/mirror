import React from 'react';
import { DoorOpen, Users, Layers, BadgeDollarSign, AlertTriangle, Check, Sparkles, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { Room } from '../../../types';
import { pricingService, ROOM_TYPE_LABELS, mapRoomToPricingKey } from '../../../services/pricingService';

interface RoomCardProps {
  room: Room;
  status: 'available' | 'partially_booked' | 'fully_booked';
  reason?: string;
  isSelected: boolean;
  onSelect: (roomId: string) => void;
  pricePerHourLabel: string;
  durationHours?: number;
}

export const RoomCard = React.memo(function RoomCard({ 
  room, 
  status, 
  reason, 
  isSelected, 
  onSelect, 
  pricePerHourLabel,
  durationHours = 1
}: RoomCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const isAvailable = status !== 'fully_booked';

  const handleSelectClick = React.useCallback(() => {
    if (isAvailable) {
      onSelect(room.id);
    }
  }, [isAvailable, onSelect, room.id]);

  const pricingKey = mapRoomToPricingKey(room);
  const hour1Price = pricingService.getExactPrice(pricingKey, 1) || room.pricePerHour;
  const calculatedDurationPrice = durationHours > 0 
    ? pricingService.calculateRoomPrice(room, durationHours) 
    : hour1Price;
  const labelObj = ROOM_TYPE_LABELS[pricingKey];

  return (
    <motion.div
      whileHover={isAvailable ? { scale: 1.01, y: -2 } : {}}
      whileTap={isAvailable ? { scale: 0.99 } : {}}
      onClick={handleSelectClick}
      className={cn(
        "relative rounded-3xl p-5 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between",
        isSelected 
          ? "bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500 shadow-md ring-2 ring-cyan-500/20" 
          : isAvailable 
            ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow-sm" 
            : "bg-slate-50 dark:bg-slate-910 border-slate-100 dark:border-slate-900/40 opacity-75 cursor-not-allowed"
      )}
    >
      {/* Selection Border Line indicator */}
      {isSelected && (
        <span className="absolute top-0 inset-x-0 h-1 bg-cyan-500 animate-pulse" />
      )}

      <div>
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-3 items-center">
            <div className={cn(
              "p-3 rounded-2xl shrink-0",
              isSelected 
                ? "bg-cyan-500 text-white" 
                : isAvailable 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400"
            )}>
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white leading-snug">{room.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  {labelObj ? (isRTL ? labelObj.ar : labelObj.en) : room.type || 'Room'}
                </span>
              </div>
            </div>
          </div>

          {/* State Badges */}
          <div>
            {status === 'available' && (
              <span className="inline-flex px-3 py-1 text-[10px] font-extrabold tracking-wide uppercase rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                {t('bookings.availState')}
              </span>
            )}
            {status === 'partially_booked' && (
              <span className="inline-flex px-3 py-1 text-[10px] font-extrabold tracking-wide uppercase rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                {t('bookings.partialState')}
              </span>
            )}
            {status === 'fully_booked' && (
              <span className="inline-flex px-3 py-1 text-[10px] font-extrabold tracking-wide uppercase rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/30 dark:border-rose-500/20">
                {t('bookings.bookedState')}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Duration Price Box */}
        <div className="my-3 p-3 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isRTL 
                ? `سعر ${durationHours > 0 ? durationHours.toFixed(durationHours % 1 === 0 ? 0 : 1) : 1} ساعة:` 
                : `${durationHours > 0 ? durationHours.toFixed(durationHours % 1 === 0 ? 0 : 1) : 1} Hours Price:`}
            </span>
          </div>
          <div className="text-sm font-black text-cyan-600 dark:text-cyan-400">
            {calculatedDurationPrice} {isRTL ? 'ج.م' : 'EGP'}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{t('bookings.capacity', { val: room.capacity })}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{t('bookings.tablesCount', { val: room.tables?.length || 0 })}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <BadgeDollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{isRTL ? `1 ساعة = ${hour1Price} ج.م` : `1 hr = ${hour1Price} EGP`}</span>
            </div>
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded-full">
              {isRTL ? 'تسعير مصفوفة معتمد' : 'Pricing Matrix'}
            </span>
          </div>
        </div>
      </div>

      {/* Overlapping alert messages */}
      {!isAvailable && reason && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50/75 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 flex gap-2 items-center">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 leading-tight">
            {reason}
          </p>
        </div>
      )}

      {/* Selected Indicator Checkmark */}
      {isSelected && (
        <div className={cn(
          "absolute bottom-3 right-3 p-1.5 rounded-full bg-cyan-500 text-white shadow",
          isRTL ? "left-3 right-auto" : "right-3 left-auto"
        )}>
          <Check className="w-3 h-3" />
        </div>
      )}
    </motion.div>
  );
});
