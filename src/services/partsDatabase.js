// Parts Database Service
// Provides detailed part information, specifications, and compatibility data

class PartsDatabase {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.apiEndpoint = import.meta.env.VITE_PARTS_API_ENDPOINT || null;
    this.apiKey = import.meta.env.VITE_PARTS_API_KEY || null;
  }

  /**
   * Searches for parts by various criteria
   * @param {Object} searchCriteria - Search parameters
   * @returns {Promise<Array>} Array of matching parts
   */
  async searchParts(searchCriteria) {
    try {
      const cacheKey = this.generateCacheKey(searchCriteria);
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Try API call if available
      if (this.apiEndpoint && this.apiKey) {
        const results = await this.searchPartsAPI(searchCriteria);
        this.cache.set(cacheKey, { data: results, timestamp: Date.now() });
        return results;
      }

      // Fallback to local database
      const results = await this.searchLocalDatabase(searchCriteria);
      this.cache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;

    } catch (error) {
      console.error('Parts search error:', error);
      return this.getFallbackResults(searchCriteria);
    }
  }

  /**
   * Searches parts using external API
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} API results
   */
  async searchPartsAPI(criteria) {
    const response = await fetch(`${this.apiEndpoint}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(criteria)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return this.normalizeAPIResults(data);
  }

  /**
   * Searches local parts database
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Local search results
   */
  async searchLocalDatabase(criteria) {
    // Simulate database search with comprehensive part data
    const localParts = this.getLocalPartsDatabase();
    
    return localParts.filter(part => {
      return this.matchesCriteria(part, criteria);
    });
  }

  /**
   * Checks if a part matches search criteria
   * @param {Object} part - Part to check
   * @param {Object} criteria - Search criteria
   * @returns {boolean} Whether part matches
   */
  matchesCriteria(part, criteria) {
    if (criteria.partNumber && part.partNumber.toLowerCase().includes(criteria.partNumber.toLowerCase())) {
      return true;
    }
    
    if (criteria.name && part.name.toLowerCase().includes(criteria.name.toLowerCase())) {
      return true;
    }
    
    if (criteria.brand && part.brand.toLowerCase().includes(criteria.brand.toLowerCase())) {
      return true;
    }
    
    if (criteria.category && part.category.toLowerCase().includes(criteria.category.toLowerCase())) {
      return true;
    }
    
    if (criteria.applianceType && part.applianceType && 
        part.applianceType.toLowerCase().includes(criteria.applianceType.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Gets comprehensive local parts database
   * @returns {Array} Local parts data
   */
  getLocalPartsDatabase() {
    return [
      // Dishwasher Parts
      {
        id: 'part-001',
        name: 'Dishwasher Door Seal',
        partNumber: 'WPW10300924',
        brand: 'Whirlpool',
        category: 'Seals & Gaskets',
        applianceType: 'Dishwasher',
        description: 'Genuine OEM door seal for Whirlpool dishwashers. Prevents water leakage and ensures proper door closure.',
        specifications: {
          'Material': 'Rubber',
          'Color': 'Black',
          'Dimensions': '24" x 18"',
          'Weight': '1.2 lbs',
          'Temperature Range': '-40°F to 180°F',
          'Installation': 'Professional recommended',
          'Warranty': '1 year'
        },
        compatibleModels: ['WDF520PADM', 'WDT720PADM', 'WDF540PADM', 'WDT750SAHZ', 'WDT710PAYM'],
        features: ['Water-tight seal', 'Heat resistant', 'Easy installation'],
        installationDifficulty: 'Medium',
        averagePrice: 25.99
      },
      {
        id: 'part-002',
        name: 'Dishwasher Wash Pump Motor',
        partNumber: 'W10348269',
        brand: 'Whirlpool',
        category: 'Motors & Pumps',
        applianceType: 'Dishwasher',
        description: 'Replacement wash pump motor for Whirlpool dishwashers. Circulates water during wash cycles.',
        specifications: {
          'Voltage': '120V',
          'Power': '1/3 HP',
          'RPM': '3450',
          'Weight': '3.5 lbs',
          'Mounting': 'Bottom mount',
          'Warranty': '2 years'
        },
        compatibleModels: ['WDF520PADM', 'WDT720PADM', 'WDTA50SAHZ', 'WDT750SAHV'],
        features: ['High efficiency', 'Quiet operation', 'Corrosion resistant'],
        installationDifficulty: 'Hard',
        averagePrice: 89.99
      },
      
      // Refrigerator Parts
      {
        id: 'part-003',
        name: 'Refrigerator Water Filter',
        partNumber: 'EDR4RXD1',
        brand: 'Whirlpool',
        category: 'Filters',
        applianceType: 'Refrigerator',
        description: 'Genuine refrigerator water filter. Reduces chlorine taste and odor, certified for quality.',
        specifications: {
          'Filter Life': '6 months',
          'Flow Rate': '0.5 GPM',
          'Certification': 'NSF 42 & 53',
          'Dimensions': '10.8" x 2.4"',
          'Capacity': '200 gallons',
          'Installation': 'Tool-free'
        },
        compatibleModels: ['WRS325SDHZ', 'WRS588FIHZ', 'WRS571CIHZ', 'WRS315SDHM'],
        features: ['Reduces chlorine', 'Improves taste', 'Easy replacement'],
        installationDifficulty: 'Easy',
        averagePrice: 32.99
      },
      {
        id: 'part-004',
        name: 'Refrigerator Ice Maker',
        partNumber: 'W10190965',
        brand: 'Whirlpool',
        category: 'Ice Makers',
        applianceType: 'Refrigerator',
        description: 'Complete ice maker assembly for Whirlpool refrigerators. Produces up to 8 lbs of ice per day.',
        specifications: {
          'Ice Production': '8 lbs/day',
          'Voltage': '115V',
          'Dimensions': '14" x 8" x 6"',
          'Weight': '4.2 lbs',
          'Installation': 'Professional recommended',
          'Warranty': '1 year'
        },
        compatibleModels: ['WRS325SDHZ', 'WRS588FIHZ', 'WRF555SDFZ', 'WRS571CIHZ'],
        features: ['Automatic operation', 'Self-cleaning', 'Energy efficient'],
        installationDifficulty: 'Hard',
        averagePrice: 156.99
      },

      // Washer Parts
      {
        id: 'part-005',
        name: 'Washer Door Boot Seal',
        partNumber: 'W10290499',
        brand: 'Whirlpool',
        category: 'Seals & Gaskets',
        applianceType: 'Washer',
        description: 'Front-loading washer door boot seal. Prevents water leakage during wash cycles.',
        specifications: {
          'Material': 'Rubber',
          'Color': 'Black',
          'Dimensions': '22" diameter',
          'Weight': '2.1 lbs',
          'Temperature Range': '32°F to 200°F',
          'Installation': 'Professional recommended'
        },
        compatibleModels: ['WFW9151YW', 'WFW8300SW', 'WFW9050XW', 'WFW8500DC'],
        features: ['Flexible design', 'Mold resistant', 'Durable construction'],
        installationDifficulty: 'Hard',
        averagePrice: 78.99
      },

      // Dryer Parts
      {
        id: 'part-006',
        name: 'Dryer Heating Element',
        partNumber: '279838',
        brand: 'Whirlpool',
        category: 'Heating Elements',
        applianceType: 'Dryer',
        description: 'Electric dryer heating element. Provides heat for drying clothes efficiently.',
        specifications: {
          'Wattage': '5400W',
          'Voltage': '240V',
          'Resistance': '10.6 ohms',
          'Dimensions': '14" x 8"',
          'Weight': '1.8 lbs',
          'Installation': 'Professional recommended'
        },
        compatibleModels: ['WED4815EW', 'WED4850HW', 'WED5000DW', 'WED4950HW'],
        features: ['High efficiency', 'Even heating', 'Long lasting'],
        installationDifficulty: 'Medium',
        averagePrice: 45.99
      },

      // Range/Oven Parts
      {
        id: 'part-007',
        name: 'Oven Door Seal',
        partNumber: 'W10134009',
        brand: 'Whirlpool',
        category: 'Seals & Gaskets',
        applianceType: 'Range',
        description: 'Oven door seal gasket. Maintains proper temperature and prevents heat loss.',
        specifications: {
          'Material': 'Fiberglass',
          'Color': 'Gray',
          'Length': '84 inches',
          'Width': '0.75 inches',
          'Temperature Rating': '500°F',
          'Installation': 'DIY friendly'
        },
        compatibleModels: ['WFE515S0ES', 'WFE525S0HS', 'WFE540H0ES', 'WFE550S0HZ'],
        features: ['Heat resistant', 'Self-adhesive', 'Easy installation'],
        installationDifficulty: 'Easy',
        averagePrice: 28.99
      },

      // Microwave Parts
      {
        id: 'part-008',
        name: 'Microwave Turntable Motor',
        partNumber: 'WB26X10038',
        brand: 'GE',
        category: 'Motors & Drives',
        applianceType: 'Microwave',
        description: 'Turntable motor for GE microwaves. Rotates the glass tray during cooking.',
        specifications: {
          'Voltage': '120V',
          'RPM': '5/6',
          'Shaft': '7mm',
          'Dimensions': '2" x 2" x 1.5"',
          'Weight': '0.3 lbs',
          'Installation': 'DIY friendly'
        },
        compatibleModels: ['JES1072SHSS', 'JES1095SMSS', 'JES2051SNSS', 'JES1460DSBB'],
        features: ['Quiet operation', 'Precise rotation', 'Easy replacement'],
        installationDifficulty: 'Easy',
        averagePrice: 18.99
      }
    ];
  }

  /**
   * Enhances part data with additional information
   * @param {Object} basePart - Basic part information
   * @returns {Promise<Object>} Enhanced part data
   */
  async enhancePartData(basePart) {
    try {
      // Search for matching parts in database
      const searchResults = await this.searchParts({
        partNumber: basePart.partNumber,
        name: basePart.name,
        brand: basePart.brand
      });

      if (searchResults.length > 0) {
        // Merge with database information
        const dbPart = searchResults[0];
        return {
          ...basePart,
          ...dbPart,
          // Preserve AI-identified fields if they exist
          confidence: basePart.confidence || dbPart.confidence || 85,
          source: 'enhanced'
        };
      }

      return basePart;
    } catch (error) {
      console.error('Error enhancing part data:', error);
      return basePart;
    }
  }

  /**
   * Gets fallback results when search fails
   * @param {Object} criteria - Original search criteria
   * @returns {Array} Fallback results
   */
  getFallbackResults(criteria) {
    const fallbackParts = this.getLocalPartsDatabase().slice(0, 3);
    return fallbackParts.map(part => ({
      ...part,
      confidence: 70,
      source: 'fallback'
    }));
  }

  /**
   * Normalizes API results to internal format
   * @param {Object} apiData - Raw API response
   * @returns {Array} Normalized parts data
   */
  normalizeAPIResults(apiData) {
    if (!apiData.parts || !Array.isArray(apiData.parts)) {
      return [];
    }

    return apiData.parts.map(part => ({
      id: part.id || `api-${Date.now()}`,
      name: part.name || part.title,
      partNumber: part.partNumber || part.part_number || part.sku,
      brand: part.brand || part.manufacturer,
      category: part.category || 'General',
      applianceType: part.applianceType || part.appliance_type,
      description: part.description,
      specifications: part.specifications || part.specs || {},
      compatibleModels: part.compatibleModels || part.compatible_models || [],
      features: part.features || [],
      installationDifficulty: part.installationDifficulty || part.difficulty || 'Medium',
      averagePrice: part.averagePrice || part.price || 0,
      confidence: 90,
      source: 'api'
    }));
  }

  /**
   * Generates cache key for search criteria
   * @param {Object} criteria - Search criteria
   * @returns {string} Cache key
   */
  generateCacheKey(criteria) {
    return JSON.stringify(criteria);
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
}

// Export singleton instance
export const partsDatabase = new PartsDatabase();
export default partsDatabase;

