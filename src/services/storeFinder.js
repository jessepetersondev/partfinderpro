// Store Finder Service - FIXED VERSION
// Finds local stores that carry identified appliance parts using AI with proper distance filtering

import { geolocationService } from './geolocation.js';
import { aiStoreLocatorService } from './aiStoreLocator.js';

class StoreFinderService {
  constructor() {
    // No static database - using AI-powered dynamic store finding
    this.useAI = true;
    this.maxDistanceDefault = 5; // FIXED: Default to 5 miles instead of 25
  }

  /**
   * Find stores near user location that carry the specified part using AI
   * @param {Object} part - The identified part object
   * @param {Object} userLocation - User's location {latitude, longitude}
   * @param {number} maxDistance - Maximum distance in miles (default: 5)
   * @returns {Promise<Array>} Array of stores sorted by distance
   */
  async findNearbyStores(part, userLocation, maxDistance = this.maxDistanceDefault) {
    try {
      console.log(`StoreFinderService: Finding stores within ${maxDistance} miles for part: ${part.name}`);
      console.log('User location:', userLocation);

      // FIXED: Use stricter distance limit and ensure proper filtering
      const stores = await aiStoreLocatorService.findNearbyStores(part, userLocation, maxDistance);
      
      // ADDITIONAL FIX: Double-check distance filtering in case AI service didn't filter properly
      const filteredStores = this.filterStoresByDistance(stores, userLocation, maxDistance);
      
      // FIXED: Sort by distance and limit to closest stores
      const sortedStores = this.sortByDistanceAndRelevance(filteredStores, userLocation, part);
      
      // FIXED: Return only top 5 closest stores instead of 10
      const finalStores = sortedStores.slice(0, 5);
      
      console.log(`StoreFinderService: Returning ${finalStores.length} stores within ${maxDistance} miles`);
      
      // Log distances for debugging
      finalStores.forEach(store => {
        console.log(`- ${store.name}: ${store.distanceFormatted} (likelihood: ${store.likelihood || 'N/A'}%)`);
      });
      
      return finalStores;

    } catch (error) {
      console.error('StoreFinderService error:', error);
      throw new Error('Failed to find nearby stores');
    }
  }

  /**
   * FIXED: Additional distance filtering to ensure stores are within specified range
   * @param {Array} stores - Array of stores
   * @param {Object} userLocation - User's location
   * @param {number} maxDistance - Maximum distance in miles
   * @returns {Array} Filtered stores within distance
   */
  filterStoresByDistance(stores, userLocation, maxDistance) {
    return stores.filter(store => {
      // Calculate distance if not already calculated
      let distance = store.distance;
      
      if (distance === undefined) {
        const storeLat = store.coordinates?.lat || store.latitude;
        const storeLng = store.coordinates?.lng || store.longitude;
        
        if (storeLat && storeLng) {
          distance = geolocationService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            storeLat,
            storeLng
          );
          store.distance = distance;
          store.distanceFormatted = `${Math.round(distance * 10) / 10} mi`;
        } else {
          console.warn(`Store ${store.name} missing coordinates, excluding from results`);
          return false;
        }
      }
      
      const withinRange = distance <= maxDistance;
      if (!withinRange) {
        console.log(`Filtering out ${store.name} - ${distance.toFixed(1)} mi exceeds ${maxDistance} mi limit`);
      }
      
      return withinRange;
    });
  }

  /**
   * FIXED: Enhanced sorting by distance and part availability likelihood
   * @param {Array} stores - Array of stores
   * @param {Object} userLocation - User's location
   * @param {Object} part - The part being searched for
   * @returns {Array} Stores sorted by relevance and distance
   */
  sortByDistanceAndRelevance(stores, userLocation, part) {
    return stores.map(store => {
      // Ensure distance is calculated
      if (store.distance === undefined) {
        const storeLat = store.coordinates?.lat || store.latitude;
        const storeLng = store.coordinates?.lng || store.longitude;
        
        if (storeLat && storeLng) {
          store.distance = geolocationService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            storeLat,
            storeLng
          );
          store.distanceFormatted = `${Math.round(store.distance * 10) / 10} mi`;
        }
      }

      // FIXED: Calculate relevance score based on likelihood and distance
      const likelihood = store.likelihood || 50;
      const distance = store.distance || 999;
      
      // Relevance score: higher likelihood and closer distance = higher score
      // Distance penalty: each mile reduces score by 5 points
      // Likelihood bonus: each percentage point adds 1 point
      store.relevanceScore = likelihood - (distance * 5);
      
      // Ensure availability status is set
      if (!store.availability) {
        store.availability = this.getAvailabilityStatus(likelihood);
      }
      
      // Ensure estimated price is set
      if (!store.estimatedPrice) {
        store.estimatedPrice = this.getEstimatedPrice(part, store);
      }
      
      return store;
    }).sort((a, b) => {
      // FIXED: Primary sort by relevance score, secondary by distance
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 10) {
        return b.relevanceScore - a.relevanceScore; // Higher relevance first
      }
      return a.distance - b.distance; // Closer distance first for similar relevance
    });
  }

  /**
   * FIXED: Get availability status based on likelihood and store type
   * @param {number} likelihood - Likelihood score
   * @returns {Object} Availability status
   */
  getAvailabilityStatus(likelihood) {
    if (likelihood >= 85) {
      return { status: 'in-stock', label: 'Likely In Stock', color: 'green' };
    } else if (likelihood >= 70) {
      return { status: 'possible', label: 'May Have In Stock', color: 'orange' };
    } else if (likelihood >= 50) {
      return { status: 'call', label: 'Call to Confirm', color: 'gray' };
    } else {
      return { status: 'unlikely', label: 'Unlikely to Have', color: 'red' };
    }
  }

  /**
   * FIXED: Get estimated price based on part and store characteristics
   * @param {Object} part - The part object
   * @param {Object} store - The store object
   * @returns {Object} Estimated price information
   */
  getEstimatedPrice(part, store) {
    // Base price estimation logic
    let basePrice = 35; // Default base price
    
    // Adjust based on part category
    if (part.category) {
      const category = part.category.toLowerCase();
      if (category.includes('filter')) basePrice = 25;
      if (category.includes('seal') || category.includes('gasket')) basePrice = 30;
      if (category.includes('motor') || category.includes('pump')) basePrice = 85;
      if (category.includes('control') || category.includes('board')) basePrice = 120;
    }
    
    // Adjust based on store type and likelihood
    const likelihood = store.likelihood || 50;
    let priceMultiplier = 1.0;
    
    // Higher likelihood stores might have better prices (more competition)
    if (likelihood >= 85) priceMultiplier = 0.9;
    else if (likelihood >= 70) priceMultiplier = 1.0;
    else priceMultiplier = 1.1;
    
    // Store type adjustments
    const storeName = (store.name || '').toLowerCase();
    if (storeName.includes('home depot') || storeName.includes('lowe')) {
      priceMultiplier *= 0.95; // Big box stores often have competitive prices
    } else if (storeName.includes('parts') || storeName.includes('appliance')) {
      priceMultiplier *= 1.05; // Specialty stores might be slightly higher
    }
    
    const estimatedPrice = Math.round(basePrice * priceMultiplier);
    const priceRange = {
      low: Math.round(estimatedPrice * 0.85),
      high: Math.round(estimatedPrice * 1.15)
    };
    
    return {
      price: estimatedPrice,
      currency: 'USD',
      range: `$${priceRange.low}-$${priceRange.high}`,
      formatted: `$${estimatedPrice}`
    };
  }

  /**
   * Get store hours for today (utility method)
   * @param {Object} store - Store object
   * @returns {string} Today's hours
   */
  getTodaysHours(store) {
    if (!store.hours) return 'Hours not available';
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    return store.hours[today] || 'Hours not available';
  }

  /**
   * Check if store is currently open (utility method)
   * @param {Object} store - Store object
   * @returns {boolean}
   */
  isStoreOpen(store) {
    const todaysHours = this.getTodaysHours(store);
    if (todaysHours === 'Closed' || todaysHours === 'Hours not available') {
      return false;
    }

    // Simple check - in production would parse actual hours
    const now = new Date();
    const currentHour = now.getHours();
    
    // Most stores are open between 8 AM and 8 PM
    return currentHour >= 8 && currentHour < 20;
  }

  /**
   * Get directions URL to store (utility method)
   * @param {Object} store - Store object
   * @param {Object} userLocation - User's location
   * @returns {string} Google Maps directions URL
   */
  getDirectionsUrl(store, userLocation) {
    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    const storeLat = store.coordinates?.lat || store.latitude;
    const storeLng = store.coordinates?.lng || store.longitude;
    const destination = `${storeLat},${storeLng}`;
    return `https://www.google.com/maps/dir/${origin}/${destination}`;
  }

  /**
   * FIXED: Find stores by ZIP code with proper distance filtering
   * @param {Object} part - The identified part object
   * @param {string} zipCode - ZIP code to search near
   * @param {number} maxDistance - Maximum distance in miles (default: 5)
   * @returns {Promise<Array>} Array of stores sorted by distance
   */
  async findStoresByZipCode(part, zipCode, maxDistance = this.maxDistanceDefault) {
    try {
      // Convert ZIP code to coordinates
      const location = await this.zipCodeToCoordinates(zipCode);
      if (!location) {
        throw new Error('Invalid ZIP code or location not found');
      }
      
      console.log(`Finding stores near ZIP code ${zipCode} (${location.latitude}, ${location.longitude})`);
      
      // Use the same logic as findNearbyStores
      return await this.findNearbyStores(part, location, maxDistance);
      
    } catch (error) {
      console.error('Error finding stores by ZIP code:', error);
      throw error;
    }
  }

  /**
   * Convert ZIP code to coordinates
   * @param {string} zipCode - 5-digit ZIP code
   * @returns {Promise<Object>} Location coordinates
   */
  async zipCodeToCoordinates(zipCode) {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          latitude: parseFloat(data.places[0].latitude),
          longitude: parseFloat(data.places[0].longitude),
          zipCode: zipCode,
          city: data.places[0]['place name'],
          state: data.places[0]['state abbreviation']
        };
      }
      
      // Fallback coordinates for common ZIP codes
      const zipCodeMap = {
        '10001': { latitude: 40.7505, longitude: -73.9934, city: 'New York', state: 'NY' },
        '90210': { latitude: 34.0901, longitude: -118.4065, city: 'Beverly Hills', state: 'CA' },
        '60601': { latitude: 41.8781, longitude: -87.6298, city: 'Chicago', state: 'IL' },
        '77001': { latitude: 29.7604, longitude: -95.3698, city: 'Houston', state: 'TX' },
        '33101': { latitude: 25.7617, longitude: -80.1918, city: 'Miami', state: 'FL' },
        '55101': { latitude: 44.9537, longitude: -93.0900, city: 'Saint Paul', state: 'MN' },
        '30301': { latitude: 33.7490, longitude: -84.3880, city: 'Atlanta', state: 'GA' },
        '02101': { latitude: 42.3601, longitude: -71.0589, city: 'Boston', state: 'MA' },
        '98101': { latitude: 47.6062, longitude: -122.3321, city: 'Seattle', state: 'WA' },
        '80201': { latitude: 39.7392, longitude: -104.9903, city: 'Denver', state: 'CO' }
      };
      
      const fallback = zipCodeMap[zipCode];
      if (fallback) {
        return { ...fallback, zipCode };
      }
      
      return null;
    } catch (error) {
      console.error('Error converting ZIP code to coordinates:', error);
      return null;
    }
  }
}

// Create singleton instance
export const storeFinderService = new StoreFinderService();

// Export for testing
export { StoreFinderService };

