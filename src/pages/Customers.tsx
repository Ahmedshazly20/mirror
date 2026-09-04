import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Eye, 
  Edit, 
  Trash2, 
  History, 
  UserPlus,
  Building,
  FileText,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, isAfter } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { useWorkspaceStore } from '../store';
import { customerService } from '../services/customerService';
import { Customer, Booking, Subscription, Visit } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function Customers() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? ar : enUS;

  const { 
    customers, 
    setCustomers,
    bookings, 
    subscriptions, 
    visits,
    rooms
  } = useWorkspaceStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Filter & Search Customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase().trim();
    return customers.filter(c => 
      c.customerId?.toString().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email || '');
    setNotes(customer.notes || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFormError(isRTL ? 'الرجاء إدخال الاسم ورقم الهاتف' : 'Name and phone are required');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim()
        });
      } else {
        await customerService.createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim()
        });
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || (isRTL ? 'حدث خطأ أثناء الحفظ' : 'An error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCustomerToDelete(customer);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await customerService.deleteCustomer(customerToDelete.id);
      setCustomers(customers.filter(c => c.id !== customerToDelete.id));
      toast.success(isRTL ? `تم حذف العميل "${customerToDelete.name}" بنجاح` : `Customer "${customerToDelete.name}" deleted successfully`);
      if (selectedCustomer?.id === customerToDelete.id) {
        setIsProfileOpen(false);
        setSelectedCustomer(null);
      }
      setCustomerToDelete(null);
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      toast.error(err.message || (isRTL ? 'حدث خطأ أثناء حذف العميل' : 'Failed to delete customer'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Customer specific records
  const getCustomerBookings = (c: Customer): Booking[] => {
    return bookings.filter(b => 
      b.customerId === c.id || 
      b.phoneNumber === c.phone || 
      b.userName.toLowerCase().trim() === c.name.toLowerCase().trim()
    );
  };

  const getCustomerSubscriptions = (c: Customer): Subscription[] => {
    return subscriptions.filter(s => 
      s.customerId === c.id || 
      s.phoneNumber === c.phone || 
      s.userName.toLowerCase().trim() === c.name.toLowerCase().trim()
    );
  };

  const getCustomerVisits = (c: Customer): Visit[] => {
    return visits.filter(v => 
      v.customerId === c.id || 
      v.customerPhone === c.phone
    );
  };

  const getRoomName = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.name || roomId;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isRTL ? 'بيانات العملاء' : 'Customer Directory'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? 'دليل بيانات ومعلومات العملاء، سجل الزيارات، الحجوزات والاشتراكات' : 'Directory of customer profiles, visit records, room bookings and memberships'}
            </p>
          </div>
        </div>

        <Button 
          onClick={handleOpenAddModal}
          className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-5 h-11 font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isRTL ? 'إضافة عميل جديد' : 'Add New Customer'}</span>
        </Button>
      </div>

      {/* Search & Statistics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none", isRTL ? 'right-3.5' : 'left-3.5')} />
          <Input 
            placeholder={isRTL ? 'ابحث برقم العميل (مثلاً: 12)، الاسم، أو رقم الهاتف...' : 'Search by Customer ID (e.g. 12), name or phone...'} 
            className={cn(
              "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl h-11 font-medium shadow-sm transition-colors duration-200", 
              isRTL ? 'pr-10' : 'pl-10'
            )}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm flex items-center p-4">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 mr-3">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">{isRTL ? 'إجمالي العملاء' : 'Total Customers'}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{customers.length}</p>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm flex items-center p-4">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500 mr-3">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">{isRTL ? 'سجل الزيارات' : 'Total Visits Recorded'}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{visits.length}</p>
          </div>
        </Card>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 text-center">{isRTL ? 'رقم العميل ID' : 'ID'}</th>
                <th className="px-5 py-3.5">{isRTL ? 'اسم العميل' : 'Customer Name'}</th>
                <th className="px-5 py-3.5">{isRTL ? 'رقم الهاتف' : 'Phone'}</th>
                <th className="px-5 py-3.5">{isRTL ? 'ملاحظات' : 'Notes'}</th>
                <th className="px-5 py-3.5 text-center">{isRTL ? 'الزيارات' : 'Visits'}</th>
                <th className="px-5 py-3.5 text-center">{isRTL ? 'الحجوزات' : 'Bookings'}</th>
                <th className="px-5 py-3.5 text-center">{isRTL ? 'الاشتراك' : 'Membership'}</th>
                <th className="px-5 py-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    {isRTL ? 'لا يوجد عملاء مطابقين للبحث' : 'No customers found'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const custBookings = getCustomerBookings(cust);
                  const custSubs = getCustomerSubscriptions(cust);
                  const activeSub = custSubs.find(s => s.isActive && (!s.endDate || isAfter(new Date(s.endDate), new Date())));

                  return (
                    <tr 
                      key={cust.id} 
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsProfileOpen(true);
                      }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 text-center">
                        <Badge variant="outline" className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20 font-bold px-2.5 py-1">
                          #{cust.customerId}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        {cust.name}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300" dir="ltr">
                        {cust.phone}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 max-w-[200px] truncate">
                        {cust.notes || cust.email || '-'}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {cust.totalVisits || getCustomerVisits(cust).length || 0}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {custBookings.length}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {activeSub ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                            {isRTL ? 'نشط' : 'Active'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800">
                            {isRTL ? 'بدون' : 'None'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-lg"
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsProfileOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            onClick={(e) => handleOpenEditModal(cust, e)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                            onClick={(e) => handleOpenDeleteModal(cust, e)}
                            title={isRTL ? 'حذف العميل' : 'Delete Customer'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingCustomer 
                ? (isRTL ? 'تعديل بيانات العميل' : 'Edit Customer')
                : (isRTL ? 'إضافة عميل جديد' : 'Add New Customer')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-2">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'اسم العميل *' : 'Customer Name *'}
              </label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={isRTL ? 'أدخل اسم العميل' : 'Enter customer name'}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'رقم الهاتف *' : 'Phone Number *'}
              </label>
              <Input 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="01xxxxxxxxx"
                className="rounded-xl"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
              </label>
              <Input 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="example@mail.com"
                type="email"
                className="rounded-xl"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'ملاحظات' : 'Notes'}
              </label>
              <Input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder={isRTL ? 'أية ملاحظات إضافية...' : 'Any extra notes...'}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl">
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-lg">
                    #{selectedCustomer.customerId}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedCustomer.name}
                    </DialogTitle>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5" dir="ltr">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedCustomer.phone}</span>
                      {selectedCustomer.email && (
                        <>
                          <span>•</span>
                          <Mail className="w-3.5 h-3.5" />
                          <span>{selectedCustomer.email}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-9 px-3 text-xs gap-1.5 rounded-xl"
                    onClick={(e) => handleOpenEditModal(selectedCustomer, e)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-9 px-3 text-xs gap-1.5 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    onClick={(e) => handleOpenDeleteModal(selectedCustomer, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'حذف' : 'Delete'}</span>
                  </Button>
                </div>
              </div>
              {selectedCustomer.notes && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{selectedCustomer.notes}</span>
                </div>
              )}
            </DialogHeader>

            {/* Customer Details Tabs */}
            <Tabs defaultValue="visits" className="w-full mt-4">
              <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1">
                <TabsTrigger value="visits" className="rounded-lg text-xs font-bold">
                  {isRTL ? 'سجل الزيارات' : 'Visits'} ({getCustomerVisits(selectedCustomer).length})
                </TabsTrigger>
                <TabsTrigger value="bookings" className="rounded-lg text-xs font-bold">
                  {isRTL ? 'الحجوزات' : 'Bookings'} ({getCustomerBookings(selectedCustomer).length})
                </TabsTrigger>
                <TabsTrigger value="subs" className="rounded-lg text-xs font-bold">
                  {isRTL ? 'الاشتراكات' : 'Memberships'} ({getCustomerSubscriptions(selectedCustomer).length})
                </TabsTrigger>
              </TabsList>

              {/* Visits Tab */}
              <TabsContent value="visits" className="pt-4 space-y-3">
                {getCustomerVisits(selectedCustomer).length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    {isRTL ? 'لا توجد زيارات مسجلة لهذا العميل حتى الآن' : 'No visits recorded yet'}
                  </p>
                ) : (
                  getCustomerVisits(selectedCustomer).map(v => (
                    <div key={v.id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-cyan-500" />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {format(new Date(v.date), 'dd MMMM yyyy - HH:mm', { locale: dateLocale })}
                          </p>
                          <p className="text-[11px] text-slate-500">{v.notes || (isRTL ? 'زيارة مساحة العمل' : 'Workspace Visit')}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {v.type}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Bookings Tab */}
              <TabsContent value="bookings" className="pt-4 space-y-3">
                {getCustomerBookings(selectedCustomer).length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    {isRTL ? 'لا توجد حجوزات لهذا العميل' : 'No room bookings found'}
                  </p>
                ) : (
                  getCustomerBookings(selectedCustomer).map(b => (
                    <div key={b.id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{getRoomName(b.roomId)}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {format(new Date(b.startTime), 'dd/MM/yyyy HH:mm', { locale: dateLocale })} → {format(new Date(b.endTime), 'HH:mm', { locale: dateLocale })}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {b.status}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Memberships Tab */}
              <TabsContent value="subs" className="pt-4 space-y-3">
                {getCustomerSubscriptions(selectedCustomer).length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    {isRTL ? 'لا توجد اشتراكات لهذا العميل' : 'No memberships found'}
                  </p>
                ) : (
                  getCustomerSubscriptions(selectedCustomer).map(s => (
                    <div key={s.id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white capitalize">
                          {s.type === 'package' ? (isRTL ? 'باقة ساعات' : 'Hours Package') : (isRTL ? 'اشتراك شهري' : 'Monthly Sub')}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {format(new Date(s.startDate), 'dd/MM/yyyy')} → {s.endDate ? format(new Date(s.endDate), 'dd/MM/yyyy') : '∞'}
                        </p>
                      </div>
                      <div>
                        {s.type === 'package' ? (
                          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">
                            {s.remainingHours || 0} / {s.totalHours || 0} {t('common.hours')}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                            {s.isActive ? (isRTL ? 'ساري' : 'Active') : (isRTL ? 'منتهي' : 'Expired')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Customer Confirmation Dialog */}
      <Dialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'تأكيد حذف العميل' : 'Confirm Delete Customer'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isRTL ? 'هذا الإجراء لا يمكن التراجع عنه' : 'This action cannot be undone'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {customerToDelete && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 my-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{customerToDelete.name}</span>
                <Badge variant="outline" className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20 font-bold">
                  #{customerToDelete.customerId}
                </Badge>
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5" dir="ltr">
                <Phone className="w-3 h-3" />
                <span>{customerToDelete.phone}</span>
              </p>
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isRTL 
              ? 'هل أنت متأكد من رغبتك في حذف هذا العميل من النظام؟ سيتم حذف بيانات العميل نهائيًا.'
              : 'Are you sure you want to delete this customer? Their customer profile will be permanently removed.'}
          </p>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomerToDelete(null)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isRTL ? 'جاري الحذف...' : 'Deleting...'}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{isRTL ? 'تأكيد الحذف' : 'Delete Customer'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
