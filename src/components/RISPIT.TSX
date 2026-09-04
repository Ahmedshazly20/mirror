import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '../lib/utils-workspace';

interface ReceiptData {
  userName: string;
  phoneNumber?: string;
  roomName?: string;
  tableNumber?: string;
  startTime: any;
  endTime: any;
  duration: number;
  timeCost: number;
  servicesCost: number;
  totalCost: number;
  services: any[];
  isSubscribed?: boolean;
}

export function ReceiptPrinter({ data }: { data: ReceiptData }) {
  const handlePrint = async () => {
    const date = new Date().toLocaleString('ar-EG');

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - Operix</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }

          @page {
            size: 80mm auto;
            margin: 0mm;
          }

          html, body {
            width: 80mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .wrap {
            width: 76mm;
            margin: 0 auto;
            padding: 4mm 0;
          }

          .center { text-align: center; }

          .logo {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 2px;
          }

          .sub {
            font-size: 9px;
            color: #444;
            margin-top: 1px;
          }

          .dashes {
            border: none;
            border-top: 1px dashed #000;
            margin: 4mm 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 2px;
            font-size: 11px;
          }

          .row .label { color: #333; }
          .row .value { font-weight: bold; }

          .section-title {
            font-size: 10px;
            font-weight: bold;
            margin: 3mm 0 1mm;
          }

          .service-line {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin-bottom: 1px;
            padding-right: 3mm;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 15px;
            font-weight: 900;
            margin-top: 2mm;
          }

          .footer {
            text-align: center;
            font-size: 9px;
            color: #555;
            margin-top: 4mm;
            line-height: 1.8;
          }
        </style>
      </head>
      <body>
        <div class="wrap">

          <div class="center">
            <div class="logo">Operix</div>
            <div class="sub">نظام إدارة مساحات العمل</div>
            <div class="sub">${date}</div>
          </div>

          <hr class="dashes">

          <div class="row">
            <span class="label">العميل</span>
            <span class="value">${data.userName}</span>
          </div>
          ${data.phoneNumber ? `
          <div class="row">
            <span class="label">الهاتف</span>
            <span class="value" dir="ltr">${data.phoneNumber}</span>
          </div>` : ''}
          <div class="row">
            <span class="label">النوع</span>
            <span class="value">${data.isSubscribed ? 'مشترك ✓' : 'زائر'}</span>
          </div>
          ${data.roomName ? `
          <div class="row">
            <span class="label">المكان</span>
            <span class="value">${data.roomName}${data.tableNumber ? ' / ' + data.tableNumber : ''}</span>
          </div>` : ''}

          <hr class="dashes">

          <div class="row">
            <span class="label">المدة</span>
            <span class="value">${formatDuration(data.duration)}</span>
          </div>
          <div class="row">
            <span class="label">تكلفة الوقت</span>
            <span class="value">${data.timeCost.toFixed(2)} ج.م</span>
          </div>

          ${data.services.length > 0 ? `
            <hr class="dashes">
            <div class="section-title">▸ الطلبات</div>
            ${data.services.map(s => `
              <div class="service-line">
                <span>${s.name} × ${s.quantity}</span>
                <span>${(s.price * s.quantity).toFixed(2)} ج.م</span>
              </div>
            `).join('')}
            <div class="row" style="margin-top:2mm">
              <span class="label">إجمالي الخدمات</span>
              <span class="value">${data.servicesCost.toFixed(2)} ج.م</span>
            </div>
          ` : ''}

          <hr class="dashes">

          <div class="total-row">
            <span>الإجمالي</span>
            <span>${data.totalCost.toFixed(2)} ج.م</span>
          </div>

          <div class="footer">
            ـــــــــــــــــــــ<br>
            شكراً لزيارتكم 🙏<br>
            Operix System
          </div>

        </div>
      </body>
      </html>
    `;

    if ((window as any).electronAPI?.printReceipt) {
      try {
        await (window as any).electronAPI.printReceipt(html);
      } catch (err) {
        console.error('فشل الطباعة:', err);
      }
    } else {
      const pw = window.open('', '_blank');
      if (!pw) return;
      pw.document.write(html);
      pw.document.close();
    }
  };

  return (
    <Button
      onClick={handlePrint}
      variant="outline"
      className="gap-2 border-cyan-500/20 text-cyan-600 hover:bg-cyan-500/10"
    >
      <Printer className="w-4 h-4" />
      طباعة الفاتورة
    </Button>
  );
}