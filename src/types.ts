export type Role = 'owner' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName?: string;
  name?: string;
  createdAt: number;
}

export interface ServiceInventoryComponent {
  inventoryItemId: string;
  quantity: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  category: string;
  inventoryItemId?: string;
  inventoryComponents?: ServiceInventoryComponent[];
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type PricingType = 'hourly' | 'daily' | 'subscription' | 'booking';

export interface SessionRoomAssignment {
  roomId: string;
  roomName: string;
  tableId: string;
  tableNumber: number;
  tableLabel?: string;
  groupSize: number;
}

export type SessionDurationMode = 'fixed' | 'full_day' | 'open';

export interface Session {
  id: string;
  userName: string;
  phoneNumber: string;
  customerId?: string;
  whatsappOptIn?: boolean;
  startTime: any; // Firestore Timestamp
  endTime: any | null; // Firestore Timestamp | null
  duration?: number; // minutes
  pricingType: PricingType;
  durationMode?: SessionDurationMode;
  selectedHours?: number; // 1 - 8 hours when fixed
  isSubscribed: boolean;
  timeCost: number;
  servicesCost: number;
  services: {
    id?: string;
    serviceId?: string;
    inventoryItemId?: string;
    name: string;
    price: number;
    quantity: number;
    originalPrice?: number;
    discountAmount?: number;
  }[];
  subtotal?: number;
  discountPercentage?: number;
  discountAmount?: number;
  totalCost: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  serviceDiscountTotal?: number;
  status: 'active' | 'completed';
  notes: string;
  createdAt: any; // Firestore Timestamp
  roomAssignment?: SessionRoomAssignment;
  subscriptionId?: string;
  deductedHours?: number;
  deductedMinutes?: number;
  remainingMinutes?: number;
  paymentMethod?: 'cash' | 'instapay';
  timeDiscount?: number;
  bookingId?: string;
}

export interface RoomTable {
  id: string;
  number: number;
  label?: string;
  capacity: number;
}

export type RoomType = 
  | 'shared_space' 
  | 'single_pod' 
  | 'meeting_room' 
  | 'lecture_room' 
  | 'office_2_3' 
  | 'office_1' 
  | 'office_4';

export interface Room {
  id: string;
  name: string;
  pricePerHour: number;
  capacity: number;
  tables: RoomTable[];
  type?: RoomType;
  pricingType?: RoomType;
  status?: 'available' | 'occupied' | 'maintenance';
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type BookingStatus = 'confirmed' | 'active' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  roomId: string;
  userName: string;
  phoneNumber: string;
  customerId?: string;
  startTime: number;
  endTime: number;
  totalPrice: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  paymentMethod?: 'cash' | 'instapay' | 'card';
  status?: BookingStatus;
  notes?: string;
  createdAt: number;
  activeSessionId?: string;
  cancellationReason?: string;
  cancelledAt?: number;
  lostDeposit?: number;
}

export interface Package {
  id: string;
  name: string;
  totalHours: number;
  price: number;
  isActive: boolean;
  validityDays?: number;
  description?: string;
  roomId?: string;
  roomName?: string;
  createdAt: number;
}

export type SubscriptionType = 'monthly' | 'package';

export interface Subscription {
  id: string;
  userName: string;
  phoneNumber: string;
  customerId?: string;
  whatsappOptIn?: boolean;
  startDate: number;
  endDate: number | null;
  validityDays?: number;
  isActive: boolean;
  price: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'paid' | 'partially_paid' | 'unpaid';
  paymentMethod?: 'cash' | 'instapay';
  createdAt: number;
  type: SubscriptionType;
  packageId?: string;
  totalHours?: number;
  remainingHours?: number;
  usedHours?: number;
  totalMinutes?: number;
  remainingMinutes?: number;
  usedMinutes?: number;
  allowedDays?: string[]; // ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  allowedSpaceTypes?: string[]; // ['shared_space', 'meeting_room', etc.] or room IDs
  roomId?: string;
  roomName?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: any;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  date: any;
  notes: string;
  createdAt: any;
}

// ── Customer Management ────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  customerId: number; // Unique numeric ID e.g., 12
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalVisits?: number;
  lastVisit?: number;
  totalBookings?: number;
  totalSpent?: number;
  outstandingBalance?: number;
  createdAt: number;
  updatedAt?: number;
}

// ── Visits ────────────────────────────────────────────────────────────────────
export interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  date: number;
  type: 'session' | 'booking' | 'visit';
  referenceId?: string;
  notes?: string;
  createdAt: number;
}

// ── Payments ──────────────────────────────────────────────────────────────────
export interface Payment {
  id: string;
  bookingId?: string;
  customerId?: string;
  subscriptionId?: string;
  sessionId?: string;
  amount: number;
  paymentMethod: 'cash' | 'instapay' | 'card';
  date: number;
  notes?: string;
  createdAt: number;
  createdBy?: string;
}

// ── Inventory Management ──────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  purchasePrice: number;
  sellingPrice: number;
  active: boolean;
  createdAt: number;
  updatedAt?: number;
}

export type StockMovementType = 'restock' | 'sale' | 'adjustment' | 'return' | 'waste';

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: 'service' | 'session' | 'manual' | 'booking';
  referenceId?: string;
  createdAt: number;
  notes?: string;
  createdBy?: string;
}

// ── Pricing Table Matrix Rules ─────────────────────────────────────────────────
export interface RoomPricingRule {
  roomType: RoomType;
  prices: Record<number, number>; // e.g. { 1: 200, 2: 386, 3: 557, ... }
}

export interface WorkspaceSettings {
  pricing: {
    firstHourPrice: number;
    secondHourPrice: number;
    dailyCapPrice: number;
    minChargeMinutes: number;
  };
  pricingRules?: Record<RoomType, Record<number, number>>;
  subscriptions: {
    enabled: boolean;
    monthlyPrice: number;
    durationDays: number;
  };
  rooms: Room[];
  globalServiceDiscount: {
    enabled: boolean;
    percentage: number;
  };
}

export type Theme = 'light' | 'dark';

// ── Electron API (exposed via Preload.js) ─────────────────────────────────────
declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (html: string) => Promise<{ success: boolean }>;
    };
  }
}