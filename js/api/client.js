/**
 * REST API Client for Backend Communication with Offline Resilience
 */
const ApiClient = {
  getToken() {
    return localStorage.getItem('mrp_auth_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('mrp_auth_token', token);
    } else {
      localStorage.removeItem('mrp_auth_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${APP_CONFIG.apiBaseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`[ApiClient Warning] Request to ${endpoint} failed:`, error.message);
      throw error;
    }
  },

  // Auth APIs
  login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  getMe() {
    return this.request('/api/auth/me');
  },

  // Planning APIs
  getPlanningCalculation(day = 'Lunes', safetyStock = 1, vdpDays = 60) {
    return this.request(`/api/planning/calculate?day=${encodeURIComponent(day)}&safetyStock=${safetyStock}&vdpDays=${vdpDays}`);
  },

  savePlanningConfig(config) {
    return this.request('/api/planning/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  approveOrder(payload) {
    return this.request('/api/planning/approve', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getTransitOrders() {
    return this.request('/api/planning/transit');
  },

  clearAllTransitOrders() {
    return this.request('/api/planning/transit/clear', {
      method: 'POST'
    });
  },

  deleteTransitOrder(orderId) {
    return this.request(`/api/planning/transit/${encodeURIComponent(orderId)}`, {
      method: 'DELETE'
    });
  },

  reconcileTransitOrder(orderId) {
    return this.request('/api/planning/transit/reconcile', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  },

  // Products API
  getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/products${qs ? '?' + qs : ''}`);
  },

  updateProduct(sku, payload) {
    return this.request(`/api/products/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  batchUpdateProducts(overrides) {
    return this.request('/api/products/batch-update', {
      method: 'POST',
      body: JSON.stringify({ overrides })
    });
  },

  toggleProductActive(sku, isActive) {
    return this.request(`/api/products/${encodeURIComponent(sku)}/toggle-active`, {
      method: 'POST',
      body: JSON.stringify({ isActive })
    });
  },

  // Sync API
  triggerSync(url) {
    return this.request('/api/sync/trigger', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  },

  getSyncStatus() {
    return this.request('/api/sync/status');
  },

  // Analytics APIs
  getGmroiMatrix() {
    return this.request('/api/analytics/gmroi');
  },

  getCategoriesAnalytics() {
    return this.request('/api/analytics/categories');
  },

  getCapitalEfficiency() {
    return this.request('/api/analytics/capital-efficiency');
  }
};

window.ApiClient = ApiClient;
