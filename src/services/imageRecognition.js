// Analyzes uploaded images to identify appliance parts
import configService from './config.js';

/**
 * Standalone image validation function - CRITICAL FIX for "validateImage is not a function" error
 * This function is exported separately to ensure it's always available
 */
export const validateImage = (file) => {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  const maxSizeBytes = 20 * 1024 * 1024; // 20MB
  const errors = [];

  if (!file) {
    return { 
      isValid: false, 
      errors: ['No file provided'] 
    };
  }

  // Validate format
  if (!supportedFormats.includes(file.type.toLowerCase())) {
    errors.push(`Unsupported format: ${file.type}. Please use JPEG, PNG, WEBP, or GIF.`);
  }

  // Validate size
  if (file.size > maxSizeBytes) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    errors.push(`Image is too large (${sizeMB}MB). Maximum size is 20MB.`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

class ImageRecognitionService {
  constructor() {
    this.configService = configService;
  }

  /**
   * Validates image file - instance method that calls the standalone function
   * @param {File} file - Image file to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateImage(file) {
    return validateImage(file);
  }

  /**
   * Analyzes an image to identify appliance parts
   * @param {string} imageData - Base64 encoded image data
   * @param {boolean} isDemo - Whether this is a demo request
   * @returns {Promise<Object>} Part identification results
   */
  async identifyPart(imageData, isDemo = false) {
    try {
      console.log('🔍 ImageRecognitionService: Starting part identification');
      console.log('Demo mode requested:', isDemo);
      console.log('Should use real AI:', this.configService.shouldUseRealAI());
      
      // If demo mode is explicitly requested, return mock data
      if (isDemo) {
        console.log('Using demo mode (explicitly requested)');
        return this.getDemoResult();
      }

      // Check if we should use real AI
      if (!this.configService.shouldUseRealAI()) {
        console.log('Using demo mode (no API key or feature disabled)');
        return this.getDemoResult();
      }

      // Get API configuration
      const openaiConfig = this.configService.getAPIConfig('openai');
      
      if (!openaiConfig.apiKey) {
        console.warn('OpenAI API key not found, falling back to demo mode');
        return this.getDemoResult();
      }

      console.log('✅ Using real OpenAI API for part identification');

      // Prepare the image for API call
      const imageUrl = this.prepareImageData(imageData);
      
      // Call OpenAI Vision API
      const response = await fetch(`${openaiConfig.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: openaiConfig.model,
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
        console.error('OpenAI API error:', response.status, response.statusText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.choices || !result.choices[0]) {
        throw new Error('Invalid response from OpenAI API');
      }

      const analysisText = result.choices[0].message.content;
      
      // Parse the AI response
      const parsedResult = this.parseAIResponse(analysisText);
      
      console.log('✅ Real AI analysis completed successfully');
      return parsedResult;

    } catch (error) {
      console.error('Error in part identification:', error);
      console.log('Falling back to demo mode due to error');
      return this.getDemoResult();
    }
  }

  /**
   * Prepares image data for API call
   * @param {string} imageData - Base64 encoded image data
   * @returns {string} Formatted image URL for API
   */
  prepareImageData(imageData) {
    // If it's already a data URL, return as is
    if (imageData.startsWith('data:')) {
      return imageData;
    }
    
    // Otherwise, assume it's base64 and add the data URL prefix
    return `data:image/jpeg;base64,${imageData}`;
  }

  /**
   * Gets the analysis prompt for the AI
   * @returns {string} Analysis prompt
   */
  getAnalysisPrompt() {
    return `You are an expert appliance repair technician. Analyze this image and identify the appliance part shown. 

Please provide your response in the following JSON format:
{
  "partName": "Specific name of the part",
  "partNumber": "Model/part number if visible",
  "appliance": "Type of appliance this part belongs to",
  "description": "Detailed description of the part and its function",
  "condition": "Assessment of the part's condition",
  "commonIssues": ["List of common problems with this part"],
  "replacementDifficulty": "Easy/Medium/Hard",
  "estimatedCost": "Estimated replacement cost range",
  "compatibility": "Information about compatible models",
  "confidence": 0.95
}

Focus on accuracy and provide as much detail as possible about the part identification.`;
  }

  /**
   * Parses AI response text into structured data
   * @param {string} responseText - Raw AI response
   * @returns {Object} Parsed part identification data
   */
  parseAIResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and normalize the response
        return {
          partName: parsed.partName || 'Unknown Part',
          partNumber: parsed.partNumber || 'N/A',
          appliance: parsed.appliance || 'Unknown Appliance',
          description: parsed.description || 'No description available',
          condition: parsed.condition || 'Unknown',
          commonIssues: Array.isArray(parsed.commonIssues) ? parsed.commonIssues : ['No common issues identified'],
          replacementDifficulty: parsed.replacementDifficulty || 'Medium',
          estimatedCost: parsed.estimatedCost || '$20-50',
          compatibility: parsed.compatibility || 'Check manufacturer specifications',
          confidence: parsed.confidence || 0.8,
          source: 'openai-vision',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
    }

    // Fallback: create structured response from text
    return {
      partName: 'AI-Identified Part',
      partNumber: 'N/A',
      appliance: 'Unknown Appliance',
      description: responseText.substring(0, 200) + '...',
      condition: 'Unknown',
      commonIssues: ['Analysis from AI response'],
      replacementDifficulty: 'Medium',
      estimatedCost: '$20-50',
      compatibility: 'Check manufacturer specifications',
      confidence: 0.7,
      source: 'openai-vision-fallback',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Returns demo/mock data for testing
   * @returns {Object} Mock part identification data
   */
  getDemoResult() {
    console.log('🎭 Using demo mode for part identification');
    
    return {
      partName: 'Dishwasher Door Seal',
      partNumber: 'WPW10300924',
      appliance: 'Dishwasher',
      description: 'This is the rubber door seal (also called a door gasket) that creates a watertight seal around the dishwasher door. It prevents water from leaking out during the wash cycle and helps maintain proper water pressure inside the dishwasher.',
      condition: 'Shows signs of wear and potential cracking',
      commonIssues: [
        'Cracking or tearing from age and use',
        'Mold or mildew buildup in folds',
        'Loss of flexibility causing leaks',
        'Food debris causing poor sealing'
      ],
      replacementDifficulty: 'Medium',
      estimatedCost: '$25-45',
      compatibility: 'Compatible with Whirlpool, KitchenAid, and Maytag dishwashers manufactured 2010-2020. Check your model number for exact compatibility.',
      confidence: 0.92,
      source: 'demo-mode',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gets supported image formats
   * @returns {Array} Array of supported MIME types
   */
  getSupportedFormats() {
    return [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
  }

  /**
   * Validates image format
   * @param {string} mimeType - MIME type of the image
   * @returns {boolean} Whether the format is supported
   */
  isFormatSupported(mimeType) {
    return this.getSupportedFormats().includes(mimeType.toLowerCase());
  }

  /**
   * Gets maximum image size in bytes
   * @returns {number} Maximum size in bytes
   */
  getMaxImageSize() {
    return 20 * 1024 * 1024; // 20MB
  }

  /**
   * Validates image size
   * @param {number} sizeInBytes - Size of the image in bytes
   * @returns {boolean} Whether the size is acceptable
   */
  isValidSize(sizeInBytes) {
    return sizeInBytes <= this.getMaxImageSize();
  }

  /**
   * Preprocesses image before analysis
   * @param {File} imageFile - Image file to preprocess
   * @returns {Promise<string>} Base64 encoded image data
   */
  async preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
      // Validate format
      if (!this.isFormatSupported(imageFile.type)) {
        reject(new Error(`Unsupported image format: ${imageFile.type}`));
        return;
      }

      // Validate size
      if (!this.isValidSize(imageFile.size)) {
        reject(new Error(`Image too large: ${imageFile.size} bytes (max: ${this.getMaxImageSize()})`));
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Gets service status and configuration
   * @returns {Object} Service status information
   */
  getStatus() {
    const openaiConfig = this.configService.getAPIConfig('openai');
    
    return {
      serviceName: 'Image Recognition Service',
      status: 'active',
      mode: this.configService.shouldUseRealAI() ? 'production' : 'demo',
      apiConfigured: !!openaiConfig.apiKey,
      supportedFormats: this.getSupportedFormats(),
      maxImageSize: this.getMaxImageSize(),
      model: openaiConfig.model,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const imageRecognitionService = new ImageRecognitionService();
export default imageRecognitionService;

