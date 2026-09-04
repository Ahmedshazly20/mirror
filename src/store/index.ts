import { create } from 'zustand';
import { 
  Session, 
  Booking, 
  Room, 
  Subscription, 
  WorkspaceSettings, 
  Theme, 
  UserProfile,
  ServiceItem,
  Expense,
  ExpenseCategory,
  Package,
  PricingType,
  Customer,
  InventoryItem,
  InventoryMovement,
  Visit,
  Payment,
  RoomType
} from '../types';
import { sessionService } from '../services/sessionService';
import { toMillis } from '../lib/utils-workspace';
import { DEFAULT_BOOKABLE_ROOMS, DEFAULT_PRICING_TABLE, pricingService } from '../services/pricingService';

interface WorkspaceState {
  // Auth State
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  
  // Data State
  sessions: Session[];
  completedSessions: Session[];
  bookings: Booking[];
  rooms: Room[];
  subscriptions: Subscription[];
  packages: Package[];
  availableServices: ServiceItem[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  customers: Customer[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  visits: Visit[];
  payments: Payment[];
  settings: WorkspaceSettings;
  theme: Theme;
  
  // UI State
  isNewSessionModalOpen: boolean;
  setIsNewSessionModalOpen: (open: boolean) => void;

  // Loading States
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setCompletedSessions: (sessions: Session[]) => void;
  setBookings: (bookings: Booking[]) => void;
  setRooms: (rooms: Room[]) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  setPackages: (packages: Package[]) => void;
  setAvailableServices: (services: ServiceItem[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setExpenseCategories: (categories: ExpenseCategory[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setInventoryItems: (items: InventoryItem[]) => void;
  setInventoryMovements: (movements: InventoryMovement[]) => void;
  setVisits: (visits: Visit[]) => void;
  setPayments: (payments: Payment[]) => void;
  setSettings: (settings: WorkspaceSettings) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  
  // Pricing Logic
  calculateSessionCost: (session: Partial<Session>) => { 
    total: number; 
    subtotal: number;
    discountPercentage: number;
    discountAmount: number;
    timeCost: number; 
    servicesCost: number; 
    duration: number; 
    type: PricingType;
    serviceDiscountTotal: number;
    bookingDeposit?: number;
    bookingTotal?: number;
    linkedBooking?: Booking | null;
  };
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  pricing: {
    firstHourPrice: 40,
    secondHourPrice: 40,
    dailyCapPrice: 100,
    minChargeMinutes: 60,
  },
  subscriptions: {
    enabled: true,
    monthlyPrice: 1000,
    durationDays: 30,
  },
  rooms: DEFAULT_BOOKABLE_ROOMS,
  pricingRules: DEFAULT_PRICING_TABLE,
  globalServiceDiscount: {
    enabled: false,
    percentage: 0
  }
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  sessions: [],
  completedSessions: [],
  bookings: [],
  rooms: DEFAULT_BOOKABLE_ROOMS,
  subscriptions: [],
  packages: [],
  availableServices: [],
  expenses: [],
  expenseCategories: [],
  customers: [],
  inventoryItems: [],
  inventoryMovements: [],
  visits: [],
  payments: [],
  settings: DEFAULT_SETTINGS,
  theme: 'dark',
  
  isNewSessionModalOpen: false,
  setIsNewSessionModalOpen: (isNewSessionModalOpen) => set({ isNewSessionModalOpen }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  setSessions: (sessions) => {
    const seenIds = new Set<string>();
    const seenBookingIds = new Set<string>();
    const seenRoomSlots = new Set<string>();
    const cleanSessions: Session[] = [];

    for (const s of sessions) {
      if (!s || !s.id || s.status !== 'active') continue;
      if (seenIds.has(s.id)) continue;

      if (s.bookingId) {
        if (seenBookingIds.has(s.bookingId)) continue;
        seenBookingIds.add(s.bookingId);
      }

      if (s.roomAssignment?.roomId) {
        const roomKey = `${s.roomAssignment.roomId}_${s.bookingId || s.userName.trim().toLowerCase()}`;
        if (seenRoomSlots.has(roomKey)) continue;
        seenRoomSlots.add(roomKey);
      }

      seenIds.add(s.id);
      cleanSessions.push(s);
    }

    set({ sessions: cleanSessions });
  },
  setCompletedSessions: (completedSessions) => set({ completedSessions }),
  setBookings: (bookings) => set({ bookings }),
  setRooms: (rooms) => set((state) => ({ 
    rooms: rooms && rooms.length > 0 ? rooms : state.rooms,
    settings: {
      ...state.settings,
      rooms: rooms && rooms.length > 0 ? rooms : state.settings.rooms
    }
  })),
  setSubscriptions: (subscriptions) => set({ subscriptions }),
  setPackages: (packages) => set({ packages }),
  setAvailableServices: (availableServices) => set({ availableServices }),
  setExpenses: (expenses) => set({ expenses }),
  setExpenseCategories: (expenseCategories) => set({ expenseCategories }),
  setCustomers: (customers) => set({ customers }),
  setInventoryItems: (inventoryItems) => set({ inventoryItems }),
  setInventoryMovements: (inventoryMovements) => set({ inventoryMovements }),
  setVisits: (visits) => set({ visits }),
  setPayments: (payments) => set({ payments }),
  setSettings: (settings) => set((state) => {
    const finalRooms = (settings.rooms && settings.rooms.length > 0) 
      ? settings.rooms 
      : (state.rooms && state.rooms.length > 0 ? state.rooms : DEFAULT_BOOKABLE_ROOMS);
    return {
      settings: { ...DEFAULT_SETTINGS, ...settings, rooms: finalRooms },
      rooms: finalRooms
    };
  }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  calculateSessionCost: (session) => {
    const { settings, subscriptions, rooms, bookings } = get();
    const { globalServiceDiscount, pricingRules } = settings;
    
    const startTime = toMillis(session.startTime);
    const now = toMillis(session.endTime);
    const diffMs = now - startTime;
    const diffMinutes = Math.max(diffMs / (1000 * 60), 0);
    
    let timeCost = 0;
    let type: PricingType = session.pricingType || 'hourly';

    // 1. Check if session is linked to a Room Booking (Fixed Price)
    const linkedBooking = session.bookingId ? bookings.find(b => b.id === session.bookingId) : null;
    const isBookingSession = !!session.bookingId || session.pricingType === 'booking';

    if (isBookingSession) {
      // Fixed price Room Booking: Price is strictly fixed from booking total price (or initial timeCost)
      // It does NOT change with elapsed duration/minutes
      const fixedBookingPrice = linkedBooking?.totalPrice ?? (session.timeCost || 0);
      timeCost = fixedBookingPrice;
      type = 'booking';
    } else if (session.isSubscribed) {
      timeCost = 0; // Covered by subscription or package
      type = 'subscription';
    } else {
      // Pricing Table matrix from Settings (or DEFAULT_PRICING_TABLE)
      const activeRules = pricingRules || DEFAULT_PRICING_TABLE;

      // Space / Room determination
      let spaceOrRoom: Room | RoomType | string = 'shared_space';
      if (session.roomAssignment && (session.roomAssignment.roomId || session.roomAssignment.roomName)) {
        const roomObj = rooms.find(r => r.id === session.roomAssignment?.roomId) || 
                        settings.rooms?.find(r => r.id === session.roomAssignment?.roomId) ||
                        session.roomAssignment.roomName;
        spaceOrRoom = roomObj;
      }

      // Check durationMode: 'fixed' | 'full_day' | 'open'
      const mode = session.durationMode || (session.pricingType === 'daily' ? 'full_day' : 'open');

      if (mode === 'full_day' || session.pricingType === 'daily') {
        // Full Day: 8-hour price from matrix
        timeCost = pricingService.getFullDayPrice(spaceOrRoom, activeRules);
        type = 'daily';
      } else if (mode === 'fixed' && session.selectedHours) {
        // Fixed duration (1-8 hours) directly from pricing table
        timeCost = pricingService.calculateSessionModeCost(
          spaceOrRoom,
          'fixed',
          session.selectedHours,
          diffMinutes,
          activeRules
        );
        type = 'hourly';
      } else {
        // Open session: 1st hour price × actual hours
        timeCost = pricingService.calculateSessionModeCost(
          spaceOrRoom,
          'open',
          undefined,
          diffMinutes,
          activeRules
        );
        type = 'hourly';
      }
    }

    let serviceDiscountTotal = 0;
    const servicesCost = (session.services || []).reduce((acc, s) => {
      let itemPrice = s.price;
      const discountPercentage = Number(globalServiceDiscount?.percentage || 0);
      
      if (globalServiceDiscount?.enabled && discountPercentage > 0) {
        const discount = (s.price * discountPercentage) / 100;
        itemPrice = s.price - discount;
        serviceDiscountTotal += discount * (s.quantity || 1);
      }
      return acc + (itemPrice * (s.quantity || 1));
    }, 0);

    const subtotal = Math.round((timeCost + servicesCost) * 100) / 100;

    // Calculate discount
    const discountPercentage = Number(session.discountPercentage || 0);
    let discountAmount = 0;

    if (session.discountAmount !== undefined && session.discountAmount > 0) {
      discountAmount = session.discountAmount;
    } else if (discountPercentage > 0) {
      discountAmount = Math.round((subtotal * discountPercentage) / 100);
    } else if (session.timeDiscount && session.timeDiscount > 0) {
      discountAmount = session.timeDiscount;
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    const bookingDeposit = linkedBooking?.paidAmount ?? (session.paidAmount || 0);
    const bookingTotal = linkedBooking?.totalPrice ?? (isBookingSession ? timeCost : undefined);
    
    return { 
      total, 
      subtotal,
      discountPercentage,
      discountAmount,
      timeCost, 
      servicesCost, 
      duration: diffMinutes, 
      type,
      serviceDiscountTotal,
      bookingDeposit,
      bookingTotal,
      linkedBooking
    };
  },
}));
