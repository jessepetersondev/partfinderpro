// Vendor APIs Service
// Fetches real-time pricing and availability from multiple appliance parts vendors

class VendorAPIsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes for pricing data
    this.requestTimeout = 10000; // 10 seconds per vendor
    
    // API configurations
    this.vendors = {
      repairClinic: {
        name: 'RepairClinic',
        logo: '🔧',
        baseUrl: import.meta.env.VITE_REPAIRCLINIC_API_URL,
        apiKey: import.meta.env.VITE_REPAIRCLINIC_API_KEY,
        enabled: true
      },
      partSelect: {
        name: 'PartSelect',
        logo: '⚙️',
        baseUrl: import.meta.env.VITE_PARTSELECT_API_URL,
        apiKey: import.meta.env.VITE_PARTSELECT_API_KEY,
        enabled: true
      },
      appliancePartsPros: {
        name: 'AppliancePartsPros',
        logo: '🏠',
        baseUrl: import.meta.env.VITE_APPLIANCEPARTSPROS_API_URL,
        apiKey: import.meta.env.VITE_APPLIANCEPARTSPROS_API_KEY,
        enabled: true
      },
      encompassSupply: {
        name: 'Encompass Supply',
        logo: '📦',
        baseUrl: import.meta.env.VITE_ENCOMPASS_API_URL,
        apiKey: import.meta.env.VITE_ENCOMPASS_API_KEY,
        enabled: true
      }
    };
  }

  /**
   * Gets pricing from all available vendors for a part
   * @param {Object} part - Part information
   * @returns {Promise<Array>} Array of vendor pricing data
   */
  async getVendorPricing(part) {
    try {
      const cacheKey = this.generateCacheKey(part);
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Fetch from all vendors in parallel
      const vendorPromises = Object.entries(this.vendors)
        .filter(([_, config]) => config.enabled)
        .map(([vendorId, config]) => 
          this.fetchVendorPricing(vendorId, config, part)
        );

      const results = await Promise.allSettled(vendorPromises);
      
      // Process results and filter successful ones
      const vendorPricing = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value)
        .filter(vendor => vendor !== null);

      // Add fallback vendors if no real data available
      if (vendorPricing.length === 0) {
        const fallbackPricing = this.getFallbackPricing(part);
        this.cache.set(cacheKey, { data: fallbackPricing, timestamp: Date.now() });
        return fallbackPricing;
      }

      // Sort by total price (price + shipping)
      vendorPricing.sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping));

      // Cache the results
      this.cache.set(cacheKey, { data: vendorPricing, timestamp: Date.now() });
      
      return vendorPricing;

    } catch (error) {
      console.error('Error fetching vendor pricing:', error);
      return this.getFallbackPricing(part);
    }
  }

  /**
   * Fetches pricing from a specific vendor
   * @param {string} vendorId - Vendor identifier
   * @param {Object} config - Vendor configuration
   * @param {Object} part - Part information
   * @returns {Promise<Object|null>} Vendor pricing data or null
   */
  async fetchVendorPricing(vendorId, config, part) {
    try {
      // If no API configuration, use mock data
      if (!config.baseUrl || !config.apiKey) {
        return this.getMockVendorPricing(vendorId, config, part);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      const response = await fetch(`${config.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'User-Agent': 'PartFinder-Pro/1.0'
        },
        body: JSON.stringify({
          partNumber: part.partNumber,
          brand: part.brand,
          category: part.category
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`${config.name} API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeVendorResponse(vendorId, config, data, part);

    } catch (error) {
      console.warn(`Error fetching from ${config.name}:`, error.message);
      
      // Return mock data as fallback
      return this.getMockVendorPricing(vendorId, config, part);
    }
  }

  /**
   * Normalizes vendor API response to standard format
   * @param {string} vendorId - Vendor identifier
   * @param {Object} config - Vendor configuration
   * @param {Object} data - Raw API response
   * @param {Object} part - Original part data
   * @returns {Object} Normalized vendor data
   */
  normalizeVendorResponse(vendorId, config, data, part) {
    // Handle different API response formats
    let productData;
    
    if (data.products && data.products.length > 0) {
      productData = data.products[0];
    } else if (data.items && data.items.length > 0) {
      productData = data.items[0];
    } else if (data.results && data.results.length > 0) {
      productData = data.results[0];
    } else {
      return null; // No products found
    }

    return {
      id: vendorId,
      name: config.name,
      logo: config.logo,
      price: this.parsePrice(productData.price || productData.cost || productData.amount),
      shipping: this.parsePrice(productData.shipping || productData.shippingCost || 0),
      availability: this.normalizeAvailability(productData.availability || productData.stock || productData.inStock),
      estimatedDelivery: this.normalizeDelivery(productData.delivery || productData.estimatedDelivery || productData.shippingTime),
      rating: this.parseRating(productData.rating || productData.score),
      url: productData.url || productData.link || config.baseUrl,
      sku: productData.sku || productData.id || part.partNumber,
      lastUpdated: new Date().toISOString(),
      source: 'api'
    };
  }

  /**
   * Gets mock vendor pricing as fallback
   * @param {string} vendorId - Vendor identifier
   * @param {Object} config - Vendor configuration
   * @param {Object} part - Part information
   * @returns {Object} Mock vendor data
   */
  getMockVendorPricing(vendorId, config, part) {
    const basePrice = part.averagePrice || 25.99;
    const priceVariation = 0.8 + (Math.random() * 0.4); // ±20% variation
    const price = Math.round(basePrice * priceVariation * 100) / 100;
    
    const mockData = {
      repairClinic: {
        price: price,
        shipping: 5.99,
        availability: 'in-stock',
        estimatedDelivery: '2-3 business days',
        rating: 4.8
      },
      partSelect: {
        price: price * 1.08,
        shipping: 0,
        availability: 'in-stock',
        estimatedDelivery: '3-5 business days',
        rating: 4.6
      },
      appliancePartsPros: {
        price: price * 0.94,
        shipping: 7.99,
        availability: Math.random() > 0.3 ? 'in-stock' : 'limited',
        estimatedDelivery: '5-7 business days',
        rating: 4.7
      },
      encompassSupply: {
        price: price * 1.12,
        shipping: 4.99,
        availability: 'in-stock',
        estimatedDelivery: '1-2 business days',
        rating: 4.5
      }
    };

    const vendorMock = mockData[vendorId] || mockData.repairClinic;

    return {
      id: vendorId,
      name: config.name,
      logo: config.logo,
      price: Math.round(vendorMock.price * 100) / 100,
      shipping: vendorMock.shipping,
      availability: vendorMock.availability,
      estimatedDelivery: vendorMock.estimatedDelivery,
      rating: vendorMock.rating,
      url: `https://${vendorId}.com/parts/${part.partNumber}`,
      sku: part.partNumber,
      lastUpdated: new Date().toISOString(),
      source: 'mock'
    };
  }

  /**
   * Gets fallback pricing when all vendors fail
   * @param {Object} part - Part information
   * @returns {Array} Fallback vendor data
   */
  getFallbackPricing(part) {
    return Object.entries(this.vendors).map(([vendorId, config]) => 
      this.getMockVendorPricing(vendorId, config, part)
    );
  }

  /**
   * Parses price from various formats
   * @param {*} price - Price in various formats
   * @returns {number} Parsed price
   */
  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const cleaned = price.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  /**
   * Normalizes availability status
   * @param {*} availability - Availability in various formats
   * @returns {string} Normalized availability
   */
  normalizeAvailability(availability) {
    if (!availability) return 'unknown';
    
    const status = availability.toString().toLowerCase();
    
    if (status.includes('in stock') || status.includes('available') || status === 'true') {
      return 'in-stock';
    } else if (status.includes('limited') || status.includes('low')) {
      return 'limited';
    } else if (status.includes('out') || status.includes('unavailable') || status === 'false') {
      return 'out-of-stock';
    }
    
    return 'unknown';
  }

  /**
   * Normalizes delivery time
   * @param {*} delivery - Delivery time in various formats
   * @returns {string} Normalized delivery time
   */
  normalizeDelivery(delivery) {
    if (!delivery) return '3-5 business days';
    
    const deliveryStr = delivery.toString().toLowerCase();
    
    if (deliveryStr.includes('1-2') || deliveryStr.includes('next day')) {
      return '1-2 business days';
    } else if (deliveryStr.includes('2-3')) {
      return '2-3 business days';
    } else if (deliveryStr.includes('3-5')) {
      return '3-5 business days';
    } else if (deliveryStr.includes('5-7') || deliveryStr.includes('week')) {
      return '5-7 business days';
    }
    
    return delivery.toString();
  }

  /**
   * Parses rating from various formats
   * @param {*} rating - Rating in various formats
   * @returns {number} Parsed rating (0-5)
   */
  parseRating(rating) {
    if (typeof rating === 'number') {
      return Math.min(Math.max(rating, 0), 5);
    }
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? 4.5 : Math.min(Math.max(parsed, 0), 5);
    }
    return 4.5; // Default rating
  }

  /**
   * Generates cache key for part pricing
   * @param {Object} part - Part information
   * @returns {string} Cache key
   */
  generateCacheKey(part) {
    return `pricing_${part.partNumber}_${part.brand}`.toLowerCase();
  }

  /**
   * Clears expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gets vendor configuration for testing
   * @returns {Object} Vendor configurations
   */
  getVendorConfigs() {
    return this.vendors;
  }

  /**
   * Updates vendor configuration
   * @param {string} vendorId - Vendor identifier
   * @param {Object} config - New configuration
   */
  updateVendorConfig(vendorId, config) {
    if (this.vendors[vendorId]) {
      this.vendors[vendorId] = { ...this.vendors[vendorId], ...config };
    }
  }

  /**
   * Enables or disables a vendor
   * @param {string} vendorId - Vendor identifier
   * @param {boolean} enabled - Whether to enable the vendor
   */
  setVendorEnabled(vendorId, enabled) {
    if (this.vendors[vendorId]) {
      this.vendors[vendorId].enabled = enabled;
    }
  }

  /**
   * Gets health status of all vendors
   * @returns {Promise<Object>} Vendor health status
   */
  async getVendorHealth() {
    const healthChecks = Object.entries(this.vendors)
      .filter(([_, config]) => config.enabled)
      .map(async ([vendorId, config]) => {
        try {
          if (!config.baseUrl) {
            return { vendorId, status: 'mock', responseTime: 0 };
          }

          const start = Date.now();
          const response = await fetch(`${config.baseUrl}/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            signal: AbortSignal.timeout(5000)
          });
          const responseTime = Date.now() - start;

          return {
            vendorId,
            status: response.ok ? 'healthy' : 'error',
            responseTime,
            statusCode: response.status
          };
        } catch (error) {
          return {
            vendorId,
            status: 'error',
            responseTime: -1,
            error: error.message
          };
        }
      });

    const results = await Promise.allSettled(healthChecks);
    
    return results.reduce((acc, result) => {
      if (result.status === 'fulfilled') {
        acc[result.value.vendorId] = result.value;
      }
      return acc;
    }, {});
  }
}

// Export singleton instance
export const vendorAPIsService = new VendorAPIsService();
export default vendorAPIsService;

