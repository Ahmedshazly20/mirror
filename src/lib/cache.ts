import { Customer } from '../types';

// ── In-Memory Fast Indexing & Caching ─────────────────────────────────────────
// Provides O(1) lookups instead of scanning arrays on every keystroke or session start.

interface CustomerCache {
  byId: Map<string, Customer>;
  byCustomerId: Map<number, Customer>;
  byPhone: Map<string, Customer>;
  searchIndex: { term: string; customer: Customer }[];
  lastUpdate: number;
}

let customerCache: CustomerCache = {
  byId: new Map(),
  byCustomerId: new Map(),
  byPhone: new Map(),
  searchIndex: [],
  lastUpdate: 0,
};

/**
 * Updates the indexed customer maps from the active customer array.
 */
export function indexCustomers(customers: Customer[]): CustomerCache {
  const byId = new Map<string, Customer>();
  const byCustomerId = new Map<number, Customer>();
  const byPhone = new Map<string, Customer>();
  const searchIndex: { term: string; customer: Customer }[] = [];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    byId.set(c.id, c);
    if (c.customerId) {
      byCustomerId.set(c.customerId, c);
    }
    if (c.phone) {
      byPhone.set(c.phone.trim(), c);
    }
    
    // Pre-build normalized search term for ultra-fast matching
    const searchString = `${c.customerId} ${c.name} ${c.phone} ${c.email || ''}`.toLowerCase();
    searchIndex.push({ term: searchString, customer: c });
  }

  customerCache = {
    byId,
    byCustomerId,
    byPhone,
    searchIndex,
    lastUpdate: Date.now(),
  };

  return customerCache;
}

/**
 * Fast search using pre-indexed customer data.
 */
export function fastSearchCustomers(query: string, customers: Customer[], limit = 20): Customer[] {
  if (!query.trim()) return customers.slice(0, limit);
  
  // Re-index if cache is empty or array length changed
  if (customerCache.searchIndex.length !== customers.length) {
    indexCustomers(customers);
  }

  const cleanQuery = query.toLowerCase().trim();
  const results: Customer[] = [];

  for (let i = 0; i < customerCache.searchIndex.length; i++) {
    const item = customerCache.searchIndex[i];
    if (item.term.includes(cleanQuery)) {
      results.push(item.customer);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * O(1) customer lookup by phone number
 */
export function getCustomerByPhone(phone: string, fallbackCustomers?: Customer[]): Customer | undefined {
  if (customerCache.byPhone.size === 0 && fallbackCustomers) {
    indexCustomers(fallbackCustomers);
  }
  return customerCache.byPhone.get(phone.trim());
}

/**
 * O(1) customer lookup by numeric customer ID
 */
export function getCustomerByCode(code: number, fallbackCustomers?: Customer[]): Customer | undefined {
  if (customerCache.byCustomerId.size === 0 && fallbackCustomers) {
    indexCustomers(fallbackCustomers);
  }
  return customerCache.byCustomerId.get(code);
}
