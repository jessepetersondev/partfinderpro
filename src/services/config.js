// Configuration Service
// Manages environment variables and application settings

class ConfigService {
  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    
    // CRITICAL FIX: Always log configuration in production to verify environment variables
    if (this.isProduction() || this.isDevelopment() || import.meta.env.VITE_DEBUG_MODE === 'true') {
      this.logConfiguration();
    }
  }

  /**
   * Loads configuration from environment variables
   * @returns {Object} Configuration object
   */
  loadConfiguration() {
    // Get environment variables with proper fallbacks
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const googlePlacesApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    const appMode = import.meta.env.VITE_APP_MODE || 'development';
    
    return {
      // Application settings
      app: {
        mode: appMode,
        debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
        logLevel: import.meta.env.VITE_LOG_LEVEL || 'info'
      },

      // Feature flags - Enable real AI if we have API keys
      features: {
        enableDemoMode: false,
        enableRealAI: true,
        enableVendorAPIs: true,
        enableCaching: import.meta.env.VITE_ENABLE_CACHING !== 'false',
        enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
        enableErrorReporting: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true'
      },

      // OpenAI configuration
      openai: {
        apiKey: openaiApiKey,
        apiBase: import.meta.env.VITE_OPENAI_API_BASE || 'https://api.openai.com/v1',
        model: 'gpt-4o'
      },

      // Google Places API configuration
      googlePlaces: {
        apiKey: googlePlacesApiKey
      },

      // Parts database configuration
      partsDatabase: {
        apiEndpoint: import.meta.env.VITE_PARTS_API_ENDPOINT,
        apiKey: import.meta.env.VITE_PARTS_API_KEY
      },

      // Vendor API configurations
      vendors: {
        repairClinic: {
          apiUrl: import.meta.env.VITE_REPAIRCLINIC_API_URL,
          apiKey: import.meta.env.VITE_REPAIRCLINIC_API_KEY
        },
        partSelect: {
          apiUrl: import.meta.env.VITE_PARTSELECT_API_URL,
          apiKey: import.meta.env.VITE_PARTSELECT_API_KEY
        },
        appliancePartsPros: {
          apiUrl: import.meta.env.VITE_APPLIANCEPARTSPROS_API_URL,
          apiKey: import.meta.env.VITE_APPLIANCEPARTSPROS_API_KEY
        },
        encompassSupply: {
          apiUrl: import.meta.env.VITE_ENCOMPASS_API_URL,
          apiKey: import.meta.env.VITE_ENCOMPASS_API_KEY
        }
      },

      // Cache settings
      cache: {
        timeout: parseInt(import.meta.env.VITE_CACHE_TIMEOUT) || 900000, // 15 minutes
        maxSize: 100 // Maximum number of cached items
      },

      // Analytics configuration
      analytics: {
        googleAnalyticsId: import.meta.env.VITE_GOOGLE_ANALYTICS_ID,
        sentryDsn: import.meta.env.VITE_SENTRY_DSN
      },

      // API timeouts and limits
      api: {
        timeout: 10000, // 10 seconds
        retries: 3,
        rateLimitDelay: 1000 // 1 second between requests
      }
    };
  }

  /**
   * Validates the configuration and logs warnings for missing keys
   */
  validateConfiguration() {
    const warnings = [];
    const errors = [];

    // // Check OpenAI configuration
    // if (!this.config.openai.apiKey) {
    //   warnings.push('OpenAI API key not found. AI features will use demo mode.');
    //   // Force demo mode if no API key
    //   this.config.features.enableRealAI = false;
    // } else {
    //   console.log('✅ OpenAI API key configured - Real AI enabled');
    //   this.config.features.enableRealAI = true;
    // }

    // Check Google Places API
    if (!this.config.googlePlaces.apiKey) {
      warnings.push('Google Places API key not found. Store location will use mock data.');
    } else {
      console.log('✅ Google Places API key configured');
    }

    // Check vendor configurations
    if (this.config.features.enableVendorAPIs) {
      const vendorKeys = Object.entries(this.config.vendors);
      const missingVendors = vendorKeys.filter(([_, config]) => !config.apiKey);
      
      if (missingVendors.length > 0) {
        warnings.push(`Missing API keys for vendors: ${missingVendors.map(([name]) => name).join(', ')}. These vendors will use mock data.`);
      }
    }

    // Log warnings and errors
    if (this.config.app.debugMode || this.isDevelopment()) {
      warnings.forEach(warning => console.warn('⚠️ Config Warning:', warning));
      errors.forEach(error => console.error('❌ Config Error:', error));
    }

    this.configWarnings = warnings;
    this.configErrors = errors;
  }

  /**
   * Gets a configuration value by path
   * @param {string} path - Dot-separated path to config value
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Sets a configuration value by path
   * @param {string} path - Dot-separated path to config value
   * @param {*} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.config;

    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
  }

  /**
   * Checks if a feature is enabled
   * @param {string} featureName - Name of the feature
   * @returns {boolean} Whether the feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.get(`features.${featureName}`, false);
  }

  /**
   * Gets the current environment mode
   * @returns {string} Environment mode (development, production, etc.)
   */
  getMode() {
    return this.config.app.mode;
  }

  /**
   * Checks if running in development mode
   * @returns {boolean} Whether in development mode
   */
  isDevelopment() {
    return this.config.app.mode === 'development';
  }

  /**
   * Checks if running in production mode
   * @returns {boolean} Whether in production mode
   */
  isProduction() {
    return this.config.app.mode === 'production';
  }

  /**
   * Gets API configuration for a specific service
   * @param {string} serviceName - Name of the service
   * @returns {Object} API configuration
   */
  getAPIConfig(serviceName) {
    switch (serviceName) {
      case 'openai':
        return this.config.openai;
      case 'googlePlaces':
        return this.config.googlePlaces;
      case 'partsDatabase':
        return this.config.partsDatabase;
      default:
        return this.config.vendors[serviceName] || null;
    }
  }

  /**
   * Gets all vendor configurations
   * @returns {Object} Vendor configurations
   */
  getVendorConfigs() {
    return this.config.vendors;
  }

  /**
   * Gets cache configuration
   * @returns {Object} Cache configuration
   */
  getCacheConfig() {
    return this.config.cache;
  }

  /**
   * Gets analytics configuration
   * @returns {Object} Analytics configuration
   */
  getAnalyticsConfig() {
    return this.config.analytics;
  }

  /**
   * Gets API timeout and retry settings
   * @returns {Object} API settings
   */
  getAPISettings() {
    return this.config.api;
  }

  /**
   * Gets configuration warnings
   * @returns {Array} Array of warning messages
   */
  getWarnings() {
    return this.configWarnings || [];
  }

  /**
   * Gets configuration errors
   * @returns {Array} Array of error messages
   */
  getErrors() {
    return this.configErrors || [];
  }

  /**
   * Logs current configuration (for debugging)
   */
  logConfiguration() {
    console.group('🔧 PartFinder Pro Configuration');
    console.log('Mode:', this.config.app.mode);
    console.log('Features:', this.config.features);
    console.log('OpenAI configured:', !!this.config.openai.apiKey);
    console.log('Google Places configured:', !!this.config.googlePlaces.apiKey);
    console.log('Vendors configured:', Object.entries(this.config.vendors)
      .filter(([_, config]) => config.apiKey)
      .map(([name]) => name));
    console.log('Warnings:', this.configWarnings);
    console.log('Errors:', this.configErrors);
    console.groupEnd();
  }

  /**
   * Reloads configuration from environment
   */
  reload() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Gets a sanitized version of config for client-side logging
   * @returns {Object} Sanitized configuration
   */
  getSanitizedConfig() {
    const sanitized = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive information
    if (sanitized.openai) {
      sanitized.openai.apiKey = sanitized.openai.apiKey ? '[CONFIGURED]' : '[NOT SET]';
    }
    
    if (sanitized.googlePlaces) {
      sanitized.googlePlaces.apiKey = sanitized.googlePlaces.apiKey ? '[CONFIGURED]' : '[NOT SET]';
    }
    
    Object.keys(sanitized.vendors || {}).forEach(vendor => {
      if (sanitized.vendors[vendor].apiKey) {
        sanitized.vendors[vendor].apiKey = '[CONFIGURED]';
      }
    });

    return sanitized;
  }

  /**
   * Checks if real AI should be used (has API key and feature enabled)
   * @returns {boolean} Whether to use real AI
   */
  shouldUseRealAI() {
    return true;//this.config.features.enableRealAI && !!this.config.openai.apiKey;
  }

  /**
   * Checks if Google Places API should be used
   * @returns {boolean} Whether to use Google Places API
   */
  shouldUseGooglePlaces() {
    return !!this.config.googlePlaces.apiKey;
  }
}

// Export singleton instance
export const configService = new ConfigService();
export default configService;

