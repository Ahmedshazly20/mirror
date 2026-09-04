import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes undefined fields from an object. 
 * Firestore throws errors when updating/setting documents with undefined values.
 */
export function cleanData(data: any): any {
  if (data === null || data === undefined || typeof data !== 'object') return data;
  
  // Preserve Firestore Timestamp instances, Date objects, or objects with toDate/seconds
  if (
    data instanceof Date || 
    ('seconds' in data && 'nanoseconds' in data) || 
    typeof data.toDate === 'function'
  ) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanData(item));
  }
  
  const clean: Record<string, any> = {};
  
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined) {
      if (
        value !== null && 
        typeof value === 'object' && 
        !(value instanceof Date) && 
        !('seconds' in value && 'nanoseconds' in value) && 
        typeof value.toDate !== 'function'
      ) {
        clean[key] = cleanData(value);
      } else {
        clean[key] = value;
      }
    }
  });
  
  return clean;
}
