import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Camera, Search, MapPin, Star, Navigation, CheckCircle, Upload, Zap, Target, DollarSign, Play, AlertCircle, Clock, Phone, ExternalLink, ShoppingCart, Package } from 'lucide-react'
import sampleSeal from './assets/sample-dishwasher-seal.jpg'
import sampleFilter from './assets/sample-water-filter.jpg'
// FIXED: Proper imports for logo assets
import logoHorizontal from './assets/partfinder-pro-logo-horizontal.png'
import logoMain from './assets/partfinder-pro-logo-main.png'
import logoWhite from './assets/partfinder-pro-logo-white.png'
import logoIcon from './assets/partfinder-pro-icon-only.png'
import { useCapacitor } from './hooks/useCapacitor';
import './App.css'

// FIXED: Logo Component with proper asset imports
const PartFinderLogo = ({ size = 'medium', variant = 'default', className = '' }) => {
  const sizeClasses = {
    small: 'h-8',
    medium: 'h-12',
    large: 'h-16',
    xlarge: 'h-24'
  };

  // FIXED: Use imported assets instead of absolute paths
  const logoSrc = variant === 'white' ? logoWhite : logoHorizontal;

  return (
    <img 
      src={logoSrc}
      alt="PartFinder Pro"
      className={`${sizeClasses[size]} w-auto ${className}`}
      onError={(e) => {
        // Fallback to text if image fails to load
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'inline';
      }}
    />
  );
};

// Fallback text logo
const TextLogo = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-3xl',
    xlarge: 'text-4xl'
  };

  return (
    <span className={`font-bold text-blue-600 ${sizeClasses[size]} ${className}`} style={{ display: 'none' }}>
      PartFinder Pro
    </span>
  );
};

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
   * FIXED: Create proper search query with strict validation to exclude "Not visible" and invalid values
   */
  const createSearchQuery = (part) => {
    if (!part) {
      console.warn('No part data provided for search query');
      return 'appliance part';
    }

    console.log('Creating search query from part data:', part);

    // FIXED: Function to validate if a value is usable
    const isValidValue = (value) => {
      if (!value) return false;
      if (typeof value !== 'string') return false;
      const cleanValue = value.trim().toLowerCase();
      
      // FIXED: Exclude all variations of invalid values
      const invalidValues = [
        'not visible',
        'not found',
        'unknown',
        'undefined',
        'null',
        'generic',
        'n/a',
        'na',
        ''
      ];
      
      return !invalidValues.includes(cleanValue) && cleanValue.length > 0;
    };

    // FIXED: Extract only valid values
    const validTerms = [];
    
    // Check each field and only add if valid
    if (isValidValue(part.brand)) {
      validTerms.push(part.brand.trim());
    }
    
    if (isValidValue(part.name) && part.name !== 'Appliance Part') {
      validTerms.push(part.name.trim());
    }
    
    if (isValidValue(part.partNumber)) {
      validTerms.push(part.partNumber.trim());
    }
    
    // FIXED: Use category only if it's specific and valid
    if (isValidValue(part.category) && part.category !== 'Parts') {
      validTerms.push(part.category.trim());
    }

    // FIXED: Build search query with fallback strategies
    let searchQuery = '';
    
    if (validTerms.length > 0) {
      searchQuery = validTerms.join(' ');
    } else {
      // FIXED: Use description or fallback to generic appliance part search
      if (part.description && isValidValue(part.description) && 
          !part.description.toLowerCase().includes('dimmer switch')) {
        // Extract meaningful terms from description
        const descWords = part.description.split(' ')
          .filter(word => word.length > 3 && !['used', 'works', 'control'].includes(word.toLowerCase()))
          .slice(0, 3);
        
        if (descWords.length > 0) {
          searchQuery = descWords.join(' ') + ' appliance part';
        } else {
          searchQuery = 'appliance replacement part';
        }
      } else {
        searchQuery = 'appliance replacement part';
      }
    }

    console.log('Generated search query:', searchQuery);
    
    return searchQuery;
  };

  /**
   * FIXED: Generate dynamic pricing based on part category and complexity
   */
  const generateDynamicPricing = (part, store) => {
    if (!part) return { price: 25.99, range: '$20-$35' };

    // FIXED: Base price calculation based on part category and complexity
    let basePrice = 25.99; // Default base price
    
    // Category-based pricing
    const categoryPricing = {
      'Seals & Gaskets': { base: 18.99, variance: 15 },
      'Filters': { base: 22.99, variance: 12 },
      'Motors': { base: 89.99, variance: 40 },
      'Control Boards': { base: 125.99, variance: 60 },
      'Pumps': { base: 75.99, variance: 35 },
      'Heating Elements': { base: 45.99, variance: 20 },
      'Switches': { base: 15.99, variance: 10 },
      'Belts': { base: 12.99, variance: 8 },
      'Parts': { base: 28.99, variance: 18 } // Generic parts
    };

    const categoryInfo = categoryPricing[part.category] || categoryPricing['Parts'];
    basePrice = categoryInfo.base;

    // FIXED: Store-specific pricing adjustments
    const storeMultipliers = {
      'Amazon': 1.0,
      'eBay': 0.85,
      'Walmart': 0.92,
      'Home Depot': 1.08,
      "Lowe's": 1.05,
      'Appliance Parts Pros': 1.15
    };

    const storeMultiplier = storeMultipliers[store] || 1.0;
    
    // FIXED: Add some randomness for realistic pricing
    const randomVariance = (Math.random() - 0.5) * (categoryInfo.variance * 0.4);
    const finalPrice = (basePrice + randomVariance) * storeMultiplier;
    
    // FIXED: Round to realistic price points
    const roundedPrice = Math.round(finalPrice * 100) / 100;
    
    // FIXED: Generate price range
    const lowerBound = Math.max(roundedPrice * 0.85, 5.99);
    const upperBound = roundedPrice * 1.25;
    const priceRange = `$${Math.round(lowerBound)}-$${Math.round(upperBound)}`;

    return {
      price: roundedPrice,
      range: priceRange,
      formatted: `$${roundedPrice.toFixed(2)}`
    };
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
   * FIXED: Generate fallback offers with proper search query handling and dynamic pricing
   */
  const generateFallbackOffers = (part) => {
    // FIXED: Use improved search query creation and encoding
    const searchQuery = createSearchQuery(part);
    const encodedSearchQuery = encodeURIComponent(searchQuery);
    
    console.log('Generating fallback offers with search query:', searchQuery);
    console.log('Encoded search query:', encodedSearchQuery);
    
    // FIXED: Ensure part data exists with proper fallbacks
    const partName = (part?.name && part.name !== 'Appliance Part') ? part.name : 'Replacement Part';
    const partNumber = (part?.partNumber && part.partNumber.toLowerCase() !== 'not visible') ? part.partNumber : '';
    const displayTitle = partNumber ? `${partName} - ${partNumber}` : partName;
    
    // FIXED: Generate dynamic pricing for each store
    const stores = ['Amazon', 'eBay', 'Walmart'];
    
    return stores.map((store, index) => {
      const pricing = generateDynamicPricing(part, store);
      
      // FIXED: Store-specific URL patterns
      const urlPatterns = {
        'Amazon': `https://www.amazon.com/s?k=${encodedSearchQuery}&tag=partfinderpro-20`,
        'eBay': `https://www.ebay.com/sch/i.html?_nkw=${encodedSearchQuery}`,
        'Walmart': `https://www.walmart.com/search?q=${encodedSearchQuery}`
      };

      return {
        id: `${store.toLowerCase()}-fallback`,
        title: displayTitle,
        store: store,
        price: pricing.price,
        currency: 'USD',
        availability: 'In Stock',
        affiliateUrl: urlPatterns[store],
        confidence: 85 - (index * 5), // Slightly decreasing confidence
        isFallback: true,
        searchQuery: searchQuery, // Store original search query for debugging
        priceRange: pricing.range
      };
    });
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
   * Handle camera capture or file upload (COMBINED FUNCTIONALITY)
   */
  const handleImageCapture = async () => {
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
      console.error('Image capture error:', error);
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

    // FIXED: Function to clean individual fields
    const cleanField = (value, fieldName) => {
      if (!value || typeof value !== 'string') return null;
      
      const cleanValue = value.trim();
      const lowerValue = cleanValue.toLowerCase();
      
      // FIXED: List of invalid values to exclude
      const invalidValues = [
        'not visible',
        'not found',
        'unknown',
        'undefined',
        'null',
        'n/a',
        'na'
      ];
      
      if (invalidValues.includes(lowerValue) || cleanValue.length === 0) {
        return null;
      }
      
      return cleanValue;
    };

    // FIXED: Clean string fields with proper fallbacks
    const cleanedName = cleanField(cleanedPart.name, 'name');
    const cleanedBrand = cleanField(cleanedPart.brand, 'brand');
    const cleanedPartNumber = cleanField(cleanedPart.partNumber, 'partNumber');
    const cleanedCategory = cleanField(cleanedPart.category, 'category');

    // FIXED: Set cleaned values or appropriate defaults
    cleanedPart.name = cleanedName || 'Appliance Part';
    cleanedPart.brand = cleanedBrand || '';  // Leave empty if not valid
    cleanedPart.partNumber = cleanedPartNumber || ''; // Leave empty if not valid
    cleanedPart.category = cleanedCategory || 'Parts';

    // FIXED: Clean description
    if (cleanedPart.description) {
      const cleanedDescription = cleanField(cleanedPart.description, 'description');
      cleanedPart.description = cleanedDescription || 'Replacement appliance part';
    } else {
      cleanedPart.description = 'Replacement appliance part';
    }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <PartFinderLogo size="xlarge" />
            <TextLogo size="xlarge" />
          </div>
          <p className="text-xl text-gray-700">AI-Powered Appliance Part Identification</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* COMBINED: Main Image Capture Card */}
        <Card className="mb-8 shadow-xl bg-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Camera className="h-8 w-8 text-blue-600" />
              Identify Your Part
            </CardTitle>
            <CardDescription className="text-lg">
              Take a photo or upload an image of your appliance part
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                onClick={handleImageCapture}
                className="h-16 text-lg bg-blue-600 hover:bg-blue-700 shadow-lg"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera className="h-6 w-6 mr-3" />
                    Take Photo
                  </>
                )}
              </Button>
              
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
                className="h-16 text-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 shadow-lg"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mr-3" />
                    Upload Image
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Demo Section */}
        <Card className="mb-8 shadow-lg bg-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
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
              className="w-full h-12 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 shadow-lg"
              size="lg"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-2"></div>
                  Loading Demo...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Demo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* CLEANED UP: Key Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg bg-white border-0">
            <CardContent className="p-6 text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">AI-Powered Identification</h3>
              <p className="text-gray-600">Advanced computer vision identifies parts instantly with high accuracy</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-white border-0">
            <CardContent className="p-6 text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Direct Purchase & Local Stores</h3>
              <p className="text-gray-600">Buy parts online or find nearby stores that carry your specific part</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Indicator */}
        {apiStatus.loaded && (
          <div className="text-center">
            <div className="inline-flex items-center gap-4 px-6 py-3 bg-white rounded-lg shadow-lg border-0">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${apiStatus.ai === 'ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm font-medium">AI: {apiStatus.ai === 'ready' ? 'Ready' : 'Demo Mode'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${apiStatus.location === 'ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm font-medium">Location: {apiStatus.location === 'ready' ? 'Ready' : 'Demo Mode'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderResultsScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Logo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <PartFinderLogo size="medium" />
            <TextLogo size="medium" />
            <h1 className="text-3xl font-bold text-gray-900">Part Identified</h1>
          </div>
          <Button onClick={resetToHome} variant="outline" className="shadow-lg">
            New Search
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedPart && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Part Image */}
            <Card className="shadow-lg bg-white border-0">
              <CardContent className="p-6">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <img 
                    src={capturedImage || selectedPart.imageUrl} 
                    alt="Captured part"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={selectedPart.source === 'ai' ? 'default' : 'secondary'}>
                    {selectedPart.source === 'ai' ? 'AI Identified' : 'Demo Mode'}
                  </Badge>
                  {/* FIXED: Display confidence as percentage (95% instead of 0.95%) */}
                  <Badge variant="outline">
                    {Math.round(selectedPart.confidence)}% Match
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Part Details */}
            <div className="space-y-6">
              <Card className="shadow-lg bg-white border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {selectedPart.name}
                  </CardTitle>
                  <CardDescription>
                    Part #{selectedPart.partNumber} • {selectedPart.brand}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{selectedPart.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Category:</span>
                      <p className="text-gray-600">{selectedPart.category}</p>
                    </div>
                    <div>
                      <span className="font-medium">Brand:</span>
                      <p className="text-gray-600">{selectedPart.brand}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Part Number:</span>
                      <p className="text-gray-600 font-mono">{selectedPart.partNumber}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* NEW: Purchase Options */}
              <Card className="shadow-lg bg-white border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Buy This Part
                  </CardTitle>
                  <CardDescription>
                    Compare prices from trusted retailers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingOffers ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Finding best prices...</span>
                    </div>
                  ) : productOffers.length > 0 ? (
                    <div className="space-y-3">
                      {productOffers.slice(0, 3).map((offer) => (
                        <div key={offer.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{offer.store}</span>
                              <Badge variant="outline" className="text-xs">
                                {offer.confidence}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{offer.availability}</p>
                            {offer.searchQuery && (
                              <p className="text-xs text-gray-400">Search: {offer.searchQuery}</p>
                            )}
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-bold text-lg">${offer.price.toFixed(2)}</p>
                            {offer.priceRange && (
                              <p className="text-xs text-gray-500">{offer.priceRange}</p>
                            )}
                          </div>
                          <Button 
                            onClick={() => handleBuyProduct(offer)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Buy Now
                          </Button>
                        </div>
                      ))}
                      
                      {productOffers.length > 3 && (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setShowPurchaseOptions(!showPurchaseOptions)}
                        >
                          {showPurchaseOptions ? 'Show Less' : `Show ${productOffers.length - 3} More Options`}
                        </Button>
                      )}
                      
                      {showPurchaseOptions && productOffers.slice(3).map((offer) => (
                        <div key={offer.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{offer.store}</span>
                              <Badge variant="outline" className="text-xs">
                                {offer.confidence}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{offer.availability}</p>
                            {offer.searchQuery && (
                              <p className="text-xs text-gray-400">Search: {offer.searchQuery}</p>
                            )}
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-bold text-lg">${offer.price.toFixed(2)}</p>
                            {offer.priceRange && (
                              <p className="text-xs text-gray-500">{offer.priceRange}</p>
                            )}
                          </div>
                          <Button 
                            onClick={() => handleBuyProduct(offer)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Buy Now
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600 mb-4">No purchase options available at the moment.</p>
                      <Button variant="outline" onClick={() => loadProductOffers(selectedPart)}>
                        Retry Search
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={handleFindStores}
                  className="w-full shadow-lg"
                  disabled={isLoadingStores}
                >
                  {isLoadingStores ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Finding Stores...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Find Local Stores
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={resetToHome}
                  variant="outline"
                  className="w-full shadow-lg"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Another Part
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Part Details Tabs */}
        {selectedPart && (
          <Card className="mt-6 shadow-lg bg-white border-0">
            <Tabs defaultValue="specifications" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="specifications">Specifications</TabsTrigger>
                <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
              </TabsList>
              
              <TabsContent value="specifications" className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(selectedPart.specifications || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium">{key}:</span>
                      <span className="text-gray-600">{value}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="compatibility" className="p-6">
                <div>
                  <h4 className="font-medium mb-3">Compatible Models:</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {(selectedPart.compatibleModels || []).map((model) => (
                      <Badge key={model} variant="outline" className="justify-start">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {/* Location Error for Store Finding */}
        {locationError && (
          <Card className="mt-6 border-orange-200 bg-orange-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-orange-800 mb-3">{locationError}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Enter ZIP code (e.g., 90210)"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="max-w-xs"
                      maxLength={5}
                    />
                    <Button 
                      onClick={handleZipCodeSearch}
                      disabled={isLoadingStores || !zipCode.trim()}
                      size="sm"
                    >
                      {isLoadingStores ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderStoresScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Logo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <PartFinderLogo size="medium" />
            <TextLogo size="medium" />
            <h1 className="text-3xl font-bold text-gray-900">Nearby Stores</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCurrentScreen('results')} variant="outline" className="shadow-lg">
              Back to Results
            </Button>
            <Button onClick={resetToHome} variant="outline" className="shadow-lg">
              New Search
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Part Summary */}
        {selectedPart && (
          <Card className="mb-6 shadow-lg bg-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={capturedImage || selectedPart.imageUrl} 
                    alt="Part"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedPart.name}</h3>
                  <p className="text-sm text-gray-600">Part #{selectedPart.partNumber} • {selectedPart.brand}</p>
                </div>
                <Badge variant="outline">
                  Stores within 5 miles
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stores List */}
        {nearbyStores.length > 0 ? (
          <div className="grid gap-4">
            {nearbyStores.map((store) => (
              <Card key={store.id} className="hover:shadow-xl transition-shadow shadow-lg bg-white border-0">
                <CardContent className="p-6">
                  <div className="grid lg:grid-cols-4 gap-4">
                    {/* Store Info */}
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{store.name}</h3>
                          <p className="text-sm text-gray-600">{store.chain}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm font-medium">{store.rating}</span>
                          </div>
                          <p className="text-sm text-gray-600">{store.distanceFormatted}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>{store.address}</p>
                        <p>{store.city}, {store.state} {store.zipCode}</p>
                        <p>{store.phone}</p>
                      </div>

                      {store.services && (
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-1">
                            {store.services.slice(0, 3).map((service) => (
                              <Badge key={service} variant="secondary" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Availability & Price */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Availability</p>
                        <Badge 
                          variant={store.availability.status === 'in-stock' ? 'default' : 'secondary'}
                          className={store.availability.status === 'in-stock' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}
                        >
                          {store.availability.label}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{store.likelihood}% likelihood</p>
                      </div>

                      {store.estimatedPrice && (
                        <div>
                          <p className="text-sm font-medium mb-1">Estimated Price</p>
                          <p className="text-lg font-bold text-green-600">{store.estimatedPrice.formatted}</p>
                          <p className="text-xs text-gray-500">{store.estimatedPrice.range}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <Button 
                        onClick={() => getDirections(store)}
                        className="w-full shadow-lg"
                        size="sm"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Directions
                      </Button>
                      
                      {store.phone && (
                        <Button 
                          onClick={() => callStore(store)}
                          variant="outline"
                          className="w-full shadow-lg"
                          size="sm"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Store
                        </Button>
                      )}
                      
                      {store.website && (
                        <Button 
                          onClick={() => visitWebsite(store)}
                          variant="outline"
                          className="w-full shadow-lg"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visit Website
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-lg bg-white border-0">
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No stores found</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any stores within 5 miles that carry this part.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => setCurrentScreen('results')} variant="outline" className="shadow-lg">
                  Back to Results
                </Button>
                <Button onClick={resetToHome} className="shadow-lg">
                  Search Another Part
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ZIP Code Search Option */}
        {locationError && (
          <Card className="mt-6 border-orange-200 bg-orange-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-orange-800 mb-3">Try searching a different area:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Enter ZIP code (e.g., 90210)"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="max-w-xs"
                      maxLength={5}
                    />
                    <Button 
                      onClick={handleZipCodeSearch}
                      disabled={isLoadingStores || !zipCode.trim()}
                      size="sm"
                    >
                      {isLoadingStores ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="App">
      {renderScreen()}
    </div>
  );
}

export default App;

