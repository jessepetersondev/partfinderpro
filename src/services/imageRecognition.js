// Image Recognition Service using OpenAI Vision API
// Analyzes uploaded images to identify appliance parts

class ImageRecognitionService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    this.apiBase = import.meta.env.VITE_OPENAI_API_BASE || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    this.model = 'gpt-4o'; // GPT-4 with vision capabilities
  }

  /**
   * Analyzes an image to identify appliance parts
   * @param {string} imageData - Base64 encoded image data
   * @param {boolean} isDemo - Whether this is a demo request
   * @returns {Promise<Object>} Part identification results
   */
  async identifyPart(imageData, isDemo = false) {
    try {
      // If demo mode, return mock data immediately
      if (isDemo) {
        return this.getDemoResult();
      }

      // Validate API key
      if (!this.apiKey) {
        console.warn('OpenAI API key not found, falling back to demo mode');
        return this.getDemoResult();
      }

      // Prepare the image for API call
      const imageUrl = this.prepareImageData(imageData);
      
      // Call OpenAI Vision API
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: this.getAnalysisPrompt()
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Parse the AI response
      return this.parseAIResponse(result.choices[0].message.content);

    } catch (error) {
      console.error('Image recognition error:', error);
      
      // Fallback to demo data on error
      return {
        ...this.getDemoResult(),
        error: 'Unable to process image with AI. Showing demo result.',
        confidence: 85
      };
    }
  }

  /**
   * Prepares image data for API call
   * @param {string} imageData - Base64 or blob URL
   * @returns {string} Properly formatted image URL
   */
  prepareImageData(imageData) {
    // If it's already a data URL, return as is
    if (imageData.startsWith('data:image/')) {
      return imageData;
    }
    
    // If it's a blob URL, we need to convert it
    // For now, return the data as is and let the API handle it
    return imageData;
  }

  /**
   * Gets the analysis prompt for the AI
   * @returns {string} Detailed prompt for part identification
   */
  getAnalysisPrompt() {
    return `You are an expert appliance repair technician. Analyze this image and identify the appliance part shown. 

Please provide a detailed analysis in the following JSON format:
{
  "partName": "Specific name of the part",
  "partNumber": "Manufacturer part number if visible",
  "brand": "Brand/manufacturer if identifiable",
  "category": "Part category (e.g., Seals & Gaskets, Filters, Motors, etc.)",
  "description": "Detailed description of the part and its function",
  "specifications": {
    "Material": "Material composition",
    "Color": "Primary color",
    "Dimensions": "Estimated dimensions",
    "Weight": "Estimated weight",
    "TemperatureRange": "Operating temperature range if applicable"
  },
  "compatibleModels": ["List of compatible appliance models if identifiable"],
  "applianceType": "Type of appliance this part belongs to",
  "condition": "New/Used/Damaged assessment",
  "confidence": "Confidence level as integer 1-100",
  "identificationNotes": "Additional notes about the identification"
}

Focus on:
- Accurate part identification
- Specific technical details
- Compatibility information
- Professional terminology
- High confidence scoring for clear images

If the image is unclear or doesn't show an appliance part, indicate low confidence and explain why.`;
  }

  /**
   * Parses the AI response into a structured format
   * @param {string} aiResponse - Raw AI response text
   * @returns {Object} Parsed part information
   */
  parseAIResponse(aiResponse) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        
        // Convert to our internal format
        return {
          id: Date.now().toString(),
          name: parsedData.partName || 'Unknown Part',
          partNumber: parsedData.partNumber || 'N/A',
          brand: parsedData.brand || 'Unknown',
          category: parsedData.category || 'General',
          description: parsedData.description || 'Part identified from image',
          specifications: parsedData.specifications || {},
          compatibleModels: parsedData.compatibleModels || [],
          applianceType: parsedData.applianceType || 'Unknown',
          condition: parsedData.condition || 'Unknown',
          confidence: Math.min(Math.max(parsedData.confidence || 75, 1), 100),
          identificationNotes: parsedData.identificationNotes || '',
          imageUrl: null, // Will be set by the calling function
          source: 'ai-identified'
        };
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
    }

    // Fallback parsing if JSON extraction fails
    return this.parseTextResponse(aiResponse);
  }

  /**
   * Fallback text parsing for non-JSON responses
   * @param {string} text - AI response text
   * @returns {Object} Basic part information
   */
  parseTextResponse(text) {
    // Extract basic information from text response
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      id: Date.now().toString(),
      name: this.extractField(lines, ['part', 'name', 'component']) || 'Identified Part',
      partNumber: this.extractField(lines, ['number', 'model', 'part number']) || 'N/A',
      brand: this.extractField(lines, ['brand', 'manufacturer', 'make']) || 'Unknown',
      category: this.extractField(lines, ['category', 'type']) || 'General',
      description: text.substring(0, 200) + '...',
      specifications: {},
      compatibleModels: [],
      confidence: 70,
      imageUrl: null,
      source: 'ai-identified-text'
    };
  }

  /**
   * Extracts field values from text lines
   * @param {Array} lines - Text lines to search
   * @param {Array} keywords - Keywords to look for
   * @returns {string|null} Extracted value
   */
  extractField(lines, keywords) {
    for (const line of lines) {
      for (const keyword of keywords) {
        if (line.toLowerCase().includes(keyword)) {
          const parts = line.split(':');
          if (parts.length > 1) {
            return parts[1].trim();
          }
        }
      }
    }
    return null;
  }

  /**
   * Returns demo/fallback result
   * @returns {Object} Demo part data
   */
  getDemoResult() {
    return {
      id: 'demo-1',
      name: 'Dishwasher Door Seal',
      partNumber: 'WPW10300924',
      brand: 'Whirlpool',
      category: 'Seals & Gaskets',
      description: 'Genuine OEM door seal for Whirlpool dishwashers. Prevents water leakage and ensures proper door closure.',
      specifications: {
        'Material': 'Rubber',
        'Color': 'Black',
        'Dimensions': '24" x 18"',
        'Weight': '1.2 lbs',
        'Temperature Range': '-40°F to 180°F'
      },
      compatibleModels: ['WDF520PADM', 'WDT720PADM', 'WDF540PADM', 'WDT750SAHZ'],
      confidence: 92,
      imageUrl: null,
      source: 'demo'
    };
  }

  /**
   * Validates image before processing
   * @param {File} file - Image file to validate
   * @returns {Object} Validation result
   */
  validateImage(file) {
    const maxSize = 20 * 1024 * 1024; // 20MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Image too large. Maximum size is 20MB.' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Please use JPEG, PNG, or WebP.' };
    }

    return { valid: true };
  }

  /**
   * Compresses image if needed
   * @param {string} imageData - Base64 image data
   * @param {number} maxWidth - Maximum width
   * @param {number} quality - Compression quality (0-1)
   * @returns {Promise<string>} Compressed image data
   */
  async compressImage(imageData, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedData);
      };

      img.src = imageData;
    });
  }
}

// Export singleton instance
export const imageRecognitionService = new ImageRecognitionService();
export default imageRecognitionService;

