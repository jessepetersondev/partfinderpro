import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Camera, Search, MapPin, Star, Navigation, CheckCircle, Upload, Zap, Target, DollarSign, Play, AlertCircle, Clock, Phone, ExternalLink, ShoppingCart, Package } from 'lucide-react'
import sampleSeal from './assets/sample-dishwasher-seal.jpg'
import sampleFilter from './assets/sample-water-filter.jpg'
import { useCapacitor } from './hooks/useCapacitor';
import './App.css'

// Mock data for demonstration (preserved for fallback)
const mockParts = [
  {
    id: '1',
    name: 'Dishwasher Door Seal',
    partNumber: 'WPW10300924',
    brand: 'Whirlpool',
    category: 'Seals & Gaskets',
    description: 'Genuine OEM door seal for Whirlpool dishwashers. Prevents water leakage and ensures proper door closure.',
    imageUrl: sampleSeal,
    compatibleModels: ['WDF520PADM', 'WDT720PADM', 'WDF540PADM', 'WDT750SAHZ'],
    specifications: {
      'Material': 'Rubber',
      'Color': 'Black',
      'Dimensions': '24" x 18"',
      'Weight': '1.2 lbs',
      'Temperature Range': '-40°F to 180°F'
    },
    confidence: 92
  },
  {
    id: '2',
    name: 'Refrigerator Water Filter',
    partNumber: 'EDR4RXD1',
    brand: 'Whirlpool',
    category: 'Filters',
    description: 'Genuine refrigerator water filter. Reduces chlorine taste and odor, certified for quality.',
    imageUrl: sampleFilter,
    compatibleModels: ['WRS325SDHZ', 'WRS588FIHZ', 'WRS571CIHZ', 'WRS315SDHM'],
    specifications: {
      'Filter Life': '6 months',
      'Flow Rate': '0.5 GPM',
      'Certification': 'NSF 42 & 53',
      'Dimensions': '10.8" x 2.4"',
      'Capacity': '200 gallons'
    },
    confidence: 88
  }
]

// API Services (lazy loaded to prevent blocking)
let apiServices = null;

const loadAPIServices = async () => {
  if (apiServices) return apiServices;
  
  try {
    const [configModule, imageModule, partsModule, geolocationModule, storeFinderModule, productPurchaseModule] = await Promise.all([
      import('./services/config.js').catch(() => null),
      import('./services/imageRecognition.js').catch(() => null),
      import('./services/partsDatabase.js').catch(() => null),
      import('./services/geolocation.js').catch(() => null),
      import('./services/storeFinder.js').catch(() => null),
      import('./services/productPurchaseService.js').catch(() => null)
    ]);

    apiServices = {
      config: configModule?.configService || null,
      imageRecognition: imageModule?.imageRecognitionService || null,
      partsDatabase: partsModule?.partsDatabase || null,
      geolocation: geolocationModule?.geolocationService || null,
      storeFinder: storeFinderModule?.storeFinderService || null,
      productPurchase: productPurchaseModule?.productPurchaseService || null,
      // CRITICAL FIX: Import the standalone validateImage function
      validateImage: imageModule?.validateImage || null
    };

    // Initialize configuration if available
    if (apiServices.config) {
      apiServices.config.logConfiguration();
    }

    return apiServices;
  } catch (error) {
    console.warn('Failed to load API services, using fallback mode:', error);
    return null;
  }
};

function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [selectedPart, setSelectedPart] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [nearbyStores, setNearbyStores] = useState([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [apiStatus, setApiStatus] = useState({ ai: 'demo', location: 'demo', loaded: false })
  const [error, setError] = useState(null)
  const [zipCode, setZipCode] = useState('') // FIXED - Added ZIP code state
  
  // NEW: Purchase functionality state
  const [productOffers, setProductOffers] = useState([])
  const [isLoadingOffers, setIsLoadingOffers] = useState(false)
  const [showPurchaseOptions, setShowPurchaseOptions] = useState(false)
  
  const fileInputRef = useRef(null)
  const { takePicture, isCapacitorAvailable } = useCapacitor();

  // Load API services on component mount
  useEffect(() => {
    const initializeServices = async () => {
      const services = await loadAPIServices();
      if (services) {
        setApiStatus({
          ai: services.imageRecognition ? 'ready' : 'demo',
          location: services.geolocation ? 'ready' : 'demo',
          loaded: true
        });
      } else {
        setApiStatus({ ai: 'demo', location: 'demo', loaded: true });
      }
    };

    initializeServices();
  }, []);

  /**
   * FIXED: Create proper search query with validation and fallbacks
   */
  const createSearchQuery = (part) => {
    if (!part) {
      console.warn('No part data provided for search query');
      return 'appliance part';
    }

    // FIXED: Ensure all fields exist and have fallbacks
    const brand = part.brand || '';
    const name = part.name || '';
    const partNumber = part.partNumber || '';
    const category = part.category || '';

    console.log('Creating search query from part data:', {
      brand,
      name,
      partNumber,
      category,
      fullPart: part
    });

    // FIXED: Build search query with multiple fallback strategies
    let searchTerms = [];

    // Primary strategy: Use all available information
    if (brand && brand !== 'Not Visible') searchTerms.push(brand);
    if (name && name !== 'Not Visible') searchTerms.push(name);
    if (partNumber && partNumber !== 'Not Visible') searchTerms.push(partNumber);

    // Fallback strategy: Use category if main terms are missing
    if (searchTerms.length === 0 && category && category !== 'Not Visible') {
      searchTerms.push(category);
      searchTerms.push('appliance part');
    }

    // Final fallback: Generic appliance part search
    if (searchTerms.length === 0) {
      searchTerms = ['appliance', 'part', 'replacement'];
    }

    const searchQuery = searchTerms.join(' ').trim();
    
    console.log('Generated search query:', searchQuery);
    
    return searchQuery;
  };

  /**
   * NEW: Load product offers from multiple stores
   */
  const loadProductOffers = async (part) => {
    if (!part) return;

    setIsLoadingOffers(true);
    
    try {
      const services = await loadAPIServices();
      
      if (services && services.productPurchase && services.productPurchase.isConfigured()) {
        console.log('🛒 Loading product offers...');
        
        // FIXED: Use improved search query creation
        const searchQuery = createSearchQuery(part);
        
        const offers = await services.productPurchase.searchProducts(searchQuery, {
          maxResults: 10,
          sortBy: 'RELEVANCE'
        });
        
        // Filter offers with high confidence for appliance parts
        const relevantOffers = offers.filter(offer => offer.confidence >= 60);
        
        setProductOffers(relevantOffers);
        console.log(`✅ Found ${relevantOffers.length} relevant product offers`);
      } else {
        console.log('🔄 Product purchase service not configured, using fallback');
        setProductOffers(generateFallbackOffers(part));
      }
    } catch (error) {
      console.error('Error loading product offers:', error);
      setProductOffers(generateFallbackOffers(part));
    } finally {
      setIsLoadingOffers(false);
    }
  };

  /**
   * FIXED: Generate fallback offers with proper search query handling
   */
  const generateFallbackOffers = (part) => {
    // FIXED: Use improved search query creation and encoding
    const searchQuery = createSearchQuery(part);
    const encodedSearchQuery = encodeURIComponent(searchQuery);
    
    console.log('Generating fallback offers with search query:', searchQuery);
    
    // FIXED: Ensure part data exists with proper fallbacks
    const partName = part?.name || 'Appliance Part';
    const partNumber = part?.partNumber || '';
    const displayTitle = partNumber ? `${partName} - ${partNumber}` : partName;
    
    return [
      {
        id: 'amazon-fallback',
        title: displayTitle,
        store: 'Amazon',
        price: 45.99,
        currency: 'USD',
        availability: 'In Stock',
        affiliateUrl: `https://www.amazon.com/s?k=${encodedSearchQuery}&tag=partfinderpro-20`,
        confidence: 85,
        isFallback: true,
        searchQuery: searchQuery // FIXED: Store original search query for debugging
      },
      {
        id: 'ebay-fallback',
        title: displayTitle,
        store: 'eBay',
        price: 42.50,
        currency: 'USD',
        availability: 'In Stock',
        affiliateUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodedSearchQuery}`,
        confidence: 80,
        isFallback: true,
        searchQuery: searchQuery // FIXED: Store original search query for debugging
      },
      {
        id: 'walmart-fallback',
        title: displayTitle,
        store: 'Walmart',
        price: 48.99,
        currency: 'USD',
        availability: 'In Stock',
        affiliateUrl: `https://www.walmart.com/search?q=${encodedSearchQuery}`,
        confidence: 75,
        isFallback: true,
        searchQuery: searchQuery // FIXED: Store original search query for debugging
      }
    ];
  };

  /**
   * FIXED: Handle buying a product with enhanced debugging
   */
  const handleBuyProduct = (offer) => {
    if (!offer || !offer.affiliateUrl) {
      setError('Purchase link not available for this product.');
      return;
    }

    // FIXED: Enhanced tracking and debugging
    console.log('🛒 User clicking buy button for:', {
      store: offer.store,
      product: offer.title,
      price: offer.price,
      partNumber: selectedPart?.partNumber,
      searchQuery: offer.searchQuery || 'not available',
      affiliateUrl: offer.affiliateUrl,
      selectedPartData: selectedPart
    });

    // FIXED: Validate URL before opening
    try {
      const url = new URL(offer.affiliateUrl);
      console.log('✅ Opening valid URL:', url.href);
      
      // Open affiliate URL in new tab
      window.open(offer.affiliateUrl, '_blank', 'noopener,noreferrer');
    } catch (urlError) {
      console.error('❌ Invalid URL:', offer.affiliateUrl, urlError);
      setError('Invalid purchase link. Please try a different option.');
    }
  };

  /**
   * Handle camera capture
   */
  const handleCameraCapture = async () => {
    setError(null);
    
    try {
      if (isCapacitorAvailable) {
        // Use Capacitor camera for mobile
        const imageData = await takePicture();
        if (imageData) {
          setCapturedImage(imageData);
          await processImage(imageData);
        }
      } else {
        // Use file input for web
        fileInputRef.current?.click();
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      setError('Camera not available. Please use file upload instead.');
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Please select an image under 10MB.');
      return;
    }

    try {
      const services = await loadAPIServices();
      
      // Use the standalone validateImage function if available
      if (services && services.validateImage) {
        const validation = services.validateImage(file);
        if (!validation.isValid) {
          setError(validation.errors.join(' '));
          return;
        }
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result;
        if (imageData) {
          setCapturedImage(imageData);
          await processImage(imageData);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload error:', error);
      setError('Error processing image file. Please try again.');
    }
  };

  /**
   * FIXED: Process captured/uploaded image with enhanced data validation
   */
  const processImage = async (imageData) => {
    setIsProcessing(true);
    setError(null);

    try {
      const services = await loadAPIServices();
      let identifiedPart = null;

      if (services && services.imageRecognition) {
        try {
          console.log('Using AI for part identification');
          identifiedPart = await services.imageRecognition.identifyPart(imageData);
          
          if (identifiedPart && services.partsDatabase) {
            // Enhance with additional part data
            identifiedPart = await services.partsDatabase.enhancePartData(identifiedPart);
          }
          
          if (identifiedPart) {
            identifiedPart.source = 'ai';
            
            // FIXED: Validate and clean part data
            identifiedPart = validateAndCleanPartData(identifiedPart);
          }
        } catch (aiError) {
          console.warn('AI identification failed, falling back to demo mode:', aiError);
          identifiedPart = null;
        }
      }

      if (!identifiedPart) {
        // Fallback to demo mode
        console.log('Using demo mode for part identification');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
        identifiedPart = { ...mockParts[0] }; // Use first mock part
        identifiedPart.source = 'demo';
        
        // FIXED: Ensure demo data is also validated
        identifiedPart = validateAndCleanPartData(identifiedPart);
      }

      if (identifiedPart) {
        console.log('✅ Part identified:', identifiedPart);
        setSelectedPart(identifiedPart);
        setCurrentScreen('results');
        
        // NEW: Automatically load product offers
        await loadProductOffers(identifiedPart);
      } else {
        setError('Could not identify the part. Please try a clearer image.');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * FIXED: Validate and clean part data to prevent "Not Visible" issues
   */
  const validateAndCleanPartData = (part) => {
    if (!part) return null;

    // FIXED: Clean up any "Not Visible" or invalid values
    const cleanedPart = { ...part };

    // Clean string fields
    ['name', 'brand', 'partNumber', 'category', 'description'].forEach(field => {
      if (cleanedPart[field] === 'Not Visible' || 
          cleanedPart[field] === 'undefined' || 
          cleanedPart[field] === 'null' || 
          !cleanedPart[field] || 
          typeof cleanedPart[field] !== 'string') {
        
        // Provide sensible defaults based on field
        switch (field) {
          case 'name':
            cleanedPart[field] = 'Appliance Part';
            break;
          case 'brand':
            cleanedPart[field] = 'Generic';
            break;
          case 'partNumber':
            cleanedPart[field] = 'Unknown';
            break;
          case 'category':
            cleanedPart[field] = 'Parts';
            break;
          case 'description':
            cleanedPart[field] = 'Replacement appliance part';
            break;
          default:
            cleanedPart[field] = '';
        }
      }
    });

    // FIXED: Ensure confidence is a valid number
    if (!cleanedPart.confidence || isNaN(cleanedPart.confidence)) {
      cleanedPart.confidence = 75; // Default confidence
    }

    console.log('✅ Cleaned part data:', cleanedPart);
    
    return cleanedPart;
  };

  /**
   * Handle demo mode
   */
  const handleDemo = async () => {
    setError(null);
    setIsProcessing(true);
    setCapturedImage(sampleSeal);
    
    try {
      const services = await loadAPIServices();
      let demoPartData = { ...mockParts[0] };

      if (services && services.partsDatabase) {
        // Enhance demo data with API services
        demoPartData = await services.partsDatabase.enhancePartData(demoPartData);
        demoPartData.source = 'api-demo';
      } else {
        demoPartData.source = 'demo';
      }

      // FIXED: Ensure demo data is validated
      demoPartData = validateAndCleanPartData(demoPartData);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSelectedPart(demoPartData);
      setCurrentScreen('results');
      
      // NEW: Load product offers for demo part
      await loadProductOffers(demoPartData);
    } catch (error) {
      console.error('Error in demo mode:', error);
      setError('Demo mode error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * FIXED - Handle finding local stores with proper distance filtering
   */
  const handleFindStores = async () => {
    if (!selectedPart) return;

    setIsLoadingStores(true);
    setLocationError(null);
    setError(null);

    try {
      const services = await loadAPIServices();
      
      // FIXED - Use stricter distance limit (3-5 miles instead of 25)
      const maxDistance = 5; // Maximum 5 miles
      
      // Always try to use the AI store locator first
      if (services && services.storeFinder) {
        console.log(`Using AI Store Locator for store finding within ${maxDistance} miles`);
        
        // Get user location first
        let location;
        if (services.geolocation) {
          try {
            location = await services.geolocation.getCurrentLocation();
            setUserLocation(location);
            console.log('Got user location:', location);
          } catch (locationError) {
            console.warn('Could not get user location:', locationError);
            setLocationError('Location access denied. Please enable location services or enter your ZIP code below.');
            
            // Don't use fallback location - require user input
            setIsLoadingStores(false);
            return;
          }
        } else {
          console.log('Geolocation service not available');
          setLocationError('Location services not available. Please enter your ZIP code below.');
          setIsLoadingStores(false);
          return;
        }

        // FIXED - Use AI store locator with strict distance limit
        const stores = await services.storeFinder.findNearbyStores(selectedPart, location, maxDistance);
        setNearbyStores(stores);
        
        console.log(`AI Store Locator found ${stores.length} stores within ${maxDistance} miles`);
        
        if (stores.length === 0) {
          setError(`No stores found within ${maxDistance} miles. Try entering a ZIP code to search a different area.`);
        }
      } else {
        // Only fallback to demo if services completely failed to load
        console.log('Services failed to load, using demo mode for store finding');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
        
        // FIXED - Create demo stores with realistic close distances
        const demoStores = [
          {
            id: 'demo_1',
            name: 'The Home Depot',
            chain: 'Home Depot',
            address: '1234 Main Street',
            city: 'Your City',
            state: 'CA',
            zipCode: '90210',
            phone: '(555) 123-4567',
            distance: 1.8, // FIXED - Closer distance
            distanceFormatted: '1.8 mi',
            rating: 4.2,
            availability: { status: 'in-stock', label: 'Likely In Stock', color: 'green' },
            estimatedPrice: { price: 24.99, currency: 'USD', formatted: '$24.99', range: '$20-$30' },
            hours: { monday: '6:00 AM - 10:00 PM' },
            services: ['Parts Lookup', 'Installation', 'Repair Service'],
            website: 'https://homedepot.com',
            likelihood: 85,
            coordinates: { lat: 34.0522, lng: -118.2437 }
          },
          {
            id: 'demo_2',
            name: "Lowe's Home Improvement",
            chain: "Lowe's",
            address: '5678 Oak Avenue',
            city: 'Your City',
            state: 'CA',
            zipCode: '90210',
            phone: '(555) 234-5678',
            distance: 2.4, // FIXED - Closer distance
            distanceFormatted: '2.4 mi',
            rating: 4.3,
            availability: { status: 'possible', label: 'May Have In Stock', color: 'orange' },
            estimatedPrice: { price: 26.95, currency: 'USD', formatted: '$26.95', range: '$22-$32' },
            hours: { monday: '6:00 AM - 10:00 PM' },
            services: ['Parts Lookup', 'Installation', 'Appliance Repair'],
            website: 'https://lowes.com',
            likelihood: 80,
            coordinates: { lat: 34.0522, lng: -118.2437 }
          },
          {
            id: 'demo_3',
            name: 'ABC Appliance Parts',
            chain: 'Independent',
            address: '9876 Pine Street',
            city: 'Your City',
            state: 'CA',
            zipCode: '90210',
            phone: '(555) 345-6789',
            distance: 3.2, // FIXED - Closer distance
            distanceFormatted: '3.2 mi',
            rating: 4.7,
            availability: { status: 'in-stock', label: 'Likely In Stock', color: 'green' },
            estimatedPrice: { price: 23.50, currency: 'USD', formatted: '$23.50', range: '$19-$28' },
            hours: { monday: '9:00 AM - 6:00 PM' },
            services: ['Parts Lookup', 'Expert Advice', 'Special Orders'],
            website: 'https://abcapplianceparts.com',
            likelihood: 92,
            coordinates: { lat: 34.0522, lng: -118.2437 }
          }
        ];
        
        setNearbyStores(demoStores);
        setUserLocation({ latitude: 34.0522, longitude: -118.2437 }); // Demo location
      }

      setCurrentScreen('stores');
    } catch (error) {
      console.error('Error finding stores:', error);
      if (error.message.includes('Location')) {
        setLocationError(error.message);
      } else {
        setError('Error finding nearby stores. Please try again.');
      }
    } finally {
      setIsLoadingStores(false);
    }
  };

  /**
   * FIXED - Handle ZIP code search with proper distance filtering
   */
  const handleZipCodeSearch = async () => {
    if (!selectedPart || !zipCode.trim()) {
      setError('Please enter a valid ZIP code.');
      return;
    }

    // Validate ZIP code format
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(zipCode.trim())) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }

    setIsLoadingStores(true);
    setLocationError(null);
    setError(null);

    try {
      const services = await loadAPIServices();
      const maxDistance = 5; // FIXED - Use same strict distance limit
      
      if (services && services.storeFinder && services.storeFinder.findStoresByZipCode) {
        console.log(`Searching for stores near ZIP code ${zipCode} within ${maxDistance} miles`);
        
        const stores = await services.storeFinder.findStoresByZipCode(selectedPart, zipCode.trim(), maxDistance);
        setNearbyStores(stores);
        
        // Set user location based on ZIP code
        if (stores.length > 0 && stores[0].userLocation) {
          setUserLocation(stores[0].userLocation);
        }
        
        console.log(`Found ${stores.length} stores near ZIP code ${zipCode}`);
        
        if (stores.length === 0) {
          setError(`No stores found within ${maxDistance} miles of ZIP code ${zipCode}. Try a different ZIP code.`);
        } else {
          setCurrentScreen('stores');
        }
      } else {
        setError('ZIP code search not available. Please enable location services instead.');
      }
    } catch (error) {
      console.error('Error searching by ZIP code:', error);
      setError('Error searching by ZIP code. Please try again or enable location services.');
    } finally {
      setIsLoadingStores(false);
    }
  };

  /**
   * Get directions to store
   */
  const getDirections = (store) => {
    if (userLocation) {
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      // Use store coordinates from the AI store locator (coordinates.lat/lng format)
      const storeLat = store.coordinates?.lat || store.latitude || '34.0522';
      const storeLng = store.coordinates?.lng || store.longitude || '-118.2437';
      const destination = `${storeLat},${storeLng}`;
      const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
      console.log(`Directions: From ${origin} to ${destination}`);
      window.open(url, '_blank');
    } else {
      // Fallback to store address search if no user location
      const address = store.address || `${store.name}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
      window.open(url, '_blank');
    }
  };

  /**
   * Call store
   */
  const callStore = (store) => {
    if (store.phone) {
      window.location.href = `tel:${store.phone}`;
    }
  };

  /**
   * Visit store website
   */
  const visitWebsite = (store) => {
    if (store.website) {
      window.open(store.website, '_blank');
    } else if (store.googleMapsUri) {
      window.open(store.googleMapsUri, '_blank');
    }
  };

  /**
   * Reset to home screen
   */
  const resetToHome = () => {
    setCurrentScreen('home');
    setSelectedPart(null);
    setCapturedImage(null);
    setNearbyStores([]);
    setUserLocation(null);
    setLocationError(null);
    setError(null);
    setZipCode(''); // FIXED - Reset ZIP code
    // NEW: Reset purchase state
    setProductOffers([]);
    setShowPurchaseOptions(false);
  };

  // Render different screens
  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return renderHomeScreen();
      case 'results':
        return renderResultsScreen();
      case 'stores':
        return renderStoresScreen();
      default:
        return renderHomeScreen();
    }
  };

  const renderHomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PartFinder Pro</h1>
          <p className="text-xl text-gray-600">AI-Powered Appliance Part Identification</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Camera Capture */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-6 w-6 text-blue-600" />
                Take Photo
              </CardTitle>
              <CardDescription>
                Capture an image of your appliance part for instant identification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCameraCapture}
                className="w-full"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Open Camera'}
              </Button>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-6 w-6 text-green-600" />
                Upload Image
              </CardTitle>
              <CardDescription>
                Select an existing photo from your device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Choose File'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Demo Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-6 w-6 text-purple-600" />
              Try Demo
            </CardTitle>
            <CardDescription>
              See how PartFinder Pro works with a sample dishwasher door seal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleDemo}
              variant="outline"
              className="w-full"
              size="lg"
              disabled={isProcessing}
            >
              {isProcessing ? 'Loading Demo...' : 'Start Demo'}
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-600">Advanced computer vision identifies parts instantly</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Target className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Accurate Results</h3>
              <p className="text-sm text-gray-600">Get precise part numbers and compatibility info</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Find Local Stores</h3>
              <p className="text-sm text-gray-600">Locate nearby stores that carry your part</p>
            </CardContent>
          </Card>

          {/* NEW: Purchase feature */}
          <Card>
            <CardContent className="p-6 text-center">
              <ShoppingCart className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Direct Purchase</h3>
              <p className="text-sm text-gray-600">Buy parts directly from trusted retailers</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Indicator */}
        {apiStatus.loaded && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-4 px-4 py-2 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${apiStatus.ai === 'ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm">AI: {apiStatus.ai === 'ready' ? 'Ready' : 'Demo Mode'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${apiStatus.location === 'ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm">Location: {apiStatus.location === 'ready' ? 'Ready' : 'Demo Mode'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderResultsScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Part Identified</h1>
          <Button onClick={resetToHome} variant="outline">
            New Search
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Image */}
          <Card>
            <CardContent className="p-6">
              <img 
                src={capturedImage || selectedPart?.imageUrl} 
                alt="Captured part" 
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {selectedPart?.confidence}% Match
                </Badge>
                <Badge variant={selectedPart?.source === 'ai' ? 'default' : 'secondary'}>
                  {selectedPart?.source === 'ai' ? 'AI Identified' : 'Demo Mode'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Part Details */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedPart?.name}</CardTitle>
              <CardDescription>
                Part #{selectedPart?.partNumber} • {selectedPart?.brand}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{selectedPart?.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="font-medium">Category:</span>
                  <span>{selectedPart?.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Brand:</span>
                  <span>{selectedPart?.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Part Number:</span>
                  <span className="font-mono">{selectedPart?.partNumber}</span>
                </div>
              </div>

              {/* NEW: Purchase button */}
              <div className="space-y-3">
                <Button 
                  onClick={() => setShowPurchaseOptions(!showPurchaseOptions)}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  disabled={isLoadingOffers}
                >
                  {isLoadingOffers ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Finding Best Prices...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Buy This Part
                    </div>
                  )}
                </Button>

                <Button 
                  onClick={handleFindStores}
                  className="w-full"
                  size="lg"
                  disabled={isLoadingStores}
                  variant="outline"
                >
                  {isLoadingStores ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      Finding Stores...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Find Local Stores
                    </div>
                  )}
                </Button>
              </div>

              {/* FIXED - Add ZIP code search option */}
              {locationError && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm mb-3">{locationError}</p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter ZIP code (e.g., 90210)"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      maxLength={5}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleZipCodeSearch}
                      disabled={isLoadingStores || !zipCode.trim()}
                      size="sm"
                    >
                      Search
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* FIXED: Purchase Options with enhanced debugging */}
        {showPurchaseOptions && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Purchase Options
              </CardTitle>
              <CardDescription>
                Compare prices from multiple retailers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOffers && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Finding best prices...</p>
                </div>
              )}

              {!isLoadingOffers && productOffers.length > 0 && (
                <div className="grid gap-4">
                  {productOffers.map((offer, index) => (
                    <div key={offer.id || index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{offer.store}</span>
                          {offer.isFallback && (
                            <Badge variant="outline" className="text-xs">Search</Badge>
                          )}
                          {/* FIXED: Show search query for debugging */}
                          {offer.searchQuery && (
                            <Badge variant="outline" className="text-xs bg-blue-50">
                              Query: {offer.searchQuery.substring(0, 20)}...
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {offer.price > 0 ? (
                            <span className="text-xl font-bold text-green-600">
                              ${offer.price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-500">Price varies</span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-2">{offer.title}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{offer.availability}</span>
                          {offer.confidence && (
                            <span>{offer.confidence}% match</span>
                          )}
                        </div>
                        
                        <Button 
                          onClick={() => handleBuyProduct(offer)}
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {offer.isFallback ? 'Search on ' + offer.store : 'Buy Now'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingOffers && productOffers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No purchase options found. Try searching manually:</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const searchQuery = createSearchQuery(selectedPart);
                        const encodedQuery = encodeURIComponent(searchQuery);
                        window.open(`https://www.amazon.com/s?k=${encodedQuery}`, '_blank');
                      }}
                    >
                      Search Amazon
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const searchQuery = createSearchQuery(selectedPart);
                        const encodedQuery = encodeURIComponent(searchQuery);
                        window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`, '_blank');
                      }}
                    >
                      Search eBay
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Specifications and Compatibility */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <Tabs defaultValue="specs" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
              </TabsList>
              
              <TabsContent value="specs" className="mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedPart?.specifications && Object.entries(selectedPart.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium">{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="compatibility" className="mt-4">
                <div className="space-y-2">
                  <h4 className="font-medium mb-3">Compatible Models:</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {selectedPart?.compatibleModels?.map((model, index) => (
                      <div key={index} className="px-3 py-2 bg-gray-50 rounded font-mono text-sm">
                        {model}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStoresScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Local Stores</h1>
            <p className="text-gray-600">
              {/* FIXED - Show actual distance limit */}
              Stores within 5 miles carrying: {selectedPart?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCurrentScreen('results')} variant="outline">
              Back to Results
            </Button>
            <Button onClick={resetToHome} variant="outline">
              New Search
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stores List */}
        {nearbyStores.length > 0 ? (
          <div className="space-y-4">
            {nearbyStores.map((store) => (
              <Card key={store.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="grid lg:grid-cols-4 gap-4">
                    {/* Store Info */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-semibold">{store.name}</h3>
                        <Badge 
                          variant={store.availability?.status === 'in-stock' ? 'default' : 'secondary'}
                          className={`${
                            store.availability?.color === 'green' ? 'bg-green-100 text-green-800' :
                            store.availability?.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {store.availability?.label || 'Call to Confirm'}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{store.address}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {store.distanceFormatted}
                        </div>
                        {store.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {store.rating} ({store.userRatingCount || 0})
                          </div>
                        )}
                        {/* FIXED - Show likelihood score for debugging */}
                        {store.likelihood && (
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            {store.likelihood}% likely
                          </div>
                        )}
                      </div>

                      {store.services && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {store.services.slice(0, 3).map((service, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price & Hours */}
                    <div>
                      <div className="mb-3">
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Estimated Price</span>
                        </div>
                        <p className="text-lg font-semibold text-green-600">
                          {store.estimatedPrice?.formatted || store.estimatedPrice?.range || 'Call for Price'}
                        </p>
                      </div>

                      {store.hours && (
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">Hours</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {store.hours.monday || 'Call for hours'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={() => getDirections(store)}
                        className="w-full"
                        size="sm"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Directions
                      </Button>
                      
                      {store.phone && (
                        <Button 
                          onClick={() => callStore(store)}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Store
                        </Button>
                      )}
                      
                      {(store.website || store.googleMapsUri) && (
                        <Button 
                          onClick={() => visitWebsite(store)}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visit Website
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Reason (for debugging) */}
                  {store.aiReason && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        <strong>AI Analysis:</strong> {store.aiReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Stores Found</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any stores within 5 miles that carry this part.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setCurrentScreen('results')} variant="outline">
                  Try Different Location
                </Button>
                <Button onClick={resetToHome}>
                  New Search
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  return renderScreen();
}

export default App

