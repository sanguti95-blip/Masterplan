/**
 * Hybrid Multi-level Cache (In-Memory + LocalStorage with TTL)
 */
const AppCache = {
  memoryCache: new Map(),

  set(key, data, ttlMs = 300000) {
    const item = {
      data,
      expiry: Date.now() + ttlMs
    };
    this.memoryCache.set(key, item);
    try {
      localStorage.setItem(`mrp_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('LocalStorage full or unavailable:', e);
    }
  },

  get(key) {
    // Check RAM cache first (< 1ms)
    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (Date.now() < item.expiry) {
        return item.data;
      }
      this.memoryCache.delete(key);
    }

    // Check LocalStorage (< 10ms)
    try {
      const raw = localStorage.getItem(`mrp_${key}`);
      if (raw) {
        const item = JSON.parse(raw);
        if (Date.now() < item.expiry) {
          this.memoryCache.set(key, item);
          return item.data;
        }
        localStorage.removeItem(`mrp_${key}`);
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    return null;
  },

  remove(key) {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`mrp_${key}`);
    } catch (e) {}
  },

  clear() {
    this.memoryCache.clear();
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('mrp_')) localStorage.removeItem(k);
      });
    } catch (e) {}
  }
};

window.AppCache = AppCache;
