import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Camera, Search, MapPin, Star, Navigation, CheckCircle, Upload, Zap, Target, DollarSign, Play, AlertCircle, Clock, Phone, ExternalLink } from 'lucide-react'
import sampleSeal from './assets/sample-dishwasher-seal.jpg'
import sampleFilter from './assets/sample-water-filter.jpg'
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
    const [configModule, imageModule, partsModule, geolocationModule, storeFinderModule] = await Promise.all([
      import('./services/config.js').catch(() => null),
      import('./services/imageRecognition.js').catch(() => null),
      import('./services/partsDatabase.js').catch(() => null),
      import('./services/geolocation.js').catch(() => null),
      import('./services/storeFinder.js').catch(() => null)
    ]);

    apiServices = {
      config: configModule?.configService || null,
      imageRecognition: imageModule?.imageRecognitionService || null,
      partsDatabase: partsModule?.partsDatabase || null,
      geolocation: geolocationModule?.geolocationService || null,
      storeFinder: storeFinderModule?.storeFinderService || null
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
  const [zipCodeInput, setZipCodeInput] = useState('')
  const fileInputRef = useRef(null)

  // Initialize API services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        const services = await loadAPIServices();
        
        if (services && services.config) {
          // Check API status
          const aiConfigured = services.config.get('openai.apiKey') ? 'configured' : 'demo';
          
          setApiStatus({
            ai: aiConfigured,
            location: services.geolocation ? 'available' : 'demo',
            loaded: true
          });
        } else {
          setApiStatus({ ai: 'demo', location: 'demo', loaded: true });
        }
      } catch (error) {
        console.error('Error initializing services:', error);
        setApiStatus({ ai: 'demo', location: 'demo', loaded: true });
      }
    };

    initializeServices();
  }, []);

  /**
   * Enhanced image capture handler with API integration
   */
  const handleImageCapture = async (event) => {
    const file = event.target.files[0]
    if (file) {
      try {
        setError(null);
        
        const reader = new FileReader()
        reader.onload = async (e) => {
          setCapturedImage(e.target.result)
          setIsProcessing(true)
          
          try {
            const services = await loadAPIServices();
            let identifiedPart;

            if (services && services.imageRecognition) {
              // Validate image
              const validation = services.imageRecognition.validateImage(file);
              if (!validation.valid) {
                setError(validation.error);
                setIsProcessing(false);
                return;
              }

              // Use AI service for identification
              identifiedPart = await services.imageRecognition.identifyPart(e.target.result);
              
              // Enhance with parts database
              if (services.partsDatabase && identifiedPart) {
                identifiedPart = await services.partsDatabase.enhancePartData(identifiedPart);
              }
            } else {
              // Fallback to demo mode
              console.log('Using demo mode for part identification');
              await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
              identifiedPart = mockParts[0]; // Use first mock part
              identifiedPart.source = 'demo';
            }

            if (identifiedPart) {
              setSelectedPart(identifiedPart);
              setCurrentScreen('results');
            } else {
              setError('Could not identify the part. Please try a clearer image.');
            }
          } catch (error) {
            console.error('Error processing image:', error);
            setError('Error processing image. Please try again.');
          } finally {
            setIsProcessing(false);
          }
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error('Error reading file:', error);
        setError('Error reading image file. Please try again.');
        setIsProcessing(false);
      }
    }
  }

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

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSelectedPart(demoPartData);
      setCurrentScreen('results');
    } catch (error) {
      console.error('Error in demo mode:', error);
      setError('Demo mode error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle finding local stores
   */
  const handleFindStores = async () => {
    if (!selectedPart) return;

    setIsLoadingStores(true);
    setLocationError(null);
    setError(null);

    try {
      const services = await loadAPIServices();
      
      // Always try to use the AI store locator first
      if (services && services.storeFinder) {
        console.log('Using AI Store Locator for store finding');
        
        // Get user location first
        let location;
        if (services.geolocation) {
          try {
            location = await services.geolocation.getCurrentLocation();
            setUserLocation(location);
            console.log('Got user location:', location);
          } catch (locationError) {
            console.warn('Could not get user location, using central US default:', locationError);
            // Use central US location as default instead of CA
            location = { latitude: 39.8283, longitude: -98.5795 }; // Geographic center of US
            setUserLocation(location);
          }
        } else {
          // Use central US location as default if geolocation service not available
          console.log('Geolocation service not available, using central US default');
          location = { latitude: 39.8283, longitude: -98.5795 }; // Geographic center of US
          setUserLocation(location);
        }

        // Use AI store locator to find nearby stores
        const stores = await services.storeFinder.findNearbyStores(selectedPart, location);
        setNearbyStores(stores);
        
        console.log(`AI Store Locator found ${stores.length} stores near user location`);
      } else {
        // Only fallback to demo if services completely failed to load
        console.log('Services failed to load, using demo mode for store finding');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
        
        // Create demo stores with realistic data
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
            distance: 2.3,
            distanceFormatted: '2.3 mi',
            rating: 4.2,
            availability: { status: 'in-stock', label: 'In Stock' },
            estimatedPrice: { price: 24.99, currency: 'USD' },
            hours: { monday: '6:00 AM - 10:00 PM' },
            services: ['Parts Lookup', 'Installation', 'Repair Service'],
            website: 'https://homedepot.com'
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
            distance: 3.7,
            distanceFormatted: '3.7 mi',
            rating: 4.3,
            availability: { status: 'limited', label: 'Limited Stock' },
            estimatedPrice: { price: 26.95, currency: 'USD' },
            hours: { monday: '6:00 AM - 10:00 PM' },
            services: ['Parts Lookup', 'Installation', 'Appliance Repair'],
            website: 'https://lowes.com'
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
            distance: 5.1,
            distanceFormatted: '5.1 mi',
            rating: 4.7,
            availability: { status: 'in-stock', label: 'In Stock' },
            estimatedPrice: { price: 23.50, currency: 'USD' },
            hours: { monday: '9:00 AM - 6:00 PM' },
            services: ['Parts Lookup', 'Expert Advice', 'Special Orders'],
            website: 'https://abcapplianceparts.com'
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
      const query = encodeURIComponent(address);
      const url = `https://www.google.com/maps/search/${query}`;
      console.log(`Directions fallback: Searching for ${query}`);
      window.open(url, '_blank');
    }
  };

  /**
   * Handle zip code search
   */
  const handleZipCodeSearch = async () => {
    if (!zipCodeInput.match(/^\d{5}$/)) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    setIsLoadingStores(true);
    setError(null);

    try {
      // Convert ZIP code to coordinates using a geocoding service
      const coordinates = await zipCodeToCoordinates(zipCodeInput);
      
      if (coordinates) {
        // Update user location with new coordinates and ZIP code
        const newLocation = {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          zipCode: zipCodeInput
        };
        setUserLocation(newLocation);
        
        // Re-run store search with new location
        const services = await loadAPIServices();
        if (services && services.storeFinder && selectedPart) {
          const stores = await services.storeFinder.findNearbyStores(selectedPart, newLocation);
          setNearbyStores(stores);
          console.log(`Found ${stores.length} stores near ZIP code ${zipCodeInput}`);
        }
      } else {
        setError('Could not find location for ZIP code. Please try a different ZIP code.');
      }
    } catch (error) {
      console.error('Error searching by ZIP code:', error);
      setError('Error searching by ZIP code. Please try again.');
    } finally {
      setIsLoadingStores(false);
    }
  };

  /**
   * Convert ZIP code to coordinates
   */
  const zipCodeToCoordinates = async (zipCode) => {
    try {
      // Use a free geocoding service to convert ZIP code to coordinates
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          lat: parseFloat(data.places[0].latitude),
          lng: parseFloat(data.places[0].longitude)
        };
      }
      
      // Fallback: Use approximate coordinates for common ZIP codes
      const zipCodeMap = {
        '10001': { lat: 40.7505, lng: -73.9934 }, // NYC
        '90210': { lat: 34.0901, lng: -118.4065 }, // Beverly Hills
        '60601': { lat: 41.8781, lng: -87.6298 }, // Chicago
        '77001': { lat: 29.7604, lng: -95.3698 }, // Houston
        '33101': { lat: 25.7617, lng: -80.1918 }, // Miami
        '55101': { lat: 44.9537, lng: -93.0900 }, // St. Paul, MN
      };
      
      return zipCodeMap[zipCode] || null;
    } catch (error) {
      console.error('Error converting ZIP code to coordinates:', error);
      return null;
    }
  };

  const renderProcessingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold mb-2">Analyzing Your Part</h3>
          <p className="text-gray-600">AI is identifying your appliance part...</p>
        </div>
      </div>
    </div>
  )

  const renderHomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Search className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PartFinder Pro</h1>
          <p className="text-gray-600">Identify appliance parts and find local stores</p>
          
          {/* API Status Indicators */}
          {apiStatus.loaded && (
            <div className="flex justify-center gap-2 mt-4">
              <Badge variant={apiStatus.ai === 'configured' ? 'default' : 'secondary'} className="text-xs">
                AI: {apiStatus.ai === 'configured' ? 'Live' : 'Demo'}
              </Badge>
              <Badge variant={apiStatus.location === 'available' ? 'default' : 'secondary'} className="text-xs">
                Location: {apiStatus.location === 'available' ? 'Available' : 'Demo'}
              </Badge>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-2">
              <Camera className="h-6 w-6 text-blue-600 mx-auto" />
            </div>
            <p className="text-sm text-gray-600">Snap Photo</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-2">
              <Target className="h-6 w-6 text-green-600 mx-auto" />
            </div>
            <p className="text-sm text-gray-600">AI Identify</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-2">
              <MapPin className="h-6 w-6 text-purple-600 mx-auto" />
            </div>
            <p className="text-sm text-gray-600">Find Stores</p>
          </div>
        </div>

        {/* Main Action Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Camera className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Identify Your Part</h3>
              <p className="text-gray-600">Take a photo of your appliance part and let AI identify it for you</p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Take Photo
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDemo}
                className="w-full"
                size="lg"
              >
                <Play className="mr-2 h-5 w-5" />
                Try Demo
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderResultsScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <Button 
            variant="ghost" 
            onClick={() => setCurrentScreen('home')}
            className="p-2"
          >
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Part Identified</h2>
          <div></div>
        </div>

        {/* Part Image and Confidence */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <img 
                src={capturedImage || selectedPart?.imageUrl} 
                alt="Captured part"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {selectedPart?.confidence || 92}% Match
                </Badge>
                <Badge variant="outline" className="bg-white">
                  {selectedPart?.category}
                </Badge>
              </div>
              {selectedPart?.source && (
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className="text-xs bg-white">
                    Source: {selectedPart.source}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Part Details */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-xl font-semibold mb-2">{selectedPart?.name}</h3>
            <p className="text-gray-600 mb-4">Part #{selectedPart?.partNumber} • {selectedPart?.brand}</p>
            <p className="text-sm text-gray-700 mb-4">{selectedPart?.description}</p>

            <Tabs defaultValue="specs" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
              </TabsList>
              <TabsContent value="specs" className="space-y-2">
                {selectedPart?.specifications && Object.entries(selectedPart.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="compatibility" className="space-y-2">
                <p className="text-sm text-gray-600 mb-2">Compatible Models:</p>
                <div className="space-y-1">
                  {selectedPart?.compatibleModels?.map((model, index) => (
                    <Badge key={index} variant="outline" className="mr-2 mb-1">
                      {model}
                    </Badge>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Location Error Display */}
        {locationError && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Location Access Needed</p>
                  <p className="text-xs">{locationError}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleFindStores}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
            disabled={isLoadingStores}
          >
            <MapPin className="mr-2 h-5 w-5" />
            {isLoadingStores ? 'Finding Stores...' : 'Find Local Stores'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCurrentScreen('home')}
            className="w-full"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Identify Another Part
          </Button>
        </div>
      </div>
    </div>
  )

  const renderStoresScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <Button 
            variant="ghost" 
            onClick={() => setCurrentScreen('results')}
            className="p-2"
          >
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Local Stores</h2>
          <div></div>
        </div>

        {/* Part Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <img 
                src={selectedPart?.imageUrl} 
                alt={selectedPart?.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold">{selectedPart?.name}</h3>
                <p className="text-sm text-gray-600">Part #{selectedPart?.partNumber}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  {nearbyStores.length} stores found
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Control */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Search Location</h4>
                {userLocation && (
                  <Badge variant="secondary" className="text-xs">
                    {userLocation.zipCode || 'Current Location'}
                  </Badge>
                )}
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter ZIP code (e.g., 55101)"
                  value={zipCodeInput}
                  onChange={(e) => setZipCodeInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength="5"
                />
                <Button 
                  onClick={handleZipCodeSearch}
                  disabled={isLoadingStores || !zipCodeInput.match(/^\d{5}$/)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
              </div>
              
              {userLocation && (
                <p className="text-xs text-gray-500">
                  Currently showing stores near: {userLocation.zipCode || `${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoadingStores && (
          <Card className="mb-6">
            <CardContent className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Finding nearby stores...</p>
            </CardContent>
          </Card>
        )}

        {/* Stores List */}
        <div className="space-y-4">
          {nearbyStores.map((store, index) => (
            <Card key={store.id} className={index === 0 ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold">{store.name}</h3>
                      {index === 0 && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">Closest</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 mb-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">{store.rating}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-600">{store.distanceFormatted}</span>
                    </div>
                    <p className="text-sm text-gray-600">{store.address}</p>
                    <p className="text-sm text-gray-600">{store.city}, {store.state} {store.zipCode}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Availability</p>
                    <Badge 
                      variant={store.availability?.status === 'in-stock' ? 'default' : 'secondary'}
                      className={store.availability?.status === 'in-stock' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {store.availability?.label || 'Check Store'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Est. Price</p>
                    <p className="text-lg font-bold">
                      ${store.estimatedPrice?.price || '24.99'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {store.hours?.monday || '9:00 AM - 6:00 PM'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{store.phone}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={() => getDirections(store)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Directions
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(store.website, '_blank')}
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                {store.services && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-1">Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {store.services.slice(0, 3).map((service, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Action */}
        <div className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => setCurrentScreen('home')}
            className="w-full"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Identify Another Part
          </Button>
        </div>
      </div>
    </div>
  )

  // Main render logic
  if (isProcessing) {
    return renderProcessingScreen()
  }

  switch (currentScreen) {
    case 'home':
      return renderHomeScreen()
    case 'results':
      return renderResultsScreen()
    case 'stores':
      return renderStoresScreen()
    default:
      return renderHomeScreen()
  }
}

export default App

