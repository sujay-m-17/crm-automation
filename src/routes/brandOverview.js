const express = require('express');
const router = express.Router();
const zohoService = require('../services/zohoService');
const geminiService = require('../services/geminiService');

// Generate brand overview for a specific company
router.post('/generate/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Step 1: Get company data from Zoho CRM
    const companyData = await zohoService.getCompanyWithWebsite(companyId);
    
    if (!companyData) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Step 2: Generate brand overview using Gemini AI
    const brandOverview = await geminiService.generateBrandOverview(companyData);
    
    // Check if insufficient data was detected
    if (brandOverview.insufficientData === true) {
      return res.json({
        success: true,
        insufficientData: true,
        data: {
          company: brandOverview.company,
          reason: brandOverview.reason,
          suggestions: brandOverview.suggestions,
          message: brandOverview.message,
          overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL'
        }
      });
    }
    
    res.json({
      success: true,
      data: brandOverview
    });
  } catch (error) {
    console.error('Error generating brand overview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate brand overview for multiple companies
router.post('/generate-batch', async (req, res) => {
  try {
    const { companyIds } = req.body;
    
    if (!companyIds || !Array.isArray(companyIds)) {
      return res.status(400).json({
        success: false,
        error: 'Company IDs array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const companyId of companyIds) {
      try {
        const companyData = await zohoService.getCompanyWithWebsite(companyId);
        const brandOverview = await geminiService.generateBrandOverview(companyData);
        
        // Check if insufficient data was detected
        if (brandOverview.insufficientData === true) {
          results.push({
            companyId,
            insufficientData: true,
            company: brandOverview.company,
            reason: brandOverview.reason,
            suggestions: brandOverview.suggestions,
            message: brandOverview.message,
            overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL'
          });
        } else {
          results.push(brandOverview);
        }
      } catch (error) {
        errors.push({
          companyId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        errors,
        totalProcessed: companyIds.length,
        successful: results.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Error generating batch brand overviews:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update company with brand overview data
router.post('/update/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { updateFields } = req.body;
    
    // Get current company data
    const companyData = await zohoService.getCompanyWithWebsite(companyId);
    
    // Generate brand overview
    const brandOverview = await geminiService.generateBrandOverview(companyData);
    
    // Prepare update data
    const updateData = {
      id: companyId,
      ...updateFields
    };
    
    // Update company in Zoho CRM
    const updateResult = await zohoService.updateCompany(companyId, updateData);
    
    res.json({
      success: true,
      data: {
        brandOverview,
        updateResult
      }
    });
  } catch (error) {
    console.error('Error updating company with brand overview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get brand overview for companies with websites
router.get('/companies-with-websites', async (req, res) => {
  try {
    const { page = 1, per_page = 10 } = req.query;
    
    // Get companies from Zoho CRM
    const companies = await zohoService.getCompanies({
      page,
      per_page
    });
    
    // Filter companies with websites
    const companiesWithWebsites = companies.data?.filter(company => 
      company.Website && company.Website.trim() !== ''
    ) || [];
    
    res.json({
      success: true,
      data: {
        companies: companiesWithWebsites,
        total: companiesWithWebsites.length,
        page: parseInt(page),
        per_page: parseInt(per_page)
      }
    });
  } catch (error) {
    console.error('Error getting companies with websites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search and generate brand overview
router.post('/search-and-generate', async (req, res) => {
  try {
    const { searchTerm, searchField = 'Company_Name' } = req.body;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    // Search companies in Zoho CRM
    const searchResults = await zohoService.searchCompanies(searchTerm, searchField);
    
    if (!searchResults.data || searchResults.data.length === 0) {
      return res.json({
        success: true,
        data: {
          companies: [],
          brandOverviews: [],
          message: 'No companies found matching the search criteria'
        }
      });
    }

    // Generate brand overviews for found companies
    const brandOverviews = [];
    const errors = [];

    for (const company of searchResults.data) {
      try {
        const companyData = {
          id: company.id,
          name: company.Company_Name,
          website: company.Website,
          industry: company.Industry,
          description: company.Description
        };
        
        const brandOverview = await geminiService.generateBrandOverview(companyData);
        
        // Check if insufficient data was detected
        if (brandOverview.insufficientData === true) {
          brandOverviews.push({
            companyId: company.id,
            companyName: company.Company_Name,
            insufficientData: true,
            company: brandOverview.company,
            reason: brandOverview.reason,
            suggestions: brandOverview.suggestions,
            message: brandOverview.message,
            overview: 'DATA_NOT_FOUND_DUE_TO_INCORRECT_COMPANY_NAME_OR_WEBSITE_URL'
          });
        } else {
          brandOverviews.push(brandOverview);
        }
      } catch (error) {
        errors.push({
          companyId: company.id,
          companyName: company.Company_Name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        companies: searchResults.data,
        brandOverviews,
        errors,
        totalFound: searchResults.data.length,
        successful: brandOverviews.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Error searching and generating brand overviews:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 