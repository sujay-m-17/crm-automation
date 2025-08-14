const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');

// Scrape website
router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const scrapedContent = await geminiService.scrapeWebsite(url);
    
    res.json({
      success: true,
      data: scrapedContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze company information
router.post('/analyze', async (req, res) => {
  try {
    const { companyData, scrapedContent } = req.body;
    
    if (!companyData) {
      return res.status(400).json({
        success: false,
        error: 'Company data is required'
      });
    }

    const analysis = await geminiService.analyzeCompany(companyData, scrapedContent || { text: '' });
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get geolocation information
router.post('/geolocation', async (req, res) => {
  try {
    const { companyData, scrapedContent } = req.body;
    
    if (!companyData) {
      return res.status(400).json({
        success: false,
        error: 'Company data is required'
      });
    }

    const geolocationInfo = await geminiService.getGeolocationInfo(companyData, scrapedContent || { text: '' });
    
    res.json({
      success: true,
      data: geolocationInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate complete brand overview
router.post('/brand-overview', async (req, res) => {
  try {
    const { companyData } = req.body;
    
    if (!companyData) {
      return res.status(400).json({
        success: false,
        error: 'Company data is required'
      });
    }

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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 