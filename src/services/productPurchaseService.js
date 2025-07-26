/**
 * Product Purchase Service
 * Integrates with RapidAPI Real-Time Product Search to find and purchase appliance parts
 */

class ProductPurchaseService {
  constructor() {
    this.apiKey = import.meta.env.VITE_RAPIDAPI_KEY;
    this.apiHost = 'real-time-product-search.p.rapidapi.com';
    this.baseUrl = 'https://real-time-product-search.p.rapidapi.com';
    
    // Affiliate program configurations
    this.affiliatePrograms = {
      amazon: {
        tag: import.meta.env.VITE_AMAZON_AFFILIATE_TAG || 'partfinderpro-20',
        baseUrl: 'https://www.amazon.com'
      },
      ebay: {
        campaignId: import.meta.env.VITE_EBAY_CAMPAIGN_ID || '5338239407',
        baseUrl: 'https://www.ebay.com'
      },
      walmart: {
        publisherId: import.meta.env.VITE_WALMART_PUBLISHER_ID || 'partfinderpro',
        baseUrl: 'https://www.walmart.com'
      },
      target: {
        affiliateId: import.meta.env.VITE_TARGET_AFFILIATE_ID || 'partfinderpro',
        baseUrl: 'https://www.target.com'
      }
    };
  }

  /**
   * Search for products across multiple stores
   * @param {string} query - Product search query (e.g., "Whirlpool dishwasher door seal WPW10195677")
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of product offers from different stores
   */
  async searchProducts(query, options = {}) {
    try {
      const searchParams = new URLSearchParams({
        q: query,
        country: options.country || 'us',
        language: options.language || 'en',
        max_results: options.maxResults || 20,
        sort_by: options.sortBy || 'RELEVANCE'
      });

      const response = await fetch(`${this.baseUrl}/search?${searchParams}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.apiHost,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.processSearchResults(data);
    } catch (error) {
      console.error('🚨 Product search failed:', error);
      return this.getFallbackResults(query);
    }
  }

  /**
   * Get detailed product offers from multiple stores
   * @param {string} productId - Product identifier
   * @returns {Promise<Array>} Array of store offers with prices and availability
   */
  async getProductOffers(productId) {
    try {
      const response = await fetch(`${this.baseUrl}/product-offers`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.apiHost,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_id: productId })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.processOffers(data);
    } catch (error) {
      console.error('🚨 Product offers fetch failed:', error);
      return [];
    }
  }

  /**
   * Process search results and enhance with affiliate links
   * @param {Object} data - Raw API response
   * @returns {Array} Processed product results
   */
  processSearchResults(data) {
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map(product => ({
      id: product.product_id || this.generateProductId(product),
      title: product.product_title || product.title,
      description: product.product_description || product.description,
      price: this.parsePrice(product.product_price || product.price),
      originalPrice: this.parsePrice(product.product_original_price),
      currency: product.currency || 'USD',
      availability: product.product_availability || 'In Stock',
      rating: product.product_rating || 0,
      reviewCount: product.product_num_reviews || 0,
      imageUrl: product.product_photo || product.image_url,
      store: this.identifyStore(product.source || product.store_name),
      productUrl: product.product_url || product.url,
      affiliateUrl: this.generateAffiliateUrl(product),
      shipping: this.parseShipping(product.delivery),
      features: product.product_highlights || [],
      specifications: product.product_attributes || {},
      confidence: this.calculateRelevanceScore(product)
    }));
  }

  /**
   * Process store offers and enhance with affiliate links
   * @param {Object} data - Raw offers data
   * @returns {Array} Processed store offers
   */
  processOffers(data) {
    if (!data.offers || !Array.isArray(data.offers)) {
      return [];
    }

    return data.offers.map(offer => ({
      store: this.identifyStore(offer.store_name),
      price: this.parsePrice(offer.price),
      currency: offer.currency || 'USD',
      availability: offer.availability || 'In Stock',
      shipping: this.parseShipping(offer.shipping),
      url: offer.url,
      affiliateUrl: this.generateAffiliateUrl(offer),
      rating: offer.store_rating || 0,
      trustScore: this.calculateTrustScore(offer)
    })).sort((a, b) => b.trustScore - a.trustScore);
  }

  /**
   * Generate affiliate URL based on store
   * @param {Object} product - Product or offer object
   * @returns {string} Affiliate URL or original URL
   */
  generateAffiliateUrl(product) {
    const store = this.identifyStore(product.source || product.store_name);
    const originalUrl = product.product_url || product.url;

    if (!originalUrl) return null;

    try {
      switch (store.toLowerCase()) {
        case 'amazon':
          return this.generateAmazonAffiliateUrl(originalUrl);
        case 'ebay':
          return this.generateEbayAffiliateUrl(originalUrl);
        case 'walmart':
          return this.generateWalmartAffiliateUrl(originalUrl);
        case 'target':
          return this.generateTargetAffiliateUrl(originalUrl);
        default:
          return originalUrl;
      }
    } catch (error) {
      console.error('🚨 Affiliate URL generation failed:', error);
      return originalUrl;
    }
  }

  /**
   * Generate Amazon affiliate URL
   * @param {string} url - Original Amazon URL
   * @returns {string} Affiliate URL
   */
  generateAmazonAffiliateUrl(url) {
    const amazonTag = this.affiliatePrograms.amazon.tag;
    
    // Extract ASIN from URL
    const asinMatch = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    if (asinMatch) {
      const asin = asinMatch[1];
      return `https://www.amazon.com/dp/${asin}?tag=${amazonTag}`;
    }
    
    // Fallback: add tag parameter
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}tag=${amazonTag}`;
  }

  /**
   * Generate eBay affiliate URL
   * @param {string} url - Original eBay URL
   * @returns {string} Affiliate URL
   */
  generateEbayAffiliateUrl(url) {
    const campaignId = this.affiliatePrograms.ebay.campaignId;
    
    // eBay Partner Network URL format
    const encodedUrl = encodeURIComponent(url);
    return `https://rover.ebay.com/rover/1/711-53200-19255-0/1?icep_ff3=2&pub=5575378759&campid=${campaignId}&customid=&icep_item=${encodedUrl}&ipn=psmain&icep_vectorid=229466&kwid=902099&mtid=824&kw=lg`;
  }

  /**
   * Generate Walmart affiliate URL
   * @param {string} url - Original Walmart URL
   * @returns {string} Affiliate URL
   */
  generateWalmartAffiliateUrl(url) {
    const publisherId = this.affiliatePrograms.walmart.publisherId;
    
    // Walmart affiliate URL format
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}u1=${publisherId}&oid=223073.1&wmlspartner=partfinderpro`;
  }

  /**
   * Generate Target affiliate URL
   * @param {string} url - Original Target URL
   * @returns {string} Affiliate URL
   */
  generateTargetAffiliateUrl(url) {
    const affiliateId = this.affiliatePrograms.target.affiliateId;
    
    // Target affiliate URL format (Commission Junction)
    const encodedUrl = encodeURIComponent(url);
    return `https://goto.target.com/c/2092183/81938/2092?u=${encodedUrl}&subid1=${affiliateId}`;
  }

  /**
   * Identify store from various identifiers
   * @param {string} identifier - Store name or URL
   * @returns {string} Standardized store name
   */
  identifyStore(identifier) {
    if (!identifier) return 'Unknown';
    
    const id = identifier.toLowerCase();
    
    if (id.includes('amazon')) return 'Amazon';
    if (id.includes('ebay')) return 'eBay';
    if (id.includes('walmart')) return 'Walmart';
    if (id.includes('target')) return 'Target';
    if (id.includes('lowes') || id.includes('lowe\'s')) return 'Lowe\'s';
    if (id.includes('homedepot') || id.includes('home depot')) return 'Home Depot';
    if (id.includes('bestbuy') || id.includes('best buy')) return 'Best Buy';
    if (id.includes('sears')) return 'Sears';
    if (id.includes('appliancepartspros')) return 'Appliance Parts Pros';
    if (id.includes('repairparts')) return 'Repair Parts';
    
    return identifier;
  }

  /**
   * Parse price string to number
   * @param {string|number} price - Price string or number
   * @returns {number} Parsed price
   */
  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    
    // Remove currency symbols and extract number
    const cleanPrice = price.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleanPrice) || 0;
  }

  /**
   * Parse shipping information
   * @param {string|Object} shipping - Shipping info
   * @returns {Object} Parsed shipping details
   */
  parseShipping(shipping) {
    if (!shipping) return { cost: 0, time: 'Unknown' };
    
    if (typeof shipping === 'string') {
      const freeShipping = shipping.toLowerCase().includes('free');
      return {
        cost: freeShipping ? 0 : null,
        time: shipping,
        isFree: freeShipping
      };
    }
    
    return shipping;
  }

  /**
   * Calculate relevance score for appliance parts
   * @param {Object} product - Product object
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevanceScore(product) {
    let score = 50; // Base score
    
    const title = (product.product_title || product.title || '').toLowerCase();
    const description = (product.product_description || product.description || '').toLowerCase();
    
    // Boost for appliance-related keywords
    const applianceKeywords = ['dishwasher', 'refrigerator', 'washer', 'dryer', 'oven', 'microwave', 'freezer', 'ice maker'];
    const partKeywords = ['seal', 'filter', 'belt', 'motor', 'pump', 'valve', 'switch', 'element', 'gasket'];
    
    applianceKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
      if (description.includes(keyword)) score += 5;
    });
    
    partKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 15;
      if (description.includes(keyword)) score += 8;
    });
    
    // Boost for model numbers (pattern: letters + numbers)
    if (/[A-Z]{2,}\d{4,}/.test(title.toUpperCase())) score += 20;
    
    // Boost for high ratings
    const rating = product.product_rating || 0;
    score += rating * 2;
    
    // Boost for trusted stores
    const store = this.identifyStore(product.source || product.store_name);
    const trustedStores = ['Amazon', 'eBay', 'Walmart', 'Target', 'Lowe\'s', 'Home Depot'];
    if (trustedStores.includes(store)) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate trust score for store offers
   * @param {Object} offer - Store offer object
   * @returns {number} Trust score (0-100)
   */
  calculateTrustScore(offer) {
    let score = 50; // Base score
    
    // Store reputation
    const store = this.identifyStore(offer.store_name);
    const storeScores = {
      'Amazon': 95,
      'eBay': 85,
      'Walmart': 90,
      'Target': 88,
      'Lowe\'s': 92,
      'Home Depot': 91,
      'Best Buy': 87,
      'Sears': 75
    };
    
    score = storeScores[store] || 60;
    
    // Adjust for store rating
    if (offer.store_rating) {
      score += (offer.store_rating - 3) * 5; // Boost/penalty based on rating
    }
    
    // Boost for free shipping
    if (offer.shipping && offer.shipping.isFree) {
      score += 5;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate fallback results when API fails
   * @param {string} query - Search query
   * @returns {Array} Fallback product results
   */
  getFallbackResults(query) {
    console.log('🔄 Using fallback product search for:', query);
    
    // Generate search URLs for major stores
    const stores = [
      {
        name: 'Amazon',
        url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${this.affiliatePrograms.amazon.tag}`,
        description: 'Search on Amazon for appliance parts'
      },
      {
        name: 'eBay',
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
        description: 'Search on eBay for appliance parts'
      },
      {
        name: 'Walmart',
        url: `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
        description: 'Search on Walmart for appliance parts'
      },
      {
        name: 'Lowe\'s',
        url: `https://www.lowes.com/search?searchTerm=${encodeURIComponent(query)}`,
        description: 'Search on Lowe\'s for appliance parts'
      }
    ];

    return stores.map(store => ({
      id: `fallback-${store.name.toLowerCase()}`,
      title: `Search "${query}" on ${store.name}`,
      description: store.description,
      price: 0,
      currency: 'USD',
      store: store.name,
      affiliateUrl: store.url,
      confidence: 70,
      isFallback: true
    }));
  }

  /**
   * Generate unique product ID
   * @param {Object} product - Product object
   * @returns {string} Generated ID
   */
  generateProductId(product) {
    const title = product.product_title || product.title || '';
    const store = product.source || product.store_name || '';
    return btoa(`${title}-${store}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Check if API is configured
   * @returns {boolean} True if API key is available
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get configuration status
   * @returns {Object} Configuration details
   */
  getConfigStatus() {
    return {
      apiConfigured: !!this.apiKey,
      affiliatePrograms: {
        amazon: !!this.affiliatePrograms.amazon.tag,
        ebay: !!this.affiliatePrograms.ebay.campaignId,
        walmart: !!this.affiliatePrograms.walmart.publisherId,
        target: !!this.affiliatePrograms.target.affiliateId
      }
    };
  }
}

// Export singleton instance
export const productPurchaseService = new ProductPurchaseService();
export default productPurchaseService;

