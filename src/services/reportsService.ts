import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Session } from '../types';
import { toMillis } from '../lib/utils-workspace';

export const reportsService = {
  async getSessionsByDateRange(startDate: number, endDate: number) {
    try {
      const q = query(
        collection(db, 'sessions'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
    } catch (err) {
      console.warn('Error querying sessions by date range, falling back to in-memory filter:', err);
      const snapshot = await getDocs(collection(db, 'sessions'));
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
      return all.filter(s => {
        const t = toMillis(s.createdAt ?? s.startTime);
        return t >= startDate && t <= endDate;
      });
    }
  },

  async getRevenueStats(days: number = 30) {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const sessions = await this.getSessionsByDateRange(startDate, Date.now());
    
    const dailyRevenue: Record<string, number> = {};
    
    sessions.forEach(session => {
      const dateMs = toMillis(session.createdAt ?? session.startTime);
      const date = new Date(dateMs).toLocaleDateString();
      const paid = session.paidAmount !== undefined 
        ? session.paidAmount 
        : (session.paymentStatus === 'unpaid' ? 0 : (session.totalCost || 0));
      dailyRevenue[date] = (dailyRevenue[date] || 0) + paid;
    });
    
    return Object.entries(dailyRevenue).map(([date, amount]) => ({
      date,
      amount
    }));
  }
};
