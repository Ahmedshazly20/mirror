import { formatDuration } from '../../../lib/utils-workspace';

export interface ThermalReceiptData {
  userName: string;
  phoneNumber?: string;
  roomName?: string;
  tableNumber?: string;
  startTime: any;
  endTime: number;
  duration: number;
  timeCost: number;
  servicesCost: number;
  serviceDiscountTotal?: number;
  subtotal?: number;
  discountPercentage?: number;
  discountAmount?: number;
  totalCost: number;
  services: any[];
  isSubscribed?: boolean;
  notes?: string;
  remainingHours?: number;
  deductedHours?: number;
  paymentMethod?: 'cash' | 'instapay';
  timeDiscount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  isBookingSession?: boolean;
  bookingTotal?: number;
  depositAmount?: number;
  collectedNow?: number;
}

export function printThermalReceipt(data: ThermalReceiptData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const date = new Date().toLocaleString('ar-EG');
  const startDate = new Date(
    typeof data.startTime === 'object' && data.startTime?.seconds
      ? data.startTime.seconds * 1000
      : Number(data.startTime)
  ).toLocaleTimeString('ar-EG');

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة - Operix</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 8px 10px;
          font-size: 13px;
          color: #000;
          background: #fff;
        }
        .center { text-align: center; }
        .logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
        .sub  { font-size: 11px; color: #555; margin-bottom: 2px; }
        .dashes { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px; }
        .row.bold { font-weight: bold; font-size: 13px; }
        .section-title { font-size: 11px; font-weight: bold; margin: 6px 0 3px; }
        .service-row { display: flex; justify-content: space-between; font-size: 11px; color: #333; margin: 2px 0 2px 8px; }
        .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 4px; }
        .footer { text-align: center; font-size: 11px; margin-top: 14px; color: #444; line-height: 1.6; }
        .type-badge { display: inline-block; border: 1px solid #000; padding: 1px 6px; font-size: 10px; border-radius: 3px; margin-top: 2px; }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="logo">Operix</div>
        <div class="sub">نظام إدارة مساحات العمل</div>
        <div class="sub">${date}</div>
      </div>

      <hr class="dashes">

      <div class="row bold">
        <span>العميل</span>
        <span>${data.userName}</span>
      </div>
      ${data.phoneNumber ? `<div class="row"><span>الهاتف</span><span dir="ltr">${data.phoneNumber}</span></div>` : ''}
      <div class="row">
        <span>النوع</span>
        <span class="type-badge">${data.isBookingSession ? 'حجز غرفة (سعر ثابت) 🏢' : data.isSubscribed ? 'مشترك ✓' : 'زائر'}</span>
      </div>
      ${data.roomName ? `<div class="row"><span>المكان</span><span>${data.roomName}${data.tableNumber ? ' / ' + data.tableNumber : ''}</span></div>` : ''}

      <hr class="dashes">

      <div class="row"><span>بداية الجلسة</span><span>${startDate}</span></div>
      <div class="row"><span>المدة</span><span>${formatDuration(data.duration)}</span></div>

      <hr class="dashes">

      ${data.isBookingSession ? `
        <div class="row bold"><span>حجز الغرفة (سعر ثابت)</span><span>${(data.bookingTotal || data.timeCost).toFixed(2)} ج.م</span></div>
      ` : `
        <div class="row"><span>تكلفة الوقت</span><span>${data.timeCost.toFixed(2)} ج.م</span></div>
      `}
      ${data.timeDiscount ? `<div class="row" style="color:red"><span>خصم الوقت الإضافي</span><span>-${data.timeDiscount.toFixed(2)} ج.م</span></div>` : ''}

      ${data.deductedHours ? `<div class="row"><span>ساعات مخصومة</span><span>${data.deductedHours} ساعة</span></div>` : ''}
      ${data.remainingHours !== undefined ? `<div class="row"><span>ساعات متبقية</span><span>${data.remainingHours} ساعة</span></div>` : ''}

      ${data.services && data.services.length > 0 ? `
        <div class="section-title">▸ الطلبات والخدمات الإضافية</div>
        ${data.services.map(s => `
          <div class="service-row">
            <span>${s.name} × ${s.quantity}</span>
            <span>${(s.price * s.quantity).toFixed(2)} ج.م</span>
          </div>
        `).join('')}
        <div class="row" style="margin-top:4px">
          <span>إجمالي الخدمات</span>
          <span>${data.servicesCost.toFixed(2)} ج.م</span>
        </div>
        ${data.serviceDiscountTotal ? `<div class="row" style="color:green"><span>خصم الخدمات</span><span>-${data.serviceDiscountTotal.toFixed(2)} ج.م</span></div>` : ''}
      ` : ''}

      ${data.notes ? `
        <hr class="dashes">
        <div class="section-title">ملاحظات</div>
        <div style="font-size:11px;color:#333">${data.notes}</div>
      ` : ''}

      <hr class="dashes">

      ${data.paymentMethod ? `<div class="row"><span>طريقة الدفع</span><span>${data.paymentMethod === 'cash' ? 'كاش (Cash) 💵' : 'إنستا باي (InstaPay) ⚡'}</span></div>` : ''}

      ${data.subtotal !== undefined && (data.discountAmount || 0) > 0 ? `
        <div class="row" style="margin-top:4px">
          <span>المجموع الفرعي (Subtotal)</span>
          <span>${data.subtotal.toFixed(2)} ج.م</span>
        </div>
        <div class="row" style="color:green; font-weight: bold;">
          <span>الخصم (${data.discountPercentage || 0}%)</span>
          <span>-${(data.discountAmount || 0).toFixed(2)} ج.م</span>
        </div>
      ` : ''}

      <div class="total-row">
        <span>إجمالي الفاتورة (Final Total)</span>
        <span>${data.totalCost.toFixed(2)} ج.م</span>
      </div>

      ${data.depositAmount !== undefined && data.depositAmount > 0 ? `
        <div class="row" style="margin-top:4px; color:#16a34a">
          <span>العربون / المقدم المدفوع</span>
          <span>-${data.depositAmount.toFixed(2)} ج.م ✓</span>
        </div>
      ` : ''}

      ${data.collectedNow !== undefined ? `
        <div class="row" style="margin-top:2px">
          <span>المدفوع الآن</span>
          <span>${data.collectedNow.toFixed(2)} ج.م</span>
        </div>
      ` : data.paidAmount !== undefined ? `
        <div class="row" style="margin-top:4px">
          <span>إجمالي المدفوع</span>
          <span>${data.paidAmount.toFixed(2)} ج.م</span>
        </div>
      ` : ''}

      ${data.remainingAmount !== undefined ? `
        <div class="row bold" style="color:${data.remainingAmount > 0 ? '#d97706' : '#16a34a'}; margin-top:3px">
          <span>${data.remainingAmount > 0 ? 'المتبقي على العميل' : 'حالة الحساب'}</span>
          <span>${data.remainingAmount > 0 ? data.remainingAmount.toFixed(2) + ' ج.م' : 'خالص بالكامل ✓'}</span>
        </div>
      ` : ''}

      <div class="footer">
        ━━━━━━━━━━━━━━━━━━━━━<br>
        شكراً لزيارتكم 🙏<br>
        Operix System
      </div>

      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function handleReprint(session: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const startMs = session.startTime.toMillis ? session.startTime.toMillis() : Number(session.startTime);
  const endMs   = session.endTime?.toMillis ? session.endTime.toMillis() : (session.endTime ? Number(session.endTime) : Date.now());
  const date    = new Date(endMs).toLocaleString('ar-EG');
  const startTime = new Date(startMs).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const endTime   = new Date(endMs).toLocaleTimeString('ar-EG',   { hour: '2-digit', minute: '2-digit' });

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة - Operix</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm; margin: 0 auto; padding: 8px 10px;
          font-size: 13px; color: #000; background: #fff;
        }
        .center  { text-align: center; }
        .logo    { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
        .sub     { font-size: 11px; color: #555; margin-bottom: 2px; }
        .dashes  { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .row     { display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px; }
        .row.bold { font-weight: bold; font-size: 13px; }
        .section-title { font-size: 11px; font-weight: bold; margin: 6px 0 3px; }
        .service-row { display: flex; justify-content: space-between; font-size: 11px; color: #333; margin: 2px 0 2px 8px; }
        .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 4px; }
        .footer  { text-align: center; font-size: 11px; margin-top: 14px; color: #444; line-height: 1.6; }
        .reprint { text-align: center; font-size: 10px; color: #999; margin-top: 6px; border-top: 1px dashed #ccc; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="logo">Operix</div>
        <div class="sub">نظام إدارة مساحات العمل</div>
        <div class="sub">${date}</div>
      </div>
      <hr class="dashes">
      <div class="row bold"><span>العميل</span><span>${session.userName}</span></div>
      ${session.phoneNumber ? `<div class="row"><span>الهاتف</span><span dir="ltr">${session.phoneNumber}</span></div>` : ''}
      <div class="row">
        <span>النوع</span>
        <span style="border:1px solid #000;padding:1px 5px;font-size:10px;border-radius:3px">${(session.pricingType === 'booking' || session.bookingId) ? 'حجز غرفة (سعر ثابت) 🏢' : session.isSubscribed ? 'مشترك ✓' : 'زائر'}</span>
      </div>
      ${session.roomAssignment?.roomName ? `<div class="row"><span>المكان</span><span>${session.roomAssignment.roomName}${session.roomAssignment.tableLabel ? ' / ' + session.roomAssignment.tableLabel : ''}</span></div>` : ''}
      <hr class="dashes">
      <div class="row"><span>بداية الجلسة</span><span>${startTime}</span></div>
      <div class="row"><span>نهاية الجلسة</span><span>${endTime}</span></div>
      <div class="row"><span>المدة</span><span>${formatDuration(session.duration || 0)}</span></div>
      <hr class="dashes">
      ${(session.pricingType === 'booking' || session.bookingId) ? `
        <div class="row bold"><span>حجز الغرفة (سعر ثابت)</span><span>${(session.timeCost || 0).toFixed(2)} ج.م</span></div>
      ` : `
        <div class="row"><span>تكلفة الوقت</span><span>${(session.timeCost || 0).toFixed(2)} ج.م</span></div>
      `}
      ${session.deductedHours ? `<div class="row"><span>ساعات مخصومة</span><span>${session.deductedHours} ساعة</span></div>` : ''}
      ${session.services?.length > 0 ? `
        <div class="section-title">▸ الطلبات والخدمات</div>
        ${session.services.map((s: any) => `
          <div class="service-row">
            <span>${s.name} × ${s.quantity}</span>
            <span>${(s.price * s.quantity).toFixed(2)} ج.م</span>
          </div>
        `).join('')}
        <div class="row" style="margin-top:4px">
          <span>إجمالي الخدمات</span>
          <span>${(session.servicesCost || 0).toFixed(2)} ج.م</span>
        </div>
        ${session.serviceDiscountTotal ? `<div class="row" style="color:green"><span>خصم الخدمات</span><span>-${session.serviceDiscountTotal.toFixed(2)} ج.م</span></div>` : ''}
      ` : ''}
      ${session.notes ? `<hr class="dashes"><div class="section-title">ملاحظات</div><div style="font-size:11px;color:#333">${session.notes}</div>` : ''}
      <hr class="dashes">
      <div class="total-row">
        <span>الإجمالي</span>
        <span>${session.totalCost.toFixed(2)} ج.م</span>
      </div>
      ${session.paidAmount !== undefined ? `
        <div class="row" style="margin-top:4px">
          <span>إجمالي المدفوع</span>
          <span>${session.paidAmount.toFixed(2)} ج.م</span>
        </div>
      ` : ''}
      ${session.remainingAmount !== undefined ? `
        <div class="row bold" style="color:${session.remainingAmount > 0 ? '#d97706' : '#16a34a'}; margin-top:3px">
          <span>${session.remainingAmount > 0 ? 'المتبقي على العميل' : 'حالة الحساب'}</span>
          <span>${session.remainingAmount > 0 ? session.remainingAmount.toFixed(2) + ' ج.م' : 'خالص بالكامل ✓'}</span>
        </div>
      ` : ''}
      <div class="footer">━━━━━━━━━━━━━━━━━━━━━<br>شكراً لزيارتكم 🙏<br>Operix System</div>
      <div class="reprint">🖨 إعادة طباعة</div>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
