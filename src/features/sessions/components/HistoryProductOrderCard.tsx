import React from 'react';
import {
  ShoppingBag,
  Phone,
  Clock,
  Printer,
  ChevronRight,
  Banknote,
  Sparkles,
  CreditCard,
  UserCheck,
  Tag,
  Percent,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, toMillis } from '../../../lib/utils-workspace';
import { printProductOrderReceipt } from '../utils/printReceipt';
import { useWorkspaceStore } from '../../../store';
import { cn } from '@/lib/utils';
import { Payment } from '../../../types';

interface HistoryProductOrderCardProps {
  payment: Payment;
  isRTL: boolean;
  onSelect: (payment: Payment) => void;
}

export const HistoryProductOrderCard = React.memo(function HistoryProductOrderCard({
  payment,
  isRTL,
  onSelect,
}: HistoryProductOrderCardProps) {
  const customers = useWorkspaceStore((state) => state.customers);

  const handleCardClick = React.useCallback(() => {
    onSelect(payment);
  }, [onSelect, payment]);

  const handlePrintClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      printProductOrderReceipt(payment);
    },
    [payment],
  );

  const linkedCustomer = React.useMemo(() => {
    if (!customers || customers.length === 0) return null;
    if (payment.customerId) {
      const found = customers.find((c) => c.id === payment.customerId);
      if (found) return found;
    }
    if (payment.customerPhone) {
      const found = customers.find((c) => c.phone === payment.customerPhone?.trim());
      if (found) return found;
    }
    return null;
  }, [customers, payment.customerId, payment.customerPhone]);

  const txMillis = toMillis(payment.date ?? payment.createdAt);
  const items = payment.items || [];
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const discountTotal = payment.serviceDiscountTotal || 0;
  const subtotal = payment.subtotal ?? payment.amount + discountTotal;

  const isDefaultWalkIn =
    !payment.customerName || payment.customerName.trim() === 'عميل سريع';
  const customerDisplayName =
    linkedCustomer?.name ||
    (!isDefaultWalkIn ? payment.customerName : undefined) ||
    (isRTL ? 'عميل سريع' : 'Walk-in Customer');
  const customerPhone = payment.customerPhone || linkedCustomer?.phone;
  const shortOrderId = payment.id.slice(0, 8).toUpperCase();

  return (
    <Card
      className="bg-white dark:bg-slate-900/50 border-amber-200/80 dark:border-amber-900/40 hover:border-amber-500/60 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <ShoppingBag className="w-6 h-6" />
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {linkedCustomer?.customerId && (
                <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg font-mono">
                  #{linkedCustomer.customerId}
                </span>
              )}

              <h4 className="font-bold text-slate-900 dark:text-white text-base md:text-lg leading-tight truncate">
                {customerDisplayName}
              </h4>

              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] py-0 px-2 h-5 font-bold flex items-center gap-1 rounded-lg">
                <ShoppingBag className="w-3 h-3" />
                <span>{isRTL ? 'طلب منتجات' : 'Product Order'}</span>
              </Badge>

              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-amber-500" />
                #{shortOrderId}
              </span>

              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1',
                  payment.paymentMethod === 'instapay'
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                    : payment.paymentMethod === 'card'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {payment.paymentMethod === 'instapay' ? (
                  <>
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>InstaPay</span>
                  </>
                ) : payment.paymentMethod === 'card' ? (
                  <>
                    <CreditCard className="w-2.5 h-2.5" />
                    <span>Card</span>
                  </>
                ) : (
                  <>
                    <Banknote className="w-2.5 h-2.5" />
                    <span>{isRTL ? 'كاش' : 'Cash'}</span>
                  </>
                )}
              </span>

              {discountTotal > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Percent className="w-2.5 h-2.5" />
                  {isRTL ? `خصم -${formatCurrency(discountTotal)}` : `Disc -${formatCurrency(discountTotal)}`}
                </span>
              )}
            </div>

            {/* Products summary */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {items.slice(0, 4).map((item, idx) => (
                  <span
                    key={`${item.id || item.name}-${idx}`}
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800 px-2 py-0.5 rounded-lg"
                  >
                    {item.name} ×{item.quantity}
                  </span>
                ))}
                {items.length > 4 && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    +{items.length - 4} {isRTL ? 'أصناف أخرى' : 'more'}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3.5 text-[11px] text-slate-500 font-medium flex-wrap">
              {customerPhone && (
                <span
                  className={cn(
                    'flex items-center gap-1.5 font-mono text-amber-600 dark:text-amber-400',
                    isRTL && 'flex-row-reverse',
                  )}
                >
                  <Phone className="w-3 h-3" />
                  {customerPhone}
                </span>
              )}

              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-500/80" />
                {format(txMillis, 'HH:mm')}
              </span>

              {payment.createdBy && (
                <span className="flex items-center gap-1 text-slate-400">
                  <UserCheck className="w-3 h-3" />
                  {payment.createdBy}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
              {isRTL ? 'الأصناف' : 'Items'}
            </p>
            <p className="text-sm md:text-base font-mono font-black text-slate-700 dark:text-slate-200">
              {totalQuantity} {isRTL ? 'قطعة' : 'qty'}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
              {isRTL ? 'الإجمالي' : 'Total'}
            </p>
            <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(payment.amount)}
            </p>
            {discountTotal > 0 && subtotal > payment.amount && (
              <p className="text-[10px] text-slate-400 line-through font-mono">
                {formatCurrency(subtotal)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrintClick}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-amber-500/10 hover:text-amber-600 text-slate-400 transition-colors cursor-pointer shrink-0"
            title={isRTL ? 'طباعة الإيصال' : 'Print Receipt'}
          >
            <Printer className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white text-slate-400 transition-colors shrink-0">
            <ChevronRight className={cn('w-5 h-5 transition-transform', isRTL && 'rotate-180')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
