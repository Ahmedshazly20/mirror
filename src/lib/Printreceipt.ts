/**
 * printReceipt — يشتغل في Electron وفي المتصفح العادي
 * استخدمه بدل window.open في كل مكان محتاج طباعة
 */
export async function printReceipt(htmlContent: string): Promise<void> {
  // ── Electron ─────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && (window as any).electronAPI?.printReceipt) {
    try {
      await (window as any).electronAPI.printReceipt(htmlContent);
    } catch (err) {
      console.error('Electron print error:', err);
    }
    return;
  }

  // ── Web browser fallback ──────────────────────────────────────────────────
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    console.warn('Could not open print window');
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  // المتصفح بيعمل print تلقائياً لأن الـ HTML فيه window.onload = print
}