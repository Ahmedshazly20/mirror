import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Report') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Professional Formatting (Auto-width)
  const maxWidths = data.reduce((acc: any, row: any) => {
    Object.keys(row).forEach((key, i) => {
      const val = row[key] ? row[key].toString() : '';
      acc[i] = Math.max(acc[i] || 0, val.length, key.length);
    });
    return acc;
  }, []);

  ws['!cols'] = maxWidths.map((w: number) => ({ wch: w + 2 }));

  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const formatSessionForExport = (sessions: any[], t: any) => {
  return sessions.map(s => ({
    [t('sessions.customer')]: s.userName,
    [t('common.phone')]: s.phoneNumber || '',
    [t('common.date')]: new Date(s.startTime?.seconds ? s.startTime.seconds * 1000 : s.startTime).toLocaleDateString('ar-EG'),
    [t('common.rooms')]: s.roomAssignment?.roomName || '',
    [t('rooms.tables')]: s.roomAssignment?.tableLabel || s.roomAssignment?.tableNumber || '',
    [t('sessions.duration')]: Math.floor(s.duration || 0) + ' ' + t('common.minutes'),
    [t('sessions.timeCost')]: s.timeCost,
    [t('sessions.servicesCost')]: s.servicesCost,
    [t('settings.globalDiscount')]: s.serviceDiscountTotal || 0,
    [t('sessions.totalBill')]: s.totalCost,
    [t('sessions.notes')]: s.notes || ''
  }));
};

export const formatSubscriptionForExport = (subs: any[], t: any) => {
  return subs.map(s => ({
    [t('sessions.customer')]: s.userName,
    [t('common.phone')]: s.phoneNumber,
    [t('subs.type')]: s.type === 'package' ? t('subs.package') : t('subs.monthly'),
    [t('subs.packageName')]: s.packageName || '',
    [t('subs.totalHours')]: s.totalHours || '',
    [t('subs.remainingHours')]: s.remainingHours || '',
    [t('common.date')]: new Date(s.startDate).toLocaleDateString('ar-EG'),
    [t('subs.expiry')]: s.endDate ? new Date(s.endDate).toLocaleDateString('ar-EG') : t('subs.noExpiry'),
    [t('common.status')]: s.status === 'active' ? t('common.active') : t('common.expired')
  }));
};

export const formatExpenseForExport = (expenses: any[], t: any) => {
  return expenses.map(e => ({
    [t('common.description')]: e.description,
    [t('common.category')]: e.category,
    [t('common.amount')]: e.amount,
    [t('common.date')]: new Date(e.date).toLocaleDateString('ar-EG'),
    [t('common.notes')]: e.notes || ''
  }));
};
