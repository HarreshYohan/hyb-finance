/**
 * js/cache.js
 * Client-side caching layer to provide instant load (Stale-While-Revalidate pattern).
 * Caches Supabase synced data into localStorage with a 5-minute TTL.
 */

const CACHE_KEY = 'centa_data_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    const now = Date.now();
    
    // If the cache is too old, we can still return it for instant UI,
    // but the caller (db.js) should know it needs to background sync.
    const isStale = (now - parsed.timestamp) > CACHE_TTL_MS;
    
    return {
      data: parsed.data,
      isStale
    };
  } catch (e) {
    console.error('Failed to read cache:', e);
    return null;
  }
}

export function updateCache(stateData) {
  try {
    // Only cache what we need to render the main views instantly
    const cacheReady = {
      tx: stateData.tx || [],
      debts: stateData.debts || [],
      goals: stateData.goals || [],
      budgets: stateData.budgets || {},
      profile: stateData.profile || null
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: cacheReady
    }));
  } catch (e) {
    console.error('Failed to update cache:', e);
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}
