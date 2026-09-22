import { RoomType, Room, SpaceTypeConfig } from '../types';

export interface SpaceTypeOption {
  key: string;
  labelEn: string;
  labelAr: string;
  active?: boolean;
}

export const DEFAULT_SPACE_TYPES: SpaceTypeConfig[] = [
  { key: 'shared_space', labelEn: 'Shared Space', labelAr: 'مساحة مشتركة', active: true, isDefault: true },
  { key: 'single_pod',   labelEn: 'Single Pod',   labelAr: 'غرفة فردية (Pod)', active: true, isDefault: true },
  { key: 'meeting_room', labelEn: 'Meeting Room', labelAr: 'غرفة اجتماعات', active: true, isDefault: true },
  { key: 'lecture_room', labelEn: 'Lecture Room', labelAr: 'قاعة محاضرات', active: true, isDefault: true },
  { key: 'office_2_3',   labelEn: 'Office 2/3',   labelAr: 'مكتب 2 / 3', active: true, isDefault: true },
  { key: 'office_1',     labelEn: 'Office 1',     labelAr: 'مكتب 1', active: true, isDefault: true },
  { key: 'office_4',     labelEn: 'Office 4',     labelAr: 'مكتب 4', active: true, isDefault: true },
];

export const SUPPORTED_SPACE_TYPES: SpaceTypeOption[] = DEFAULT_SPACE_TYPES.map(s => ({
  key: s.key,
  labelEn: s.labelEn,
  labelAr: `${s.labelEn} (${s.labelAr})`,
  active: s.active
}));

export const BOOKABLE_ROOM_OPTIONS = [
  { id: 'meeting_room', nameEn: 'Meeting Room', nameAr: 'Meeting Room (غرفة اجتماعات)', pricingKey: 'meeting_room', defaultCapacity: 8, defaultPrice: 200 },
  { id: 'lecture_room', nameEn: 'Lecture Room', nameAr: 'Lecture Room (قاعة محاضرات)', pricingKey: 'lecture_room', defaultCapacity: 25, defaultPrice: 230 },
  { id: 'office_1',     nameEn: 'Office 1',     nameAr: 'Office 1 (مكتب 1)',         pricingKey: 'office_1',     defaultCapacity: 2, defaultPrice: 125 },
  { id: 'office_2',     nameEn: 'Office 2',     nameAr: 'Office 2 (مكتب 2)',         pricingKey: 'office_2_3',   defaultCapacity: 3, defaultPrice: 110 },
  { id: 'office_3',     nameEn: 'Office 3',     nameAr: 'Office 3 (مكتب 3)',         pricingKey: 'office_2_3',   defaultCapacity: 3, defaultPrice: 110 },
  { id: 'office_4',     nameEn: 'Office 4',     nameAr: 'Office 4 (مكتب 4)',         pricingKey: 'office_4',     defaultCapacity: 4, defaultPrice: 150 },
];

export const DEFAULT_BOOKABLE_ROOMS: Room[] = [
  { id: 'room-meeting',  name: 'Meeting Room', type: 'meeting_room', pricingType: 'meeting_room', capacity: 8,  pricePerHour: 200, status: 'available', active: true, tables: [] },
  { id: 'room-lecture',  name: 'Lecture Room', type: 'lecture_room', pricingType: 'lecture_room', capacity: 25, pricePerHour: 230, status: 'available', active: true, tables: [] },
  { id: 'room-office-1', name: 'Office 1',     type: 'office_1',     pricingType: 'office_1',     capacity: 2,  pricePerHour: 125, status: 'available', active: true, tables: [] },
  { id: 'room-office-2', name: 'Office 2',     type: 'office_2_3',   pricingType: 'office_2_3',   capacity: 3,  pricePerHour: 110, status: 'available', active: true, tables: [] },
  { id: 'room-office-3', name: 'Office 3',     type: 'office_2_3',   pricingType: 'office_2_3',   capacity: 3,  pricePerHour: 110, status: 'available', active: true, tables: [] },
  { id: 'room-office-4', name: 'Office 4',     type: 'office_4',     pricingType: 'office_4',     capacity: 4,  pricePerHour: 150, status: 'available', active: true, tables: [] },
];

export const DEFAULT_PRICING_TABLE: Record<string, Record<number, number>> = {
  shared_space: { 1: 30,  2: 55,  3: 80,  4: 100, 5: 120, 6: 130, 7: 140, 8: 150 },
  single_pod:   { 1: 30,  2: 55,  3: 80,  4: 100, 5: 120, 6: 130, 7: 140, 8: 150 },
  meeting_room: { 1: 200, 2: 386, 3: 557, 4: 714, 5: 857, 6: 936, 7: 1060, 8: 1140 },
  lecture_room: { 1: 230, 2: 415, 3: 600, 4: 760, 5: 910, 6: 1025, 7: 1165, 8: 1320 },
  office_2_3:   { 1: 110, 2: 210, 3: 300, 4: 380, 5: 450, 6: 510, 7: 565, 8: 625 },
  office_1:     { 1: 125, 2: 240, 3: 340, 4: 400, 5: 495, 6: 570, 7: 630, 8: 700 },
  office_4:     { 1: 150, 2: 280, 3: 400, 4: 500, 5: 580, 6: 655, 7: 735, 8: 800 },
};

export const ROOM_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  shared_space: { en: 'Shared Space', ar: 'مساحة مشتركة' },
  single_pod:   { en: 'Single Pod',   ar: 'غرفة فردية (Pod)' },
  meeting_room: { en: 'Meeting Room', ar: 'غرفة اجتماعات' },
  lecture_room: { en: 'Lecture Room', ar: 'قاعة محاضرات' },
  office_2_3:   { en: 'Office 2/3',   ar: 'مكتب 2 / 3' },
  office_1:     { en: 'Office 1',     ar: 'مكتب 1' },
  office_4:     { en: 'Office 4',     ar: 'مكتب 4' },
};

/**
 * Returns the effective list of space types (from settings or defaults)
 */
export function getEffectiveSpaceTypes(spaceTypes?: SpaceTypeConfig[] | null): SpaceTypeConfig[] {
  if (spaceTypes && spaceTypes.length > 0) {
    return spaceTypes;
  }
  return DEFAULT_SPACE_TYPES;
}

/**
 * Generates a slug key from a label string (e.g. "Private Room" -> "private_room")
 */
export function generateSpaceTypeKey(label: string): string {
  const clean = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || `space_${Date.now()}`;
}

export function mapRoomToPricingKey(
  room: Room | { name?: string; type?: string; pricingType?: string } | string | undefined,
  availableSpaceTypesOrTable?: SpaceTypeConfig[] | Record<string, any> | null
): string {
  if (!room) return 'shared_space';
  
  if (typeof room === 'string') {
    const s = room.trim();
    const sLower = s.toLowerCase();

    // Check against available space types
    if (availableSpaceTypesOrTable) {
      if (Array.isArray(availableSpaceTypesOrTable)) {
        const match = availableSpaceTypesOrTable.find(
          st => st.key === s || st.key.toLowerCase() === sLower || st.labelEn.toLowerCase() === sLower
        );
        if (match) return match.key;
      } else if (typeof availableSpaceTypesOrTable === 'object' && availableSpaceTypesOrTable[s]) {
        return s;
      }
    }

    if (DEFAULT_PRICING_TABLE[s]) return s;

    if (sLower.includes('lecture') || sLower.includes('محاضر') || sLower.includes('قاعة')) return 'lecture_room';
    if (sLower.includes('meeting') || sLower.includes('اجتماع')) return 'meeting_room';
    if (sLower.includes('office 1') || sLower === 'office_1' || sLower.includes('مكتب 1')) return 'office_1';
    if (sLower.includes('office 4') || sLower === 'office_4' || sLower.includes('مكتب 4')) return 'office_4';
    if (sLower.includes('office 2') || sLower.includes('office 3') || sLower === 'office_2_3' || sLower === 'office_2' || sLower === 'office_3' || sLower.includes('مكتب 2') || sLower.includes('مكتب 3')) return 'office_2_3';
    if (sLower.includes('single') || sLower.includes('pod') || sLower.includes('booth') || sLower === 'single_pod' || sLower.includes('فردي')) return 'single_pod';
    if (sLower.includes('shared') || sLower === 'shared_space' || sLower.includes('مشترك') || sLower.includes('عام') || sLower === 'open_space' || sLower.includes('open')) return 'shared_space';
    
    return s;
  }
  
  // Object room resolution: prefer pricingType, then type, then name
  if (room.pricingType) {
    return mapRoomToPricingKey(room.pricingType, availableSpaceTypesOrTable);
  }
  if (room.type) {
    return mapRoomToPricingKey(room.type, availableSpaceTypesOrTable);
  }
  if (room.name) {
    return mapRoomToPricingKey(room.name, availableSpaceTypesOrTable);
  }
  return 'shared_space';
}

export const pricingService = {
  /**
   * Returns exact price directly from the matrix pricing table for 1 to 8 hours.
   */
  getExactPrice(
    roomOrType: Room | RoomType | string | undefined,
    hours: number,
    customTable?: Record<string, Record<number, number>> | null
  ): number | null {
    if (hours < 1 || hours > 8) return null;
    const pricingKey = mapRoomToPricingKey(roomOrType, customTable);
    const table = customTable || DEFAULT_PRICING_TABLE;
    const roomPrices = table[pricingKey] || table['shared_space'] || DEFAULT_PRICING_TABLE.shared_space;
    if (!roomPrices) return null;
    return roomPrices[hours] ?? null;
  },

  /**
   * Returns full day price (strictly 8-hour rate from matrix table).
   */
  getFullDayPrice(
    roomOrType: Room | RoomType | string | undefined,
    customTable?: Record<string, Record<number, number>> | null
  ): number {
    const p8 = this.getExactPrice(roomOrType, 8, customTable);
    if (p8 !== null) return p8;
    const pricingKey = mapRoomToPricingKey(roomOrType, customTable);
    const table = customTable || DEFAULT_PRICING_TABLE;
    const roomPrices = table[pricingKey] || table['shared_space'] || DEFAULT_PRICING_TABLE.shared_space;
    return roomPrices?.[8] ?? 150;
  },

  /**
   * Returns base hourly rate (1st hour price) for open sessions.
   */
  getHourlyRate(
    roomOrType: Room | RoomType | string | undefined,
    customTable?: Record<string, Record<number, number>> | null
  ): number {
    const p1 = this.getExactPrice(roomOrType, 1, customTable);
    if (p1 !== null) return p1;
    const pricingKey = mapRoomToPricingKey(roomOrType, customTable);
    const table = customTable || DEFAULT_PRICING_TABLE;
    const roomPrices = table[pricingKey] || table['shared_space'] || DEFAULT_PRICING_TABLE.shared_space;
    return roomPrices?.[1] ?? 30;
  },

  /**
   * Calculates price for a session according to its duration mode:
   * - fixed: exact N hours from pricing table
   * - full_day: 8-hour price from pricing table
   * - open: hourly rate (1st hour) × actual duration in hours
   */
  calculateSessionModeCost(
    roomOrType: Room | RoomType | string | undefined,
    mode: 'fixed' | 'full_day' | 'open' | undefined,
    selectedHours: number | undefined,
    elapsedMinutes: number,
    customTable?: Record<string, Record<number, number>> | null
  ): number {
    const pricingKey = mapRoomToPricingKey(roomOrType, customTable);
    const table = customTable || DEFAULT_PRICING_TABLE;
    const roomPrices = table[pricingKey] || table['shared_space'] || DEFAULT_PRICING_TABLE.shared_space;

    if (mode === 'full_day') {
      return this.getFullDayPrice(roomOrType, customTable);
    }

    if (mode === 'fixed') {
      const hours = Math.min(Math.max(selectedHours || 1, 1), 8);
      const exact = roomPrices?.[hours];
      if (exact !== undefined) return exact;
      return this.calculateRoomPrice(roomOrType, hours, customTable);
    }

    // mode === 'open' or fallback: Hourly Rate (1st hour) × Actual Duration (Minutes)
    const firstHourPrice = roomPrices?.[1] ?? 30;
    const exactCost = (elapsedMinutes / 60) * firstHourPrice;
    return Math.round(exactCost * 100) / 100;
  },

  /**
   * Calculates total booking or room price based on space type/pricingType and duration (in hours).
   * Uses non-linear pricing matrix rules directly from settings / DEFAULT_PRICING_TABLE.
   * 8 hours is the Maximum Billable Duration (Cap) - any duration >= 8 hours uses the 8-hour rate directly.
   * Never relies on rooms.pricePerHour as an independent source.
   */
  calculateRoomPrice(
    roomOrType: Room | RoomType | string | undefined,
    durationHours: number,
    customTable?: Record<string, Record<number, number>> | null,
    fallbackHourlyPrice: number = 30
  ): number {
    if (durationHours <= 0) return 0;
    
    const pricingKey = mapRoomToPricingKey(roomOrType, customTable);
    const table = customTable || DEFAULT_PRICING_TABLE;
    const roomPrices = table[pricingKey] || table['shared_space'] || DEFAULT_PRICING_TABLE.shared_space;

    if (!roomPrices) {
      // Fallback: Cap at 8 hours
      const cappedDuration = Math.min(durationHours, 8);
      return Math.round(cappedDuration * fallbackHourlyPrice);
    }

    // 8 hours is the Maximum Billable Duration (Cap).
    // Any duration of 8 hours or more costs strictly the 8-hour price. No extra hours or time fees.
    if (durationHours >= 8) {
      return roomPrices[8] ?? (roomPrices[1] ? roomPrices[1] * 8 : fallbackHourlyPrice * 8);
    }

    // Exact integer hour between 1 and 8 (e.g. 1->30, 2->55, 3->80, 4->100, 5->120, 6->130, 7->140, 8->150)
    const roundedHour = Math.round(durationHours * 1000) / 1000;
    const intHour = Math.round(roundedHour);
    if (Math.abs(roundedHour - intHour) < 0.0001 && intHour >= 1 && intHour <= 8) {
      if (roomPrices[intHour] !== undefined) {
        return roomPrices[intHour];
      }
    }

    const lowerHour = Math.floor(durationHours);
    const fraction = durationHours - lowerHour;

    if (lowerHour === 0) {
      // Less than 1 hour -> proportional to 1st hour
      const firstHourPrice = roomPrices[1] ?? fallbackHourlyPrice;
      return Math.round(durationHours * firstHourPrice);
    }

    // Between 1 and 8 hours with fractions
    const lowerPrice = roomPrices[lowerHour] ?? (lowerHour * fallbackHourlyPrice);
    const upperHour = lowerHour + 1;
    const upperPrice = roomPrices[upperHour] ?? (upperHour * fallbackHourlyPrice);

    if (fraction === 0) {
      return lowerPrice;
    }

    // Linear interpolation between the two non-linear brackets
    const interpolated = lowerPrice + (upperPrice - lowerPrice) * fraction;
    return Math.round(interpolated);
  }
};
