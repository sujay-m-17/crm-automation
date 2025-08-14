const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const zohoService = require('../services/zohoService');
const slackService = require('../services/slackService');
const axios = require('axios');

// Function to find company website using search
async function findCompanyWebsite(companyName) {
  try {
    // Try multiple search strategies
    const searchQueries = [
      `${companyName} official website`,
      `${companyName} company website`,
      `site:${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      `site:${companyName.toLowerCase().replace(/\s+/g, '')}.in`,
      `site:${companyName.toLowerCase().replace(/\s+/g, '')}.org`
    ];

    for (const query of searchQueries) {
      try {
        // Use a search API or scrape Google search results
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Extract URLs from search results (simplified approach)
        const html = response.data;
        const urlMatches = html.match(/https?:\/\/[^\s"<>]+/g);
        
        if (urlMatches) {
          // Filter for likely company websites
          const companyUrls = urlMatches.filter(url => {
            const domain = url.replace(/https?:\/\//, '').split('/')[0];
            return domain.includes(companyName.toLowerCase().replace(/\s+/g, '')) ||
                   domain.includes(companyName.toLowerCase().replace(/\s+/g, '-')) ||
                   !domain.includes('google.com') &&
                   !domain.includes('facebook.com') &&
                   !domain.includes('linkedin.com') &&
                   !domain.includes('twitter.com');
          });

          if (companyUrls.length > 0) {
            return companyUrls[0];
          }
        }
      } catch (error) {
        // Search query failed
      }
    }

    // Fallback: Try common domain patterns
    const commonDomains = [
      `${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      `${companyName.toLowerCase().replace(/\s+/g, '')}.in`,
      `${companyName.toLowerCase().replace(/\s+/g, '')}.org`,
      `www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      `www.${companyName.toLowerCase().replace(/\s+/g, '')}.in`
    ];

    for (const domain of commonDomains) {
      try {
        const testUrl = `https://${domain}`;
        const response = await axios.get(testUrl, {
          timeout: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.status === 200) {
          return testUrl;
        }
      } catch (error) {
        // Domain doesn't exist or is not accessible
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ Error finding company website: ${error.message}`);
    return null;
  }
}

// Webhook endpoint to capture lead data from Zoho CRM
router.post('/lead-created', async (req, res) => {
  try {
    console.log('🔔 Webhook received: Lead created');
    
    // Handle form-data from Zoho CRM
    let leadData = req.body;
    
    // Extract data from form-data fields
    const leadId = leadData.leadId || leadData.id || leadData.lead_id || leadData.resource_id || leadData.Lead_ID;
    const company = leadData.company || leadData.Company || leadData.company_name || leadData.Company_Name;
    let website = leadData.website || leadData.Website || leadData.website_url || leadData.Website_URL;

    console.log(`📊 Processing lead: ${company} (ID: ${leadId})`);

    // If website is not provided, try to find it
    if (company && !website) {
      try {
        website = await findCompanyWebsite(company);
        if (website) {
          console.log(`✅ Found website: ${website}`);
        }
      } catch (error) {
        console.error('❌ Error finding company website:', error.message);
      }
    }

    // Generate brand overview using Gemini AI
    if (company) {
      console.log(`🏢 Generating brand overview for: ${company}`);
      
      try {
        // Create company data structure for Gemini analysis
        const companyData = {
          name: company,
          website: website,
          id: leadId
        };

        // Generate brand overview using Gemini AI
        const brandOverview = await geminiService.generateBrandOverview(companyData);
        
        console.log('✅ Brand overview generated successfully');

        // Update the lead in Zoho CRM with brand overview
        const updateResult = await zohoService.updateLeadWithBrandOverview(leadId, brandOverview);



        // Return success response with brand overview and update confirmation
        res.json({
          success: true,
          message: 'Lead processed, brand overview generated and updated in Zoho CRM',
          data: {
            receivedAt: new Date().toISOString(),
            leadId,
            company,
            website,
            brandOverview: {
              analysis: brandOverview.analysis,
              geolocation: brandOverview.geolocation,
              scrapedContent: brandOverview.scrapedContent
            },
            zohoUpdate: updateResult
          }
        });

      } catch (error) {
        console.error('❌ Error generating brand overview:', error);
        
        // Check if this is a Gemini AI failure (empty/insufficient response)
        if (error.message?.includes('insufficient data') || 
            error.message?.includes('All AI models failed') ||
            error.message?.includes('Failed to analyze company with Gemini')) {
          
          // Send Slack notification only for AI failures
          await slackService.sendErrorNotification(error, {
            leadId,
            company,
            website,
            step: 'Gemini AI Analysis Failed'
          });
        }
        
        res.status(500).json({
          success: false,
          error: 'Failed to generate brand overview: ' + error.message
        });
      }
    } else {
      console.log('⚠️ Missing company or website data, skipping brand overview generation');
      
      // Return success response without brand overview
      res.json({
        success: true,
        message: 'Webhook received successfully (no brand overview - missing data)',
        data: {
          receivedAt: new Date().toISOString(),
          leadId,
          company,
          website,
          brandOverview: null
        }
      });
    }

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check for webhook
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;