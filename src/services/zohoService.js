const axios = require('axios');
const jwt = require('jsonwebtoken');
const slackService = require('./slackService');

class ZohoService {
  constructor() {
    this.baseURL = 'https://www.zohoapis.in/crm/v8';
    this.authURL = 'https://accounts.zoho.in/oauth/v2';
    this.accessToken = null;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.tokenExpiry = null;
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.authURL}/token`, null, {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        }
      });

      const { access_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.tokenExpiry = new Date(Date.now() + (expires_in * 1000));
      
      return { access_token, expires_in };
    } catch (error) {
      console.error('❌ Error refreshing access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  // Check if token needs refresh
  isTokenExpired() {
    if (!this.accessToken || !this.tokenExpiry) {
      return true;
    }
    
    // Refresh token 5 minutes before expiry
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return Date.now() > (this.tokenExpiry.getTime() - bufferTime);
  }

  // Get authenticated headers
  async getAuthHeaders() {
    // Check if token needs refresh
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    return {
      'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }



  // Validate access token
  async validateToken() {
    try {
      const headers = await this.getAuthHeaders();
      await axios.get(`${this.baseURL}/org`, { headers });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Update lead with brand overview
  async updateLeadWithBrandOverview(leadId, brandOverview) {
    try {
      const headers = await this.getAuthHeaders();
      
      // Validate brand overview data before mapping
      this.validateBrandOverviewData(brandOverview);
      
      // Map brand overview to Zoho CRM fields
      const fieldMappings = await this.mapBrandOverviewToFields(brandOverview);
      
      // Validate field mappings before sending to Zoho
      this.validateFieldMappings(fieldMappings);
      
      const updateData = {
        data: [
          {
            id: leadId,
            ...fieldMappings
          }
        ],
        skip_feature_execution: [
          {
            name: "cadences"
          }
        ]
      };

      // Get available fields from Zoho CRM to check field names
      try {
        const metadata = await this.getLeadMetadata();
        if (metadata && metadata.fields) {
          // Check which of our fields exist
          const fieldMappingsKeys = Object.keys(fieldMappings);
          const missingFields = fieldMappingsKeys.filter(key => 
            !metadata.fields.some(field => field.api_name === key)
          );
          if (missingFields.length > 0) {
            console.warn(`⚠️ Missing fields in Zoho CRM: ${missingFields.join(', ')}`);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch field metadata:', error.message);
      }

      const response = await axios.put(
        `${this.baseURL}/Leads/${leadId}`,
        updateData,
        { headers }
      );

      console.log(`✅ Lead ${leadId} updated successfully in Zoho CRM`);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating lead:', error.response?.data || error.message);
      
      // Send Slack notification for Zoho CRM update failure
      await slackService.sendErrorNotification(error, {
        leadId,
        step: 'Zoho CRM Update Failed'
      });
      
      throw new Error(`Failed to update lead: ${error.response?.data?.message || error.message}`);
    }
  }

  // Validate brand overview data structure
  validateBrandOverviewData(brandOverview) {
    if (!brandOverview) {
      throw new Error('Brand overview data is missing');
    }
    
    // Check if this is an insufficient data response
    if (brandOverview.insufficientData === true) {
      // BLOCK UPLOAD: Don't allow insufficient data to be uploaded to Zoho CRM
      throw new Error(`Cannot upload insufficient data to Zoho CRM: ${brandOverview.reason}`);
    }
    
    // Check if analysis data is missing or empty
    if (!brandOverview.analysis || Object.keys(brandOverview.analysis).length === 0) {
      throw new Error('Analysis data is missing or empty - cannot upload to Zoho CRM');
    }
    
    // Check if the analysis contains meaningful data (not just "Not available" fields)
    const analysis = brandOverview.analysis;
    const meaningfulFields = ['overview', 'mission', 'products', 'targetMarket', 'brandPositioning'];
    const hasMeaningfulData = meaningfulFields.some(field => {
      const value = analysis[field];
      return value && 
             value !== 'Not available' && 
             value !== 'Unknown' && 
             value !== 'Analysis completed' &&
             value !== 'Analysis completed with parsing issues' &&
             (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    });
    
    if (!hasMeaningfulData) {
      throw new Error('Analysis contains no meaningful data - cannot upload to Zoho CRM');
    }
    
    // Check if geolocation data is missing
    if (!brandOverview.geolocation) {
      console.warn('⚠️ Geolocation data is missing from brand overview');
    }
  }

  // Validate field mappings before sending to Zoho
  validateFieldMappings(fieldMappings) {
    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      throw new Error('No field mappings generated - cannot update Zoho CRM');
    }
    
    // Check for critical fields
    const criticalFields = ['Overview', 'Geographic_Presence'];
    const missingCriticalFields = criticalFields.filter(field => !fieldMappings[field]);
    
    if (missingCriticalFields.length > 0) {
      console.warn(`⚠️ Missing critical fields: ${missingCriticalFields.join(', ')}`);
    }
  }

  // Get lead metadata to check field names
  async getLeadMetadata() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${this.baseURL}/settings/fields?module=Leads`, { headers });
      return response.data;
    } catch (error) {
      console.error('❌ Error getting lead metadata:', error.response?.data || error.message);
      return null;
    }
  }

  // Map brand overview data to Zoho CRM fields
  async mapBrandOverviewToFields(brandOverview) {
    try {
      // Check if this is an insufficient data response
      if (brandOverview.insufficientData === true) {
        return {
          'Overview': 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL',
          'Product_Services': 'Please enter the correct company name and website URL',
          'Target_Market': 'Data not available - please verify company information',
          'Brand_Positioning': 'Unable to generate brand overview with current data',
          'Brand_Revenue': 'Not available - please provide correct company details',
          'Online_Revenue': 'Not available - please provide correct company details',
          'AOV': 'Not available - please provide correct company details',
          'Order_Volume': 'Not available - please provide correct company details',
          'Sales_Channels': 'Not available - please provide correct company details',
          'Company_Size': 'Not available - please provide correct company details',
          'Brand_Size_Scale': 'Not available - please provide correct company details',
          'Decision_Makers': 'Not available - please provide correct company details',
          'Marketing_Indicators': 'Not available - please provide correct company details',
          'Tech_Stack': 'Not available - please provide correct company details',
          'Marketing_Budget': 'Not available - please provide correct company details',
          'Geographic_Presence': 'Not available - please provide correct company details',
          'Recent_News_Updates': 'Not available - please provide correct company details',
          'Website_Traffic': 'Not available - please provide correct company details'
        };
      }
      
      const { analysis, geolocation } = brandOverview;
      
      // Extract the actual data from the Gemini response objects
      const analysisData = analysis.analysis || analysis.rawResponse || analysis;
      const geolocationData = geolocation.geolocationAnalysis || geolocation.rawResponse || geolocation;
      
      // Parse the JSON responses from Gemini (they come as strings with markdown)
      let parsedAnalysis, parsedGeolocation;
      
      try {
        if (typeof analysisData === 'string') {
          parsedAnalysis = JSON.parse(analysisData.replace(/```json\n|\n```/g, ''));
        } else {
          parsedAnalysis = analysisData;
        }
      } catch (error) {
        console.error('❌ Error parsing analysis data:', error.message);
        parsedAnalysis = { overview: 'Analysis parsing failed' };
      }
      
      try {
        if (typeof geolocationData === 'string') {
          parsedGeolocation = JSON.parse(geolocationData.replace(/```json\n|\n```/g, ''));
        } else {
          parsedGeolocation = geolocationData;
        }
      } catch (error) {
        console.error('❌ Error parsing geolocation data:', error.message);
        parsedGeolocation = { 
          headquarters: 'Not specified',
          serviceAreas: [],
          markets: []
        };
      }
      
      // Map to Zoho CRM fields
      const fieldMappings = {};
      
      // Overview
      if (parsedAnalysis.overview) {
        fieldMappings['Overview'] = parsedAnalysis.overview;
      }
      
      // Product & Services
      if (parsedAnalysis.products && parsedAnalysis.products.length > 0) {
        fieldMappings['Product_Services'] = parsedAnalysis.products.join('\n• ');
      }
      
      // Target Market
      if (parsedAnalysis.targetMarket) {
        fieldMappings['Target_Market'] = parsedAnalysis.targetMarket;
      }
      
      // Brand Positioning
      if (parsedAnalysis.brandPositioning) {
        fieldMappings['Brand_Positioning'] = parsedAnalysis.brandPositioning;
      }
      
      // Brand Revenue (if available in analysis)
      if (parsedAnalysis.revenue) {
        fieldMappings['Brand_Revenue'] = parsedAnalysis.revenue;
      }
      
      // Annual Revenue
      if (parsedAnalysis.annualRevenue) {
        fieldMappings['Brand_Revenue'] = parsedAnalysis.annualRevenue;
      }
      
      // Online Revenue/GMV
      if (parsedAnalysis.onlineRevenue) {
        fieldMappings['Online_Revenue'] = parsedAnalysis.onlineRevenue;
      }
      
      // AOV (Average Order Value)
      if (parsedAnalysis.aov) {
        fieldMappings['AOV'] = parsedAnalysis.aov;
      }
      
      // Order Volume
      if (parsedAnalysis.orderVolume) {
        fieldMappings['Order_Volume'] = parsedAnalysis.orderVolume;
      }
      
      // Sales Channels
      if (parsedAnalysis.salesChannels && parsedAnalysis.salesChannels.length > 0) {
        fieldMappings['Sales_Channels'] = parsedAnalysis.salesChannels.join(', ');
      }
      
      // Company Size
      if (parsedAnalysis.companySize) {
        fieldMappings['Company_Size'] = parsedAnalysis.companySize;
      }
      
      // Brand Size & Scale
      if (parsedAnalysis.brandSize || parsedAnalysis.companySize) {
        fieldMappings['Brand_Size_Scale'] = parsedAnalysis.brandSize || parsedAnalysis.companySize;
      }
      
      // Decision Makers
      if (parsedAnalysis.decisionMakers && parsedAnalysis.decisionMakers.length > 0) {
        fieldMappings['Decision_Makers'] = parsedAnalysis.decisionMakers.join(', ');
      }
      
      // Marketing Indicators
      if (parsedAnalysis.marketingIndicators) {
        fieldMappings['Marketing_Indicators'] = parsedAnalysis.marketingIndicators;
      }
      
      // Tech Stack
      if (parsedAnalysis.techStack && parsedAnalysis.techStack.length > 0) {
        fieldMappings['Tech_Stack'] = parsedAnalysis.techStack.join(', ');
      }
      
      // Marketing Budget - Calculate 5% of annual revenue
      if (parsedAnalysis.annualRevenue || parsedAnalysis.onlineRevenue) {
        const revenueValue = parsedAnalysis.annualRevenue || parsedAnalysis.onlineRevenue;
        
        // Extract numeric value from revenue string (handle billions, millions, crores, etc.)
        let revenueNumber = 0;
        let revenueSource = 'unknown';
        
        if (revenueValue.includes('billion')) {
          const match = revenueValue.match(/(\d+(?:\.\d+)?)\s*billion/i);
          if (match) {
            revenueNumber = parseFloat(match[1]) * 1000000000; // Convert to full number
            revenueSource = 'billion';
          }
        } else if (revenueValue.includes('million')) {
          const match = revenueValue.match(/(\d+(?:\.\d+)?)\s*million/i);
          if (match) {
            revenueNumber = parseFloat(match[1]) * 1000000; // Convert to full number
            revenueSource = 'million';
          }
        } else if (revenueValue.includes('crore') || revenueValue.includes('crores')) {
          const match = revenueValue.match(/(\d+(?:,\d+)?)\s*crore/i);
          if (match) {
            const croreValue = parseFloat(match[1].replace(/,/g, ''));
            revenueNumber = croreValue * 10000000; // 1 crore = 10 million
            revenueSource = 'crores';
          }
        } else if (revenueValue.includes('lakh') || revenueValue.includes('lakhs')) {
          const match = revenueValue.match(/(\d+(?:,\d+)?)\s*lakh/i);
          if (match) {
            const lakhValue = parseFloat(match[1].replace(/,/g, ''));
            revenueNumber = lakhValue * 100000; // 1 lakh = 100,000
            revenueSource = 'lakhs';
          }
        } else {
          // Try to extract just numbers (fallback)
          const revenueMatch = String(revenueValue).match(/[\d,]+/);
          if (revenueMatch) {
            revenueNumber = parseFloat(revenueMatch[0].replace(/,/g, ''));
            revenueSource = 'raw_number';
          }
        }
        
        if (revenueNumber > 0) {
          const marketingBudget = revenueNumber * 0.05; // 5% of revenue
          
          // Format the marketing budget with source information
          let budgetDisplay = `$${marketingBudget.toLocaleString()}`;
          
          // Add source information based on the revenue type
          if (revenueSource === 'crores') {
            const croreValue = revenueNumber / 10000000;
            budgetDisplay = `$${marketingBudget.toLocaleString()} (calculated from ₹${croreValue.toLocaleString()} crores revenue)`;
          } else if (revenueSource === 'lakhs') {
            const lakhValue = revenueNumber / 100000;
            budgetDisplay = `$${marketingBudget.toLocaleString()} (calculated from ₹${lakhValue.toLocaleString()} lakhs revenue)`;
          } else if (revenueSource === 'billion') {
            const billionValue = revenueNumber / 1000000000;
            budgetDisplay = `$${marketingBudget.toLocaleString()} (calculated from $${billionValue} billion revenue)`;
          } else if (revenueSource === 'million') {
            const millionValue = revenueNumber / 1000000;
            budgetDisplay = `$${marketingBudget.toLocaleString()} (calculated from $${millionValue} million revenue)`;
          } else {
            budgetDisplay = `$${marketingBudget.toLocaleString()} (calculated from ${revenueValue})`;
          }
          
          fieldMappings['Marketing_Budget'] = budgetDisplay;
        }
      } else if (parsedAnalysis.marketingBudget) {
        // If no revenue but marketing budget provided, use it directly
        fieldMappings['Marketing_Budget'] = parsedAnalysis.marketingBudget;
      }
      
      // Geographic Presence
      const geographicInfo = [];
      
      // Only add headquarters if it's specified and not generic
      if (parsedGeolocation.headquarters && 
          parsedGeolocation.headquarters !== 'Not specified' && 
          parsedGeolocation.headquarters !== 'Not specified in the provided text.' &&
          parsedGeolocation.headquarters !== 'Unknown' &&
          parsedGeolocation.headquarters !== 'N/A' &&
          parsedGeolocation.headquarters.trim() !== '') {
        geographicInfo.push(`Headquarters: ${parsedGeolocation.headquarters}`);
      }
      
      if (parsedGeolocation.serviceAreas && parsedGeolocation.serviceAreas.length > 0) {
        geographicInfo.push(`Service Areas: ${parsedGeolocation.serviceAreas.join(', ')}`);
      }
      
      if (parsedGeolocation.markets && parsedGeolocation.markets.length > 0) {
        geographicInfo.push(`Markets: ${parsedGeolocation.markets.join(', ')}`);
      }
      
      if (geographicInfo.length > 0) {
        fieldMappings['Geographic_Presence'] = geographicInfo.join('\n');
      } else {
        // Fallback: Set a default value if no geographic info is available
        fieldMappings['Geographic_Presence'] = 'Geographic information not available';
      }
      
      // Recent News & Updates
      if (parsedAnalysis.recentNews && parsedAnalysis.recentNews.length > 0) {
        fieldMappings['Recent_News_Updates'] = parsedAnalysis.recentNews.join('\n• ');
      }
      
      // Website Traffic
      if (parsedAnalysis.websiteTraffic) {
        // Clean up the traffic data to remove confidence and source info
        let cleanTrafficData = parsedAnalysis.websiteTraffic;
        
        // Remove confidence and source information from the display
        cleanTrafficData = cleanTrafficData.replace(/\(Source: [^)]+, Confidence: [^)]+\)/g, '');
        cleanTrafficData = cleanTrafficData.replace(/\(Confidence: [^)]+\)/g, '');
        cleanTrafficData = cleanTrafficData.replace(/Source: [^,]+/g, '');
        cleanTrafficData = cleanTrafficData.trim();
        
        fieldMappings['Website_Traffic'] = cleanTrafficData;
      }
      
      return fieldMappings;
    } catch (error) {
      console.error('❌ Error mapping brand overview to fields:', error.message);
      
      // Send Slack notification for field mapping failure
      await slackService.sendErrorNotification(error, {
        step: 'Field Mapping Failed'
      });
      
      // Fallback to simple mapping if parsing fails
      return {
        Overview: `Brand Overview Generated: ${new Date().toISOString()}`,
        'Recent_News_&_Updates': `Analysis: ${JSON.stringify(brandOverview.analysis, null, 2)}\n\nGeolocation: ${JSON.stringify(brandOverview.geolocation, null, 2)}`
      };
    }
  }


}

module.exports = new ZohoService(); 