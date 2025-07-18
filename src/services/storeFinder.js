// Store Finder Service
// Finds local stores that carry identified appliance parts using AI

import { geolocationService } from './geolocation.js';
import { aiStoreLocatorService } from './aiStoreLocator.js';

class StoreFinderService {
  constructor() {
    // No static database - using AI-powered dynamic store finding
    this.useAI = true;
  }

  /**
   * Find stores near user location that carry the specified part using AI
   * @param {Object} part - The identified part object
   * @param {Object} userLocation - User's location {latitude, longitude}
   * @param {number} maxDistance - Maximum distance in miles (default: 25)
   * @returns {Promise<Array>} Array of stores sorted by distance
   */
  async findNearbyStores(part, userLocation, maxDistance = 25) {
    try {
      // Use AI Store Locator for dynamic store finding
      console.log('StoreFinderService: Delegating to AI Store Locator');
      const stores = await aiStoreLocatorService.findNearbyStores(part, userLocation, maxDistance);
      console.log(`StoreFinderService: Found ${stores.length} stores using AI`);
      return stores;

    } catch (error) {
      console.error('StoreFinderService error:', error);
      throw new Error('Failed to find nearby stores');
    }
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
    const destination = `${store.latitude},${store.longitude}`;
    return `https://www.google.com/maps/dir/${origin}/${destination}`;
  }
}

// Create singleton instance
export const storeFinderService = new StoreFinderService();

// Export for testing
export { StoreFinderService };

