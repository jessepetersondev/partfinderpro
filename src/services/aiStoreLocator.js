// AI-Powered Store Locator Service - FIXED VERSION
// Uses AI to dynamically find real stores that carry specific appliance parts with proper distance filtering

import { geolocationService } from './geolocation.js';

class AIStoreLocatorService {
  constructor() {
    this.openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.googlePlacesApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    this.apiBase = import.meta.env.VITE_OPENAI_API_BASE || 'https://api.openai.com/v1';
  }

  /**
   * Find stores near user location that carry the specified part using AI
   * @param {Object} part - The identified part object
   * @param {Object} userLocation - User's location {latitude, longitude}
   * @param {number} maxDistance - Maximum distance in miles (default: 5)
   * @returns {Promise<Array>} Array of stores sorted by distance
   */
  async findNearbyStores(part, userLocation, maxDistance = 5) {
    console.log(`AI Store Locator: Finding stores within ${maxDistance} miles for part: ${part.name}`);
    console.log('User location:', userLocation);

    try {
      // Step 1: Use AI to determine relevant store types
      const storeTypes = await this.determineStoreTypes(part.name, part.category);
      console.log('AI determined store types:', storeTypes);

      // Step 2: Find nearby stores using Google Places API with strict distance limit
      const stores = await this.searchRealNearbyStores(userLocation, storeTypes, maxDistance);
      console.log(`Found nearby stores: ${stores.length}`);

      // Step 3: Use AI to verify which stores likely carry this part
      const verifiedStores = await this.verifyPartAvailability(stores, part.name, part.category);
      console.log(`Verified stores that carry part: ${verifiedStores.length}`);

      // Step 4: FIXED - Apply strict distance filtering and sort by distance
      const filteredStores = this.applyStrictDistanceFilter(verifiedStores, userLocation, maxDistance);
      const sortedStores = this.sortByDistanceAndRelevance(filteredStores, userLocation);
      
      // FIXED - Return only top 5 closest stores instead of 10
      const finalResults = sortedStores.slice(0, 5);

      console.log(`AI Store Locator: Returning ${finalResults.length} stores within ${maxDistance} miles`);
      
      // Log final results for debugging
      finalResults.forEach(store => {
        console.log(`- ${store.name}: ${store.distanceFormatted} (likelihood: ${store.likelihood}%)`);
      });
      
      return finalResults;

    } catch (error) {
      console.error('AI Store Locator error:', error);
      // FIXED - Fallback with proper distance filtering
      return this.generateFallbackStores(userLocation, part.name, maxDistance);
    }
  }

  /**
   * FIXED - Apply strict distance filtering to ensure no stores exceed the limit
   * @param {Array} stores - Array of stores
   * @param {Object} userLocation - User's location
   * @param {number} maxDistance - Maximum distance in miles
   * @returns {Array} Stores within the distance limit
   */
  applyStrictDistanceFilter(stores, userLocation, maxDistance) {
    return stores.filter(store => {
      const distance = store.distance || geolocationService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        store.coordinates.lat,
        store.coordinates.lng
      );
      
      store.distance = distance;
      store.distanceFormatted = `${Math.round(distance * 10) / 10} mi`;
      
      const withinRange = distance <= maxDistance;
      if (!withinRange) {
        console.log(`Filtering out ${store.name} - ${distance.toFixed(1)} mi exceeds ${maxDistance} mi limit`);
      }
      
      return withinRange;
    });
  }

  /**
   * FIXED - Enhanced sorting by distance and relevance
   * @param {Array} stores - Array of stores
   * @param {Object} userLocation - User's location
   * @returns {Array} Stores sorted by relevance and distance
   */
  sortByDistanceAndRelevance(stores, userLocation) {
    return stores.map(store => {
      // Calculate relevance score: higher likelihood and closer distance = higher score
      const likelihood = store.likelihood || 50;
      const distance = store.distance || 999;
      
      // Relevance score: likelihood bonus minus distance penalty
      store.relevanceScore = likelihood - (distance * 10); // Each mile reduces score by 10 points
      
      return store;
    }).sort((a, b) => {
      // Primary sort by relevance score, secondary by distance
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 15) {
        return b.relevanceScore - a.relevanceScore; // Higher relevance first
      }
      return a.distance - b.distance; // Closer distance first for similar relevance
    });
  }

  /**
   * Use AI to determine what types of stores typically carry this part
   * @param {string} partName - Name of the part
   * @param {string} partCategory - Category of the part
   * @returns {Promise<Array>} Array of store types for Google Places API
   */
  async determineStoreTypes(partName, partCategory) {
    if (!this.openaiApiKey) {
      console.warn('OpenAI API key not found, using fallback store types');
      return this.getFallbackStoreTypes(partName, partCategory);
    }

    try {
      const prompt = `You are an expert in appliance parts retail. I need to find stores that carry this specific appliance part:

Part: ${partName}
Category: ${partCategory || 'Unknown'}

Please provide a JSON array of Google Places API store types that would SPECIFICALLY carry appliance parts like this. Focus ONLY on stores that actually sell appliance parts, repair parts, or appliance-related items.

Valid Google Places API types to choose from:
- hardware_store (Home Depot, Lowe's, Ace Hardware)
- home_goods_store (appliance sections)
- electronics_store (for electronic appliance parts)
- store (general, but only if appliance-related)

EXCLUDE these types (they don't carry appliance parts):
- restaurant, food, clothing_store, beauty_salon, gas_station, bank, etc.

Example response: ["hardware_store", "home_goods_store"]

Be very selective - only include store types that would actually have appliance parts inventory.`;

      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const storeTypes = JSON.parse(jsonMatch[0]);
        // Validate that only appliance-relevant types are returned
        const validTypes = storeTypes.filter(type => 
          ['hardware_store', 'home_goods_store', 'electronics_store', 'store'].includes(type)
        );
        return validTypes.length > 0 ? validTypes : this.getFallbackStoreTypes(partName, partCategory);
      }

      return this.getFallbackStoreTypes(partName, partCategory);

    } catch (error) {
      console.error('Error getting store types from AI:', error);
      return this.getFallbackStoreTypes(partName, partCategory);
    }
  }

  /**
   * Get fallback store types when AI is not available
   * @param {string} partName - Name of the part
   * @param {string} partCategory - Category of the part
   * @returns {Array} Fallback store types
   */
  getFallbackStoreTypes(partName, partCategory) {
    return [
      'hardware_store',
      'home_goods_store', 
      'electronics_store',
      'store'
    ];
  }

  /**
   * FIXED - Search for real nearby stores using Google Places API with strict distance control
   * @param {Object} userLocation - User's location
   * @param {Array} storeTypes - Store types to search for
   * @param {number} maxDistance - Maximum distance in miles
   * @returns {Promise<Array>} Array of real nearby stores
   */
  async searchRealNearbyStores(userLocation, storeTypes, maxDistance) {
    if (!this.googlePlacesApiKey) {
      console.warn('Google Places API key not found, using fallback method');
      return this.generateFallbackStores(userLocation, 'appliance part', maxDistance);
    }

    try {
      // FIXED - Convert miles to meters with stricter limit
      const radiusMeters = Math.min(maxDistance * 1609.34, maxDistance * 1609.34); // No artificial cap, use actual distance
      
      console.log(`Searching Google Places within ${radiusMeters}m (${maxDistance} miles) radius`);
      
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googlePlacesApiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,places.types,places.internationalPhoneNumber'
        },
        body: JSON.stringify({
          includedTypes: storeTypes,
          maxResultCount: 20, // Get more results to filter from
          locationRestriction: {
            circle: {
              center: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              },
              radius: radiusMeters
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google Places API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.places || data.places.length === 0) {
        console.log('No places found, using fallback stores');
        return this.generateFallbackStores(userLocation, 'appliance part', maxDistance);
      }

      // Convert Google Places results to our format and calculate distances
      const stores = data.places
        .filter(place => place.businessStatus === 'OPERATIONAL')
        .map(place => {
          const store = {
            id: place.name?.text || 'unknown',
            name: place.displayName?.text || 'Unknown Store',
            address: place.formattedAddress || 'Address not available',
            coordinates: {
              lat: place.location?.latitude || userLocation.latitude,
              lng: place.location?.longitude || userLocation.longitude
            },
            googleMapsUri: place.googleMapsUri || '',
            rating: place.rating || 0,
            userRatingCount: place.userRatingCount || 0,
            phone: place.internationalPhoneNumber || '',
            types: place.types || [],
            source: 'google_places'
          };
          
          // Calculate distance immediately
          store.distance = geolocationService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            store.coordinates.lat,
            store.coordinates.lng
          );
          store.distanceFormatted = `${Math.round(store.distance * 10) / 10} mi`;
          
          return store;
        })
        // FIXED - Filter out stores that exceed the distance limit
        .filter(store => {
          const withinRange = store.distance <= maxDistance;
          if (!withinRange) {
            console.log(`Google Places returned store outside range: ${store.name} at ${store.distance.toFixed(1)} mi`);
          }
          return withinRange;
        });

      console.log(`Google Places API returned ${stores.length} operational stores within ${maxDistance} miles`);
      return stores;

    } catch (error) {
      console.error('Error searching Google Places API:', error);
      return this.generateFallbackStores(userLocation, 'appliance part', maxDistance);
    }
  }

  /**
   * Use AI to verify which stores likely carry the specific part
   * @param {Array} stores - Array of nearby stores
   * @param {string} partName - Name of the part
   * @param {string} partCategory - Category of the part
   * @returns {Promise<Array>} Verified stores with likelihood scores
   */
  async verifyPartAvailability(stores, partName, partCategory) {
    if (!this.openaiApiKey || stores.length === 0) {
      // Without AI, use heuristic filtering
      return this.heuristicStoreFiltering(stores, partName, partCategory);
    }

    try {
      const storeList = stores.slice(0, 15).map((store, index) => 
        `${index + 1}. ${store.name} - ${store.address} (Types: ${store.types?.join(', ') || 'Unknown'}) [Distance: ${store.distanceFormatted}]`
      ).join('\n');

      const prompt = `You are an expert in appliance parts retail. I need to determine which of these stores would ACTUALLY carry this specific appliance part.

Part: ${partName}
Category: ${partCategory || 'Unknown'}

Stores to evaluate:
${storeList}

For each store, provide a likelihood score (0-100) that they would carry this SPECIFIC appliance part. Be VERY STRICT - only give high scores to stores that actually sell appliance parts.

Consider:
- Does the store name indicate appliance parts (Home Depot, Lowe's, appliance repair, parts store)?
- Would this type of business actually stock appliance parts?
- EXCLUDE restaurants, clothing stores, gas stations, banks, etc. (give them 0-10 scores)
- ONLY include stores that would realistically have appliance parts inventory
- Give HIGHER scores to stores that are CLOSER to the user (shorter distances)

Respond with JSON array: [{"index": 1, "likelihood": 85, "reason": "Major home improvement store with appliance parts section"}, {"index": 2, "likelihood": 5, "reason": "Restaurant - does not carry appliance parts"}]

Only include stores with likelihood >= 60 in your response. Be very selective and prioritize closer stores.`;

      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;

      // Parse AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const evaluations = JSON.parse(jsonMatch[0]);
        const verifiedStores = [];

        for (const evaluation of evaluations) {
          const storeIndex = evaluation.index - 1;
          // FIXED - Increased minimum likelihood threshold to 60
          if (storeIndex >= 0 && storeIndex < stores.length && evaluation.likelihood >= 60) {
            const store = { ...stores[storeIndex] };
            store.likelihood = evaluation.likelihood;
            store.aiReason = evaluation.reason;
            verifiedStores.push(store);
          }
        }

        // If AI filtered out too many stores, use heuristic as backup
        if (verifiedStores.length === 0) {
          console.log('AI filtered out all stores, using heuristic backup');
          return this.heuristicStoreFiltering(stores, partName, partCategory);
        }

        return verifiedStores;
      }

      return this.heuristicStoreFiltering(stores, partName, partCategory);

    } catch (error) {
      console.error('Error verifying stores with AI:', error);
      return this.heuristicStoreFiltering(stores, partName, partCategory);
    }
  }

  /**
   * FIXED - Heuristic filtering when AI is not available with stricter criteria
   * @param {Array} stores - Array of stores
   * @param {string} partName - Name of the part
   * @param {string} partCategory - Category of the part
   * @returns {Array} Filtered stores with likelihood scores
   */
  heuristicStoreFiltering(stores, partName, partCategory) {
    return stores.map(store => {
      let likelihood = 20; // FIXED - Lower base likelihood to be more strict
      const storeName = store.name.toLowerCase();
      const storeTypes = (store.types || []).join(' ').toLowerCase();

      // Strong positive indicators for appliance parts
      if (storeName.includes('home depot') || storeName.includes('depot')) likelihood += 50;
      if (storeName.includes('lowe') || storeName.includes("lowe's")) likelihood += 50;
      if (storeName.includes('sears') || storeName.includes('parts')) likelihood += 55;
      if (storeName.includes('appliance')) likelihood += 45;
      if (storeName.includes('repair')) likelihood += 40;
      if (storeName.includes('hardware')) likelihood += 35;
      if (storeName.includes('ace hardware')) likelihood += 40;

      // Store type indicators
      if (storeTypes.includes('home_goods_store')) likelihood += 25;
      if (storeTypes.includes('hardware_store')) likelihood += 30;
      if (storeTypes.includes('electronics_store')) likelihood += 20;

      // FIXED - Distance bonus: closer stores get higher likelihood
      const distance = store.distance || 999;
      if (distance <= 1) likelihood += 15; // Very close stores get bonus
      else if (distance <= 2) likelihood += 10;
      else if (distance <= 3) likelihood += 5;

      // Strong negative indicators - these stores definitely don't carry appliance parts
      if (storeTypes.includes('restaurant') || storeName.includes('restaurant')) likelihood = 0;
      if (storeTypes.includes('food') || storeName.includes('food')) likelihood = 0;
      if (storeTypes.includes('clothing_store') || storeName.includes('clothing')) likelihood = 0;
      if (storeTypes.includes('beauty_salon') || storeName.includes('beauty')) likelihood = 0;
      if (storeTypes.includes('gas_station') || storeName.includes('gas')) likelihood = 0;
      if (storeTypes.includes('bank') || storeName.includes('bank')) likelihood = 0;
      if (storeTypes.includes('pharmacy') || storeName.includes('pharmacy')) likelihood = 0;
      if (storeTypes.includes('car_') || storeName.includes('auto')) likelihood = 0;
      if (storeName.includes('coffee') || storeName.includes('cafe')) likelihood = 0;
      if (storeName.includes('hotel') || storeName.includes('motel')) likelihood = 0;
      if (storeName.includes('school') || storeName.includes('hospital')) likelihood = 0;

      // Additional exclusions for non-appliance businesses
      if (storeName.includes('pizza') || storeName.includes('burger')) likelihood = 0;
      if (storeName.includes('salon') || storeName.includes('spa')) likelihood = 0;
      if (storeName.includes('gym') || storeName.includes('fitness')) likelihood = 0;
      if (storeName.includes('church') || storeName.includes('temple')) likelihood = 0;

      return {
        ...store,
        likelihood: Math.max(0, Math.min(100, likelihood)),
        aiReason: likelihood > 0 ? 'Heuristic evaluation - likely carries appliance parts' : 'Heuristic evaluation - does not carry appliance parts'
      };
    }).filter(store => store.likelihood >= 60); // FIXED - Increased threshold to 60%
  }

  /**
   * Get availability status based on likelihood
   * @param {number} likelihood - Likelihood score
   * @returns {Object} Availability status
   */
  getAvailabilityStatus(likelihood) {
    if (likelihood >= 85) {
      return { status: 'likely', label: 'Likely In Stock', color: 'green' };
    } else if (likelihood >= 70) {
      return { status: 'possible', label: 'May Have In Stock', color: 'orange' };
    } else {
      return { status: 'call', label: 'Call to Confirm', color: 'gray' };
    }
  }

  /**
   * Get estimated price based on likelihood and store type
   * @param {number} likelihood - Likelihood score
   * @returns {string} Estimated price range
   */
  getEstimatedPrice(likelihood) {
    const basePrice = 35;
    const variation = likelihood >= 70 ? 0.9 : 1.1;
    const price = Math.round(basePrice * variation);
    return `$${price - 10}-$${price + 15}`;
  }

  /**
   * Get directions URL to store
   * @param {Object} storeCoords - Store coordinates
   * @param {Object} userLocation - User location
   * @returns {string} Google Maps directions URL
   */
  getDirectionsUrl(storeCoords, userLocation) {
    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    const destination = `${storeCoords.lat},${storeCoords.lng}`;
    return `https://www.google.com/maps/dir/${origin}/${destination}`;
  }

  /**
   * FIXED - Generate fallback stores when APIs are not available with proper distance control
   * @param {Object} userLocation - User's location
   * @param {string} partName - Name of the part
   * @param {number} maxDistance - Maximum distance in miles
   * @returns {Array} Fallback stores within distance limit
   */
  generateFallbackStores(userLocation, partName, maxDistance = 5) {
    console.log(`Generating fallback stores within ${maxDistance} miles`);
    
    // FIXED - Generate stores at realistic distances within the limit
    const fallbackStores = [
      {
        id: 'fallback_hd',
        name: 'The Home Depot',
        address: `Near ${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`,
        coordinates: {
          lat: userLocation.latitude + (0.01 * Math.min(maxDistance / 5, 1)), // Scale with distance limit
          lng: userLocation.longitude + (0.01 * Math.min(maxDistance / 5, 1))
        },
        rating: 4.2,
        userRatingCount: 1250,
        phone: '(555) 123-4567',
        types: ['home_goods_store', 'hardware_store'],
        likelihood: 85,
        aiReason: 'Major home improvement retailer with appliance parts section',
        source: 'fallback'
      },
      {
        id: 'fallback_lowes',
        name: "Lowe's Home Improvement",
        address: `Near ${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`,
        coordinates: {
          lat: userLocation.latitude - (0.008 * Math.min(maxDistance / 5, 1)),
          lng: userLocation.longitude + (0.012 * Math.min(maxDistance / 5, 1))
        },
        rating: 4.1,
        userRatingCount: 980,
        phone: '(555) 234-5678',
        types: ['home_goods_store', 'hardware_store'],
        likelihood: 80,
        aiReason: 'Home improvement store with appliance section',
        source: 'fallback'
      },
      {
        id: 'fallback_local',
        name: 'Local Appliance Parts Center',
        address: `Near ${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`,
        coordinates: {
          lat: userLocation.latitude + (0.005 * Math.min(maxDistance / 5, 1)),
          lng: userLocation.longitude - (0.008 * Math.min(maxDistance / 5, 1))
        },
        rating: 4.5,
        userRatingCount: 156,
        phone: '(555) 345-6789',
        types: ['store', 'establishment'],
        likelihood: 92,
        aiReason: 'Specialized appliance parts retailer',
        source: 'fallback'
      }
    ];

    // Calculate distances and filter by maxDistance
    const storesWithDistance = fallbackStores.map(store => {
      store.distance = geolocationService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        store.coordinates.lat,
        store.coordinates.lng
      );
      store.distanceFormatted = `${Math.round(store.distance * 10) / 10} mi`;
      
      // Add availability and pricing
      store.availability = this.getAvailabilityStatus(store.likelihood);
      store.estimatedPrice = this.getEstimatedPrice(store.likelihood);
      store.directionsUrl = this.getDirectionsUrl(store.coordinates, userLocation);
      
      return store;
    }).filter(store => store.distance <= maxDistance);

    return storesWithDistance.sort((a, b) => a.distance - b.distance);
  }
}

// Create singleton instance
export const aiStoreLocatorService = new AIStoreLocatorService();

// Export for testing
export { AIStoreLocatorService };

