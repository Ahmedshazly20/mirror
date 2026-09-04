import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Session } from '../types';

export const reportsService = {
  async getSessionsByDateRange(startDate: number, endDate: number) {
    const q = query(
      collection(db, 'sessions'),
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
  },

  async getRevenueStats(days: number = 30) {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const sessions = await this.getSessionsByDateRange(startDate, Date.now());
    
    const dailyRevenue: Record<string, number> = {};
    
    sessions.forEach(session => {
      const date = new Date(session.createdAt).toLocaleDateString();
      dailyRevenue[date] = (dailyRevenue[date] || 0) + session.totalCost;
    });
    
    return Object.entries(dailyRevenue).map(([date, amount]) => ({
      date,
      amount
    }));
  }
};
