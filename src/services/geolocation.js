// Geolocation Service
// Handles getting user location for store finding

class GeolocationService {
  constructor() {
    this.currentLocation = null;
    this.locationError = null;
  }

  /**
   * Get user's current location
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        this.locationError = error;
        reject(new Error(error));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          
          this.currentLocation = location;
          this.locationError = null;
          console.log('Location obtained:', location);
          resolve(location);
        },
        (error) => {
          let errorMessage;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = 'An unknown error occurred while retrieving location';
              break;
          }
          
          this.locationError = errorMessage;
          console.error('Geolocation error:', errorMessage);
          reject(new Error(errorMessage));
        },
        options
      );
    });
  }

  /**
   * Get cached location if available and recent
   * @returns {Object|null}
   */
  getCachedLocation() {
    if (!this.currentLocation) return null;
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if (this.currentLocation.timestamp < fiveMinutesAgo) {
      return null; // Location is too old
    }
    
    return this.currentLocation;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - First point latitude
   * @param {number} lon1 - First point longitude
   * @param {number} lat2 - Second point latitude
   * @param {number} lon2 - Second point longitude
   * @returns {number} Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number}
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Format distance for display
   * @param {number} distance - Distance in miles
   * @returns {string}
   */
  formatDistance(distance) {
    if (distance < 0.1) return 'Less than 0.1 mi';
    if (distance < 1) return `${distance.toFixed(1)} mi`;
    return `${Math.round(distance)} mi`;
  }

  /**
   * Get location permission status
   * @returns {Promise<string>} 'granted', 'denied', or 'prompt'
   */
  async getPermissionStatus() {
    if (!navigator.permissions) {
      return 'unknown';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state;
    } catch (error) {
      console.warn('Could not check geolocation permission:', error);
      return 'unknown';
    }
  }

  /**
   * Request location permission
   * @returns {Promise<boolean>}
   */
  async requestLocationPermission() {
    try {
      await this.getCurrentLocation();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const geolocationService = new GeolocationService();

// Export for testing
export { GeolocationService };

